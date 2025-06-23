const express = require('express');
const path = require('path');
const session = require('express-session');
const sweetcamServices = require('./services/sweetcam-services');
const userServices = require('./services/user-services');
const bcrypt = require('bcrypt');
const fs = require('fs');

const app = express();
let beginTimeOfLogin = 0;

//middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'Wrong',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

//helper function to get camera type based on port
function getCameraTypeByPort(port) {
    switch(port) {
        case 80: return 'hikvision';
        case 37777: return 'dahua';
        case 443: return 'mobotix';
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

//routes
app.get('/', requireAuth, (req, res) => {
    //get camera type from the server port
    const port = req.connection.server.address().port;
    const cameraType = getCameraTypeByPort(port);
    const config = sweetcamServices.getCameraConfig(cameraType);
    res.render(cameraType, { 
        config: config, 
        userName: req.session.username,
        model: config.model,
        brand: config.brand,
        brandImagePath: config.brandImagePath,
        brandImageWidth: config.brandImageWidth
    });
});

app.get('/login', (req, res) => {
    //if user is already logged in, redirect to home
    if (req.session && req.session.username) {
        return res.redirect('/');
    }
    const port = req.connection.server.address().port;
    const cameraType = getCameraTypeByPort(port);
    const config = sweetcamServices.getCameraConfig(cameraType);
    res.render(`login-${cameraType}`, { config: config });
});

app.post('/login', async (req, res) => { //login endpoint
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
    const passwordHash = await userServices.findUserPasswordHashByName(username);
    if (!passwordHash) {
        return res.status(404).send({ error: "User not found" });
    }
    if (await bcrypt.compare(password, passwordHash)) {
        sess.username = username;
        return res.status(200).send({ message: "Login successful" });
    } else {
        return res.status(401).send({ error: "Wrong password" });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

//start servers on different ports
const ports = [80, 37777, 443];
const cameraTypes = ['hikvision', 'dahua', 'mobotix'];

ports.forEach((port, index) => {
    const server = app.listen(port, '0.0.0.0', () => {
        console.log(`${cameraTypes[index].charAt(0).toUpperCase() + cameraTypes[index].slice(1)} server running on port ${port}`);
    });
});
