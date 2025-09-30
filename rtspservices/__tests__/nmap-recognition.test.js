const { RTSPServer } = require('../rtsp-server');
const BrandDetector = require('../utils/brand-detector');
const brandConfigs = require('../config/brand-configs');

// Mock dependencies
jest.mock('../utils/logger');
jest.mock('../utils/db-logger');
jest.mock('mysql2/promise');
jest.mock('bcrypt');
jest.mock('net');
jest.mock('dgram');
jest.mock('fs');
jest.mock('path');

describe('Nmap Recognition Tests', () => {
  let rtspServer;
  let brandDetector;
  let mockSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock socket
    mockSocket = {
      remoteAddress: '127.0.0.1',
      localAddress: '127.0.0.1',
      localPort: 554,
      write: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    };
    
    // Create instances
    rtspServer = new RTSPServer();
    brandDetector = new BrandDetector();
  });

  afterEach(() => {
    if (rtspServer && rtspServer.sessions) {
      rtspServer.sessions.clear();
    }
  });

  describe('Hikvision Brand Recognition', () => {
    test('should return Hikvision server signature in OPTIONS response', async () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/hikvision/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 200 OK')
      );
      
      const response = mockSocket.write.mock.calls[0][0];
      expect(response).toContain('Public: OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN, PAUSE');
    });

    test('should return Hikvision unauthorized response format', async () => {
      const request = 'DESCRIBE rtsp://192.168.1.100:554/hikvision/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
      
      const response = mockSocket.write.mock.calls[0][0];
      expect(response).toContain('WWW-Authenticate: Digest realm="Hikvision"');
      expect(response).toContain('WWW-Authenticate: Basic realm="/"');
    });

    test('should detect Hikvision brand from port 80', () => {
      mockSocket.localPort = 80;
      const brand = brandDetector.detectBrand(mockSocket, '', '');
      expect(brand).toBe('hikvision');
    });

    test('should detect Hikvision brand from path', () => {
      const brand = brandDetector.detectBrandByPath('/hikvision/stream');
      expect(brand).toBe('hikvision');
    });

    test('should detect Hikvision brand from User-Agent', () => {
      const brand = brandDetector.detectBrandByUserAgent('Hikvision DVR');
      expect(brand).toBe('hikvision');
    });
  });

  describe('Dahua Brand Recognition', () => {
    test('should return Dahua server signature in OPTIONS response (405 Method Not Allowed)', async () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/dahua/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 405 Method Not Allowed')
      );
      
      const response = mockSocket.write.mock.calls[0][0];
      expect(response).toContain('Server: Dahua Rtsp Server');
      expect(response).toContain('Content-Length: 0');
    });

    test('should return Dahua unauthorized response format', async () => {
      const request = 'DESCRIBE rtsp://192.168.1.100:554/dahua/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
      
      const response = mockSocket.write.mock.calls[0][0];
      expect(response).toContain('WWW-Authenticate: Basic realm="device"');
      expect(response).toContain('Server: Dahua Rtsp Server');
    });

    test('should detect Dahua brand from port 37777', () => {
      mockSocket.localPort = 37777;
      const brand = brandDetector.detectBrand(mockSocket, '', '');
      expect(brand).toBe('dahua');
    });

    test('should detect Dahua brand from path', () => {
      const brand = brandDetector.detectBrandByPath('/dahua/stream');
      expect(brand).toBe('dahua');
    });

    test('should detect Dahua brand from User-Agent', () => {
      const brand = brandDetector.detectBrandByUserAgent('Dahua IP Camera');
      expect(brand).toBe('dahua');
    });
  });

  describe('Axis Brand Recognition', () => {
    test('should return Axis server signature in OPTIONS response', async () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/axis/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 200 OK')
      );
      
      const response = mockSocket.write.mock.calls[0][0];
      expect(response).toContain('Public: DESCRIBE, GET_PARAMETER, PAUSE, PLAY, SETUP, TEARDOWN');
    });

    test('should return Axis unauthorized response format', async () => {
      const request = 'DESCRIBE rtsp://192.168.1.100:554/axis/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
      
      const response = mockSocket.write.mock.calls[0][0];
      expect(response).toContain('WWW-Authenticate: Basic realm="device"');
    });

    test('should detect Axis brand from port 10000', () => {
      mockSocket.localPort = 10000;
      const brand = brandDetector.detectBrand(mockSocket, '', '');
      expect(brand).toBe('axis');
    });

    test('should detect Axis brand from path', () => {
      const brand = brandDetector.detectBrandByPath('/axis/stream');
      expect(brand).toBe('axis');
    });

    test('should detect Axis brand from User-Agent', () => {
      const brand = brandDetector.detectBrandByUserAgent('Axis Network Camera');
      expect(brand).toBe('axis');
    });
  });

  describe('Reolink Brand Recognition', () => {
    test('should return Reolink server signature in OPTIONS response', async () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/reolink/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 200 OK')
      );
      
      const response = mockSocket.write.mock.calls[0][0];
      expect(response).toContain('Public: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN');
    });

    test('should return Reolink unauthorized response format', async () => {
      const request = 'DESCRIBE rtsp://192.168.1.100:554/reolink/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
      
      const response = mockSocket.write.mock.calls[0][0];
      expect(response).toContain('WWW-Authenticate: Basic realm="device"');
    });

    test('should detect Reolink brand from port 8081', () => {
      mockSocket.localPort = 8081;
      const brand = brandDetector.detectBrand(mockSocket, '', '');
      expect(brand).toBe('reolink');
    });

    test('should detect Reolink brand from path', () => {
      const brand = brandDetector.detectBrandByPath('/reolink/stream');
      expect(brand).toBe('reolink');
    });

    test('should detect Reolink brand from User-Agent', () => {
      const brand = brandDetector.detectBrandByUserAgent('Reolink IP Camera');
      expect(brand).toBe('reolink');
    });
  });

  describe('Mobotix Brand Recognition', () => {
    test('should return Mobotix server signature in OPTIONS response', async () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/mobotix/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 200 OK')
      );
      
      const response = mockSocket.write.mock.calls[0][0];
      expect(response).toContain('Public: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN');
    });

    test('should return Mobotix unauthorized response format', async () => {
      const request = 'DESCRIBE rtsp://192.168.1.100:554/mobotix/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
      
      const response = mockSocket.write.mock.calls[0][0];
      expect(response).toContain('WWW-Authenticate: Basic realm="device"');
    });

    test('should detect Mobotix brand from port 443', () => {
      mockSocket.localPort = 443;
      const brand = brandDetector.detectBrand(mockSocket, '', '');
      expect(brand).toBe('mobotix');
    });

    test('should detect Mobotix brand from path', () => {
      const brand = brandDetector.detectBrandByPath('/mobotix/stream');
      expect(brand).toBe('mobotix');
    });

    test('should detect Mobotix brand from User-Agent', () => {
      const brand = brandDetector.detectBrandByUserAgent('Mobotix IP Camera');
      expect(brand).toBe('mobotix');
    });
  });

  describe('Vstarcam Brand Recognition', () => {
    test('should return Vstarcam server signature in OPTIONS response', async () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/vstarcam/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 200 OK')
      );
      
      const response = mockSocket.write.mock.calls[0][0];
      expect(response).toContain('Public: OPTIONS, DESCRIBE, SETUP, PLAY, PAUSE, TEARDOWN');
    });

    test('should return Vstarcam unauthorized response format', async () => {
      const request = 'DESCRIBE rtsp://192.168.1.100:554/vstarcam/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
      
      const response = mockSocket.write.mock.calls[0][0];
      expect(response).toContain('WWW-Authenticate: Basic realm="device"');
    });

    test('should detect Vstarcam brand from port 81', () => {
      mockSocket.localPort = 81;
      const brand = brandDetector.detectBrand(mockSocket, '', '');
      expect(brand).toBe('vstarcam');
    });

    test('should detect Vstarcam brand from path', () => {
      const brand = brandDetector.detectBrandByPath('/vstarcam/stream');
      expect(brand).toBe('vstarcam');
    });

    test('should detect Vstarcam brand from User-Agent', () => {
      const brand = brandDetector.detectBrandByUserAgent('Vstarcam IP Camera');
      expect(brand).toBe('vstarcam');
    });
  });

  describe('Brand Configuration Validation', () => {
    test('should have correct brand names for nmap recognition', () => {
      const expectedNames = {
        hikvision: 'Hikvision DVR rtspd',
        dahua: 'Dahua IP camera rtspd',
        axis: 'Axis 207W Webcam rtspd',
        reolink: 'Reolink IP camera rtspd',
        mobotix: 'Mobotix IP camera rtspd',
        vstarcam: 'Vstarcam IP camera rtspd'
      };

      Object.entries(expectedNames).forEach(([brand, expectedName]) => {
        const config = brandConfigs[brand];
        expect(config.name).toBe(expectedName);
      });
    });

    test('should have correct server signatures for nmap recognition', () => {
      const expectedServers = {
        hikvision: 'Hikvision DVR rtspd',
        dahua: 'Dahua Rtsp Server',
        axis: 'Axis Rtsp Server',
        reolink: 'Reolink Rtsp Server',
        mobotix: 'Mobotix Rtsp Server',
        vstarcam: 'Vstarcam Rtsp Server'
      };

      Object.entries(expectedServers).forEach(([brand, expectedServer]) => {
        const config = brandConfigs[brand];
        expect(config.server).toBe(expectedServer);
      });
    });

    test('should have consistent unauthorized response patterns', () => {
      const brands = Object.keys(brandConfigs);
      
      brands.forEach(brand => {
        const config = brandConfigs[brand];
        expect(config.patterns.unauthorized).toBeInstanceOf(Function);
        
        const nonce = 'testnonce123';
        const response = config.patterns.unauthorized(nonce);
        
        expect(response).toContain('RTSP/1.0 401 Unauthorized');
        expect(response).toContain('WWW-Authenticate: Basic');
      });
    });

    test('should have consistent OPTIONS response patterns', () => {
      const brands = Object.keys(brandConfigs);
      
      brands.forEach(brand => {
        const config = brandConfigs[brand];
        expect(config.patterns.options).toBeDefined();
        expect(config.patterns.options.pattern1).toBeDefined();
        expect(config.patterns.options.pattern2).toBeInstanceOf(Function);
      });
    });
  });

  describe('Port-Based Brand Detection Priority', () => {
    test('should prioritize port detection over default brand', () => {
      const portBrandMap = {
        80: 'hikvision',
        81: 'vstarcam',
        37777: 'dahua',
        443: 'mobotix',
        10000: 'axis',
        8081: 'reolink'
      };

      Object.entries(portBrandMap).forEach(([port, expectedBrand]) => {
        mockSocket.localPort = parseInt(port);
        const brand = brandDetector.detectBrand(mockSocket, '', '');
        expect(brand).toBe(expectedBrand);
      });
    });

    test('should fall back to default brand for unknown ports', () => {
      const unknownPorts = [8080, 9000, 5000, 3000];
      
      unknownPorts.forEach(port => {
        mockSocket.localPort = port;
        const brand = brandDetector.detectBrand(mockSocket, '', '');
        expect(brand).toBe('hikvision'); // Default fallback
      });
    });
  });

  describe('Path-Based Brand Detection Priority', () => {
    test('should prioritize path detection over port detection', () => {
      mockSocket.localPort = 80; // Hikvision port
      
      const pathBrandMap = {
        '/hikvision/stream': 'hikvision',
        '/dahua/stream': 'dahua',
        '/axis/stream': 'axis',
        '/reolink/stream': 'reolink',
        '/mobotix/stream': 'mobotix',
        '/vstarcam/stream': 'vstarcam'
      };

      Object.entries(pathBrandMap).forEach(([path, expectedBrand]) => {
        const brand = brandDetector.detectBrand(mockSocket, '', path);
        expect(brand).toBe(expectedBrand);
      });
    });
  });

  describe('User-Agent-Based Brand Detection Priority', () => {
    test('should prioritize User-Agent detection over other methods', () => {
      mockSocket.localPort = 80; // Hikvision port
      
      const userAgentBrandMap = {
        'Hikvision DVR': 'hikvision',
        'Dahua IP Camera': 'dahua',
        'Axis Network Camera': 'axis',
        'Reolink IP Camera': 'reolink',
        'Mobotix IP Camera': 'mobotix',
        'Vstarcam IP Camera': 'vstarcam'
      };

      Object.entries(userAgentBrandMap).forEach(([userAgent, expectedBrand]) => {
        const request = `OPTIONS rtsp://192.168.1.100:554/stream RTSP/1.0\r\nUser-Agent: ${userAgent}\r\nCSeq: 1\r\n\r\n`;
        const brand = brandDetector.detectBrand(mockSocket, request, '');
        expect(brand).toBe(expectedBrand);
      });
    });
  });

  describe('Nmap Fingerprinting Compatibility', () => {
    test('should return responses that nmap can fingerprint correctly', async () => {
      const brands = ['hikvision', 'dahua', 'axis', 'reolink', 'mobotix', 'vstarcam'];
      
      for (const brand of brands) {
        const request = `OPTIONS rtsp://192.168.1.100:554/${brand}/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n`;
        
        await rtspServer.handleRequest(mockSocket, Buffer.from(request));
        
        const response = mockSocket.write.mock.calls[0][0];
        
        // Verify response format is nmap-friendly
        expect(response).toMatch(/^RTSP\/1\.0 \d+ .*\r\n/);
        expect(response).toContain('\r\n\r\n');
        
        // Verify brand-specific characteristics
        if (brand === 'dahua') {
          expect(response).toContain('RTSP/1.0 405 Method Not Allowed');
          expect(response).toContain('Server: Dahua Rtsp Server');
        } else {
          expect(response).toContain('RTSP/1.0 200 OK');
        }
        
        // Reset mock for next iteration
        mockSocket.write.mockClear();
      }
    });

    test('should maintain consistent response patterns for each brand', () => {
      const brands = ['hikvision', 'dahua', 'axis', 'reolink', 'mobotix', 'vstarcam'];
      
      brands.forEach(brand => {
        const config = brandConfigs[brand];
        
        // Each brand should have both name and server properties
        expect(config.name).toBeTruthy();
        expect(config.server).toBeTruthy();
        // Note: name and server can be the same (e.g., Hikvision)
        
        // Each brand should have consistent response patterns
        expect(config.patterns.options.pattern1).toBeTruthy();
        expect(config.patterns.unauthorized).toBeInstanceOf(Function);
      });
    });
  });
}); 