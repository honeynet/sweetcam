const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mysql = require("mysql2/promise");

// Database configuration
const baseDbConfig = {
  host: process.env.DB_HOST || "mysql_service",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sweetcam",
};

// Load camera profile data
function loadCameraData() {
  const dataPath = path.join(__dirname, "data", "cameraProfiles.json");

  if (!fs.existsSync(dataPath)) {
    throw new Error(`cameraProfiles.json not found at: ${dataPath}`);
  }

  const raw = fs.readFileSync(dataPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("cameraProfiles.json is empty or invalid.");
  }

  return parsed;
}

const CAMERA_DATA = loadCameraData();

// Utility functions
function randomChoice(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("randomChoice received an empty or invalid array.");
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

function maybeNull(value, probability = 0.1) {
  return Math.random() < probability ? null : value;
}

function validateVideoMode(videoMode, vendor, model) {
  const requiredFields = ["resolution", "frame_rate", "compression"];

  for (const field of requiredFields) {
    if (!videoMode[field] || typeof videoMode[field] !== "string") {
      throw new Error(
        `Invalid video mode field "${field}" for vendor "${vendor}", model "${model}".`
      );
    }
  }
}

function validateModelData(modelData, vendor, model) {
  const requiredFields = [
    "firmware",
    "servers",
    "ports",
    "rtsp",
    "video_modes",
  ];

  for (const field of requiredFields) {
    if (!Array.isArray(modelData[field]) || modelData[field].length === 0) {
      throw new Error(
        `Invalid or missing field "${field}" for vendor "${vendor}", model "${model}".`
      );
    }
  }

  for (const videoMode of modelData.video_modes) {
    validateVideoMode(videoMode, vendor, model);
  }
}

function buildVideoModeDisplay(videoMode) {
  return `${videoMode.resolution}@${videoMode.frame_rate}`;
}

// Database connection helper
async function createDatabaseConnection() {
  const candidateHosts = [];

  if (baseDbConfig.host) {
    candidateHosts.push(baseDbConfig.host);
  }

  if (!candidateHosts.includes("localhost")) {
    candidateHosts.push("localhost");
  }

  if (!candidateHosts.includes("127.0.0.1")) {
    candidateHosts.push("127.0.0.1");
  }

  let lastError = null;

  for (const host of candidateHosts) {
    const dbConfig = { ...baseDbConfig, host };

    try {
      const connection = await mysql.createConnection(dbConfig);

      console.log(
        `[DB] Connected to MySQL at ${host}:${dbConfig.port} (database: ${dbConfig.database})`
      );

      return connection;
    } catch (error) {
      lastError = error;
    }
  }

  // Only print failures if ALL attempts failed
  console.error("[DB] Failed to connect using all hosts:");
  candidateHosts.forEach((host) => {
    console.error(` - ${host}:${baseDbConfig.port}`);
  });

  throw lastError || new Error("Unable to connect to MySQL.");
}

// Profile generation
function generateProfile() {
  const vendors = Object.keys(CAMERA_DATA);
  if (vendors.length === 0) {
    throw new Error("No vendors found in cameraProfiles.json");
  }

  const vendor = randomChoice(vendors);
  const vendorData = CAMERA_DATA[vendor];

  if (!vendorData.models || typeof vendorData.models !== "object") {
    throw new Error(`Vendor "${vendor}" has no valid "models" object.`);
  }

  const models = Object.keys(vendorData.models);
  if (models.length === 0) {
    throw new Error(`Vendor "${vendor}" has no models.`);
  }

  const model = randomChoice(models);
  const modelData = vendorData.models[model];

  validateModelData(modelData, vendor, model);

  const selectedVideoMode = randomChoice(modelData.video_modes);

  return {
    vendor,
    model,
    firmware: randomChoice(modelData.firmware),
    server: randomChoice(modelData.servers),
    ports: randomChoice(modelData.ports),
    rtsp_path: randomChoice(modelData.rtsp),
    resolution: selectedVideoMode.resolution,
    frame_rate: selectedVideoMode.frame_rate,
    video_mode: buildVideoModeDisplay(selectedVideoMode),
    compression: selectedVideoMode.compression,
    status: "Online",
  };
}

// Database insert
async function insertProfile(connection, profile) {
  const query = `
    INSERT INTO camera_profiles (
      vendor,
      model,
      firmware,
      server,
      ports,
      rtsp_path,
      resolution,
      frame_rate,
      video_mode,
      compression,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    profile.vendor,
    profile.model,
    profile.firmware,
    profile.server,
    JSON.stringify(profile.ports),
    profile.rtsp_path,
    profile.resolution,
    profile.frame_rate,
    profile.video_mode,
    profile.compression,
    profile.status,
  ];

  const [result] = await connection.execute(query, values);
  return result.insertId;
}

async function main() {
  const countArg = process.argv[2];
  const count = countArg ? Number(countArg) : 1;

  if (Number.isNaN(count) || count <= 0) {
    console.error("Please provide a valid positive number.");
    process.exit(1);
  }

  let connection;

  try {
    connection = await createDatabaseConnection();
    console.log(`Generating ${count} camera profile(s)...`);

    for (let i = 0; i < count; i++) {
      const profile = generateProfile();
      const insertedId = await insertProfile(connection, profile);

      console.log(`Inserted profile ID ${insertedId}`);
      console.log(profile);
    }

    console.log("Done.");
  } catch (error) {
    console.error("Error generating profiles:", error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();