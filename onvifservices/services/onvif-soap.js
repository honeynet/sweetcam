const soap = require('soap');
const { pool } = require('../config/db-config');
const xml2js = require('xml2js');
const brandConfigs = require('../config/brand-configs');

const STREAM_WIDTH = 1280;
const STREAM_HEIGHT = 544;
const STREAM_FPS = 15;
const STREAM_BITRATE_KBPS = 2048;

const normalizeVendor = (value) => String(value || '').trim().toLowerCase();

const normalizeRtspPath = (rtspPath) => {
  if (!rtspPath) return null;
  return rtspPath.startsWith('/') ? rtspPath : `/${rtspPath}`;
};

const parseResolution = (resolution) => {
  const value = String(resolution || '').trim().toLowerCase();
  const match = value.match(/(\d+)\s*[xX]\s*(\d+)/);
  if (!match) {
    if (value.includes('full hd') || value.includes('1080p') || value.includes('2mp')) {
      return { width: 1920, height: 1080 };
    }

    if (value.includes('720p')) {
      return { width: 1280, height: 720 };
    }

    if (value.includes('360') || value.includes('panoramic')) {
      return { width: 2048, height: 1536 };
    }

    return { width: STREAM_WIDTH, height: STREAM_HEIGHT };
  }

  return {
    width: Number(match[1]) || STREAM_WIDTH,
    height: Number(match[2]) || STREAM_HEIGHT
  };
};

const parseFrameRate = (frameRate) => {
  const match = String(frameRate || '').match(/(\d+(?:\.\d+)?)/);
  if (!match) return STREAM_FPS;

  return Math.round(Number(match[1])) || STREAM_FPS;
};

const buildDeterministicSerial = (vendor, model, id) => {
  const normalizedVendor = String(vendor || 'CAM').replace(/[^a-z0-9]/gi, '').toUpperCase();
  const normalizedModel = String(model || 'IPCAM').replace(/[^a-z0-9]/gi, '').toUpperCase();
  const suffix = String(id || '000001').padStart(6, '0');

  return `${normalizedVendor}${normalizedModel}${suffix}`;
};

class ONVIFSoapService {
  constructor() {
    //get brand from environment variable, default to hikvision
    this.brand = normalizeVendor(process.env.ONVIF_BRAND || 'hikvision');
    this.brandConfig = brandConfigs[this.brand] || brandConfigs.hikvision;
    this.profile = null;
    this.profileLoaded = false;
    
    this.deviceInfo = {
      manufacturer: this.brandConfig.manufacturer,
      model: this.brandConfig.model,
      firmwareVersion: this.brandConfig.firmwareVersion,
      serialNumber: this.brandConfig.serialNumber,
      hardwareId: this.brandConfig.hardwareId
    };
  }

  async loadProfileFromDatabase() {
    try {
      const vendor = this.brandConfig.manufacturer || this.brand;
      const [rows] = await pool.execute(
        `SELECT id, vendor, model, firmware, server, ports, rtsp_path,
                resolution, frame_rate, video_mode, compression, status
         FROM camera_profiles
         WHERE LOWER(vendor) = LOWER(?)
         ORDER BY id DESC
         LIMIT 1`,
        [vendor]
      );

      const profile = rows[0] || null;
      this.profile = profile;
      this.profileLoaded = true;

      if (!profile) {
        console.log(`[ONVIF] No camera_profiles row found for ${vendor}; using static ${this.brand} defaults`);
        return null;
      }

      this.deviceInfo = {
        manufacturer: profile.vendor || this.brandConfig.manufacturer,
        model: profile.model || this.brandConfig.model,
        firmwareVersion: profile.firmware || this.brandConfig.firmwareVersion,
        serialNumber: buildDeterministicSerial(profile.vendor, profile.model, profile.id),
        hardwareId: profile.model || this.brandConfig.hardwareId
      };

      this.brandConfig = {
        ...this.brandConfig,
        brand: profile.vendor || this.brandConfig.manufacturer,
        manufacturer: profile.vendor || this.brandConfig.manufacturer,
        model: profile.model || this.brandConfig.model,
        firmwareVersion: profile.firmware || this.brandConfig.firmwareVersion,
        server: profile.server || this.brandConfig.server,
        rtspPath: normalizeRtspPath(profile.rtsp_path) || this.brandConfig.rtspPath,
        resolution: profile.resolution || this.brandConfig.resolution,
        frameRate: profile.frame_rate || this.brandConfig.specifications?.fps,
        videoMode: profile.video_mode || this.brandConfig.videoMode,
        compression: profile.compression || this.brandConfig.specifications?.compression,
        status: profile.status || 'Online',
        ports: profile.ports || [],
        specifications: {
          ...(this.brandConfig.specifications || {}),
          fps: profile.frame_rate || this.brandConfig.specifications?.fps,
          compression: profile.compression || this.brandConfig.specifications?.compression
        }
      };

      console.log(`[ONVIF] Loaded DB camera profile for ${profile.vendor}: ${profile.model} (${profile.resolution}, ${profile.frame_rate}, ${profile.compression})`);
      return profile;
    } catch (error) {
      this.profileLoaded = true;
      console.error(`[ONVIF] Failed to load camera profile for ${this.brand}:`, error.message);
      return null;
    }
  }

  getStreamMetadata() {
    const resolution = parseResolution(this.brandConfig.resolution || this.profile?.resolution);
    const frameRate = parseFrameRate(
      this.brandConfig.frameRate ||
      this.profile?.frame_rate ||
      this.brandConfig.specifications?.fps
    );

    return {
      width: resolution.width,
      height: resolution.height,
      frameRate,
      bitrateKbps: STREAM_BITRATE_KBPS,
      encoding: 'H264',
      h264Profile: 'Baseline',
      compression: this.brandConfig.compression || this.profile?.compression || 'H.264'
    };
  }

