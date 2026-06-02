const express = require('express');
const path = require('path');
const session = require('express-session');
const i18n = require('i18n');
const sweetcamServices = require('./services/sweetcam-services');
const userServices = require('./services/user-services');
const databaseLogger = require('./utils/database-logger');
const sequelize = require('./database/database');
const bcrypt = require('bcrypt');
const fs = require('fs');
const adminRouter = require('./controllers/admin');
const { honeypotLogger } = require('./utils/logger');
const { startCowrieIngestor } = require('./services/cowrie-ingestor');


const app = express();
let beginTimeOfLogin = 0;

app.disable('x-powered-by');
app.disable('etag');

const SESSION_COOKIE_NAMES = {
    hikvision: 'WebSession',
    dahua: 'DWebClientSession',
    axis: 'axis_session',
    reolink: 'rl_session',
    mobotix: 'mx_session',
    vstarcam: 'vstar_session',
    foscam: 'foscam_session'
};

const getSessionCookieName = () => {
    const brand = String(process.env.BRAND || '').trim().toLowerCase();
    return process.env.SESSION_COOKIE_NAME || SESSION_COOKIE_NAMES[brand] || 'web_session';
};

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
app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    next();
});

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
    name: getSessionCookieName()
}));



// i18n middleware
app.use(i18n.init);

//language switching middleware
app.use((req, res, next) => {
    const currentLocale = req.session?.locale || 'en';
    
    //set locale for i18n
    req.setLocale(currentLocale);
    
    //make locale available to templates
    res.locals.locale = currentLocale;
    
    next();
});

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const processedRequests = new Map();

