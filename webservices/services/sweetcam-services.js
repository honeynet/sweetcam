const fs = require('fs');
const path = require('path');
const cameraProfileService = require('./cameraProfileService');

const getCameraConfig = (cameraType) => {
    const configPath = path.join(__dirname, `../config/${cameraType}.json`);

    if (fs.existsSync(configPath)) {
        const jsonString = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(jsonString);
    } else {
        console.error(`config file ${configPath} not found`);
        return {};
    }
};

const getMedium = () => {
    const jsonString = fs.readFileSync(path.join(__dirname, "../config/sweetcam.json"), 'utf8');
    return JSON.parse(jsonString).medium;
};

const getLoginLimit = () => {
    const jsonString = fs.readFileSync(path.join(__dirname, "../config/sweetcam.json"), 'utf8');
    return JSON.parse(jsonString).loginLimit;
};

const buildRtspAddress = (config, profile) => {
    if (profile?.rtsp_path) {
        const base = config.rtspAddress || "rtsp://public_ip:554";
        const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
        const normalizedPath = profile.rtsp_path.startsWith("/")
            ? profile.rtsp_path
            : `/${profile.rtsp_path}`;

        return `${normalizedBase}${normalizedPath}`;
    }

    return config.rtspAddress || "rtsp://public_ip:554/mystream";
};

const mergeCameraConfig = (config, profile) => {
    return {
        // UI/static brand config
        ...config,

        // dynamic metadata from DB profile(fallback to static config)
        brand: profile?.vendor || config.brand || "Hikvision",
        model: profile?.model || config.model || "DS-2CD2T47G1-L",
        firmware: profile?.firmware || "N/A",
        server: profile?.server || "N/A",
        ports: profile?.ports || [],
        rtsp_path: profile?.rtsp_path || null,
        resolution: profile?.resolution || config.resolution || "N/A",
        frame_rate: profile?.frame_rate || "N/A",
        video_mode: profile?.video_mode || (
            profile?.resolution && profile?.frame_rate
                ? `${profile.resolution}@${profile.frame_rate}`
                : "N/A"
        ),
        compression: profile?.compression || config?.specifications?.compression || "N/A",
        status: profile?.status || "Online",

        specifications: {
            ...(config.specifications || {}),
            fps: profile?.frame_rate || config?.specifications?.fps || "N/A",
            compression: profile?.compression || config?.specifications?.compression || "N/A"
        }
    };
};

const getMergedCameraConfig = async (cameraType = 'hikvision') => {
    const config = getCameraConfig(cameraType);
    const profile = await cameraProfileService.getProfileForCameraType(cameraType);

    return mergeCameraConfig(config, profile);
};

const getCamPictureConfig = async (cameraType = 'hikvision') => {
    const config = await getMergedCameraConfig(cameraType);

    return {
        timeout: config.timeout || 1000,
        xRotationAngle: config.xRotationAngle || 10,
        yRotationAngle: config.yRotationAngle || 10,
        width: config.width || 0.3,
        height: config.height || 0.3,
        zoomRatio: config.zoomRatio || 83,
        imgPath: "/images/img.png",
        rtspAddress: buildRtspAddress(config, config),

        brandImagePath: config.brandImagePath || "/brands/Hikvision.png",
        brandImageWidth: config.brandImageWidth || "30%",
        brand: config.brand,
        model: config.model,
        firmware: config.firmware,
        server: config.server,
        ports: config.ports,
        resolution: config.resolution,
        frame_rate: config.frame_rate,
        video_mode: config.video_mode,
        compression: config.compression,
        status: config.status,
        specifications: config.specifications,
        features: config.features || {}
    };
};

const getCamVideoConfig = async (cameraType = 'hikvision') => {
    const config = await getMergedCameraConfig(cameraType);

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
        rtspAddress: buildRtspAddress(config, config),

        brand: config.brand,
        model: config.model,
        firmware: config.firmware,
        server: config.server,
        ports: config.ports,
        resolution: config.resolution,
        frame_rate: config.frame_rate,
        video_mode: config.video_mode,
        compression: config.compression,
        status: config.status,
        specifications: config.specifications,
        features: config.features || {}
    };
};

const getBrandConfig = async (cameraType = 'hikvision') => {
    const config = await getMergedCameraConfig(cameraType);

    return {
        brandImagePath: config.brandImagePath || "/brands/Hikvision.png",
        brandImageWidth: config.brandImageWidth || "30%",
        brand: config.brand,
        model: config.model,
        firmware: config.firmware,
        server: config.server,
        ports: config.ports,
        rtsp_path: config.rtsp_path,
        resolution: config.resolution,
        frame_rate: config.frame_rate,
        video_mode: config.video_mode,
        compression: config.compression,
        status: config.status,
        type: config.type || "IP Camera",
        specifications: config.specifications,
        features: config.features || {}
    };
};

module.exports = {
    getCamPictureConfig,
    getCamVideoConfig,
    getBrandConfig,
    getMedium,
    getLoginLimit,
    getCameraConfig,
    getMergedCameraConfig
};