  getDiscoveryInfo() {
    return {
      manufacturer: this.deviceInfo.manufacturer,
      model: this.deviceInfo.model,
      firmwareVersion: this.deviceInfo.firmwareVersion,
      serialNumber: this.deviceInfo.serialNumber,
      hardwareId: this.deviceInfo.hardwareId,
      deviceId: `${normalizeVendor(this.deviceInfo.manufacturer)}-${String(this.deviceInfo.model || 'camera').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${this.profile?.id || 'default'}`
    };
  }

  getPublicRtspHost() {
    return process.env.PUBLIC_RTSP_HOST ||
      process.env.RTSP_PUBLIC_HOST ||
      process.env.ONVIF_RTSP_HOST ||
      process.env.ONVIF_HTTP_ADDRESS ||
      '127.0.0.1';
  }

  getPublicOnvifBaseUrl() {
    const host = process.env.PUBLIC_ONVIF_HOST ||
      process.env.ONVIF_PUBLIC_HOST ||
      process.env.ONVIF_HTTP_ADDRESS ||
      '127.0.0.1';
    const port = process.env.ONVIF_HTTP_PORT || '8080';

    return `http://${host}:${port}`;
  }

  async getProfileRtspPath() {
    if (this.profile?.rtsp_path) {
      return normalizeRtspPath(this.profile.rtsp_path);
    }

    try {
      const vendor = this.brandConfig.manufacturer || this.brand;
      const [rows] = await pool.execute(
        `SELECT rtsp_path
         FROM camera_profiles
         WHERE LOWER(vendor) = LOWER(?) AND rtsp_path IS NOT NULL AND rtsp_path <> ''
         ORDER BY id DESC
         LIMIT 1`,
        [vendor]
      );

      return normalizeRtspPath(rows[0]?.rtsp_path);
    } catch (error) {
      console.error(`[ONVIF] Failed to resolve RTSP profile for ${this.brand}:`, error.message);
      return null;
    }
  }

  async getRtspUri() {
    const host = this.getPublicRtspHost();
    const port = this.brandConfig.rtspPort || 8554;
    const path = await this.getProfileRtspPath() ||
      normalizeRtspPath(this.brandConfig.rtspPath) ||
      '/Streaming/Channels/101';

    return `rtsp://${host}:${port}${path}`;
  }

  getRtspUriSync() {
    const host = this.getPublicRtspHost();
    const port = this.brandConfig.rtspPort || 8554;
    const path = normalizeRtspPath(this.profile?.rtsp_path) ||
      normalizeRtspPath(this.brandConfig.rtspPath) ||
      '/Streaming/Channels/101';

    return `rtsp://${host}:${port}${path}`;
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
          const baseUrl = this.getPublicOnvifBaseUrl();
          const result = {
            Service: [
              {
                Namespace: 'http://www.onvif.org/ver10/device/wsdl',
                XAddr: `${baseUrl}/onvif/device_service`,
                Version: {
                  Major: 2,
                  Minor: 7
                }
              },
              {
                Namespace: 'http://www.onvif.org/ver10/media/wsdl',
                XAddr: `${baseUrl}/onvif/media_service`,
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
          const baseUrl = this.getPublicOnvifBaseUrl();
          const result = {
            Capabilities: {
              Device: {
                XAddr: `${baseUrl}/onvif/device_service`,
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
                XAddr: `${baseUrl}/onvif/media_service`,
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
                XAddr: `${baseUrl}/onvif/ptz_service`,
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
          const stream = this.getStreamMetadata();
          const result = {
            Profiles: [
              {
                token: 'Profile_1',
                Name: `${this.deviceInfo.manufacturer} ${this.deviceInfo.model} Main Profile`,
                VideoSourceConfiguration: {
                  token: 'VideoSource_1',
                  Name: 'Video Source 1',
                  UseCount: 1,
                  SourceToken: 'VideoSource_1',
                  Bounds: {
                    x: 0,
                    y: 0,
                    width: stream.width,
                    height: stream.height
                  }
                },
                VideoEncoderConfiguration: {
                  token: 'VideoEncoder_1',
                  Name: `${this.deviceInfo.model} Video Encoder`,
                  UseCount: 1,
                  Encoding: stream.encoding,
                  Resolution: {
                    Width: stream.width,
                    Height: stream.height
                  },
                  Quality: 0.8,
                  RateControl: {
                    FrameRateLimit: stream.frameRate,
                    BitrateLimit: stream.bitrateKbps,
                    EncodingInterval: 1
                  },
                  H264: {
                    GovLength: stream.frameRate * 2,
                    H264Profile: stream.h264Profile
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
              URI: this.getRtspUriSync(),
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
          const stream = this.getStreamMetadata();
          const result = {
            VideoSources: [
              {
                token: 'VideoSource_1',
                Framerate: stream.frameRate,
                Resolution: {
                  Width: stream.width,
                  Height: stream.height
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
          const stream = this.getStreamMetadata();
          const result = {
            Configurations: [
              {
                token: 'VideoEncoder_1',
                Name: `${this.deviceInfo.manufacturer} Video Encoder`,
                UseCount: 1,
                Encoding: stream.encoding,
                Resolution: {
                  Width: stream.width,
                  Height: stream.height
                },
                Quality: 0.8,
                RateControl: {
                  FrameRateLimit: stream.frameRate,
                  BitrateLimit: stream.bitrateKbps,
                  EncodingInterval: 1
                },
                H264: {
                  GovLength: stream.frameRate * 2,
                  H264Profile: stream.h264Profile
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
