const fs = require('fs')

const getCamPictureConfig = () => {
    const jsonString = fs.readFileSync("./config/cam-picture.json");
    return JSON.parse(jsonString);
}

const getCamVideoConfig = () => {
    const jsonString = fs.readFileSync("./config/cam-video.json");
    return JSON.parse(jsonString);
}

const getBrandConfig = () => {
    const jsonString = fs.readFileSync("./config/brand.json");
    return JSON.parse(jsonString);
}

const getMedium = () => {
    const jsonString = fs.readFileSync("./config/sweetcam.json");
    return JSON.parse(jsonString).medium;
}

const getLoginLimit = () => {
    const jsonString = fs.readFileSync("./config/sweetcam.json");
    return JSON.parse(jsonString).loginLimit;
}
//new function to load camera config based on CAMERA_TYPE
const getCameraConfig = () => {
    const cameraType = process.env.CAMERA_TYPE || 'hikvision';
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
