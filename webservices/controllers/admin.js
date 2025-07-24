const adminRouter = require('express').Router()
const adminServices = require('../services/admin-services')
const userServices = require('../services/user-services');
const sweetcamServices = require('../services/sweetcam-services')
const bcrypt = require("bcrypt")
const jwt = require('jsonwebtoken')
const jwtServices = require("../utils/jwt-services")
const telegramBot = require("../utils/telegram-bot")

const prefix = process.env.ADMIN_PATH || 'admin'

console.log('Admin router initialized with prefix:', prefix);

//admin login page
adminRouter.get(`/${prefix}/login`, (req, res) => {
    res.render('admin-login', {
        title: 'Admin Login',
        error: null
    });
});

adminRouter.post(`/${prefix}/login`, async (req, res) => {
    const {username, password} = req.body

    if (!username || !password) {
        return res.status(400).send({error: 'username or password is null'}).end()
    }

    try {
        //check if admin exists and password is valid
        const isValidPassword = await adminServices.validateAdminPassword(username, password);
        
        if (isValidPassword) {
            //set up session for admin user
            req.session.username = username;
            
            //get admin credentials for token generation
            const {passwordHash, name, id} = await adminServices.findAdminCredentialsByName(username)
            const userForToken = {
                id: id,
                username: username
            }
            const token = jwt.sign(userForToken, process.env.JWT_SECRET || 'default-secret-key', { expiresIn: 60 * 60 })
            res.status(200).send({ token, username })
        } else {
           
            adminServices.sendEmail("Attempt to login as admin failed");
            res.status(401).send({ error: 'failed' })
        }
    } catch (error) {
        console.error('Admin login error:', error);
        if (error.message === 'Admin not found') {
            res.status(404).send({ error: 'Admin not found' })
        } else {
            res.status(500).send({ error: 'Internal server error' })
        }
    }
})

adminRouter.patch(`/${prefix}/password`, async (req, res) => {
    const newPassword = req.body.newPassword

    if (!newPassword) {
        return res.status(400).send({error: 'provide new password is null'}).end()
    }
    const decodedToken = jwt.verify(jwtServices.getJWTToken(req), process.env.JWT_SECRET || 'default-secret-key')
    const id = decodedToken.id
    await adminServices.updatePassword(id, newPassword)
    return res.status(200).send({message: "password update succeed"}).end()
})

adminRouter.get(`/${prefix}/picture`, (req, res) => {
    const config = {
        ...sweetcamServices.getCamPictureConfig(),
        ...sweetcamServices.getBrandConfig(),
        userName: "admin"
    }
    res.render("picture", config);
})


adminRouter.get(`/${prefix}/video`, (req, res) => {
    const config = {
        ...sweetcamServices.getCamVideoConfig(),
        ...sweetcamServices.getBrandConfig(),
        userName: "admin"
    }
    res.render("video", config)
})


adminRouter.post(`/${prefix}/user`, async (req, res) => {
    const userInfo = req.body
    const savedUser = await userServices.addUser(userInfo.name, userInfo.password)
    res.status(201).json(savedUser)
})

adminRouter.patch(`/${prefix}/config/cam-picture`, (req, res) => {
    const {name, value} = req.body
    adminServices.configCamPicture(name, value)
    res.status(200).send({ message: `${name} has been updated to ${value}` })
})

adminRouter.get(`/${prefix}/config/cam-picture`, (req, res) => {
    const camPictureConfig = sweetcamServices.getCamPictureConfig()
    res.json(camPictureConfig)
})


adminRouter.patch(`/${prefix}/cam-video`, (req, res) => {
    const {name, value} = req.body
    adminServices.configCamVideo(name, value)
    res.status(200).send({ message: `${name} has been updated to ${value}` })
})

adminRouter.get(`/${prefix}/cam-video`, (req, res) => {
    const camVideoConfig = sweetcamServices.getCamVideoConfig()
    res.json(camVideoConfig)
})


adminRouter.post(`/${prefix}/brands`, adminServices.uploadBrands, (req, res) => {
    res.status(200).send({ message: "Brand uploaded successfully" })
})


adminRouter.post(`/${prefix}/images`, adminServices.uploadImages, (req, res) => {
    res.status(200).send({ message: "Image uploaded successfully" })
})

adminRouter.post(`/${prefix}/videos`, adminServices.uploadVideos, (req, res) => {
    res.status(200).send({ message: "Video uploaded successfully" })
})

module.exports = adminRouter
