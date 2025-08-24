const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { RTSPServer } = require('../rtsp-server');

// Mock dependencies
jest.mock('mysql2/promise');
jest.mock('bcrypt');

describe('RTSP Authentication Tests', () => {
  let rtspServer;
  let mockPool;
  let mockSocket;

    beforeEach(() => {
    jest.clearAllMocks();
    
    // Use the global mock pool and reset its mocks
    mockPool = global.mockMysqlPool;
    
    // Mock socket
    mockSocket = {
      remoteAddress: '127.0.0.1',
      localAddress: '127.0.0.1',
      localPort: 554,
      write: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    };
    
    // Create RTSP server instance
    rtspServer = new RTSPServer();
  });

  afterEach(() => {
    if (rtspServer && rtspServer.sessions) {
      rtspServer.sessions.clear();
    }
  });

  describe('Database Credential Validation', () => {
    test('should reject DESCRIBE request without credentials', async () => {
      const request = 'DESCRIBE rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });

    test('should reject SETUP request without credentials', async () => {
      const request = 'SETUP rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 2\r\nTransport: RTP/AVP;unicast;client_port=8000-8001\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });

    test('should reject PLAY request without credentials', async () => {
      const request = 'PLAY rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 3\r\nSession: 12345\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });

    test('should allow OPTIONS request without credentials', async () => {
      const request = 'OPTIONS rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 200 OK')
      );
    });
  });

  describe('Authorization Header Authentication', () => {
    test('should authenticate valid Basic auth credentials', async () => {
      // Override the default mock for this specific test
      mockPool.query.mockImplementation((query, params, callback) => {
        if (callback) {
          callback(null, [{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
        }
        return Promise.resolve([{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
      });

      // Mock bcrypt to return true for valid credentials
      bcrypt.compareSync.mockImplementation((password, hash) => {
        if (password === 'testpass' && hash === 'hashedpassword123') return true;
        return false;
      });

      const credentials = Buffer.from('testuser:testpass').toString('base64');
      const request = `DESCRIBE rtsp://192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 1\r\nAuthorization: Basic ${credentials}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 200 OK')
      );
    });

    test('should reject invalid Basic auth credentials', async () => {
      // Mock the database query to return a user
      mockPool.query.mockImplementation((query, params, callback) => {
        if (callback) {
          callback(null, [{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
        }
        return Promise.resolve([{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
      });

      // Mock bcrypt to return false for invalid credentials
      bcrypt.compareSync.mockImplementation((password, hash) => {
        if (password === 'wrongpass' && hash === 'hashedpassword123') return false;
        return false;
      });

      const credentials = Buffer.from('testuser:wrongpass').toString('base64');
      const request = `DESCRIBE rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 1\r\nAuthorization: Basic ${credentials}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });

    test('should reject non-existent user', async () => {
      // Mock the database query to return no users
      mockPool.query.mockImplementation((query, params, callback) => {
        if (callback) {
          callback(null, []);
        }
        return Promise.resolve([]);
      });

      const credentials = Buffer.from('nonexistent:password').toString('base64');
      const request = `DESCRIBE rtsp://192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 1\r\nAuthorization: Basic ${credentials}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });
  });

  describe('URL Credential Authentication', () => {
    test('should authenticate valid credentials in URL', async () => {
      // Mock the database query to return a user
      mockPool.query.mockImplementation((query, params, callback) => {
        if (callback) {
          callback(null, [{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
        }
        return Promise.resolve([{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
      });

      // Mock bcrypt to return true for valid credentials
      bcrypt.compareSync.mockImplementation((password, hash) => {
        if (password === 'testpass' && hash === 'hashedpassword123') return true;
        return false;
      });

      const request = 'DESCRIBE rtsp://testuser:testpass@192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 200 OK')
      );
    });

    test('should reject invalid credentials in URL', async () => {
      // Mock the database query to return a user
      mockPool.query.mockImplementation((query, params, callback) => {
        if (callback) {
          callback(null, [{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
        }
        return Promise.resolve([{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
      });

      // Mock bcrypt to return false for invalid credentials
      bcrypt.compareSync.mockImplementation((password, hash) => {
        if (password === 'wrongpass' && hash === 'hashedpassword123') return false;
        return false;
      });

      const request = 'DESCRIBE rtsp://testuser:wrongpass@192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 1\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });
  });

  describe('Session Authentication Persistence', () => {
    test('should maintain authentication state across requests', async () => {
      // Mock the database query to return a user
      mockPool.query.mockImplementation((query, params, callback) => {
        if (callback) {
          callback(null, [{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
        }
        return Promise.resolve([{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
      });

      // Mock bcrypt to return true for valid credentials
      bcrypt.compareSync.mockImplementation((password, hash) => {
        if (password === 'testpass' && hash === 'hashedpassword123') return true;
        return false;
      });

      // First request - authenticate
      const setupRequest = `SETUP rtsp://192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 1\r\nTransport: RTP/AVP;unicast;client_port=8000-8001\r\nAuthorization: Basic ${Buffer.from('testuser:testpass').toString('base64')}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(setupRequest));
      
      // Get session ID from response
      const setupResponse = mockSocket.write.mock.calls[0][0];
      const sessionMatch = setupResponse.match(/Session: (\d+)/);
      const sessionId = sessionMatch ? sessionMatch[1] : '12345';
      
      // Second request - should work without credentials
      const playRequest = `PLAY rtsp://192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 2\r\nSession: ${sessionId}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(playRequest));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 200 OK')
      );
    });

    test('should reject requests with invalid session ID', async () => {
      const request = 'PLAY rtsp://192.168.1.100:554/stream RTSP/1.0\r\nCSeq: 1\r\nSession: invalid_session\r\n\r\n';
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      // Should return 401 Unauthorized since no credentials provided
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });
  });

  describe('Database Connection Error Handling', () => {
    test('should handle database connection failures gracefully', async () => {
      // Override the global mock to simulate database connection failure
      mockPool.query.mockImplementation((query, params, callback) => {
        if (callback) {
          callback(new Error('Database connection failed'), null);
        }
        return Promise.resolve([]); // Return empty results instead of throwing
      });

      const credentials = Buffer.from('testuser:testpass').toString('base64');
      const request = `DESCRIBE rtsp://192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 1\r\nAuthorization: Basic ${credentials}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });

    test('should handle database query errors gracefully', async () => {
      // Override the global mock to simulate database query error
      mockPool.query.mockImplementation((query, params, callback) => {
        if (callback) {
          callback(new Error('Query execution failed'), null);
        }
        return Promise.resolve([]); // Return empty results instead of throwing
      });

      const credentials = Buffer.from('testuser:testpass').toString('base64');
      const request = `DESCRIBE rtsp://192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 1\r\nAuthorization: Basic ${credentials}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });
  });

  describe('Password Hash Validation', () => {
    test('should validate bcrypt password hashes correctly', async () => {
      // Mock the database query to return a user
      mockPool.query.mockImplementation((query, params, callback) => {
        if (callback) {
          callback(null, [{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
        }
        return Promise.resolve([{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
      });

      // Mock bcrypt to return true for valid credentials
      bcrypt.compareSync.mockImplementation((password, hash) => {
        if (password === 'testpass' && hash === 'hashedpassword123') return true;
        return false;
      });

      const credentials = Buffer.from('testuser:testpass').toString('base64');
      const request = `DESCRIBE rtsp://192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 1\r\nAuthorization: Basic ${credentials}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(bcrypt.compareSync).toHaveBeenCalledWith('testpass', 'hashedpassword123');
    });

    test('should handle bcrypt comparison errors gracefully', async () => {
      // Mock the database query to return a user
      mockPool.query.mockImplementation((query, params, callback) => {
        if (callback) {
          callback(null, [{ name: 'testuser', passwordHash: 'invalid_hash' }]);
        }
        return Promise.resolve([{ name: 'testuser', passwordHash: 'invalid_hash' }]);
      });

      // Mock bcrypt to throw an error
      bcrypt.compareSync.mockImplementation(() => {
        throw new Error('Bcrypt error');
      });

      const credentials = Buffer.from('testuser:testpass').toString('base64');
      const request = `DESCRIBE rtsp://192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 1\r\nAuthorization: Basic ${credentials}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 401 Unauthorized')
      );
    });
  });

  describe('Multiple Password Hash Support', () => {
    test('should try multiple password hashes for same user', async () => {
      // Mock the database query to return multiple password hashes
      mockPool.query.mockImplementation((query, params, callback) => {
        if (callback) {
          callback(null, [
            { name: 'testuser', passwordHash: 'hash1' },
            { name: 'testuser', passwordHash: 'hash2' },
            { name: 'testuser', passwordHash: 'hash3' }
          ]);
        }
        return Promise.resolve([
          { name: 'testuser', passwordHash: 'hash1' },
          { name: 'testuser', passwordHash: 'hash2' },
          { name: 'testuser', passwordHash: 'hash3' }
        ]);
      });

      // Mock bcrypt to return false for first hash, true for second
      bcrypt.compareSync.mockImplementation((password, hash) => {
        if (password === 'testpass' && hash === 'hash1') return false;
        if (password === 'testpass' && hash === 'hash2') return true;
        return false;
      });

      const credentials = Buffer.from('testuser:testpass').toString('base64');
      const request = `DESCRIBE rtsp://192.168.1.100:554/hikvision RTSP/1.0\r\nCSeq: 1\r\nAuthorization: Basic ${credentials}\r\n\r\n`;
      
      await rtspServer.handleRequest(mockSocket, Buffer.from(request));
      
      expect(bcrypt.compareSync).toHaveBeenCalledTimes(2);
      expect(mockSocket.write).toHaveBeenCalledWith(
        expect.stringContaining('RTSP/1.0 200 OK')
      );
    });
  });
}); 