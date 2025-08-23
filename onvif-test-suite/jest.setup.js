/**
 * Jest Setup File for ONVIF Test Suite
 * Global configuration and utilities for all tests
 */

// Increase timeout for network tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Generate test UUIDs
  generateTestId: () => require('uuid').v4(),
  
  // Wait for specified time
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Retry function with exponential backoff
  retry: async (fn, maxAttempts = 3, delay = 1000) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  },
  
  // Mock ONVIF service responses
  mockONVIFResponse: (brand, action) => {
    const responses = {
      hikvision: {
        GetDeviceInformation: {
          Manufacturer: 'Hikvision',
          Model: 'DS-2CD2T47G1-L',
          FirmwareVersion: 'V5.5.82'
        },
        GetCapabilities: {
          Device: { XAddr: 'http://192.168.1.100:8080/onvif/device' },
          Media: { XAddr: 'http://192.168.1.100:8080/onvif/media' }
        }
      },
      dahua: {
        GetDeviceInformation: {
          Manufacturer: 'Dahua',
          Model: 'IPC-HDW4631C-A',
          FirmwareVersion: 'V2.800.0000000.0.R'
        }
      },
      axis: {
        GetDeviceInformation: {
          Manufacturer: 'Axis',
          Model: 'M3047-P',
          FirmwareVersion: '9.80.3.4'
        }
      }
    };
    
    return responses[brand]?.[action] || { error: 'Not implemented' };
  }
};

// Global test configuration
global.testConfig = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost',
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'sweetcam',
    port: process.env.DB_PORT || 3306
  },
  onvifServices: {
    hikvision: { httpPort: 8080, udpPort: 3702 },
    dahua: { httpPort: 8086, udpPort: 3703 },
    axis: { httpPort: 8087, udpPort: 3704 },
    reolink: { httpPort: 8088, udpPort: 3705 },
    mobotix: { httpPort: 8089, udpPort: 3706 },
    vstarcam: { httpPort: 8090, udpPort: 3707 }
  },
  testTimeout: 10000,
  retryAttempts: 3
};

// Console output suppression during tests (unless verbose)
if (!process.env.VERBOSE_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

// Global beforeAll and afterAll hooks
beforeAll(async () => {
  // Setup global test environment
  process.env.NODE_ENV = 'test';
  
  // Check if required services are available
  if (process.env.CHECK_SERVICES !== 'false') {
    console.log('Checking ONVIF services availability...');
  }
});

afterAll(async () => {
  // Cleanup global test environment
  console.log('ONVIF Test Suite completed');
});

// Custom matchers for ONVIF testing
expect.extend({
  toBeValidONVIFResponse(received) {
    const pass = received && 
                 typeof received === 'object' && 
                 (received.Manufacturer || received.manufacturer);
    
    if (pass) {
      return {
        message: () => `Expected response not to be a valid ONVIF response`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected response to be a valid ONVIF response, got ${JSON.stringify(received)}`,
        pass: false
      };
    }
  },
  
  toBeValidPort(received) {
    const pass = Number.isInteger(received) && received >= 1 && received <= 65535;
    
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid port number`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid port number (1-65535)`,
        pass: false
      };
    }
  },
  
  toBeValidIPAddress(received) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const pass = typeof received === 'string' && ipRegex.test(received);
    
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid IP address`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid IP address`,
        pass: false
      };
    }
  }
}); 