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
    model: "M3047-P",
    firmwareVersion: "9.80.3.4",
    serialNumber: "00408C123456",
    hardwareId: "M3047-P",
    deviceId: "axis-device-001",
    onvifVersion: "2.4",
    deviceType: "Network Camera",
    resolution: "360° panoramic",
    features: {
      nightVision: true,
      motionDetection: true,
      audio: true
    },
    specifications: {
      sensor: "1/2.8\" Progressive scan RGB CMOS",
      lens: "1.6 mm, F2.0",
      fps: "25/30 fps (50/60 Hz)",
      compression: "H.264, MJPEG"
    }
  },
  
  reolink: {
    manufacturer: "Reolink",
    model: "E1 Zoom",
    firmwareVersion: "v3.1.0.956",
    serialNumber: "E1-Zoom20201201AACH123456789",
    hardwareId: "E1-Zoom",
    deviceId: "reolink-device-001",
    onvifVersion: "2.4",
    deviceType: "Network Camera",
    resolution: "Full HD",
    features: {
      nightVision: true,
      motionDetection: true,
      audio: true
    },
    specifications: {
      sensor: "1/2.7\" CMOS",
      lens: "2.8-8mm Motorized Lens",
      fps: "30 fps",
      compression: "H.264, H.265"
    }
  },
  
  mobotix: {
    manufacturer: "Mobotix",
    model: "MX VT1A-2-IR",
    firmwareVersion: "V4.2.4.61",
    serialNumber: "MX-VT1A-2-IR20201201AACH123456789",
    hardwareId: "MX-VT1A-2-IR",
    deviceId: "mobotix-device-001",
    onvifVersion: "2.4",
    deviceType: "IP Camera",
    resolution: "2MP",
    features: {
      nightVision: true,
      motionDetection: true,
      audio: true
    },
    specifications: {
      sensor: "1/2.8\" CMOS",
      lens: "2.8mm",
      fps: "25fps@1080p",
      compression: "H.265"
    }
  },
  
  vstarcam: {
    manufacturer: "Vstarcam",
    model: "C7824WIP",
    firmwareVersion: "V1.0.0.1",
    serialNumber: "C7824WIP20201201AACH123456789",
    hardwareId: "C7824WIP",
    deviceId: "vstarcam-device-001",
    onvifVersion: "2.4",
    deviceType: "Network Camera",
    resolution: "640x480",
    features: {
      nightVision: true,
      motionDetection: true,
      audio: true
    },
    specifications: {
      sensor: "CMOS",
      lens: "3.6mm",
      fps: "25 fps",
      compression: "H.264"
    }
  }
};

module.exports = brandConfigs; 