const fs = require('fs')

// Extract picture config from camera-specific config
const getCamPictureConfig = (cameraType = 'hikvision') => {
    const config = getCameraConfig(cameraType);
    return {
        timeout: config.timeout || 1000,
        xRotationAngle: config.xRotationAngle || 10,
        yRotationAngle: config.yRotationAngle || 10,
        width: config.width || 0.3,
        height: config.height || 0.3,
        zoomRatio: config.zoomRatio || 83,
        imgPath: "/images/img.png",
        rtspAddress: config.rtspAddress || "rtsp://public_ip:554/mystream"
    };
}

// Extract video config from camera-specific config
const getCamVideoConfig = (cameraType = 'hikvision') => {
    const config = getCameraConfig(cameraType);
    return {
        timeout: config.timeout || 1000,
        xRotationAngle: config.xRotationAngle || 10,
        yRotationAngle: config.yRotationAngle || 10,
        width: config.width || 0.3,
        height: config.height || 0.3,
        videoPathMp4: "/videos/jfk.mp4",
        videoPathWebm: "/videos/jfk.webm",
        brandImagePath: config.brandImagePath || "/brands/Hikvision.png",
        brandImageWidth: config.brandImageWidth || "30%",
        rtspAddress: config.rtspAddress || "rtsp://public_ip:554/mystream"
    };
}

// Extract brand config from camera-specific config
const getBrandConfig = (cameraType = 'hikvision') => {
    const config = getCameraConfig(cameraType);
    return {
        brandImagePath: config.brandImagePath || "/brands/Hikvision.png",
        brandImageWidth: config.brandImageWidth || "30%",
        brand: config.brand || "Hikvision",
        model: config.model || "DS-2CD2T47G1-L"
    };
}

const getMedium = () => {
    const jsonString = fs.readFileSync("./config/sweetcam.json");
    return JSON.parse(jsonString).medium;
}

const getLoginLimit = () => {
    const jsonString = fs.readFileSync("./config/sweetcam.json");
    return JSON.parse(jsonString).loginLimit;
}

// Load camera config based on CAMERA_TYPE
const getCameraConfig = (cameraType) => {
    const configPath = `./config/${cameraType}.json`;
    if (fs.existsSync(configPath)) {
        const jsonString = fs.readFileSync(configPath);
        return JSON.parse(jsonString);
    } else {
        console.error(`config file ${configPath} not found`);
        return {};
    }
}

module.exports = { getCamPictureConfig, getCamVideoConfig, getBrandConfig, getMedium, getLoginLimit, getCameraConfig }
