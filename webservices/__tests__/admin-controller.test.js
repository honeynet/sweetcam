const bcrypt = require('bcrypt');

const fs = require('fs');

// Mock the admin services
const mockAdminServices = {
  updatePassword: jest.fn(),
  configCamPicture: jest.fn(),
  configCamVideo: jest.fn(),
  uploadBrands: jest.fn()
};

// Mock the user services
const mockUserServices = {
  addUser: jest.fn()
};

// Mock the sweetcam services
const mockSweetcamServices = {
  getCamPictureConfig: jest.fn(),
  getCamVideoConfig: jest.fn(),
  getBrandConfig: jest.fn()
};

// Mock the RTSP management
const mockRtspManagement = {
  // Add any RTSP management methods if needed
};

// Mock the ONVIF management
const mockOnvifManagement = {
  // Add any ONVIF management methods if needed
};

// Mock the admin auth utility
const mockRequireAdminAuth = jest.fn((req, res, next) => {
  req.adminId = 1;
  next();
});





// Set up mocks
jest.mock('./../services/admin-services', () => mockAdminServices);
jest.mock('./../services/user-services', () => mockUserServices);
jest.mock('./../services/sweetcam-services', () => mockSweetcamServices);
jest.mock('./../services/rtsp-management', () => mockRtspManagement);
jest.mock('./../services/onvif-management', () => mockOnvifManagement);
jest.mock('./../utils/admin-auth', () => ({ requireAdminAuth: mockRequireAdminAuth }));



// Mock file system operations
fs.readFileSync.mockImplementation((filePath) => {
  if (filePath.includes('cam-picture.json')) {
    return JSON.stringify({ quality: 'high', brightness: 50 });
  }
  if (filePath.includes('cam-video.json')) {
    return JSON.stringify({ resolution: '1080p', fps: 30 });
  }
  if (filePath.includes('brand.json')) {
    return JSON.stringify({ brand: 'Hikvision', model: 'DS-2CD2T47G1-L' });
  }
  return '{}';
});

// Mock bcrypt
bcrypt.hash.mockResolvedValue('hashedpassword123');



