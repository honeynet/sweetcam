const express = require('express');
const path = require('path');
const session = require('express-session');
const i18n = require('i18n');
const sweetcamServices = require('./services/sweetcam-services');
const userServices = require('./services/user-services');
const bcrypt = require('bcrypt');
const fs = require('fs');
const adminRouter = require('./controllers/admin');

const app = express();
let beginTimeOfLogin = 0;

//configure i18n
i18n.configure({
    locales: ['en', 'es'],
    defaultLocale: 'en',
    directory: path.join(__dirname, 'locales'),
    objectNotation: true,
    updateFiles: false,
    syncFiles: false
});

//middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'Wrong',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    name: 'sweetcam_session'
}));

// i18n middleware
app.use(i18n.init);

//language switching middleware
app.use((req, res, next) => {
    //set default locale if not set
    if (!req.session.locale) {
        req.session.locale = 'en';
    }
    
    //set locale for i18n
    req.setLocale(req.session.locale);
    
    //make locale available to templates
    res.locals.locale = req.session.locale;
    
    next();
});

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/config', express.static(path.join(__dirname, 'config')));

//health check endpoint
app.get('/health', async (req, res) => {
    try {
        //test database connection
        const sequelize = require('./database/database');
        await sequelize.authenticate();
        res.status(200).json({ 
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(503).json({ 
            status: 'unhealthy',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

//language switching route
app.get('/set-language/:lang', (req, res) => {
    const lang = req.params.lang;
    if (['en', 'es'].includes(lang)) {
        req.session.locale = lang;
    }
    res.redirect('back');
});

//helper function to get camera type based on port
function getCameraTypeByPort(port) {
    switch(port) {
        case 80: return 'hikvision';
        case 81: return 'vstarcam';
        case 37777: return 'dahua';
        case 443: return 'mobotix';
        case 10000: return 'axis';
        case 8081: return 'reolink';
        default: return 'hikvision';
    }
}

//authentication middleware
function requireAuth(req, res, next) {
    if (!req.session || !req.session.username) {
        return res.redirect('/login');
    }
    next();
}


//api endpoint to get images from public/images directory
app.get('/api/images', requireAuth, (req, res) => {

    const imagesDir = path.join(__dirname, 'public', 'images');
    try {
        const files = fs.readdirSync(imagesDir);
        const imageFiles = files.filter(file => { //filter out non-image files
            const ext = path.extname(file).toLowerCase();
            return ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext);
        });
        const imageUrls = imageFiles.map(file => `/images/${file}`);
        res.json(imageUrls);
    } catch (error) {
        console.error('Error reading images directory:', error);
        res.json([]);
    }
});

//api endpoint to get camera information
app.get('/api/camera-info', requireAuth, (req, res) => {
    const port = req.connection.server.address().port;
    const cameraType = getCameraTypeByPort(port);
    const config = sweetcamServices.getCameraConfig(cameraType);
    
    //add live status
    const cameraInfo = {
        ...config,
        status: "Online",
        uptime: "Live",
        lastRestart: new Date().toLocaleString()
    };
    
    res.json(cameraInfo);
});

//mount admin routes first (before main routes)
app.use('/', adminRouter);

//routes
app.get('/', requireAuth, (req, res) => {
    //get camera type from server port
    const port = req.connection.server.address().port;
    const cameraType = getCameraTypeByPort(port);
    const config = sweetcamServices.getCameraConfig(cameraType);
    res.render(cameraType, { 
        config: config, 
        userName: req.session.username,
        model: config.model,
        brand: config.brand,
        brandImagePath: config.brandImagePath,
        brandImageWidth: config.brandImageWidth,
        locale: req.session.locale || 'en'
    });
});

app.get('/login', (req, res) => {
    //if user is already logged in, redirect to home page
    if (req.session && req.session.username) {
        return res.redirect('/');
    }
    const port = req.connection.server.address().port;
    const cameraType = getCameraTypeByPort(port);
    const config = sweetcamServices.getCameraConfig(cameraType);
    res.render(`login-${cameraType}`, { 
        config: config,
        locale: req.session.locale || 'en'
    });
});

app.post('/login', async (req, res) => { //login endpoint
    try {
        let sess = req.session;
        if (!sess.loginTimes) {
            sess.loginTimes = 0;
            beginTimeOfLogin = Date.now();
        }
        const currentTime = Date.now();
        if (currentTime - beginTimeOfLogin <= 60000) { //check if login request is within 60 seconds
            sess.loginTimes += 1;
            if (sess.loginTimes > sweetcamServices.getLoginLimit()) {
                return res.status(403).send({ error: "Login request reached limit" });
            }
        } else {
            sess.loginTimes = 1;
            beginTimeOfLogin = currentTime;
        }

        const { username, password } = req.body;
        
        //validate input
        if (!username || !password) {
            return res.status(400).send({ error: "Username and password are required" });
        }
        
        const isValidPassword = await userServices.validateUserPassword(username, password);
        
        if (isValidPassword) {
            sess.username = username;
            return res.status(200).send({ message: "Login successful" });
        } else {
            const passwordHashes = await userServices.findUserPasswordHashesByName(username);
            if (!passwordHashes || passwordHashes.length === 0) {
                return res.status(404).send({ error: "User not found" });
            } else {
                return res.status(401).send({ error: "Wrong password" });
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        //check if it's a database connection error
        if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeHostNotFoundError') {
            return res.status(503).send({ error: "Database connection failed. Please try again later." });
        }
        return res.status(500).send({ error: "Internal server error. Please try again." });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

//start server on configurable port
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web service listening on port ${PORT}`);
});