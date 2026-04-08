const { DataTypes } = require("sequelize");
const sequelize = require("../database/database");

const CameraProfile = sequelize.define(
  "camera_profiles",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    vendor: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    model: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    firmware: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    server: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    ports: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    rtsp_path: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    resolution: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    frame_rate: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    video_mode: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    compression: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Online",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "camera_profiles",
    timestamps: false,
  }
);

module.exports = CameraProfile;