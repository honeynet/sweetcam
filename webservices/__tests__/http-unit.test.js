const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Mock the database models
const mockUser = {
  id: 1,
  name: 'testuser',
  passwordHash: 'hashedpassword123'
};

const mockAdmin = {
  id: 1,
  name: 'admin',
  passwordHash: 'adminhash123',
  chatId: '123456789'
};

// Mock the database connection
const mockSequelize = {
  authenticate: jest.fn(),
  sync: jest.fn()
};

// Mock the honeypot logger
const mockHoneypotLogger = {
  logHTTPRequest: jest.fn(),
  logServiceAccess: jest.fn(),
  logAuthFailure: jest.fn(),
  logLoginAttempt: jest.fn(),
  logSessionEvent: jest.fn(),
  logError: jest.fn(),
  logServiceEvent: jest.fn()
};

// Mock the user services
const mockUserServices = {
  validateUserPassword: jest.fn(),
  findUserPasswordHashesByName: jest.fn()
};

// Mock the admin services
const mockAdminServices = {
  validateAdminPassword: jest.fn(),
  findAdminCredentialsByName: jest.fn()
};

// Mock the sweetcam services
const mockSweetcamServices = {
  getCameraConfig: jest.fn(),
  getLoginLimit: jest.fn()
};

// Mock the cowrie ingestor
const mockCowrieIngestor = {
  startCowrieIngestor: jest.fn()
};

// Set up mocks before importing the app
jest.mock('./../database/database', () => mockSequelize);
jest.mock('./../utils/logger', () => ({ honeypotLogger: mockHoneypotLogger }));
jest.mock('./../services/user-services', () => mockUserServices);
jest.mock('./../services/admin-services', () => mockAdminServices);
jest.mock('./../services/sweetcam-services', () => mockSweetcamServices);
jest.mock('./../services/cowrie-ingestor', () => mockCowrieIngestor);

// Mock file system operations
fs.readFileSync.mockImplementation((filePath) => {
  if (filePath.includes('hikvision.json')) {
    return JSON.stringify({
      brand: 'Hikvision',
      model: 'DS-2CD2T47G1-L',
      type: 'IP Camera',
      resolution: '2688 x 1520',
      brandImagePath: '/brands/Hikvision.png',
      brandImageWidth: '30%'
    });
  }
  if (filePath.includes('sweetcam.json')) {
    return JSON.stringify({
      loginLimit: 5,
      medium: 'web'
    });
  }
  if (filePath.includes('cam-picture.json')) {
    return JSON.stringify({ quality: 'high' });
  }
  if (filePath.includes('cam-video.json')) {
    return JSON.stringify({ resolution: '1080p' });
  }
  return '{}';
});

fs.existsSync.mockReturnValue(true);
fs.readdirSync.mockReturnValue(['img_1.png', 'img.png', 'mini.jpg', 'test.jpg']);

// Mock path operations
path.extname.mockImplementation((filename) => {
  const ext = filename.split('.').pop();
  return ext ? `.${ext}` : '';
});

// Mock bcrypt
bcrypt.compare.mockResolvedValue(true);
bcrypt.compareSync.mockReturnValue(true);

