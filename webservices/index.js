const express = require('express');
const path = require('path');
const session = require('express-session');
const i18n = require('i18n');
const sweetcamServices = require('./services/sweetcam-services');
const userServices = require('./services/user-services');
const bcrypt = require('bcrypt');
const fs = require('fs');
const adminRouter = require('./controllers/admin');
const { honeypotLogger } = require('./utils/logger');



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
        
        const cameraType = getCameraType(req);
        const port = process.env.PORT || req.connection.server.address().port;
        
        honeypotLogger.logServiceAccess(
            req.ip,
            req.method,
            req.url,
            res.statusCode,
            req.get('User-Agent'),
            cameraType,
            port,
            req.sessionID
        );
        
        res.status(200).json({ 
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Health check failed:', error);
        
        const cameraType = getCameraType(req);
        const port = process.env.PORT || req.connection.server.address().port;
        
        honeypotLogger.logError(error, 'health_check', req.sessionID);
        honeypotLogger.logServiceAccess(
            req.ip,
            req.method,
            req.url,
            res.statusCode,
            req.get('User-Agent'),
            cameraType,
            port,
            req.sessionID
        );
        
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
    const cameraType = getCameraType(req);
    const port = process.env.PORT || req.connection.server.address().port;
    
    honeypotLogger.logServiceAccess(
        req.ip,
        'GET',
        `/set-language/${lang}`,
        302,
        req.get('User-Agent'),
        cameraType,
        port
    );
    
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

//helper function to get camera type from environment or request
function getCameraType(req) {
    // Try to get port from environment first (more reliable in Docker)
    const envPort = process.env.PORT;
    if (envPort) {
        return getCameraTypeByPort(parseInt(envPort));
    }
    
    // Fallback to request port detection
    const port = req.connection.server.address().port;
    return getCameraTypeByPort(port);
}

//authentication middleware
function requireAuth(req, res, next) {
    if (!req.session || !req.session.username) {
        console.log('Auth failed: No session or username, redirecting to login');
        return res.redirect('/login');
    }
    console.log('Auth successful for user:', req.session.username);
    next();
}


//api endpoint to get images from public/images directory
app.get('/api/images', requireAuth, (req, res) => {
    const cameraType = getCameraType(req);
    const port = process.env.PORT || req.connection.server.address().port;
    
            honeypotLogger.logServiceAccess(
            req.ip,
            req.method,
            req.url,
            res.statusCode,
            req.get('User-Agent'),
            cameraType,
            port,
            req.sessionID
        );

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
        honeypotLogger.logError(error, 'api_images', req.sessionID);
        res.json([]);
    }
});

//api endpoint to get camera information
app.get('/api/camera-info', requireAuth, (req, res) => {
    const cameraType = getCameraType(req);
    const port = process.env.PORT || req.connection.server.address().port;
    const config = sweetcamServices.getCameraConfig(cameraType);
    
    honeypotLogger.logServiceAccess(
        req.ip,
        req.method,
        req.url,
        res.statusCode,
        req.get('User-Agent'),
        cameraType,
        port,
        req.sessionID
    );
    
    //add live status
    const cameraInfo = {
        ...config,
        status: "Online",
        uptime: "Live",
        lastRestart: new Date().toLocaleString()
    };
    
    res.json(cameraInfo);
});

//mount admin routes after main routes to avoid conflicts

//routes
app.get('/', requireAuth, (req, res) => {
    //get camera type from server port
    const cameraType = getCameraType(req);
    const port = process.env.PORT || req.connection.server.address().port;
    const config = sweetcamServices.getCameraConfig(cameraType);
    
    honeypotLogger.logServiceAccess(
        req.ip,
        req.method,
        req.url,
        res.statusCode,
        req.get('User-Agent'),
        cameraType,
        port,
        req.sessionID
    );
    
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
    const cameraType = getCameraType(req);
    const config = sweetcamServices.getCameraConfig(cameraType);
    const port = process.env.PORT || req.connection.server.address().port;
    
    honeypotLogger.logServiceAccess(
        req.ip,
        req.method,
        req.url,
        res.statusCode,
        req.get('User-Agent'),
        cameraType,
        port,
        req.sessionID
    );
    
    res.render(`login-${cameraType}`, { 
        config: config,
        locale: req.session.locale || 'en',
        isAdminMode: false
    });
});

app.get('/admin/login', (req, res) => {
    //if user is already logged in, redirect to home page
    if (req.session && req.session.username) {
        return res.redirect('/');
    }
    const cameraType = getCameraType(req);
    const config = sweetcamServices.getCameraConfig(cameraType);
    const port = process.env.PORT || req.connection.server.address().port;
    
    honeypotLogger.logServiceAccess(
        req.ip,
        'GET',
        '/admin/login',
        200,
        req.get('User-Agent'),
        cameraType,
        port
    );
    
    res.render(`login-${cameraType}`, { 
        config: config,
        locale: req.session.locale || 'en',
        isAdminMode: true
    });
});

app.post('/login', async (req, res) => { //login endpoint
    try {
        const cameraType = getCameraType(req);
        const port = process.env.PORT || req.connection.server.address().port;
        const { username, password } = req.body;
        
        let sess = req.session;
        if (!sess.loginTimes) {
            sess.loginTimes = 0;
            beginTimeOfLogin = Date.now();
        }
        const currentTime = Date.now();
        if (currentTime - beginTimeOfLogin <= 60000) { //check if login request is within 60 seconds
            sess.loginTimes += 1;
            if (sess.loginTimes > sweetcamServices.getLoginLimit()) {
                honeypotLogger.logSuspiciousActivity(
                    req.ip,
                    'login_rate_limit_exceeded',
                    `Login attempts: ${sess.loginTimes}`,
                    req.get('User-Agent'),
                    cameraType,
                    port
                );
                return res.status(403).send({ error: "Login request reached limit" });
            }
        } else {
            sess.loginTimes = 1;
            beginTimeOfLogin = currentTime;
        }

        //validate input
        if (!username || !password) {
            honeypotLogger.logAuthFailure(
                req.ip,
                username || 'unknown',
                'missing_credentials',
                req.get('User-Agent'),
                cameraType,
                port
            );
            return res.status(400).send({ error: "Username and password are required" });
        }
        
        const isValidPassword = await userServices.validateUserPassword(username, password);
        
        if (isValidPassword) {
            sess.username = username;
            honeypotLogger.logLoginAttempt(
                req.ip,
                username,
                true,
                req.get('User-Agent'),
                req.sessionID,
                cameraType,
                port,
                password
            );
            return res.status(200).send({ message: "Login successful" });
        } else {
            const passwordHashes = await userServices.findUserPasswordHashesByName(username);
            if (!passwordHashes || passwordHashes.length === 0) {
                            honeypotLogger.logAuthFailure(
                req.ip,
                username,
                'user_not_found',
                req.get('User-Agent'),
                cameraType,
                port,
                password,
                req.sessionID
            );
                return res.status(404).send({ error: "User not found" });
            } else {
                honeypotLogger.logAuthFailure(
                    req.ip,
                    username,
                    'wrong_password',
                    req.get('User-Agent'),
                    cameraType,
                    port,
                    password,
                    req.sessionID
                );
                return res.status(401).send({ error: "Wrong password" });
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        const cameraType = getCameraType(req);
        const port = process.env.PORT || req.connection.server.address().port;
        
        honeypotLogger.logError(error, 'login_endpoint', req.sessionID);
        
        //check if it's a database connection error
        if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeHostNotFoundError') {
            return res.status(503).send({ error: "Database connection failed. Please try again later." });
        }
        return res.status(500).send({ error: "Internal server error. Please try again." });
    }
});

app.post('/admin/login', async (req, res) => { //admin login endpoint
    try {
        const cameraType = getCameraType(req);
        const port = process.env.PORT || req.connection.server.address().port;
        const { username, password } = req.body;
        
        let sess = req.session;
        if (!sess.loginTimes) {
            sess.loginTimes = 0;
            beginTimeOfLogin = Date.now();
        }
        const currentTime = Date.now();
        if (currentTime - beginTimeOfLogin <= 60000) { //check if login request is within 60 seconds
            sess.loginTimes += 1;
            if (sess.loginTimes > sweetcamServices.getLoginLimit()) {
                honeypotLogger.logSuspiciousActivity(
                    req.ip,
                    'admin_login_rate_limit_exceeded',
                    `Admin login attempts: ${sess.loginTimes}`,
                    req.get('User-Agent'),
                    cameraType,
                    port,
                    req.sessionID
                );
                return res.status(403).send({ error: "Login request reached limit" });
            }
        } else {
            sess.loginTimes = 1;
            beginTimeOfLogin = currentTime;
        }

        //validate input
        if (!username || !password) {
            honeypotLogger.logAuthFailure(
                req.ip,
                username || 'unknown',
                'admin_missing_credentials',
                req.get('User-Agent'),
                cameraType,
                port,
                null,
                req.sessionID
            );
            return res.status(400).send({ error: "Username and password are required" });
        }
        
        //use admin services for admin authentication
        const adminServices = require('./services/admin-services');
        
        try {
            const isValidPassword = await adminServices.validateAdminPassword(username, password);
            
            if (isValidPassword) {
                sess.username = username;
                sess.isAdmin = true; //mark session as admin
                honeypotLogger.logLoginAttempt(
                    req.ip,
                    username,
                    true,
                    req.get('User-Agent'),
                    req.sessionID,
                    cameraType,
                    port,
                    password
                );
                return res.status(200).send({ message: "Admin login successful" });
            } else {
                //check if admin exists to determine if it's wrong password or admin not found
                try {
                    await adminServices.findAdminCredentialsByName(username);
                    //admin exists but password is wrong
                    honeypotLogger.logAuthFailure(
                        req.ip,
                        username,
                        'admin_wrong_password',
                        req.get('User-Agent'),
                        cameraType,
                        port,
                        password,
                        req.sessionID
                    );
                    return res.status(401).send({ error: "Wrong password" });
                } catch (error) {
                    //admin doesn't exist
                    honeypotLogger.logAuthFailure(
                        req.ip,
                        username,
                        'admin_not_found',
                        req.get('User-Agent'),
                        cameraType,
                        port,
                        password,
                        req.sessionID
                    );
                    return res.status(404).send({ error: "User not found" });
                }
            }
        } catch (error) {
            //handle any other errors from admin services
            console.error('Admin authentication error:', error);
            honeypotLogger.logAuthFailure(
                req.ip,
                username,
                'admin_authentication_error',
                req.get('User-Agent'),
                cameraType,
                port,
                null,
                req.sessionID
            );
            return res.status(500).send({ error: "Authentication error. Please try again." });
        }
    } catch (error) {
        console.error('Admin login error:', error);
        const cameraType = getCameraType(req);
        const port = process.env.PORT || req.connection.server.address().port;
        
        honeypotLogger.logError(error, 'admin_login_endpoint', req.sessionID);
        
        //check if it's a database connection error
        if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeHostNotFoundError') {
            return res.status(503).send({ error: "Database connection failed. Please try again later." });
        }
        return res.status(500).send({ error: "Internal server error. Please try again." });
    }
});

app.get('/logout', (req, res) => {
    const cameraType = getCameraType(req);
    const port = process.env.PORT || req.connection.server.address().port;
    
    honeypotLogger.logSessionEvent(
        req.ip,
        req.sessionID,
        'logout',
        req.session.username,
        cameraType,
        port
    );
    
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

//mount admin routes after main routes to avoid conflicts
app.use('/', adminRouter);

//start server on configurable port
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web service listening on port ${PORT}`);
  honeypotLogger.logServiceEvent('started', `Web service started on port ${PORT}`, null);
});