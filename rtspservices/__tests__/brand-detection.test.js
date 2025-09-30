const BrandDetector = require('../utils/brand-detector');
const brandConfigs = require('../config/brand-configs');

describe('Brand Detection Tests', () => {
  let brandDetector;

  beforeEach(() => {
    brandDetector = new BrandDetector();
  });

  describe('Brand Detection by Path', () => {
    test('should detect Hikvision brand from path', () => {
      const paths = [
        '/hikvision/stream',
        '/hik/stream',
        '/hikvision/camera1',
        '/hik/camera1'
      ];

      paths.forEach(path => {
        const brand = brandDetector.detectBrandByPath(path);
        expect(brand).toBe('hikvision');
      });
    });

    test('should detect Dahua brand from path', () => {
      const paths = [
        '/dahua/stream',
        '/dvr/stream',
        '/dahua/camera1',
        '/dvr/camera1'
      ];

      paths.forEach(path => {
        const brand = brandDetector.detectBrandByPath(path);
        expect(brand).toBe('dahua');
      });
    });

    test('should detect Axis brand from path', () => {
      const paths = [
        '/axis/stream',
        '/network/stream',
        '/axis/camera1',
        '/network/camera1'
      ];

      paths.forEach(path => {
        const brand = brandDetector.detectBrandByPath(path);
        expect(brand).toBe('axis');
      });
    });

    test('should detect Reolink brand from path', () => {
      const paths = [
        '/reolink/stream',
        '/rl/stream',
        '/reolink/camera1',
        '/rl/camera1'
      ];

      paths.forEach(path => {
        const brand = brandDetector.detectBrandByPath(path);
        expect(brand).toBe('reolink');
      });
    });

    test('should detect Mobotix brand from path', () => {
      const paths = [
        '/mobotix/stream',
        '/mob/stream',
        '/mobotix/camera1',
        '/mob/camera1'
      ];

      paths.forEach(path => {
        const brand = brandDetector.detectBrandByPath(path);
        expect(brand).toBe('mobotix');
      });
    });

    test('should detect Vstarcam brand from path', () => {
      const paths = [
        '/vstarcam/stream',
        '/vstar/stream',
        '/vstarcam/camera1',
        '/vstar/camera1'
      ];

      paths.forEach(path => {
        const brand = brandDetector.detectBrandByPath(path);
        expect(brand).toBe('vstarcam');
      });
    });

    test('should default to Hikvision for unknown paths', () => {
      const paths = [
        '/unknown/stream',
        '/camera/stream',
        '/ipcam/stream',
        '/'
      ];

      paths.forEach(path => {
        const brand = brandDetector.detectBrandByPath(path);
        expect(brand).toBe('hikvision');
      });
    });

    test('should handle null and undefined paths', () => {
      expect(brandDetector.detectBrandByPath(null)).toBe('hikvision');
      expect(brandDetector.detectBrandByPath(undefined)).toBe('hikvision');
      expect(brandDetector.detectBrandByPath('')).toBe('hikvision');
    });
  });

  describe('Brand Detection by Port', () => {
    test('should detect Hikvision brand from port 80', () => {
      const brand = brandDetector.detectBrandByPort(80);
      expect(brand).toBe('hikvision');
    });

    test('should detect Vstarcam brand from port 81', () => {
      const brand = brandDetector.detectBrandByPort(81);
      expect(brand).toBe('vstarcam');
    });

    test('should detect Dahua brand from port 37777', () => {
      const brand = brandDetector.detectBrandByPort(37777);
      expect(brand).toBe('dahua');
    });

    test('should detect Mobotix brand from port 443', () => {
      const brand = brandDetector.detectBrandByPort(443);
      expect(brand).toBe('mobotix');
    });

    test('should detect Axis brand from port 10000', () => {
      const brand = brandDetector.detectBrandByPort(10000);
      expect(brand).toBe('axis');
    });

    test('should detect Reolink brand from port 8081', () => {
      const brand = brandDetector.detectBrandByPort(8081);
      expect(brand).toBe('reolink');
    });

    test('should default to Hikvision for unknown ports', () => {
      const unknownPorts = [8080, 9000, 5000, 3000];
      
      unknownPorts.forEach(port => {
        const brand = brandDetector.detectBrandByPort(port);
        expect(brand).toBe('hikvision');
      });
    });
  });

  describe('Brand Detection by User-Agent', () => {
    test('should detect Hikvision brand from User-Agent', () => {
      const userAgents = [
        'Hikvision DVR',
        'Hikvision IP Camera',
        'hikvision client',
        'HIKVISION RTSP Client'
      ];

      userAgents.forEach(ua => {
        const brand = brandDetector.detectBrandByUserAgent(ua);
        expect(brand).toBe('hikvision');
      });
    });

    test('should detect Dahua brand from User-Agent', () => {
      const userAgents = [
        'Dahua IP Camera',
        'Dahua DVR',
        'dahua client',
        'DAHUA RTSP Client'
      ];

      userAgents.forEach(ua => {
        const brand = brandDetector.detectBrandByUserAgent(ua);
        expect(brand).toBe('dahua');
      });
    });

    test('should detect Axis brand from User-Agent', () => {
      const userAgents = [
        'Axis IP Camera',
        'Axis Network Camera',
        'axis client',
        'AXIS RTSP Client'
      ];

      userAgents.forEach(ua => {
        const brand = brandDetector.detectBrandByUserAgent(ua);
        expect(brand).toBe('axis');
      });
    });

    test('should detect Reolink brand from User-Agent', () => {
      const userAgents = [
        'Reolink IP Camera',
        'Reolink Client',
        'reolink client',
        'REOLINK RTSP Client'
      ];

      userAgents.forEach(ua => {
        const brand = brandDetector.detectBrandByUserAgent(ua);
        expect(brand).toBe('reolink');
      });
    });

    test('should detect Mobotix brand from User-Agent', () => {
      const userAgents = [
        'Mobotix IP Camera',
        'Mobotix Client',
        'mobotix client',
        'MOBOTIX RTSP Client'
      ];

      userAgents.forEach(ua => {
        const brand = brandDetector.detectBrandByUserAgent(ua);
        expect(brand).toBe('mobotix');
      });
    });

    test('should detect Vstarcam brand from User-Agent', () => {
      const userAgents = [
        'Vstarcam IP Camera',
        'Vstarcam Client',
        'vstarcam client',
        'VSTARCAM RTSP Client'
      ];

      userAgents.forEach(ua => {
        const brand = brandDetector.detectBrandByUserAgent(ua);
        expect(brand).toBe('vstarcam');
      });
    });

    test('should default to Hikvision for unknown User-Agents', () => {
      const unknownUAs = [
        'Unknown Client',
        'Generic RTSP Client',
        'Test Client',
        null,
        undefined
      ];

      unknownUAs.forEach(ua => {
        const brand = brandDetector.detectBrandByUserAgent(ua);
        expect(brand).toBe('hikvision');
      });
    });
  });

  describe('Integrated Brand Detection', () => {
    test('should prioritize path-based detection over port-based', () => {
      const mockSocket = { localPort: 80 }; // Hikvision port
      const request = 'OPTIONS rtsp://192.168.1.100:554/dahua/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      const url = 'rtsp://192.168.1.100:554/dahua/stream';
      
      const brand = brandDetector.detectBrand(mockSocket, request, url);
      expect(brand).toBe('dahua'); // Path should override port
    });

    test('should prioritize User-Agent over port-based detection', () => {
      const mockSocket = { localPort: 80 }; // Hikvision port
      const request = 'OPTIONS rtsp://192.168.1.100:554/stream RTSP/1.0\r\nUser-Agent: Dahua Client\r\nCSeq: 1\r\n\r\n';
      const url = 'rtsp://192.168.1.100:554/stream';
      
      const brand = brandDetector.detectBrand(mockSocket, request, url);
      expect(brand).toBe('dahua'); // User-Agent should override port
    });

    test('should fall back to port-based detection when no other indicators', () => {
      const mockSocket = { localPort: 37777 }; // Dahua port
      const request = 'OPTIONS rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      const url = 'rtsp://192.168.1.100:554/stream';
      
      const brand = brandDetector.detectBrand(mockSocket, request, url);
      expect(brand).toBe('dahua'); // Should use port
    });

    test('should handle missing socket information gracefully', () => {
      const mockSocket = {}; // No localPort
      const request = 'OPTIONS rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      const url = 'rtsp://192.168.1.100:554/stream';
      
      const brand = brandDetector.detectBrand(mockSocket, request, url);
      expect(brand).toBe('hikvision'); // Should default
    });
  });

  describe('Brand Configuration Access', () => {
    test('should return correct brand configuration for Hikvision', () => {
      const config = brandDetector.getBrandConfig('hikvision');
      
      expect(config.name).toBe('Hikvision DVR rtspd');
      expect(config.server).toBe('Hikvision DVR rtspd');
      expect(config.patterns.options.pattern1).toContain('RTSP/1.0 200 OK');
      expect(config.patterns.unauthorized).toBeInstanceOf(Function);
    });

    test('should return correct brand configuration for Dahua', () => {
      const config = brandDetector.getBrandConfig('dahua');
      
      expect(config.name).toBe('Dahua IP camera rtspd');
      expect(config.server).toBe('Dahua Rtsp Server');
      expect(config.patterns.options.pattern1).toContain('RTSP/1.0 405 Method Not Allowed');
      expect(config.patterns.unauthorized).toBeInstanceOf(Function);
    });

    test('should return correct brand configuration for Axis', () => {
      const config = brandDetector.getBrandConfig('axis');
      
      expect(config.name).toBe('Axis 207W Webcam rtspd');
      expect(config.server).toBe('Axis Rtsp Server');
      expect(config.patterns.options.pattern1).toContain('RTSP/1.0 200 OK');
      expect(config.patterns.unauthorized).toBeInstanceOf(Function);
    });

    test('should return correct brand configuration for Reolink', () => {
      const config = brandDetector.getBrandConfig('reolink');
      
      expect(config.name).toBe('Reolink IP camera rtspd');
      expect(config.server).toBe('Reolink Rtsp Server');
      expect(config.patterns.options.pattern1).toContain('RTSP/1.0 200 OK');
      expect(config.patterns.unauthorized).toBeInstanceOf(Function);
    });

    test('should return correct brand configuration for Mobotix', () => {
      const config = brandDetector.getBrandConfig('mobotix');
      
      expect(config.name).toBe('Mobotix IP camera rtspd');
      expect(config.server).toBe('Mobotix Rtsp Server');
      expect(config.patterns.options.pattern1).toContain('RTSP/1.0 200 OK');
      expect(config.patterns.unauthorized).toBeInstanceOf(Function);
    });

    test('should return correct brand configuration for Vstarcam', () => {
      const config = brandDetector.getBrandConfig('vstarcam');
      
      expect(config.name).toBe('Vstarcam IP camera rtspd');
      expect(config.server).toBe('Vstarcam Rtsp Server');
      expect(config.patterns.options.pattern1).toContain('RTSP/1.0 200 OK');
      expect(config.patterns.unauthorized).toBeInstanceOf(Function);
    });

    test('should fall back to Hikvision for unknown brands', () => {
      const config = brandDetector.getBrandConfig('unknown');
      
      expect(config.name).toBe('Hikvision DVR rtspd');
      expect(config.server).toBe('Hikvision DVR rtspd');
    });
  });

  describe('Nonce Generation', () => {
    test('should generate unique nonces', () => {
      const nonce1 = brandDetector.generateNonce();
      const nonce2 = brandDetector.generateNonce();
      
      expect(nonce1).not.toBe(nonce2);
    });

    test('should generate nonces with correct length', () => {
      const nonce = brandDetector.generateNonce();
      expect(nonce).toHaveLength(32);
    });

    test('should generate hexadecimal nonces', () => {
      const nonce = brandDetector.generateNonce();
      expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('CSeq Extraction', () => {
    test('should extract CSeq from request', () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 42\r\n\r\n';
      const cseq = brandDetector.extractCSeq(request);
      expect(cseq).toBe('42');
    });

    test('should handle missing CSeq gracefully', () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/stream RTSP/1.0\r\n\r\n';
      const cseq = brandDetector.extractCSeq(request);
      expect(cseq).toBe('1');
    });

    test('should handle null request gracefully', () => {
      const cseq = brandDetector.extractCSeq(null);
      expect(cseq).toBe('1');
    });

    test('should handle malformed CSeq gracefully', () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: invalid\r\n\r\n';
      const cseq = brandDetector.extractCSeq(request);
      expect(cseq).toBe('1');
    });
  });
}); 