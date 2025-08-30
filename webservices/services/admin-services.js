const fs = require('fs')
const multer = require('multer')
const bcrypt = require('bcrypt')
const transporter = require('../utils/nodemailer');
const sequelize = require('../database/database');

const getNumberOfAdmins = async () => {
    try {
        const [results] = await sequelize.query(
            'SELECT COUNT(*) as count FROM admins',
            {
                type: sequelize.QueryTypes.SELECT
            }
        );
        const number = results[0].count;
        console.log(number)
        return number
    } catch (error) {
        console.error('Error getting admin count:', error);
        throw error;
    }
}

const addAdmin = async (name, password, chatId) => {
    try {
        const saltRounds = 10
        const passwordHash = await bcrypt.hash(password, saltRounds)
        const [result] = await sequelize.query(
            'INSERT INTO admins (name, passwordHash, chatId) VALUES (?, ?, ?)',
            {
                replacements: [name, passwordHash, chatId],
                type: sequelize.QueryTypes.INSERT
            }
        );
        return result.insertId
    } catch (error) {
        console.error('Error adding admin:', error);
        throw error;
    }
}

const updatePassword = async (id, password) => {
    try {
        const saltRounds = 10
        const passwordHash = await bcrypt.hash(password, saltRounds)
        await sequelize.query(
            'UPDATE admins SET passwordHash = ? WHERE id = ?',
            {
                replacements: [passwordHash, id],
                type: sequelize.QueryTypes.UPDATE
            }
        );
    } catch (error) {
        console.error('Error updating admin password:', error);
        throw error;
    }
}

const findAdminCredentialsByName = async (name) => {
    try {
        const results = await sequelize.query(
            'SELECT name, id, passwordHash FROM admins WHERE name = ?',
            {
                replacements: [name],
                type: sequelize.QueryTypes.SELECT
            }
        );
        if (results.length === 0) {
            throw new Error('Admin not found');
        }
        return results[0];
    } catch (error) {
        console.error('Error finding admin credentials:', error);
        throw error;
    }
}

const findAdminPasswordHashesByName = async (name) => {
    try {
        const results = await sequelize.query(
            'SELECT passwordHash FROM admins WHERE name = ?',
            {
                replacements: [name],
                type: sequelize.QueryTypes.SELECT
            }
        );
        return results.map(result => result.passwordHash);
    } catch (error) {
        console.error('Error finding admin password hashes:', error);
        throw error;
    }
}

const validateAdminPassword = async (username, password) => {
    try {
        const passwordHashes = await findAdminPasswordHashesByName(username);
        if (!passwordHashes || passwordHashes.length === 0) {
            return false;
        }
        
        for (const hash of passwordHashes) {
            if (await bcrypt.compare(password, hash)) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error validating admin password:', error);
        throw error;
    }
}

const findChatIdByName = async (name) => {
    try {
        const results = await sequelize.query(
            'SELECT chatId FROM admins WHERE name = ?',
            {
                replacements: [name],
                type: sequelize.QueryTypes.SELECT
            }
        );
        return results.length > 0 ? results[0].chatId : null;
    } catch (error) {
        console.error('Error finding chat ID:', error);
        throw error;
    }
}

const configCamPicture = (name, value) => {
    const jsonString = fs.readFileSync("./config/cam-picture.json")
    let camPictureConfig = JSON.parse(jsonString)
    camPictureConfig[name] = value
    fs.writeFileSync('./config/cam-picture.json', JSON.stringify(camPictureConfig, null, 4))
}

const configCamVideo = (name, value) => {
    const jsonString = fs.readFileSync("./config/cam-video.json")
    let camPictureConfig = JSON.parse(jsonString)
    camPictureConfig[name] = value
    fs.writeFileSync('./config/cam-video.json', JSON.stringify(camPictureConfig, null, 4))
}

const configSweetCam = (name, value) => {
    const jsonString = fs.readFileSync("./config/sweetcam.json")
    let camPictureConfig = JSON.parse(jsonString)
    camPictureConfig[name] = value
    fs.writeFileSync('./config/sweetcam.json', JSON.stringify(camPictureConfig, null, 4))
}

const brandStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/brands')
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    }
})

const uploadBrands = multer({storage: brandStorage}).single('image')

const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/images')
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    }
})

const uploadImages = multer({storage: imageStorage}).single('image')

const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/videos')
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    }
})

const uploadVideos = multer({storage: videoStorage}).single('video')

const sendEmail = (message) => {
    const sendHtml = `<p>${message}</p>`;
    const mailOptions = {
        from: process.env.EMAIL_ADDRESS || 'default@example.com',
        to: process.env.EMAIL_ADDRESS_TARGET || 'default@example.com',
        subject: 'Sweetcam Notification',
        html: sendHtml
    };
    transporter.sendMail(mailOptions)
}

module.exports = {
    getNumberOfAdmins,
    addAdmin,
    findAdminCredentialsByName,
    findAdminPasswordHashesByName,
    validateAdminPassword,
    findChatIdByName,
    configCamPicture,
    configCamVideo,
    configSweetCam,
    updatePassword,
    uploadBrands,
    uploadImages,
    uploadVideos,
    sendEmail
}