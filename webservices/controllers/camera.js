const cameraRouter = require('express').Router()
const sweetcamServices = require('../services/sweetcam-services')
const userServices = require('../services/user-services')
const bcrypt = require("bcrypt");

let beginTimeOfLogin = 0;

//serve dahua camera page
cameraRouter.get('/dahua', (req, res) => {
    const config = {
		...sweetcamServices.getCameraConfig(),
        userName: 'Guest'
    }
    res.render('dahua', config)
})

//serve hikvision camera page
cameraRouter.get('/hikvision', (req, res) => {
    const config = {
		...sweetcamServices.getCameraConfig(), 
        userName: 'Guest'
    }
    res.render('hikvision', config)
})

cameraRouter.get('/', (req, res) => {
    const medium = sweetcamServices.getMedium()
    if (medium === "video") {
        const config = {
            ...sweetcamServices.getCamVideoConfig(),
            ...sweetcamServices.getBrandConfig(),
            ...sweetcamServices.getCameraConfig(), 
            userName: req.session.username
        }
        res.render("video", config)
    }

    if (medium === "picture") {
        const config = {
            ...sweetcamServices.getCamPictureConfig(),
            ...sweetcamServices.getBrandConfig(),
            ...sweetcamServices.getCameraConfig(),
            userName: req.session.username
        }
        console.log(config)
        res.render("picture", config);
    }

})

cameraRouter.get('/login', (req, res) => {
    res.render("login", sweetcamServices.getBrandConfig())
})

cameraRouter.post('/login', async (req, res) => {
    let session = req.session;
    let loginLimit = sweetcamServices.getLoginLimit()
    if (!session.loginTimes) {
        session.loginTimes = 0;
        beginTimeOfLogin = Date.now()
    }

    const currentTime = Date.now()
    if (currentTime - beginTimeOfLogin <= 60_000) {
        session.loginTimes += 1;
        if (session.loginTimes > loginLimit) {
            return res.status(403).send({ error: "login request reached limit" })
        }
    } else {
        session.loginTimes = 1;
        beginTimeOfLogin = Date.now()
    }
    const username = req.body.username
    const password = req.body.password

    const passwordHash = await userServices.findUserPasswordHashByName(username);
    if (!passwordHash) {
        return res.status(404).send({ error: "user not found" })
    }
    if (await bcrypt.compare(password, passwordHash)) {
        session.username = username
        return res.status(200).send({ message: "succeed" })
    } else {
        return res.status(401).send({ error: "wrong password" })
    }
})

cameraRouter.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
})

module.exports = cameraRouter
