const express = require('express');
const path = require('path');
const sweetcamServices = require('./services/sweetcam-services');

//create two separate Express apps
const dahuaApp = express();
const hikvisionApp = express();

//common middleware setup
[dahuaApp, hikvisionApp].forEach(app => {
    app.set('view engine', 'pug');
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));
    app.use(express.static(path.join(__dirname, 'public')));
    
    //error handling
    app.use((err, req, res, next) => {
        console.error('Error:', err);
        res.status(500).send('Something broke!');
    });
    
    //request logging
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
        next();
    });
});

//test route for dahua
dahuaApp.get('/test', (req, res) => {
    res.send('Dahua server is working!');
});

//test route for hikvision
hikvisionApp.get('/test', (req, res) => {
    res.send('Hikvision server is working!');
});

// Dahua routes
dahuaApp.get('/', (req, res) => {
    try {
        console.log('Rendering Dahua page');
        const config = {
            ...sweetcamServices.getCameraConfig(),
            rtspAddress: process.env.DAHUA_RTSP_ADDRESS || 'rtsp://admin:admin@192.168.1.65:554/Streaming/Channels/101',
            userName: 'Guest'
        }
        res.render('dahua', config);
    } catch (error) {
        console.error('Error rendering Dahua page:', error);
        res.status(500).send('Error rendering Dahua page');
    }
});

// Hikvision routes
hikvisionApp.get('/', (req, res) => {
    try {
        console.log('Rendering Hikvision page');
        const config = {
            ...sweetcamServices.getCameraConfig(),
            rtspAddress: process.env.HIKVISION_RTSP_ADDRESS || 'rtsp://admin:admin@192.168.1.64:554/Streaming/Channels/101',
            userName: 'Guest'
        }
        res.render('hikvision', config);
    } catch (error) {
        console.error('Error rendering Hikvision page:', error);
        res.status(500).send('Error rendering Hikvision page');
    }
});

// Start Dahua server
const DAHUA_PORT = process.env.DAHUA_PORT || 3002;
dahuaApp.listen(DAHUA_PORT, '0.0.0.0', () => {
    console.log(`Dahua server running on port ${DAHUA_PORT}`);
    console.log(`Test Dahua server at http://localhost:${DAHUA_PORT}/test`);
});

// Start Hikvision server
const HIKVISION_PORT = process.env.HIKVISION_PORT || 3001;
hikvisionApp.listen(HIKVISION_PORT, '0.0.0.0', () => {
    console.log(`Hikvision server running on port ${HIKVISION_PORT}`);
    console.log(`Test Hikvision server at http://localhost:${HIKVISION_PORT}/test`);
});
