const net = require('net');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { RTSPServer } = require('./rtsp-server');
const { rtspLogger } = require('./utils/logger');
const { writeServiceLog, writeRTSPLog } = require('./utils/db-logger');
const BrandDetector = require('./utils/brand-detector');

// Mock dependencies
jest.mock('./utils/logger');
jest.mock('./utils/db-logger');
jest.mock('mysql2/promise');
jest.mock('bcrypt');

describe('RTSP Server Tests', () => {
  let rtspServer;
  let mockPool;
  let mockConnection;
  let mockSocket;
  let mockDatabase;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Use the global mock pool
    mockPool = global.mockMysqlPool;
    
    mockConnection = {
      release: jest.fn()
    };
    
    // Mock socket
    mockSocket = {
      remoteAddress: '127.0.0.1',
      localAddress: '127.0.0.1',
      localPort: 554,
      write: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    };
    
    // Mock database for testing
    mockDatabase = {
      users: [
        {
          name: 'testuser',
          passwordHash: 'hashedpassword123'
        },
        {
          name: 'admin',
          passwordHash: 'adminhash456'
        }
      ]
    };
    
    // Mock bcrypt
    bcrypt.compareSync.mockImplementation((password, hash) => {
      if (password === 'testpass' && hash === 'hashedpassword123') return true;
      if (password === 'adminpass' && hash === 'adminhash456') return true;
      return false;
    });
    
    // Create RTSP server instance
    rtspServer = new RTSPServer();
  });

  afterEach(() => {
    if (rtspServer && rtspServer.sessions) {
      rtspServer.sessions.clear();
    }
  });

  describe('Authentication Tests', () => {
    test('should authenticate valid user credentials from database', async () => {
      // Mock database query response
      mockPool.query.mockImplementation((query, params, callback) => {
        if (params[0] === 'testuser') {
          callback(null, [{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
        } else {
          callback(null, []);
        }
      });

      bcrypt.compareSync.mockReturnValue(true);

      const credentials = Buffer.from('testuser:testpass').toString('base64');
      const request = `DESCRIBE rtsp://192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 1\r\nAuthorization: Basic ${credentials}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 200 OK')
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT name, passwordHash FROM users WHERE LOWER(name) = ?',
        ['testuser'],
        expect.any(Function)
      );
    });

    test('should reject invalid user credentials', async () => {
      mockPool.query.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const credentials = Buffer.from('invaliduser:wrongpass').toString('base64');
      const request = `DESCRIBE rtsp://192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 1\r\nAuthorization: Basic ${credentials}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });

    test('should reject wrong password for valid user', async () => {
      mockPool.query.mockImplementation((query, params, callback) => {
        callback(null, [{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
      });

      bcrypt.compareSync.mockReturnValue(false);

      const credentials = Buffer.from('testuser:wrongpass').toString('base64');
      const request = `DESCRIBE rtsp://192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 1\r\nAuthorization: Basic ${credentials}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });

    test('should handle database connection errors gracefully', async () => {
      mockPool.query.mockImplementation((query, params, callback) => {
        callback(new Error('Database connection failed'), null);
      });

      const credentials = Buffer.from('testuser:testpass').toString('base64');
      const request = `DESCRIBE rtsp://192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 1\r\nAuthorization: Basic ${credentials}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });
  });

  describe('Brand Detection Tests', () => {
    test('should detect Hikvision brand correctly', () => {
      const brand = rtspServer.brandDetector.detectBrandByPath('/hikvision/stream');
      expect(brand).toBe('hikvision');
    });

    test('should detect Dahua brand correctly', () => {
      const brand = rtspServer.brandDetector.detectBrandByPath('/dahua/stream');
      expect(brand).toBe('dahua');
    });

    test('should detect Axis brand correctly', () => {
      const brand = rtspServer.brandDetector.detectBrandByPath('/axis/stream');
      expect(brand).toBe('axis');
    });

    test('should detect Reolink brand correctly', () => {
      const brand = rtspServer.brandDetector.detectBrandByPath('/reolink/stream');
      expect(brand).toBe('reolink');
    });

    test('should detect Mobotix brand correctly', () => {
      const brand = rtspServer.brandDetector.detectBrandByPath('/mobotix/stream');
      expect(brand).toBe('mobotix');
    });

    test('should detect Vstarcam brand correctly', () => {
      const brand = rtspServer.brandDetector.detectBrandByPath('/vstarcam/stream');
      expect(brand).toBe('vstarcam');
    });

    test('should default to Hikvision for unknown paths', () => {
      const brand = rtspServer.brandDetector.detectBrandByPath('/unknown/stream');
      expect(brand).toBe('hikvision');
    });

    test('should detect brand by User-Agent header', () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/stream RTSP/1.0\r\nUser-Agent: Hikvision DVR\r\nCSeq: 1\r\n\r\n';
      const brand = rtspServer.brandDetector.detectBrandByUserAgent('Hikvision DVR');
      expect(brand).toBe('hikvision');
    });

    test('should detect brand by port number', () => {
      const brand = rtspServer.brandDetector.detectBrandByPort(80);
      expect(brand).toBe('hikvision');
    });
  });

  describe('Brand-Specific Response Tests', () => {
    test('should return Hikvision-specific OPTIONS response', () => {
      const brandConfig = rtspServer.brandDetector.getBrandConfig('hikvision');
      const response = brandConfig.patterns.options.pattern1;
      
      expect(response).toContain('RTSP/1.0 200 OK');
      expect(response).toContain('Public: OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN, PAUSE');
    });

    test('should return Dahua-specific OPTIONS response (405 Method Not Allowed)', () => {
      const brandConfig = rtspServer.brandDetector.getBrandConfig('dahua');
      const response = brandConfig.patterns.options.pattern1;
      
      expect(response).toContain('RTSP/1.0 405 Method Not Allowed');
      expect(response).toContain('Server: Dahua Rtsp Server');
    });

    test('should return Axis-specific OPTIONS response', () => {
      const brandConfig = rtspServer.brandDetector.getBrandConfig('axis');
      const response = brandConfig.patterns.options.pattern1;
      
      expect(response).toContain('RTSP/1.0 200 OK');
      expect(response).toContain('Public: DESCRIBE, GET_PARAMETER, PAUSE, PLAY, SETUP, TEARDOWN');
    });

    test('should return brand-specific unauthorized responses', () => {
      const nonce = 'testnonce123';
      
      const hikvisionResponse = rtspServer.brandDetector.getBrandConfig('hikvision').patterns.unauthorized(nonce);
      expect(hikvisionResponse).toContain('WWW-Authenticate: Digest realm="Hikvision"');
      expect(hikvisionResponse).toContain(`nonce="${nonce}"`);
      
      const dahuaResponse = rtspServer.brandDetector.getBrandConfig('dahua').patterns.unauthorized(nonce);
      expect(dahuaResponse).toContain('WWW-Authenticate: Basic realm="device"');
      expect(dahuaResponse).toContain('Server: Dahua Rtsp Server');
    });

    test('should generate unique nonces for each request', () => {
      const nonce1 = rtspServer.brandDetector.generateNonce();
      const nonce2 = rtspServer.brandDetector.generateNonce();
      
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1).toHaveLength(32);
      expect(nonce2).toHaveLength(32);
    });
  });

  describe('RTSP Request Parsing Tests', () => {
    test('should parse RTSP OPTIONS request correctly', () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: Test Client\r\n\r\n';
      const parsed = rtspServer.parseRTSPRequest(Buffer.from(request));
      
      expect(parsed.method).toBe('OPTIONS');
      expect(parsed.url).toBe('rtsp://192.168.1.100:554/stream');
      expect(parsed.version).toBe('RTSP/1.0');
      expect(parsed.headers.CSeq).toBe('1');
      expect(parsed.headers['User-Agent']).toBe('Test Client');
    });

    test('should parse RTSP DESCRIBE request correctly', () => {
      const request = 'DESCRIBE rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 2\r\nAccept: application/sdp\r\n\r\n';
      const parsed = rtspServer.parseRTSPRequest(Buffer.from(request));
      
      expect(parsed.method).toBe('DESCRIBE');
      expect(parsed.url).toBe('rtsp://192.168.1.100:554/stream');
      expect(parsed.headers.CSeq).toBe('2');
      expect(parsed.headers.Accept).toBe('application/sdp');
    });

    test('should extract path from RTSP URL correctly', () => {
      const path1 = rtspServer.extractPath('rtsp://192.168.1.100:554/hikvision/stream');
      expect(path1).toBe('/hikvision/stream');
      
      const path2 = rtspServer.extractPath('rtsp://192.168.1.100:554/dahua/stream?param=value');
      expect(path2).toBe('/dahua/stream');
      
      const path3 = rtspServer.extractPath('/stream');
      expect(path3).toBe('/stream');
    });

    test('should parse transport header correctly', () => {
      const transport1 = rtspServer.parseTransport('RTP/AVP;unicast;client_port=8000-8001');
      expect(transport1.rtpPort).toBe(8000);
      expect(transport1.rtcpPort).toBe(8001);
      
      const transport2 = rtspServer.parseTransport();
      expect(transport2.rtpPort).toBe(8000);
      expect(transport2.rtcpPort).toBe(8001);
    });
  });

  describe('SDP Generation Tests', () => {
    test('should generate valid SDP for Hikvision brand', () => {
      const sdp = rtspServer.generateSDP('Hikvision Stream', '192.168.1.100', 'hikvision');
      
      expect(sdp).toContain('v=0');
      expect(sdp).toContain('o=- 0 0 IN IP4 192.168.1.100');
      expect(sdp).toContain('s=Hikvision Stream');
      expect(sdp).toContain('c=IN IP4 192.168.1.100');
      expect(sdp).toContain('m=video 8002 RTP/AVP 26');
      expect(sdp).toContain('a=rtpmap:26 JPEG/90000');
      expect(sdp).toContain('a=framerate:30.0');
    });

    test('should generate SDP with different server address', () => {
      const sdp = rtspServer.generateSDP('Test Stream', '10.0.0.1', 'dahua');
      
      expect(sdp).toContain('o=- 0 0 IN IP4 10.0.0.1');
      expect(sdp).toContain('c=IN IP4 10.0.0.1');
    });
  });

  describe('Stream Management Tests', () => {
    test('should setup streams for all brands', () => {
      expect(rtspServer.streams.size).toBeGreaterThan(0);
      
      const brands = ['hikvision', 'dahua', 'axis', 'reolink', 'mobotix', 'vstarcam'];
      brands.forEach(brand => {
        const stream = rtspServer.streams.get(`/${brand}`);
        expect(stream).toBeDefined();
        expect(stream.brand).toBe(brand);
        expect(stream.rtpPort).toBe(8002);
        expect(stream.rtcpPort).toBe(8003);
      });
    });

    test('should create authenticated session on SETUP', async () => {
      // Mock authentication
      mockPool.query.mockImplementation((query, params, callback) => {
        callback(null, [{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
      });

      const setupRequest = `SETUP rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 3\r\nTransport: RTP/AVP;unicast;client_port=8000-8001\r\nSession: 12345\r\nAuthorization: Basic ${Buffer.from('testuser:testpass').toString('base64')}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(setupRequest));
      
      // Check if session was created
      expect(mockSocket.write).toHaveBeenCalled();
      const response = mockSocket.write.mock.calls[0][0];
      expect(response).toContain('RTSP/1.0 200 OK');
      expect(response).toContain('Session:');
    });
  });

  describe('Logging Tests', () => {
    test('should log RTSP method requests', async () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(rtspLogger.logRTSPMethod).toHaveBeenCalledWith(
        '127.0.0.1',
        'OPTIONS',
        'rtsp://192.168.1.100:554/stream',
        undefined,
        'hikvision',
        554
      );
    });

    test('should log RTSP responses', async () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(rtspLogger.logRTSPResponse).toHaveBeenCalledWith(
        '127.0.0.1',
        'OPTIONS',
        200,
        undefined,
        'hikvision',
        554
      );
    });

    test('should log authentication attempts', async () => {
      const request = `DESCRIBE rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 2\r\nAuthorization: Basic ${Buffer.from('testuser:testpass').toString('base64')}\r\n\r\n`;
      
      // Mock successful authentication
      mockPool.query.mockImplementation((query, params, callback) => {
        callback(null, [{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
      });
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(rtspLogger.logRTSPDatabaseAuth).toHaveBeenCalled();
    });

    test('should log unauthorized access attempts', async () => {
      const request = 'DESCRIBE rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 2\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(rtspLogger.logRTSPSessionWithPayload).toHaveBeenCalled();
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });

    test('should log session events', async () => {
      // Mock authentication
      mockPool.query.mockImplementation((query, params, callback) => {
        callback(null, [{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
      });

      const setupRequest = `SETUP rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 3\r\nTransport: RTP/AVP;unicast;client_port=8000-8001\r\nAuthorization: Basic ${Buffer.from('testuser:testpass').toString('base64')}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(setupRequest));
      
      expect(rtspLogger.logRTSPSession).toHaveBeenCalled();
      expect(rtspLogger.logRTSPStreamSetup).toHaveBeenCalled();
    });
  });

  describe('Database Logging Tests', () => {
    test('should write service logs to database', async () => {
      const logEntry = {
        service: 'rtsp',
        event_type: 'test_event',
        log_level: 'info',
        ip_address: '127.0.0.1',
        message: 'Test log entry'
      };
      
      await writeServiceLog(logEntry);
      
      expect(writeServiceLog).toHaveBeenCalledWith(logEntry);
    });

    test('should write RTSP-specific logs to database', async () => {
      const logEntry = {
        event_type: 'rtsp_method',
        log_level: 'info',
        ip_address: '127.0.0.1',
        rtsp_method: 'OPTIONS',
        stream_path: '/stream'
      };
      
      await writeRTSPLog(logEntry);
      
      expect(writeRTSPLog).toHaveBeenCalledWith(logEntry);
    });

    test('should include payload data in database logs', async () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(rtspLogger.logRTSPSessionWithPayload).toHaveBeenCalledWith(
        '127.0.0.1',
        'OPTIONS',
        'rtsp://192.168.1.100:554/stream',
        200,
        undefined,
        'hikvision',
        554,
        expect.objectContaining({
          headers: expect.any(Object),
          body: request
        }),
        expect.objectContaining({
          status: 200,
          headers: expect.any(Array),
          body: expect.any(String)
        })
      );
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle malformed RTSP requests gracefully', async () => {
      const malformedRequest = 'INVALID REQUEST\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(malformedRequest));
      
      // Should not crash and should not write response
      expect(mockSocket.write).not.toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      mockPool.query.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const request = `DESCRIBE rtsp://192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 2\r\nAuthorization: Basic ${Buffer.from('testuser:testpass').toString('base64')}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });

    test('should handle authentication errors gracefully', async () => {
      const request = `DESCRIBE rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 2\r\nAuthorization: Basic ${Buffer.from('invalid:credentials').toString('base64')}\r\n\r\n`;
      
      // Mock failed authentication
      mockPool.query.mockImplementation((query, params, callback) => {
        callback(null, [{ name: 'invalid', passwordHash: 'wronghash' }]);
      });
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });
  });

  describe('Nmap Recognition Tests', () => {
    test('should return Hikvision-specific server signature', () => {
      const brandConfig = rtspServer.brandDetector.getBrandConfig('hikvision');
      expect(brandConfig.name).toBe('Hikvision DVR rtspd');
      expect(brandConfig.server).toBe('Hikvision DVR rtspd');
    });

    test('should return Dahua-specific server signature', () => {
      const brandConfig = rtspServer.brandDetector.getBrandConfig('dahua');
      expect(brandConfig.name).toBe('Dahua IP camera rtspd');
      expect(brandConfig.server).toBe('Dahua Rtsp Server');
    });

    test('should return Axis-specific server signature', () => {
      const brandConfig = rtspServer.brandDetector.getBrandConfig('axis');
      expect(brandConfig.name).toBe('Axis 207W Webcam rtspd');
      expect(brandConfig.server).toBe('Axis Rtsp Server');
    });

    test('should return Reolink-specific server signature', () => {
      const brandConfig = rtspServer.brandDetector.getBrandConfig('reolink');
      expect(brandConfig.name).toBe('Reolink IP camera rtspd');
      expect(brandConfig.server).toBe('Reolink Rtsp Server');
    });

    test('should return Mobotix-specific server signature', () => {
      const brandConfig = rtspServer.brandDetector.getBrandConfig('mobotix');
      expect(brandConfig.name).toBe('Mobotix IP camera rtspd');
      expect(brandConfig.server).toBe('Mobotix Rtsp Server');
    });

    test('should return Vstarcam-specific server signature', () => {
      const brandConfig = rtspServer.brandDetector.getBrandConfig('vstarcam');
      expect(brandConfig.name).toBe('Vstarcam IP camera rtspd');
      expect(brandConfig.server).toBe('Vstarcam Rtsp Server');
    });
  });
}); 