app.use((req, res, next) => {
    const originalSend = res.send;
    const originalJson = res.json;
    
    const requestKey = `${req.ip}-${req.method}-${req.url}-${Date.now()}`;
    
    let requestPayload = {
        body: req.body && Object.keys(req.body).length > 0 ? req.body : null,
        query: req.query && Object.keys(req.query).length > 0 ? req.query : null,
        params: req.params && Object.keys(req.params).length > 0 ? req.params : null,
        contentType: req.get('Content-Type'),
        contentLength: req.get('Content-Length'),
        url: req.url,
        originalUrl: req.originalUrl,
        method: req.method,
        headers: req.headers
    };
    
    const logRequest = (responsePayload) => {
        if (processedRequests.has(requestKey)) {
            console.log(`[DEBUG] Request ${requestKey} already processed, skipping duplicate`);
            return; 
        }
        
        console.log(`[DEBUG] Processing request ${requestKey} for ${req.method} ${req.url}`);
        
        processedRequests.set(requestKey, true);
        
        try {
            const cameraType = typeof getCameraType === 'function' ? getCameraType(req) : 'unknown';
            const port = process.env.PORT || (req.connection && req.connection.server ? req.connection.server.address().port : 80);
            
            honeypotLogger.logHTTPRequest(
                req.ip,
                req.method,
                req.url,
                res.statusCode,
                req.get('User-Agent'),
                cameraType,
                port,
                req.sessionID,
                requestPayload,
                responsePayload
            );
            
            console.log(`[DEBUG] Request ${requestKey} processed successfully`);
            
            if (processedRequests.size > 1000) {
                const firstKey = processedRequests.keys().next().value;
                processedRequests.delete(firstKey);
            }
        } catch (error) {
            console.error('Error in payload logging middleware:', error.message);
        }
    };
    
    res.send = function(data) {
        const responsePayload = {
            headers: res.getHeaders(),
            body: data
        };
        
        console.log(`[DEBUG] res.send called for request ${requestKey}`);
        logRequest(responsePayload);
        return originalSend.call(this, data);
    };
    
    res.json = function(data) {
        const responsePayload = {
            headers: res.getHeaders(),
            body: data
        };
        
        console.log(`[DEBUG] res.json called for request ${requestKey}`);
        logRequest(responsePayload);
        return originalJson.call(this, data);
    };
    
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/config', express.static(path.join(__dirname, 'config')));

const MEDIA_ACTION_TO_METHOD = {
    publish: 'ANNOUNCE',
    read: 'PLAY',
    playback: 'PLAY'
};

const parseBrandList = (value = '') => new Set(
    String(value || '')
        .split(',')
        .map(brand => brand.trim().toLowerCase())
        .filter(Boolean)
);

const NO_AUTH_RTSP_BRANDS = parseBrandList(process.env.NO_AUTH_RTSP_BRANDS);
const NO_AUTH_WEB_BRANDS = parseBrandList(process.env.NO_AUTH_WEB_BRANDS);

const MEDIAMTX_PUBLIC_RTSP_PORT = parseInt(process.env.MEDIAMTX_PUBLIC_RTSP_PORT, 10) || 8554;
const BRAND_TO_PUBLIC_RTSP_PORT = {
    hikvision: parseInt(process.env.MEDIAMTX_HIKVISION_RTSP_PORT, 10) || 8554,
    dahua: parseInt(process.env.MEDIAMTX_DAHUA_RTSP_PORT, 10) || 8555,
    axis: parseInt(process.env.MEDIAMTX_AXIS_RTSP_PORT, 10) || 8556,
    reolink: parseInt(process.env.MEDIAMTX_REOLINK_RTSP_PORT, 10) || 8557,
    mobotix: parseInt(process.env.MEDIAMTX_MOBOTIX_RTSP_PORT, 10) || 8558,
    vstarcam: parseInt(process.env.MEDIAMTX_VSTARCAM_RTSP_PORT, 10) || 8559,
    foscam: parseInt(process.env.MEDIAMTX_FOSCAM_RTSP_PORT, 10) || 8560
};

const isPrivateAddress = (ip = '') => {
    const normalizedIp = ip.replace(/^::ffff:/, '');
    return normalizedIp === '127.0.0.1' ||
        normalizedIp === '::1' ||
        normalizedIp.startsWith('10.') ||
        normalizedIp.startsWith('172.') ||
        normalizedIp.startsWith('192.168.');
};

const normalizeMediaPath = (mediaPath = '') => {
    const pathOnly = String(mediaPath || '').split('?')[0].replace(/\/trackID=\d+$/, '');
    const withSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
    return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
};

const getBrandForRtspPath = async (mediaPath) => {
    const normalizedPath = normalizeMediaPath(mediaPath);
    const lowerPath = normalizedPath.toLowerCase();

    try {
        const matches = await sequelize.query(
            `SELECT vendor FROM camera_profiles
             WHERE SUBSTRING_INDEX(rtsp_path, CHAR(63), 1) = ?
             ORDER BY id DESC
             LIMIT 1`,
            {
                replacements: [normalizedPath],
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (matches.length > 0 && matches[0].vendor) {
            return String(matches[0].vendor).toLowerCase();
        }
    } catch (error) {
        console.error('[MediaMTX Auth] Failed to resolve camera profile:', error.message);
    }

    if (lowerPath.includes('dahua') || lowerPath.includes('realmonitor')) {
        return 'dahua';
    }
    if (lowerPath.includes('axis')) {
        return 'axis';
    }
    if (lowerPath.includes('reolink') || lowerPath.includes('h264preview')) {
        return 'reolink';
    }
    if (lowerPath.includes('mobotix') || lowerPath.includes('faststream') || lowerPath.includes('/control/')) {
        return 'mobotix';
    }
    if (lowerPath.includes('vstarcam') || lowerPath.includes('videostream')) {
        return 'vstarcam';
    }
    if (lowerPath.includes('foscam') || lowerPath.includes('videomain') || lowerPath.includes('videosub')) {
        return 'foscam';
    }

    return 'hikvision';
};

const getPublicRtspPortForBrand = (brand) => {
    return BRAND_TO_PUBLIC_RTSP_PORT[String(brand || '').toLowerCase()] || MEDIAMTX_PUBLIC_RTSP_PORT;
};

const isNoAuthRtspBrand = (brand) => {
    return NO_AUTH_RTSP_BRANDS.has(String(brand || '').toLowerCase());
};

const isNoAuthWebBrand = (brand) => {
    return NO_AUTH_WEB_BRANDS.has(String(brand || '').toLowerCase());
};

const logMediaMtxAuth = async ({ body, statusCode, brand, success, reason }) => {
    const mediaPath = normalizeMediaPath(body.path || '');
    const action = body.action || 'unknown';
    const rtspMethod = MEDIA_ACTION_TO_METHOD[action] || action.toUpperCase();

    try {
        await databaseLogger.writeRTSPLog({
            event_type: action === 'publish' ? 'media_publish' : 'auth_attempt',
            log_level: success ? 'info' : 'warn',
            ip_address: body.ip || null,
            brand,
            port: getPublicRtspPortForBrand(brand),
            username: body.user || null,
            password: body.password || null,
            session_id: body.id || null,
            rtsp_method: rtspMethod,
            stream_path: mediaPath,
            connection_id: body.id || null,
            message: `MediaMTX ${action} ${success ? 'allowed' : 'rejected'} for ${mediaPath || '(no path)'}`,
            payload: {
                protocol: body.protocol,
                action,
                path: body.path,
                query: body.query,
                reason,
                statusCode
            },
            raw_data: body
        });
    } catch (error) {
        console.error('[MediaMTX Auth] Failed to write RTSP log:', error.message);
    }
};

app.post('/api/mediamtx/auth', async (req, res) => {
    const body = req.body || {};
    const action = body.action || '';
    const brand = await getBrandForRtspPath(body.path);

    if (action === 'publish') {
        const allowed = isPrivateAddress(body.ip);
        await logMediaMtxAuth({
            body,
            statusCode: allowed ? 200 : 403,
            brand,
            success: allowed,
            reason: allowed ? 'internal publisher' : 'publisher ip rejected'
        });

        return res.sendStatus(allowed ? 200 : 403);
    }

    if (action === 'read' || action === 'playback') {
        if (isNoAuthRtspBrand(brand)) {
            await logMediaMtxAuth({
                body,
                statusCode: 200,
                brand,
                success: true,
                reason: 'public no-auth camera'
            });

            return res.sendStatus(200);
        }

        if (!body.user || !body.password) {
            await logMediaMtxAuth({
                body,
                statusCode: 401,
                brand,
                success: false,
                reason: 'missing credentials'
            });

            return res.sendStatus(401);
        }

        const validCredentials = await userServices.validateUserPassword(body.user, body.password);
        await logMediaMtxAuth({
            body,
            statusCode: validCredentials ? 200 : 401,
            brand,
            success: validCredentials,
            reason: validCredentials ? 'valid credentials' : 'invalid credentials'
        });

        return res.sendStatus(validCredentials ? 200 : 401);
    }

    await logMediaMtxAuth({
        body,
        statusCode: 403,
        brand,
        success: false,
        reason: `unsupported action: ${action || 'unknown'}`
    });

    return res.sendStatus(403);
});

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

//database status endpoint
app.get('/db-status', async (req, res) => {
    try {
        const databaseLogger = require('./utils/database-logger');
        const poolStatus = databaseLogger.getPoolStatus();
        const healthCheck = await databaseLogger.healthCheck();
        
        res.status(200).json({
            status: 'success',
            pool_status: poolStatus,
            health_check: healthCheck,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Database status check failed:', error);
        res.status(500).json({
            status: 'error',
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
    const envPort = process.env.PORT;
    if (envPort) {
        return getCameraTypeByPort(parseInt(envPort));
    }
    
    const port = req.connection.server.address().port;
    return getCameraTypeByPort(port);
}

//authentication middleware
function requireAuth(req, res, next) {
    const cameraType = getCameraType(req);

    if (isNoAuthWebBrand(cameraType)) {
        if (!req.session.username) {
            req.session.username = process.env.PUBLIC_VIEWER_USERNAME || 'guest';
            req.session.isPublicViewer = true;
            req.session.isAdmin = false;
        }

        console.log(`Public no-auth web access allowed for ${cameraType}`);
        return next();
    }

    if (!req.session || !req.session.username) {
        console.log('Auth failed: No session or username, redirecting to login');
        return res.redirect('/login');
    }
    console.log('Auth successful for user:', req.session.username);
    next();
}

function requireCameraStreamAccess(req, res, next) {
    const cameraType = getCameraType(req);

    if (isNoAuthWebBrand(cameraType)) {
        return next();
    }

    return requireAuth(req, res, next);
}

let cachedMjpegFrames = null;

function getMjpegFrames() {
    if (cachedMjpegFrames) {
        return cachedMjpegFrames;
    }

    const framesDir = path.join(__dirname, 'public', 'mjpg');
    const fallbackFrames = [
        path.join(__dirname, 'public', 'images', 'test.jpg'),
        path.join(__dirname, 'public', 'images', 'mini.jpg')
    ];

    try {
        const frameFiles = fs.readdirSync(framesDir)
            .filter(file => /\.(jpe?g)$/i.test(file))
            .sort()
            .map(file => path.join(framesDir, file));

        cachedMjpegFrames = frameFiles.length > 0 ? frameFiles : fallbackFrames;
    } catch (error) {
        cachedMjpegFrames = fallbackFrames;
    }

    return cachedMjpegFrames.filter(framePath => fs.existsSync(framePath));
}

function getLatestMjpegFrame() {
    const frames = getMjpegFrames();
    if (frames.length === 0) return null;

    const index = Math.floor(Date.now() / 500) % frames.length;
    return frames[index];
}

function sendJpegSnapshot(req, res) {
    const framePath = getLatestMjpegFrame();
    if (!framePath) {
        return res.status(404).send('No image source available');
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Connection', 'close');
    return res.sendFile(framePath);
}

function streamMjpeg(req, res) {
    const frames = getMjpegFrames();
    if (frames.length === 0) {
        return res.status(404).send('No MJPEG source available');
    }

    const boundary = 'sweetcam-mjpeg-boundary';
    let frameIndex = 0;

    res.writeHead(200, {
        'Content-Type': `multipart/x-mixed-replace; boundary=${boundary}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Connection': 'close'
    });

    const sendFrame = () => {
        if (res.destroyed || res.writableEnded) return;

        const framePath = frames[frameIndex % frames.length];
        frameIndex += 1;

        fs.readFile(framePath, (error, frame) => {
            if (error || res.destroyed || res.writableEnded) return;

            res.write(`--${boundary}\r\n`);
            res.write('Content-Type: image/jpeg\r\n');
            res.write(`Content-Length: ${frame.length}\r\n\r\n`);
            res.write(frame);
            res.write('\r\n');
        });
    };

    sendFrame();
    const interval = setInterval(sendFrame, 500);

    req.on('close', () => {
        clearInterval(interval);
    });
}

const mjpegStreamPaths = [
    '/cgi-bin/mjpg/video.cgi',
    '/axis-cgi/mjpg/video.cgi',
    '/mjpg/video.mjpg'
];

const jpegSnapshotPaths = [
    '/cgi-bin/snapshot.cgi',
    '/axis-cgi/jpg/image.cgi'
];

mjpegStreamPaths.forEach(routePath => {
    app.get(routePath, requireCameraStreamAccess, streamMjpeg);
});

jpegSnapshotPaths.forEach(routePath => {
    app.get(routePath, requireCameraStreamAccess, sendJpegSnapshot);
});


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
app.get('/api/camera-info', requireAuth, async (req, res) => {
    try {
        const cameraType = getCameraType(req);
        const port = process.env.PORT || req.connection.server.address().port;
        const config = await sweetcamServices.getMergedCameraConfig(cameraType);

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

        const cameraInfo = {
            ...config,
            firmwareVersion: config.firmware || "N/A",
            ipAddress: config.ipAddress || "N/A",
            macAddress: config.macAddress || "N/A",
            status: config.status || "Online",
            uptime: config.uptime || "Live",
            lastRestart: config.lastRestart || new Date().toLocaleString()
        };

        res.json(cameraInfo);
    } catch (error) {
        console.error('Error loading camera info:', error);
        honeypotLogger.logError(error, 'api_camera_info', req.sessionID);
        res.status(500).json({ error: 'Failed to load camera info' });
    }
});

//mount admin routes after main routes to avoid conflicts

//routes
app.get('/', requireAuth, async (req, res) => {
    try {
        const cameraType = getCameraType(req);
        const port = process.env.PORT || req.connection.server.address().port;
        const config = await sweetcamServices.getMergedCameraConfig(cameraType);

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
            firmware: config.firmware,
            resolution: config.resolution,
            frame_rate: config.frame_rate,
            video_mode: config.video_mode,
            compression: config.compression,
            videoPathMp4: config.videoPathMp4,
            videoPathWebm: config.videoPathWebm,
            rtspAddress: config.rtspAddress,
            rtspPublicAddress: config.rtspPublicAddress,
            status: config.status,
            locale: req.session.locale || 'en',
            isAdmin: req.session.isAdmin || false
        });
    } catch (error) {
        console.error('Error rendering main camera page:', error);
        honeypotLogger.logError(error, 'main_page_render', req.sessionID);
        res.status(500).send('Failed to load camera page');
    }
});

app.get('/login', async (req, res) => {
    if (req.session && req.session.username) {
        return res.redirect('/');
    }

    try {
        const cameraType = getCameraType(req);
        const config = await sweetcamServices.getMergedCameraConfig(cameraType);
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
    } catch (error) {
        console.error('Error rendering login page:', error);
        honeypotLogger.logError(error, 'login_page_render', req.sessionID);
        res.status(500).send('Failed to load login page');
    }
});

app.get('/admin/login', async (req, res) => {
    if (req.session && req.session.username) {
        return res.redirect('/');
    }

    try {
        const cameraType = getCameraType(req);
        const config = await sweetcamServices.getMergedCameraConfig(cameraType);
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
    } catch (error) {
        console.error('Error rendering admin login page:', error);
        honeypotLogger.logError(error, 'admin_login_page_render', req.sessionID);
        res.status(500).send('Failed to load admin login page');
    }
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
                honeypotLogger.logError(
                    new Error('Login rate limit exceeded'),
                    'login_rate_limit_exceeded',
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
            await honeypotLogger.logAuthFailure(
                req.ip,
                username || 'unknown',
                'missing_credentials',
                req.get('User-Agent'),
                cameraType,
                port,
                null,
                req.sessionID,
                req.method,
                req.url,
                400
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
                            await honeypotLogger.logAuthFailure(
                req.ip,
                username,
                'user_not_found',
                req.get('User-Agent'),
                cameraType,
                port,
                password,
                req.sessionID,
                req.method,
                req.url,
                404
            );
                return res.status(404).send({ error: "User not found" });
            } else {
                await honeypotLogger.logAuthFailure(
                    req.ip,
                    username,
                    'wrong_password',
                    req.get('User-Agent'),
                    cameraType,
                port,
                    password,
                    req.sessionID,
                    req.method,
                    req.url,
                    401
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
                honeypotLogger.logError(
                    new Error('Admin login rate limit exceeded'),
                    'admin_login_rate_limit_exceeded',
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
            await honeypotLogger.logAuthFailure(
                req.ip,
                username || 'unknown',
                'admin_missing_credentials',
                req.get('User-Agent'),
                cameraType,
                port,
                null,
                req.sessionID,
                req.method,
                req.url,
                400
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
                    await honeypotLogger.logAuthFailure(
                        req.ip,
                        username,
                        'admin_wrong_password',
                        req.get('User-Agent'),
                        cameraType,
                        port,
                        password,
                        req.sessionID,
                        req.method,
                        req.url,
                        401
                    );
                    return res.status(401).send({ error: "Wrong password" });
                } catch (error) {
                    //admin doesn't exist
                    await honeypotLogger.logAuthFailure(
                        req.ip,
                        username,
                        'admin_not_found',
                        req.get('User-Agent'),
                        cameraType,
                        port,
                        password,
                        req.sessionID,
                        req.method,
                        req.url,
                        404
                    );
                    return res.status(404).send({ error: "User not found" });
                }
            }
        } catch (error) {
            //handle any other errors from admin services
            console.error('Admin authentication error:', error);
            await honeypotLogger.logAuthFailure(
                req.ip,
                username,
                'admin_authentication_error',
                req.get('User-Agent'),
                cameraType,
                port,
                null,
                req.sessionID,
                req.method,
                req.url,
                500
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
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web service listening on port ${PORT}`);
  honeypotLogger.logServiceEvent('started', `Web service started on port ${PORT}`, null);
  // Start Cowrie ingestor (non-blocking)
  try {
    const enabled = String(process.env.COWRIE_INGESTOR_ENABLED || '').toLowerCase();
    if (enabled === 'true' || enabled === '1') {
      startCowrieIngestor();
    } else {
      console.log('[COWRIE_INGESTOR] Disabled by environment flag');
    }
  } catch (e) {
    console.error('[COWRIE_INGESTOR] Failed to start:', e.message);
  }
});

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  try {
    // Close database connections
    const sequelize = require('./database/database');
    const databaseLogger = require('./utils/database-logger');
    
    await sequelize.close();
    await databaseLogger.close();
    
    // Close server
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  
  try {
    // Close database connections
    const sequelize = require('./database/database');
    const databaseLogger = require('./utils/database-logger');
    
    await sequelize.close();
    await databaseLogger.close();
    
    // Close server
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
});
