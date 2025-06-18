const express = require('express');
const path = require('path');
const sweetcamServices = require('./services/sweetcam-services');

//create two separate Express apps
const dahuaApp = express();
const hikvisionApp = express();
const mobotixApp = express(); 

//common middleware setup
[dahuaApp, hikvisionApp, mobotixApp].forEach(app => {
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

//test route for mobotix
mobotixApp.get('/test', (req, res) => {
	res.send('Mobotix server is working!');
});

//dahua routes
dahuaApp.get('/', (req, res) => {
    try {
        console.log('Rendering Dahua page');
        const config = {
            ...sweetcamServices.getCameraConfig(),
            userName: 'Guest'
        }
        res.render('dahua', config);
    } catch (error) {
        console.error('Error rendering Dahua page:', error);
        res.status(500).send('Error rendering Dahua page');
    }
});

//hikvision routes
hikvisionApp.get('/', (req, res) => {
    try {
        console.log('Rendering Hikvision page');
        const config = {
            ...sweetcamServices.getCameraConfig(),
            userName: 'Guest'
        }
        res.render('hikvision', config);
    } catch (error) {
        console.error('Error rendering Hikvision page:', error);
        res.status(500).send('Error rendering Hikvision page');
    }
});

//mobotix routes
mobotixApp.get('/', (req, res) => {
    try {
        console.log('Rendering Mobotix page');
        const config = {
            ...sweetcamServices.getCameraConfig(),
            userName: 'Guest'
        }
        res.render('mobotix', config);
    } catch (error) {
        console.error('Error rendering Mobotix page:', error);
        res.status(500).send('Error rendering Mobotix page');
    }
});

//start Dahua server
const DAHUA_PORT = process.env.DAHUA_PORT || 3002;
dahuaApp.listen(DAHUA_PORT, '0.0.0.0', () => {
    console.log(`Dahua server running on port ${DAHUA_PORT}`);
});

//start Hikvision server
const HIKVISION_PORT = process.env.HIKVISION_PORT || 3001;
hikvisionApp.listen(HIKVISION_PORT, '0.0.0.0', () => {
    console.log(`Hikvision server running on port ${HIKVISION_PORT}`);
});

//start Mobotix server
const MOBOTIX_PORT = process.env.MOBOTIX_PORT || 3003;
mobotixApp.listen(MOBOTIX_PORT, '0.0.0.0', () => {
	console.log(`Mobotix server running on port ${MOBOTIX_PORT}` );
}); 