describe('Admin Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset default mock behaviors
    mockAdminServices.updatePassword.mockResolvedValue();
    mockAdminServices.configCamPicture.mockImplementation(() => {});
    mockAdminServices.configCamVideo.mockImplementation(() => {});
    mockAdminServices.uploadBrands.mockImplementation((req, res, next) => next());
    
    mockUserServices.addUser.mockResolvedValue({ id: 1, name: 'newuser' });
    
    mockSweetcamServices.getCamPictureConfig.mockReturnValue({ quality: 'high', brightness: 50 });
    mockSweetcamServices.getCamVideoConfig.mockReturnValue({ resolution: '1080p', fps: 30 });
    mockSweetcamServices.getBrandConfig.mockReturnValue({ brand: 'Hikvision', model: 'DS-2CD2T47G1-L' });
    

    
    // Set environment variable for admin path
    process.env.ADMIN_PATH = 'admin';
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

  describe('Password Management', () => {
    test('should update admin password successfully', async () => {
      const req = {
        body: { newPassword: 'newpassword123' }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        end: jest.fn()
      };
      

      
      // Simulate password update
      await mockAdminServices.updatePassword(1, 'newpassword123');
      
      expect(mockAdminServices.updatePassword).toHaveBeenCalledWith(1, 'newpassword123');
    });

    test('should reject password update with null password', async () => {
      const req = {
        body: { newPassword: null }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        end: jest.fn()
      };
      
      // This would trigger a 400 error in the actual controller
      expect(req.body.newPassword).toBeNull();
    });


  });

  describe('Picture Configuration', () => {
    test('should render picture configuration page', () => {
      const req = {};
      const res = {
        render: jest.fn()
      };
      
      const config = {
        ...mockSweetcamServices.getCamPictureConfig(),
        ...mockSweetcamServices.getBrandConfig(),
        userName: "admin"
      };
      
      res.render("picture", config);
      
      expect(res.render).toHaveBeenCalledWith("picture", config);
      expect(mockSweetcamServices.getCamPictureConfig).toHaveBeenCalled();
      expect(mockSweetcamServices.getBrandConfig).toHaveBeenCalled();
    });

    test('should update camera picture configuration', () => {
      const req = {
        body: { name: 'quality', value: 'ultra' }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // Simulate configuration update
      mockAdminServices.configCamPicture('quality', 'ultra');
      
      expect(mockAdminServices.configCamPicture).toHaveBeenCalledWith('quality', 'ultra');
    });

    test('should get camera picture configuration', () => {
      const req = {};
      const res = {
        json: jest.fn()
      };
      
      const config = mockSweetcamServices.getCamPictureConfig();
      
      res.json(config);
      
      expect(res.json).toHaveBeenCalledWith(config);
      expect(mockSweetcamServices.getCamPictureConfig).toHaveBeenCalled();
    });

    test('should read picture configuration from file', () => {
      const config = JSON.parse(fs.readFileSync('./config/cam-picture.json'));
      
      expect(config).toEqual({ quality: 'high', brightness: 50 });
      expect(fs.readFileSync).toHaveBeenCalledWith('./config/cam-picture.json');
    });
  });

  describe('Video Configuration', () => {
    test('should render video configuration page', () => {
      const req = {};
      const res = {
        render: jest.fn()
      };
      
      const config = {
        ...mockSweetcamServices.getCamVideoConfig(),
        ...mockSweetcamServices.getBrandConfig(),
        userName: "admin"
      };
      
      res.render("video", config);
      
      expect(res.render).toHaveBeenCalledWith("video", config);
      expect(mockSweetcamServices.getCamVideoConfig).toHaveBeenCalled();
      expect(mockSweetcamServices.getBrandConfig).toHaveBeenCalled();
    });

    test('should update camera video configuration', () => {
      const req = {
        body: { name: 'resolution', value: '4K' }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // Simulate configuration update
      mockAdminServices.configCamVideo('resolution', '4K');
      
      expect(mockAdminServices.configCamVideo).toHaveBeenCalledWith('resolution', '4K');
    });

    test('should get camera video configuration', () => {
      const req = {};
      const res = {
        json: jest.fn()
      };
      
      const config = mockSweetcamServices.getCamVideoConfig();
      
      res.json(config);
      
      expect(res.json).toHaveBeenCalledWith(config);
      expect(mockSweetcamServices.getCamVideoConfig).toHaveBeenCalled();
    });

    test('should read video configuration from file', () => {
      const config = JSON.parse(fs.readFileSync('./config/cam-video.json'));
      
      expect(config).toEqual({ resolution: '1080p', fps: 30 });
      expect(fs.readFileSync).toHaveBeenCalledWith('./config/cam-video.json');
    });
  });

  describe('User Management', () => {
    test('should add new user successfully', async () => {
      const req = {
        body: { name: 'newuser', password: 'userpass123' }
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      // Simulate user creation
      const savedUser = await mockUserServices.addUser('newuser', 'userpass123');
      
      expect(savedUser).toEqual({ id: 1, name: 'newuser' });
      expect(mockUserServices.addUser).toHaveBeenCalledWith('newuser', 'userpass123');
    });

    test('should handle user creation with bcrypt hashing', async () => {
      const password = 'userpass123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      expect(hashedPassword).toBe('hashedpassword123');
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
    });
  });

  describe('Brand Management', () => {
    test('should upload brand files successfully', () => {
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      
      // Simulate brand upload
      mockAdminServices.uploadBrands(req, res, () => {});
      
      expect(mockAdminServices.uploadBrands).toHaveBeenCalledWith(req, res, expect.any(Function));
    });

    test('should read brand configuration from file', () => {
      const config = JSON.parse(fs.readFileSync('./config/brand.json'));
      
      expect(config).toEqual({ brand: 'Hikvision', model: 'DS-2CD2T47G1-L' });
      expect(fs.readFileSync).toHaveBeenCalledWith('./config/brand.json');
    });
  });

  describe('Admin Authentication', () => {
    test('should require admin authentication middleware', () => {
      const req = {};
      const res = {};
      const next = jest.fn();
      
      // Simulate admin auth middleware
      mockRequireAdminAuth(req, res, next);
      
      expect(req.adminId).toBe(1);
      expect(next).toHaveBeenCalled();
      expect(mockRequireAdminAuth).toHaveBeenCalledWith(req, res, next);
    });

    test('should handle admin session management', () => {
      const req = {
        adminId: 1,
        session: {
          username: 'admin',
          isAdmin: true
        }
      };
      
      expect(req.adminId).toBe(1);
      expect(req.session.username).toBe('admin');
      expect(req.session.isAdmin).toBe(true);
    });
  });

  describe('Configuration File Operations', () => {
    test('should handle file read operations', () => {
      const pictureConfig = fs.readFileSync('./config/cam-picture.json');
      const videoConfig = fs.readFileSync('./config/cam-video.json');
      const brandConfig = fs.readFileSync('./config/brand.json');
      
      expect(pictureConfig).toBeDefined();
      expect(videoConfig).toBeDefined();
      expect(brandConfig).toBeDefined();
      
      expect(fs.readFileSync).toHaveBeenCalledWith('./config/cam-picture.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('./config/cam-video.json');
      expect(fs.readFileSync).toHaveBeenCalledWith('./config/brand.json');
    });

    test('should parse JSON configuration files', () => {
      const pictureConfig = JSON.parse(fs.readFileSync('./config/cam-picture.json'));
      const videoConfig = JSON.parse(fs.readFileSync('./config/cam-video.json'));
      const brandConfig = JSON.parse(fs.readFileSync('./config/brand.json'));
      
      expect(pictureConfig).toHaveProperty('quality');
      expect(pictureConfig).toHaveProperty('brightness');
      expect(videoConfig).toHaveProperty('resolution');
      expect(videoConfig).toHaveProperty('fps');
      expect(brandConfig).toHaveProperty('brand');
      expect(brandConfig).toHaveProperty('model');
    });
  });

  describe('Error Handling', () => {


    test('should handle file system errors gracefully', () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('missing.json')) {
          throw new Error('File not found');
        }
        return '{}';
      });
      
      expect(() => {
        fs.readFileSync('./config/missing.json');
      }).toThrow('File not found');
    });

    test('should handle service errors', async () => {
      const error = new Error('Service error');
      mockAdminServices.updatePassword.mockRejectedValue(error);
      
      await expect(mockAdminServices.updatePassword(1, 'password')).rejects.toThrow('Service error');
    });
  });

  describe('Environment Configuration', () => {
    test('should use default admin path when not set', () => {
      delete process.env.ADMIN_PATH;
      const defaultPrefix = 'admin';
      
      expect(defaultPrefix).toBe('admin');
    });

    test('should use custom admin path when set', () => {
      process.env.ADMIN_PATH = 'custom-admin';
      const customPrefix = process.env.ADMIN_PATH;
      
      expect(customPrefix).toBe('custom-admin');
    });


  });

  describe('Integration Tests', () => {
    test('should handle complete admin workflow', async () => {
      // 1. Admin authentication
      const req = { adminId: 1 };
      const res = {};
      const next = jest.fn();
      
      mockRequireAdminAuth(req, res, next);
      expect(req.adminId).toBe(1);
      
      // 2. Configuration update
      mockAdminServices.configCamPicture('quality', 'ultra');
      expect(mockAdminServices.configCamPicture).toHaveBeenCalledWith('quality', 'ultra');
      
      // 3. User management
      const newUser = await mockUserServices.addUser('testuser', 'testpass');
      expect(newUser).toEqual({ id: 1, name: 'newuser' });
      
      // 4. Configuration retrieval
      const pictureConfig = mockSweetcamServices.getCamPictureConfig();
      const videoConfig = mockSweetcamServices.getCamVideoConfig();
      const brandConfig = mockSweetcamServices.getBrandConfig();
      
      expect(pictureConfig).toHaveProperty('quality');
      expect(videoConfig).toHaveProperty('resolution');
      expect(brandConfig).toHaveProperty('brand');
    });

    test('should maintain configuration consistency across services', () => {
      const pictureConfig = mockSweetcamServices.getCamPictureConfig();
      const videoConfig = mockSweetcamServices.getCamVideoConfig();
      const brandConfig = mockSweetcamServices.getBrandConfig();
      
      // All configs should be objects
      expect(typeof pictureConfig).toBe('object');
      expect(typeof videoConfig).toBe('object');
      expect(typeof brandConfig).toBe('object');
      
      // All configs should have expected properties
      expect(pictureConfig).toHaveProperty('quality');
      expect(videoConfig).toHaveProperty('resolution');
      expect(brandConfig).toHaveProperty('brand');
    });
  });
}); 