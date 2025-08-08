const adminRouter = require('express').Router()
const adminServices = require('../services/admin-services')
const userServices = require('../services/user-services');
const sweetcamServices = require('../services/sweetcam-services')
const rtspManagement = require('../services/rtsp-management')
const onvifManagement = require('../services/onvif-management')
const { requireAdminAuth } = require('../utils/admin-auth')
const bcrypt = require("bcrypt")
const jwt = require('jsonwebtoken')
const jwtServices = require("../utils/jwt-services")
const telegramBot = require("../utils/telegram-bot")

const prefix = process.env.ADMIN_PATH || 'admin'

console.log('Admin router initialized with prefix:', prefix);

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

// RTSP Management endpoints
adminRouter.get(`/${prefix}/rtsp/status`, requireAdminAuth, async (req, res) => {
    try {
        const statuses = await rtspManagement.getAllServicesStatus();
        res.json(statuses);
    } catch (error) {
        console.error('Error getting RTSP status:', error);
        res.status(500).json({ error: 'Failed to get RTSP status' });
    }
});

adminRouter.get(`/${prefix}/rtsp/ports`, requireAdminAuth, async (req, res) => {
    try {
        const ports = rtspManagement.getCurrentPortsForFrontend();
        res.json(ports);
    } catch (error) {
        console.error('Error getting RTSP ports:', error);
        res.status(500).json({ error: 'Failed to get RTSP ports' });
    }
});

adminRouter.post(`/${prefix}/rtsp/toggle/:serviceName`, requireAdminAuth, async (req, res) => {
    try {
        const { serviceName } = req.params;
        const { honeypotLogger } = require('../utils/logger');
        
        // Get current status before toggle
        const currentStatus = await rtspManagement.getServiceStatus(serviceName);
        const previousStatus = currentStatus.running ? 'Running' : 'Stopped';
        
        const result = await rtspManagement.toggleService(serviceName);
        
        // Get new status after toggle
        const newStatus = result.success ? (previousStatus === 'Running' ? 'Stopped' : 'Running') : previousStatus;
        
        // Log the RTSP toggle action
        honeypotLogger.logRTSPServiceToggle(
            req.ip,
            serviceName,
            'toggle',
            previousStatus,
            newStatus,
            req.get('User-Agent'),
            'admin',
            process.env.PORT || req.connection.server.address().port
        );
        
        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.status(500).json({ success: false, message: result.message });
        }
    } catch (error) {
        console.error('Error toggling RTSP service:', error);
        res.status(500).json({ error: 'Failed to toggle RTSP service' });
    }
});

adminRouter.get(`/${prefix}/rtsp/service/:port`, requireAdminAuth, async (req, res) => {
    try {
        const { port } = req.params;
        const serviceName = rtspManagement.getServiceByPort(port);
        
        if (!serviceName) {
            return res.status(404).json({ error: 'Service not found for port' });
        }
        
        const status = await rtspManagement.getServiceStatus(serviceName);
        res.json({ serviceName, port: parseInt(port), ...status });
    } catch (error) {
        console.error('Error getting service status:', error);
        res.status(500).json({ error: 'Failed to get service status' });
    }
});

// ONVIF Management endpoints
adminRouter.get(`/${prefix}/onvif/status`, requireAdminAuth, async (req, res) => {
    try {
        console.log('ONVIF status request from user:', req.session.username);
        const statuses = await onvifManagement.getAllServicesStatus();
        res.json(statuses);
    } catch (error) {
        console.error('Error getting ONVIF status:', error);
        res.status(500).json({ error: 'Failed to get ONVIF status' });
    }
});

adminRouter.get(`/${prefix}/onvif/ports`, requireAdminAuth, async (req, res) => {
    try {
        const ports = onvifManagement.getCurrentPortsForFrontend();
        res.json(ports);
    } catch (error) {
        console.error('Error getting ONVIF ports:', error);
        res.status(500).json({ error: 'Failed to get ONVIF ports' });
    }
});

adminRouter.post(`/${prefix}/onvif/toggle/:serviceName`, requireAdminAuth, async (req, res) => {
    try {
        const { serviceName } = req.params;
        console.log('ONVIF toggle request for service:', serviceName, 'from user:', req.session.username);
        const { honeypotLogger } = require('../utils/logger');
        
        // Get current status before toggle
        const currentStatus = await onvifManagement.getServiceStatus(serviceName);
        const previousStatus = currentStatus.running ? 'Running' : 'Stopped';
        
        const result = await onvifManagement.toggleService(serviceName);
        
        // Get new status after toggle
        const newStatus = result.success ? (previousStatus === 'Running' ? 'Stopped' : 'Running') : previousStatus;
        
        // Log the ONVIF toggle action
        honeypotLogger.logONVIFServiceToggle(
            req.ip,
            serviceName,
            'toggle',
            previousStatus,
            newStatus,
            req.get('User-Agent'),
            'admin',
            process.env.PORT || req.connection.server.address().port
        );
        
        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.status(500).json({ success: false, message: result.message });
        }
    } catch (error) {
        console.error('Error toggling ONVIF service:', error);
        res.status(500).json({ error: 'Failed to toggle ONVIF service' });
    }
});

adminRouter.get(`/${prefix}/onvif/service/:port`, requireAdminAuth, async (req, res) => {
    try {
        const { port } = req.params;
        const serviceName = onvifManagement.getServiceByPort(port);
        
        if (!serviceName) {
            return res.status(404).json({ error: 'Service not found for port' });
        }
        
        const status = await onvifManagement.getServiceStatus(serviceName);
        res.json({ serviceName, port: parseInt(port), ...status });
    } catch (error) {
        console.error('Error getting service status:', error);
        res.status(500).json({ error: 'Failed to get service status' });
    }
});

module.exports = adminRouter
