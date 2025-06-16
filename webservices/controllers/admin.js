const adminRouter = require('express').Router()
const adminServices = require('../services/admin-services')
const userServices = require('../services/user-services');
const sweetcamServices = require('../services/sweetcam-services')
const bcrypt = require("bcrypt")
const jwt = require('jsonwebtoken')
const jwtServices = require("../utils/jwt-services")
const telegramBot = require("../utils/telegram-bot")

const prefix = process.env.ADMIN_PATH

adminRouter.post(`/${prefix}/login`, async (req, res) => {
    const {username, password} = req.body

    if (!username || !password) {
        return res.status(400).send({error: 'username or password is null'}).end()
    }

    const {passwordHash, name, id} = await adminServices.findAdminCredentialsByName(username)
    if (await bcrypt.compare(password, passwordHash)) {
        const userForToken = {
            id: id,
            username: username
        }
        /* The token will be valid for 60 * 60 seconds */
        const token = jwt.sign(userForToken, process.env.JWT_SECRET, { expiresIn: 60 * 60 })
        res.status(200).send({ token, username })
    } else {
        /*const chatId = await adminServices.findChatIdByName(username)
        if (chatId) {
            await telegramBot.sendMessage(chatId, 'Attempt to login as admin failed')
        }*/
        adminServices.sendEmail("Attempt to login as admin failed");
        res.status(401).send({ error: 'failed' })
    }
})

adminRouter.patch(`/${prefix}/password`, async (req, res) => {
    const newPassword = req.body.newPassword

    if (!newPassword) {
        return res.status(400).send({error: 'provide new password is null'}).end()
    }
    const decodedToken = jwt.verify(jwtServices.getJWTToken(req), process.env.JWT_SECRET)
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

/**
 * Add user for the sweetcam service
 */
adminRouter.post(`/${prefix}/user`, async (req, res) => {
    const userInfo = req.body
    const savedUser = await userServices.addUser(userInfo.name, userInfo.password)
    res.status(201).json(savedUser)
})

/**
 * Revise the configuration for the sweetcam service in the picture model
 */
adminRouter.patch(`/${prefix}/config/cam-picture`, (req, res) => {
    const {name, value} = req.body
    adminServices.configCamPicture(name, value)
    res.status(200).send({ message: `${name} has been updated to ${value}` })
})

/**
 * Get the configuration for the sweetcam service in the picture model
 */
adminRouter.get(`/${prefix}/config/cam-picture`, (req, res) => {
    const camPictureConfig = sweetcamServices.getCamPictureConfig()
    res.json(camPictureConfig)
})

/**
 * Revise the configuration for the sweetcam service in the video model
 */
adminRouter.patch(`/${prefix}/cam-video`, (req, res) => {
    const {name, value} = req.body
    adminServices.configCamVideo(name, value)
    res.status(200).send({ message: `${name} has been updated to ${value}` })
})

/**
 * Get the configuration for the sweetcam service in the video model
 */
adminRouter.get(`/${prefix}/cam-video`, (req, res) => {
    const camVideoConfig = sweetcamServices.getCamVideoConfig()
    res.json(camVideoConfig)
})

/**
 * Upload brand image
 */
adminRouter.post(`/${prefix}/brands`, adminServices.uploadBrands, (req, res) => {
    const path = (req.file.path).split(/public/)[1]
    res.status(200).send({ message: 'Succeed', storedPath: path })
})

/**
 * Upload panoramic image
 */
adminRouter.post(`/${prefix}/images`, adminServices.uploadImages, (req, res) => {
    const path = (req.file.path).split(/public/)[1]
    res.status(200).send({ message: 'Succeed', storedPath: path })
})

/**
 * Upload panoramic video
 */
adminRouter.post(`/${prefix}/videos`, adminServices.uploadVideos, (req, res) => {
    const path = (req.file.path).split(/public/)[1]
    res.status(200).send({ message: 'Succeed', storedPath: path })
})

module.exports = adminRouter
