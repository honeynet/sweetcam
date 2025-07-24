const brandConfigs = {
  hikvision: {
    manufacturer: "Hikvision",
    model: "DS-2CD2T47G1-L",
    firmwareVersion: "V5.5.82",
    serialNumber: "DS-2CD2T47G1-L20201201AACH123456789",
    hardwareId: "DS-2CD2T47G1-L",
    deviceId: "hikvision-device-001",
    onvifVersion: "2.4",
    deviceType: "IP Camera",
    resolution: "2688 x 1520",
    features: {
      nightVision: true,
      motionDetection: true,
      audio: true,
      waterproof: "IP66"
    },
    specifications: {
      sensor: "1/3\" CMOS",
      lens: "2.8mm",
      fps: "30fps@1080p",
      compression: "H.264"
    }
  },
  
  dahua: {
    manufacturer: "Dahua",
    model: "IPC-HDW4631C-A",
    firmwareVersion: "V2.800.0000000.0.R",
    serialNumber: "IPC-HDW4631C-A20201201AACH123456789",
    hardwareId: "IPC-HDW4631C-A",
    deviceId: "dahua-device-001",
    onvifVersion: "2.4",
    deviceType: "IP Camera",
    resolution: "1080p",
    features: {
      nightVision: true,
      motionDetection: true,
      audio: true
    },
    specifications: {
      sensor: "1/2.9\" CMOS",
      lens: "2.8mm",
      fps: "25fps@1080p",
      compression: "H.265"
    }
  },
  
  axis: {
    manufacturer: "Axis",
    model: "P1445-LE",
    firmwareVersion: "9.80.3.4",
    serialNumber: "00408C123456",
    hardwareId: "P1445-LE",
    deviceId: "axis-device-001",
    onvifVersion: "2.4",
    deviceType: "IP Camera",
    resolution: "1920 x 1080",
    features: {
      nightVision: true,
      motionDetection: true,
      audio: true,
      ptz: true
    },
    specifications: {
      sensor: "1/2.9\" CMOS",
      lens: "4.3-137.6mm",
      fps: "30fps@1080p",
      compression: "H.264"
    }
  },
  
  reolink: {
    manufacturer: "Reolink",
    model: "RLC-811A",
    firmwareVersion: "v3.1.0.956",
    serialNumber: "RLC-811A20201201AACH123456789",
    hardwareId: "RLC-811A",
    deviceId: "reolink-device-001",
    onvifVersion: "2.4",
    deviceType: "IP Camera",
    resolution: "4K",
    features: {
      nightVision: true,
      motionDetection: true,
      audio: true,
      waterproof: "IP66"
    },
    specifications: {
      sensor: "1/2.49\" CMOS",
      lens: "2.8mm",
      fps: "25fps@4K",
      compression: "H.265"
    }
  },
  
  mobotix: {
    manufacturer: "Mobotix",
    model: "M15-D1080",
    firmwareVersion: "V4.2.4.61",
    serialNumber: "M15-D108020201201AACH123456789",
    hardwareId: "M15-D1080",
    deviceId: "mobotix-device-001",
    onvifVersion: "2.4",
    deviceType: "IP Camera",
    resolution: "1920 x 1080",
    features: {
      nightVision: true,
      motionDetection: true,
      audio: true,
      ptz: true
    },
    specifications: {
      sensor: "1/2.8\" CMOS",
      lens: "3.6mm",
      fps: "30fps@1080p",
      compression: "H.264"
    }
  },
  
  vstarcam: {
    manufacturer: "Vstarcam",
    model: "C7823WIP",
    firmwareVersion: "V1.0.0.1",
    serialNumber: "C7823WIP20201201AACH123456789",
    hardwareId: "C7823WIP",
    deviceId: "vstarcam-device-001",
    onvifVersion: "2.4",
    deviceType: "IP Camera",
    resolution: "1920 x 1080",
    features: {
      nightVision: true,
      motionDetection: true,
      audio: true,
      ptz: true
    },
    specifications: {
      sensor: "1/2.7\" CMOS",
      lens: "3.6mm",
      fps: "25fps@1080p",
      compression: "H.264"
    }
  }
};

module.exports = brandConfigs; 