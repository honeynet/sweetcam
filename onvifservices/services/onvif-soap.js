const soap = require('soap');
const { pool } = require('../config/db-config');
const xml2js = require('xml2js');
const brandConfigs = require('../config/brand-configs');

class ONVIFSoapService {
  constructor() {
    //get brand from environment variable, default to hikvision
    this.brand = process.env.ONVIF_BRAND || 'hikvision';
    this.brandConfig = brandConfigs[this.brand] || brandConfigs.hikvision;
    
    this.deviceInfo = {
      manufacturer: this.brandConfig.manufacturer,
      model: this.brandConfig.model,
      firmwareVersion: this.brandConfig.firmwareVersion,
      serialNumber: this.brandConfig.serialNumber,
      hardwareId: this.brandConfig.hardwareId
    };
  }

  createDeviceService() {
    return {
      GetDeviceInformation: (args, callback) => {
        try {
          const result = {
            Manufacturer: this.deviceInfo.manufacturer,
            Model: this.deviceInfo.model,
            FirmwareVersion: this.deviceInfo.firmwareVersion,
            SerialNumber: this.deviceInfo.serialNumber,
            HardwareId: this.deviceInfo.hardwareId
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      GetServices: (args, callback) => { //device service, media service, ptz service
        try {
          const result = {
            Service: [
              {
                Namespace: 'http://www.onvif.org/ver10/device/wsdl',
                XAddr: 'http://127.0.0.1:8080/onvif/device_service',
                Version: {
                  Major: 2,
                  Minor: 7
                }
              },
              {
                Namespace: 'http://www.onvif.org/ver10/media/wsdl',
                XAddr: 'http://127.0.0.1:8080/onvif/media_service',
                Version: {
                  Major: 2,
                  Minor: 7
                }
              }
            ]
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      GetCapabilities: (args, callback) => { //network, system, security, io, media, pts
        try {
          const result = {
            Capabilities: {
              Device: {
                XAddr: 'http://127.0.0.1:8080/onvif/device_service',
                Network: {
                  IPFilter: false,
                  ZeroConfiguration: true,
                  IPVersion6: false,
                  DynDNS: false,
                  Extension: {}
                },
                System: {
                  DiscoveryResolve: true,
                  DiscoveryBye: true,
                  RemoteDiscovery: false,
                  SystemBackup: false,
                  SystemLogging: true,
                  FirmwareUpgrade: false,
                  SupportedVersions: {
                    Major: 2,
                    Minor: 7
                  },
                  Extension: {}
                },
                IO: {
                  InputConnectors: 1,
                  RelayOutputs: 1,
                  Extension: {}
                },
                Security: {
                  OnboardKeyGeneration: false,
                  AccessPolicyConfig: false,
                  DefaultAccessPolicy: false,
                  Dot1X: false,
                  RemoteUserHandling: false,
                  X509Token: false,
                  SAMLToken: false,
                  KerberosToken: false,
                  RELToken: false,
                  Extension: {}
                },
                Extension: {}
              },
              Media: {
                XAddr: 'http://127.0.0.1:8080/onvif/media_service',
                StreamingCapabilities: {
                  RTPMulticast: false,
                  RTP_TCP: true,
                  RTP_RTSP_TCP: true,
                  NonAggregateControl: true,
                  NoRTSPRange: false,
                  Extension: {}
                },
                Extension: {}
              },
              PTZ: {
                XAddr: 'http://127.0.0.1:8080/onvif/ptz_service',
                Extension: {}
              },
              Extension: {}
            }
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      GetNetworkInterfaces: (args, callback) => { //eth0, ip, dhcp, link local
        try {
          const result = {
            NetworkInterfaces: [
              {
                token: 'eth0',
                Enabled: true,
                Info: {
                  Name: 'eth0',
                  HwAddress: '00:1A:2B:3C:4D:5E',
                  MTU: 1500
                },
                IPv4: {
                  Enabled: true,
                  Config: {
                    Manual: {
                      Address: '192.168.1.100',
                      PrefixLength: 24
                    },
                    LinkLocal: {
                      Address: '169.254.1.1',
                      PrefixLength: 16
                    },
                    FromDHCP: {
                      Address: '192.168.1.100',
                      PrefixLength: 24
                    },
                    DHCP: true
                  }
                }
              }
            ]
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      GetSystemDateAndTime: (args, callback) => {
        try {
          const now = new Date();
          const result = {
            SystemDateTime: {
              DateTimeType: 'NTP',
              DaylightSavings: false,
              TimeZone: {
                TZ: {
                  Name: 'UTC',
                  Offset: {
                    Hours: 0,
                    Minutes: 0
                  }
                }
              },
              UTCDateTime: {
                Time: {
                  Hour: now.getUTCHours(),
                  Minute: now.getUTCMinutes(),
                  Second: now.getUTCSeconds()
                },
                Date: {
                  Year: now.getUTCFullYear(),
                  Month: now.getUTCMonth() + 1,
                  Day: now.getUTCDate()
                }
              },
              LocalDateTime: {
                Time: {
                  Hour: now.getHours(),
                  Minute: now.getMinutes(),
                  Second: now.getSeconds()
                },
                Date: {
                  Year: now.getFullYear(),
                  Month: now.getMonth() + 1,
                  Day: now.getDate()
                }
              }
            }
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      GetSystemLog: (args, callback) => { //system, network, fake security
        try {
          const now = new Date();
          const result = {
            SystemLog: {
              Log: [
                {
                  System: {
                    Component: 'System',
                    Level: 'Information',
                    DateTime: now.toISOString(),
                    Description: `${this.deviceInfo.manufacturer} ${this.deviceInfo.model} system startup completed`
                  }
                },
                {
                  System: {
                    Component: 'Network',
                    Level: 'Information',
                    DateTime: new Date(now.getTime() - 60000).toISOString(),
                    Description: 'Network interface eth0 configured'
                  }
                },
                {
                  System: {
                    Component: 'Security',
                    Level: 'Warning',
                    DateTime: new Date(now.getTime() - 120000).toISOString(),
                    Description: 'Failed login attempt from 192.168.1.50'
                  }
                }
              ]
            }
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      GetUsers: (args, callback) => {
        try {
          const result = {
            User: [
              {
                Username: 'admin',
                UserLevel: 'Administrator'
              },
              {
                Username: 'Jimmy',
                UserLevel: 'Operator'
              }
            ]
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      CreateUsers: (args, callback) => {
        try {
          const result = {
            Username: args.Username || 'newuser'
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      DeleteUsers: (args, callback) => {
        try {
          const result = {
            Username: args.Username || 'deleteduser'
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      SetSystemDateAndTime: (args, callback) => {
        try {
          const result = {
            Status: 'OK'
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      SystemReboot: (args, callback) => {
        try {
          const result = {
            Message: `${this.deviceInfo.manufacturer} ${this.deviceInfo.model} system reboot initiated`
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      }
    };
  }

  createMediaService() { //resolutions, codec, frame rate, bitrate, audio 
    return {
      GetProfiles: (args, callback) => {
        try {
          const result = {
            Profiles: [
              {
                token: 'Profile_1',
                Name: `${this.deviceInfo.manufacturer} Main Profile`,
                VideoSourceConfiguration: {
                  token: 'VideoSource_1',
                  Name: 'Video Source 1',
                  UseCount: 1,
                  SourceToken: 'VideoSource_1',
                  Bounds: {
                    x: 0,
                    y: 0,
                    width: 1920,
                    height: 1080
                  }
                },
                VideoEncoderConfiguration: {
                  token: 'VideoEncoder_1',
                  Name: 'Video Encoder 1',
                  UseCount: 1,
                  Encoding: this.brandConfig.specifications.compression,
                  Resolution: {
                    Width: 1920,
                    Height: 1080
                  },
                  Quality: 0.8,
                  RateControl: {
                    FrameRateLimit: 30,
                    BitrateLimit: 4096,
                    EncodingInterval: 1
                  },
                  H264: {
                    GovLength: 30,
                    H264Profile: 'Baseline'
                  }
                },
                AudioSourceConfiguration: {
                  token: 'AudioSource_1',
                  Name: 'Audio Source 1',
                  UseCount: 1,
                  SourceToken: 'AudioSource_1'
                },
                AudioEncoderConfiguration: {
                  token: 'AudioEncoder_1',
                  Name: 'Audio Encoder 1',
                  UseCount: 1,
                  Encoding: 'G711',
                  Bitrate: 64,
                  SampleRate: 8000
                },
                PTZConfiguration: {
                  token: 'PTZ_1',
                  Name: 'PTZ Configuration 1',
                  UseCount: 1,
                  NodeToken: 'PTZNode_1',
                  DefaultContinuousPanTiltVelocitySpace: {
                    URI: 'http://www.onvif.org/ver10/tptz/PanTiltSpaces/ContinuousGenericSpace',
                    XRange: {
                      Min: -1,
                      Max: 1
                    },
                    YRange: {
                      Min: -1,
                      Max: 1
                    }
                  },
                  DefaultContinuousZoomVelocitySpace: {
                    URI: 'http://www.onvif.org/ver10/tptz/ZoomSpaces/ContinuousGenericSpace',
                    XRange: {
                      Min: -1,
                      Max: 1
                    }
                  },
                  DefaultPTZSpeed: {
                    PanTilt: {
                      x: 0.5,
                      y: 0.5
                    },
                    Zoom: {
                      x: 0.5
                    }
                  },
                  DefaultPTZTimeout: 30
                }
              }
            ]
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      GetStreamUri: (args, callback) => { 
        try {
          const result = {
            MediaUri: {
              URI: `rtsp://127.0.0.1:554/${this.brand}`,
              InvalidAfterConnect: false,
              InvalidAfterReboot: false,
              Timeout: 30
            }
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      GetVideoSources: (args, callback) => {
        try {
          const result = {
            VideoSources: [
              {
                token: 'VideoSource_1',
                Framerate: 30.0,
                Resolution: {
                  Width: 1920,
                  Height: 1080
                },
                Imaging: {
                  Brightness: 50,
                  ColorSaturation: 50,
                  Contrast: 50,
                  Sharpness: 50
                }
              }
            ]
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      GetAudioSources: (args, callback) => {
        try {
          const result = {
            AudioSources: [
              {
                token: 'AudioSource_1',
                Channels: 1
              }
            ]
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      GetVideoEncoderConfigurations: (args, callback) => {
        try {
          const result = {
            Configurations: [
              {
                token: 'VideoEncoder_1',
                Name: `${this.deviceInfo.manufacturer} Video Encoder`,
                UseCount: 1,
                Encoding: this.brandConfig.specifications.compression,
                Resolution: {
                  Width: 1920,
                  Height: 1080
                },
                Quality: 0.8,
                RateControl: {
                  FrameRateLimit: 30,
                  BitrateLimit: 4096,
                  EncodingInterval: 1
                },
                H264: {
                  GovLength: 30,
                  H264Profile: 'Baseline'
                }
              }
            ]
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      },

      GetAudioEncoderConfigurations: (args, callback) => {
        try {
          const result = {
            Configurations: [
              {
                token: 'AudioEncoder_1',
                Name: `${this.deviceInfo.manufacturer} Audio Encoder`,
                UseCount: 1,
                Encoding: 'G711',
                Bitrate: 64,
                SampleRate: 8000
              }
            ]
          };
          callback(null, result);
        } catch (error) {
          callback(error);
        }
      }
    };
  }

}

module.exports = ONVIFSoapService; 