const sequelize = require("../database/database");
const cameraProfile = require("../model/cameraProfile");

const CAMERA_TYPE_TO_VENDOR = {
    hikvision: "Hikvision",
    dahua: "Dahua",
    axis: "Axis",
    foscam: "Foscam",
    reolink: "Reolink",
    mobotix: "Mobotix",
    vstarcam: "VStarcam"
};

const getVendorForCameraType = (cameraType = "hikvision") => {
    return CAMERA_TYPE_TO_VENDOR[cameraType] || "Hikvision";
};

const normalizeProfile = (profile) => {
    if (!profile) return null;

    const plainProfile = profile.get ? profile.get({ plain: true }) : profile;

    let parsedPorts = plainProfile.ports;
    if (typeof parsedPorts === "string") {
        try {
            parsedPorts = JSON.parse(parsedPorts);
        } catch (error) {
            parsedPorts = [];
        }
    }

    return {
        ...plainProfile,
        ports: Array.isArray(parsedPorts) ? parsedPorts : [],
    };
};

const getRandomProfile = async () => {
    const profile = await cameraProfile.findOne({
        order: sequelize.random()
    });

    return normalizeProfile(profile);
};

const getRandomProfileByVendor = async (vendor) => {
    const profile = await cameraProfile.findOne({
        where: { vendor },
        order: sequelize.random()
    });

    return normalizeProfile(profile);
};

const getProfileForCameraType = async (cameraType = "hikvision") => {
    const vendor = getVendorForCameraType(cameraType);
    const profile = await getRandomProfileByVendor(vendor);
    console.log(`[PROFILE] cameraType=${cameraType}, vendor=${vendor}, profileId=${profile?.id}, model=${profile?.model}`);
    return profile;
};

const getProfileById = async (id) => {
    const profile = await cameraProfile.findByPk(id);
    return normalizeProfile(profile);
};

const getAllProfilesByVendor = async (vendor) => {
    const profiles = await cameraProfile.findAll({
        where: { vendor },
        order: [["id", "DESC"]]
    });

    return profiles.map(normalizeProfile);
};

module.exports = {
    getVendorForCameraType,
    getRandomProfile,
    getRandomProfileByVendor,
    getProfileForCameraType,
    getProfileById,
    getAllProfilesByVendor
};