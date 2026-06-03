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

const PUBLIC_RTSP_HOST = process.env.PUBLIC_RTSP_HOST || process.env.RTSP_PUBLIC_HOST || "localhost";

const getPublicRtspPort = (cameraType, defaultPort) => {
    const normalizedType = String(cameraType || '').toUpperCase();
    const brandPort = process.env[`MEDIAMTX_${normalizedType}_RTSP_PORT`];
    const sharedPort = process.env.MEDIAMTX_PUBLIC_RTSP_PORT || process.env.PUBLIC_RTSP_PORT;
    const parsedPort = parseInt(brandPort || sharedPort, 10);

    return Number.isFinite(parsedPort) ? parsedPort : defaultPort;
};

const DEFAULT_RTSP_ENDPOINTS = {
    hikvision: { port: 8554, path: "/Streaming/Channels/101" },
    dahua: { port: 8555, path: "/cam/realmonitor?channel=1&subtype=0" },
    axis: { port: 8556, path: "/axis-media/media.amp" },
    reolink: { port: 8557, path: "/h264Preview_01_main" },
    mobotix: { port: 8558, path: "/control/faststream.jpg" },
    vstarcam: { port: 8559, path: "/videostream.cgi" },
    foscam: { port: 8560, path: "/videoMain" }
};

const getCameraTypeFromConfig = (config = {}, profile = {}) => {
    const brand = profile?.vendor || config.brand || "hikvision";
    return String(brand).toLowerCase();
};

const normalizeRtspPath = (rtspPath) => {
    if (!rtspPath) return null;
    return rtspPath.startsWith("/") ? rtspPath : `/${rtspPath}`;
};

const buildRtspAddress = (config, profile) => {
    if (config.rtspAddress) {
        return config.rtspAddress;
    }

    const cameraType = getCameraTypeFromConfig(config, profile);
    const endpoint = DEFAULT_RTSP_ENDPOINTS[cameraType] || DEFAULT_RTSP_ENDPOINTS.hikvision;
    const rtspPath = normalizeRtspPath(profile?.rtsp_path) || endpoint.path;

    const publicPort = getPublicRtspPort(cameraType, endpoint.port);

    return `rtsp://${PUBLIC_RTSP_HOST}:${publicPort}${rtspPath}`;
};

const mergeCameraConfig = (config, profile) => {
    const rtspAddress = buildRtspAddress(config, profile || config);

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
        rtspAddress,
        rtspPublicAddress: rtspAddress,
        videoPathMp4: config.videoPathMp4 || "/videos/camera-loop-720p15.mp4",
        videoPathWebm: config.videoPathWebm || null,
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
        rtspAddress: config.rtspAddress,
        rtspPublicAddress: config.rtspPublicAddress,

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
        videoPathMp4: config.videoPathMp4,
        videoPathWebm: config.videoPathWebm,
        brandImagePath: config.brandImagePath || "/brands/Hikvision.png",
        brandImageWidth: config.brandImageWidth || "30%",
        rtspAddress: config.rtspAddress,
        rtspPublicAddress: config.rtspPublicAddress,

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
        rtspAddress: config.rtspAddress,
        rtspPublicAddress: config.rtspPublicAddress,
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
