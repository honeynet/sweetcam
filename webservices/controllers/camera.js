const express = require('express');
const cameraRouter = express.Router();
const sweetcamServices = require('../services/sweetcam-services');
const userServices = require('../services/user-services');
const bcrypt = require('bcrypt');

let beginTimeOfLogin = 0;

//login page
cameraRouter.get('/login', (req, res) => {
    if (req.session.username) {
        return res.redirect('/');
    }
    res.render('login', sweetcamServices.getBrandConfig());
});

//login handler
cameraRouter.post('/login', async (req, res) => {
    let session = req.session;
    let loginLimit = sweetcamServices.getLoginLimit();
    
    if (!session.loginTimes) {
        session.loginTimes = 0;
        beginTimeOfLogin = Date.now();
    }

    const currentTime = Date.now();
    if (currentTime - beginTimeOfLogin <= 60000) {
        session.loginTimes += 1;
        if (session.loginTimes > loginLimit) {
            return res.status(403).send({ error: "Login request reached limit" });
        }
    } else {
        session.loginTimes = 1;
        beginTimeOfLogin = currentTime;
    }

    const { username, password } = req.body;
    
    const isValidPassword = await userServices.validateUserPassword(username, password);
    
    if (isValidPassword) {
        session.username = username;
        return res.status(200).send({ message: "Login successful" });
    } else {
        const passwordHashes = await userServices.findUserPasswordHashesByName(username);
        if (!passwordHashes || passwordHashes.length === 0) {
            return res.status(404).send({ error: "User not found" });
        } else {
            return res.status(401).send({ error: "Wrong password" });
        }
    }
});

cameraRouter.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

cameraRouter.get('/hikvision', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }
    const sweetcamServices = require('../services/sweetcam-services');
    const config = {
        ...sweetcamServices.getCameraConfig(),
        userName: req.session.username
    };
    res.render('hikvision', config);
});

module.exports = cameraRouter;