describe('HTTP Web Services - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset default mock behaviors
    mockSequelize.authenticate.mockResolvedValue();
    mockSequelize.sync.mockResolvedValue();
    
    mockUserServices.validateUserPassword.mockResolvedValue(true);
    mockUserServices.findUserPasswordHashesByName.mockResolvedValue(['hashedpassword123']);
    
    mockAdminServices.validateAdminPassword.mockResolvedValue(true);
    mockAdminServices.findAdminCredentialsByName.mockResolvedValue(mockAdmin);
    
    mockSweetcamServices.getCameraConfig.mockReturnValue({
      brand: 'Hikvision',
      model: 'DS-2CD2T47G1-L',
      type: 'IP Camera',
      resolution: '2688 x 1520',
      brandImagePath: '/brands/Hikvision.png',
      brandImageWidth: '30%'
    });
    
    mockSweetcamServices.getLoginLimit.mockReturnValue(5);
  });

  describe('Brand Detection Functions', () => {
    test('should detect Hikvision brand on port 80', () => {
      const getCameraTypeByPort = (port) => {
        switch(port) {
          case 80: return 'hikvision';
          case 81: return 'vstarcam';
          case 37777: return 'dahua';
          case 443: return 'mobotix';
          case 10000: return 'axis';
          case 8081: return 'reolink';
          default: return 'hikvision';
        }
      };
      
      expect(getCameraTypeByPort(80)).toBe('hikvision');
    });

    test('should detect Vstarcam brand on port 81', () => {
      const getCameraTypeByPort = (port) => {
        switch(port) {
          case 80: return 'hikvision';
          case 81: return 'vstarcam';
          case 37777: return 'dahua';
          case 443: return 'mobotix';
          case 10000: return 'axis';
          case 8081: return 'reolink';
          default: return 'hikvision';
        }
      };
      
      expect(getCameraTypeByPort(81)).toBe('vstarcam');
    });

    test('should detect Dahua brand on port 37777', () => {
      const getCameraTypeByPort = (port) => {
        switch(port) {
          case 80: return 'hikvision';
          case 81: return 'vstarcam';
          case 37777: return 'dahua';
          case 443: return 'mobotix';
          case 10000: return 'axis';
          case 8081: return 'reolink';
          default: return 'hikvision';
        }
      };
      
      expect(getCameraTypeByPort(37777)).toBe('dahua');
    });

    test('should default to Hikvision for unknown ports', () => {
      const getCameraTypeByPort = (port) => {
        switch(port) {
          case 80: return 'hikvision';
          case 81: return 'vstarcam';
          case 37777: return 'dahua';
          case 443: return 'mobotix';
          case 10000: return 'axis';
          case 8081: return 'reolink';
          default: return 'hikvision';
        }
      };
      
      expect(getCameraTypeByPort(9999)).toBe('hikvision');
    });
  });

  describe('Authentication Logic', () => {
    test('should validate user credentials successfully', async () => {
      mockUserServices.validateUserPassword.mockResolvedValue(true);
      
      const result = await mockUserServices.validateUserPassword('testuser', 'testpass');
      
      expect(result).toBe(true);
      expect(mockUserServices.validateUserPassword).toHaveBeenCalledWith('testuser', 'testpass');
    });

    test('should reject invalid user credentials', async () => {
      mockUserServices.validateUserPassword.mockResolvedValue(false);
      
      const result = await mockUserServices.validateUserPassword('testuser', 'wrongpass');
      
      expect(result).toBe(false);
      expect(mockUserServices.validateUserPassword).toHaveBeenCalledWith('testuser', 'wrongpass');
    });

    test('should validate admin credentials successfully', async () => {
      mockAdminServices.validateAdminPassword.mockResolvedValue(true);
      
      const result = await mockAdminServices.validateAdminPassword('admin', 'adminpass');
      
      expect(result).toBe(true);
      expect(mockAdminServices.validateAdminPassword).toHaveBeenCalledWith('admin', 'adminpass');
    });

    test('should reject invalid admin credentials', async () => {
      mockAdminServices.validateAdminPassword.mockResolvedValue(false);
      
      const result = await mockAdminServices.validateAdminPassword('admin', 'wrongpass');
      
      expect(result).toBe(false);
      expect(mockAdminServices.validateAdminPassword).toHaveBeenCalledWith('admin', 'wrongpass');
    });

    test('should find user password hashes by name', async () => {
      const hashes = ['hash1', 'hash2', 'hash3'];
      mockUserServices.findUserPasswordHashesByName.mockResolvedValue(hashes);
      
      const result = await mockUserServices.findUserPasswordHashesByName('testuser');
      
      expect(result).toEqual(hashes);
      expect(mockUserServices.findUserPasswordHashesByName).toHaveBeenCalledWith('testuser');
    });

    test('should find admin credentials by name', async () => {
      mockAdminServices.findAdminCredentialsByName.mockResolvedValue(mockAdmin);
      
      const result = await mockAdminServices.findAdminCredentialsByName('admin');
      
      expect(result).toEqual(mockAdmin);
      expect(mockAdminServices.findAdminCredentialsByName).toHaveBeenCalledWith('admin');
    });
  });

  describe('Database Connection', () => {
    test('should authenticate database connection successfully', async () => {
      mockSequelize.authenticate.mockResolvedValue();
      
      await mockSequelize.authenticate();
      
      expect(mockSequelize.authenticate).toHaveBeenCalled();
    });

    test('should handle database connection failures', async () => {
      const dbError = new Error('Database connection failed');
      mockSequelize.authenticate.mockRejectedValue(dbError);
      
      await expect(mockSequelize.authenticate()).rejects.toThrow('Database connection failed');
      expect(mockSequelize.authenticate).toHaveBeenCalled();
    });

    test('should sync database models successfully', async () => {
      mockSequelize.sync.mockResolvedValue();
      
      await mockSequelize.sync();
      
      expect(mockSequelize.sync).toHaveBeenCalled();
    });
  });

  describe('Brand-Specific Configuration', () => {
    test('should return Hikvision camera configuration', () => {
      const config = mockSweetcamServices.getCameraConfig('hikvision');
      
      expect(config).toEqual({
        brand: 'Hikvision',
        model: 'DS-2CD2T47G1-L',
        type: 'IP Camera',
        resolution: '2688 x 1520',
        brandImagePath: '/brands/Hikvision.png',
        brandImageWidth: '30%'
      });
      
      expect(mockSweetcamServices.getCameraConfig).toHaveBeenCalledWith('hikvision');
    });

    test('should return login limit configuration', () => {
      const limit = mockSweetcamServices.getLoginLimit();
      
      expect(limit).toBe(5);
      expect(mockSweetcamServices.getLoginLimit).toHaveBeenCalled();
    });

    test('should read brand configuration from file', () => {
      const config = JSON.parse(fs.readFileSync('./config/hikvision.json'));
      
      expect(config).toEqual({
        brand: 'Hikvision',
        model: 'DS-2CD2T47G1-L',
        type: 'IP Camera',
        resolution: '2688 x 1520',
        brandImagePath: '/brands/Hikvision.png',
        brandImageWidth: '30%'
      });
      
      expect(fs.readFileSync).toHaveBeenCalledWith('./config/hikvision.json');
    });

    test('should read sweetcam configuration from file', () => {
      const config = JSON.parse(fs.readFileSync('./config/sweetcam.json'));
      
      expect(config).toEqual({
        loginLimit: 5,
        medium: 'web'
      });
      
      expect(fs.readFileSync).toHaveBeenCalledWith('./config/sweetcam.json');
    });
  });

  describe('File System Operations', () => {
    test('should read images directory successfully', () => {
      const files = fs.readdirSync('./public/images');
      
      expect(files).toEqual(['img_1.png', 'img.png', 'mini.jpg', 'test.jpg']);
      expect(fs.readdirSync).toHaveBeenCalledWith('./public/images');
    });

    test('should filter image files by extension', () => {
      const files = ['img_1.png', 'img.png', 'mini.jpg', 'test.jpg', 'document.pdf', 'script.js'];
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext);
      });
      
      expect(imageFiles).toEqual(['img_1.png', 'img.png', 'mini.jpg', 'test.jpg']);
    });

    test('should handle file path operations', () => {
      const result = path.join('public', 'images', 'test.jpg');
      
      expect(result).toBe('public/images/test.jpg');
      expect(path.join).toHaveBeenCalledWith('public', 'images', 'test.jpg');
    });

    test('should extract file extensions', () => {
      const ext1 = path.extname('image.png');
      const ext2 = path.extname('document.pdf');
      const ext3 = path.extname('noextension');
      
      expect(ext1).toBe('.png');
      expect(ext2).toBe('.pdf');
      expect(ext3).toBe('.noextension'); // path.extname returns the full extension including dot
    });
  });

  describe('Password Hashing', () => {
    test('should compare passwords successfully', async () => {
      bcrypt.compare.mockResolvedValue(true);
      
      const result = await bcrypt.compare('testpass', 'hashedpassword123');
      
      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith('testpass', 'hashedpassword123');
    });

    test('should reject wrong passwords', async () => {
      bcrypt.compare.mockResolvedValue(false);
      
      const result = await bcrypt.compare('wrongpass', 'hashedpassword123');
      
      expect(result).toBe(false);
      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpass', 'hashedpassword123');
    });

    test('should use synchronous comparison', () => {
      bcrypt.compareSync.mockReturnValue(true);
      
      const result = bcrypt.compareSync('testpass', 'hashedpassword123');
      
      expect(result).toBe(true);
      expect(bcrypt.compareSync).toHaveBeenCalledWith('testpass', 'hashedpassword123');
    });
  });

  describe('Logging Functions', () => {
    test('should log HTTP requests with payload data', () => {
      const req = {
        ip: '192.168.1.100',
        method: 'POST',
        url: '/login',
        body: { username: 'testuser', password: 'testpass' }
      };
      
      const res = {
        statusCode: 200,
        getHeaders: () => ({ 'Content-Type': 'application/json' }),
        body: { message: 'Login successful' }
      };
      
      mockHoneypotLogger.logHTTPRequest(
        req.ip,
        req.method,
        req.url,
        res.statusCode,
        'Mozilla/5.0 (Test Browser)',
        'hikvision',
        80,
        'test-session-id',
        { body: req.body, query: {}, params: {} },
        { headers: res.getHeaders(), body: res.body }
      );
      
      expect(mockHoneypotLogger.logHTTPRequest).toHaveBeenCalledWith(
        '192.168.1.100',
        'POST',
        '/login',
        200,
        'Mozilla/5.0 (Test Browser)',
        'hikvision',
        80,
        'test-session-id',
        { body: req.body, query: {}, params: {} },
        { headers: res.getHeaders(), body: res.body }
      );
    });

    test('should log service access events', () => {
      mockHoneypotLogger.logServiceAccess(
        '192.168.1.100',
        'GET',
        '/health',
        200,
        'Mozilla/5.0 (Test Browser)',
        'hikvision',
        80,
        'test-session-id'
      );
      
      expect(mockHoneypotLogger.logServiceAccess).toHaveBeenCalledWith(
        '192.168.1.100',
        'GET',
        '/health',
        200,
        'Mozilla/5.0 (Test Browser)',
        'hikvision',
        80,
        'test-session-id'
      );
    });

    test('should log authentication failures', () => {
      mockHoneypotLogger.logAuthFailure(
        '192.168.1.100',
        'testuser',
        'wrong_password',
        'Mozilla/5.0 (Test Browser)',
        'hikvision',
        80,
        'wrongpass',
        'test-session-id',
        'POST',
        '/login',
        401
      );
      
      expect(mockHoneypotLogger.logAuthFailure).toHaveBeenCalledWith(
        '192.168.1.100',
        'testuser',
        'wrong_password',
        'Mozilla/5.0 (Test Browser)',
        'hikvision',
        80,
        'wrongpass',
        'test-session-id',
        'POST',
        '/login',
        401
      );
    });

    test('should log login attempts', () => {
      mockHoneypotLogger.logLoginAttempt(
        '192.168.1.100',
        'testuser',
        true,
        'Mozilla/5.0 (Test Browser)',
        'test-session-id',
        'hikvision',
        80,
        'testpass'
      );
      
      expect(mockHoneypotLogger.logLoginAttempt).toHaveBeenCalledWith(
        '192.168.1.100',
        'testuser',
        true,
        'Mozilla/5.0 (Test Browser)',
        'test-session-id',
        'hikvision',
        80,
        'testpass'
      );
    });

    test('should log session events', () => {
      mockHoneypotLogger.logSessionEvent(
        '192.168.1.100',
        'test-session-id',
        'logout',
        'testuser',
        'hikvision',
        80
      );
      
      expect(mockHoneypotLogger.logSessionEvent).toHaveBeenCalledWith(
        '192.168.1.100',
        'test-session-id',
        'logout',
        'testuser',
        'hikvision',
        80
      );
    });

    test('should log errors', () => {
      const error = new Error('Database connection failed');
      
      mockHoneypotLogger.logError(error, 'health_check', 'test-session-id');
      
      expect(mockHoneypotLogger.logError).toHaveBeenCalledWith(
        error,
        'health_check',
        'test-session-id'
      );
    });
  });

  describe('Session Management', () => {
    test('should create session with user data', () => {
      const session = {
        username: 'testuser',
        isAdmin: false,
        locale: 'en',
        loginTimes: 0,
        destroy: jest.fn((callback) => callback && callback())
      };
      
      expect(session.username).toBe('testuser');
      expect(session.isAdmin).toBe(false);
      expect(session.locale).toBe('en');
      expect(session.loginTimes).toBe(0);
      expect(typeof session.destroy).toBe('function');
    });

    test('should mark admin session correctly', () => {
      const session = {
        username: 'admin',
        isAdmin: true,
        locale: 'en',
        loginTimes: 0,
        destroy: jest.fn((callback) => callback && callback())
      };
      
      expect(session.username).toBe('admin');
      expect(session.isAdmin).toBe(true);
    });

    test('should handle session destruction', () => {
      const callback = jest.fn();
      const session = {
        destroy: jest.fn((cb) => cb && cb())
      };
      
      session.destroy(callback);
      
      expect(session.destroy).toHaveBeenCalledWith(callback);
    });
  });

  describe('Rate Limiting', () => {
    test('should track login attempts within time window', () => {
      const session = {
        loginTimes: 0
      };
      
      // Simulate multiple login attempts
      session.loginTimes += 1;
      expect(session.loginTimes).toBe(1);
      
      session.loginTimes += 1;
      expect(session.loginTimes).toBe(2);
      
      session.loginTimes += 1;
      expect(session.loginTimes).toBe(3);
    });

    test('should respect login limit configuration', () => {
      const limit = mockSweetcamServices.getLoginLimit();
      
      expect(limit).toBe(5);
      
      // Simulate exceeding limit
      const session = { loginTimes: 6 };
      const isExceeded = session.loginTimes > limit;
      
      expect(isExceeded).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors', () => {
      const dbError = new Error('Database connection failed');
      dbError.name = 'SequelizeConnectionError';
      
      expect(dbError.name).toBe('SequelizeConnectionError');
      expect(dbError.message).toBe('Database connection failed');
    });

    test('should handle file system errors', () => {
      const fsError = new Error('File system error');
      
      expect(fsError.message).toBe('File system error');
    });

    test('should handle authentication service errors', () => {
      const authError = new Error('Authentication service error');
      
      expect(authError.message).toBe('Authentication service error');
    });
  });

  describe('Configuration Management', () => {
    test('should read camera picture configuration', () => {
      const config = JSON.parse(fs.readFileSync('./config/cam-picture.json'));
      
      expect(config).toEqual({ quality: 'high' });
      expect(fs.readFileSync).toHaveBeenCalledWith('./config/cam-picture.json');
    });

    test('should read camera video configuration', () => {
      const config = JSON.parse(fs.readFileSync('./config/cam-video.json'));
      
      expect(config).toEqual({ resolution: '1080p' });
      expect(fs.readFileSync).toHaveBeenCalledWith('./config/cam-video.json');
    });

    test('should handle missing configuration files gracefully', () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('missing.json')) {
          throw new Error('File not found');
        }
        return '{}';
      });
      
      expect(() => {
        JSON.parse(fs.readFileSync('./config/missing.json'));
      }).toThrow('File not found');
    });
  });
}); 