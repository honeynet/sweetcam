/**
 * Jest Setup File for RTSP Service Tests
 * Global configuration and utilities for all RTSP tests
 */

// Increase timeout for network tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Generate test session IDs
  generateSessionId: () => Math.floor(Math.random() * 100000).toString(),
  
  // Generate test IP addresses
  generateTestIP: () => `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
  
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
  
  // Create mock RTSP request
  createMockRTSPRequest: (method, url, headers = {}, body = '') => {
    const headerLines = Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n');
    
    return `${method} ${url} RTSP/1.0\r\n${headerLines}${headerLines ? '\r\n' : ''}\r\n${body}`;
  },
  
  // Create mock socket
  createMockSocket: (overrides = {}) => ({
    remoteAddress: '127.0.0.1',
    localAddress: '127.0.0.1',
    localPort: 554,
    write: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
    ...overrides
  }),
  
  // Mock RTSP service responses
  mockRTSPResponse: (brand, method) => {
    const responses = {
      hikvision: {
        options: 'RTSP/1.0 200 OK\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN, PAUSE\r\n\r\n',
        unauthorized: (nonce) => `RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Digest realm="Hikvision", nonce="${nonce}", stale="FALSE"\r\nWWW-Authenticate: Basic realm="/"\r\n\r\n`
      },
      dahua: {
        options: 'RTSP/1.0 405 Method Not Allowed\r\nServer: Dahua Rtsp Server\r\nContent-Length: 0\r\nCSeq: 0\r\n\r\n',
        unauthorized: (nonce) => `RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Basic realm="device"\r\nServer: Dahua Rtsp Server\r\nContent-Length: 0\r\n\r\n`
      },
      axis: {
        options: 'RTSP/1.0 200 OK\r\nPublic: DESCRIBE, GET_PARAMETER, PAUSE, PLAY, SETUP, TEARDOWN\r\n\r\n',
        unauthorized: (nonce) => `RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Basic realm="device"\r\n\r\n`
      }
    };
    
    return responses[brand]?.[method] || { error: 'Not implemented' };
  },
  
  // Create test user credentials
  createTestUser: (username = 'testuser', password = 'testpass') => ({
    username,
    password,
    encoded: Buffer.from(`${username}:${password}`).toString('base64')
  }),
  
  // Validate RTSP response format
  validateRTSPResponse: (response, expectedStatus = 200) => {
    const lines = response.split('\r\n');
    const firstLine = lines[0];
    
    expect(firstLine).toMatch(/^RTSP\/1\.0 \d+ .*$/);
    expect(firstLine).toContain(expectedStatus.toString());
    
    // Check for proper line endings
    expect(response).toMatch(/\r\n\r\n$/);
    
    return true;
  }
};

// Global test configuration
global.testConfig = {
  baseUrl: process.env.TEST_BASE_URL || 'rtsp://localhost',
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'sweetcam',
    port: process.env.DB_PORT || 3306
  },
  rtspService: {
    port: process.env.RTSP_PORT || 554,
    brands: ['hikvision', 'dahua', 'axis', 'reolink', 'mobotix', 'vstarcam'],
    defaultBrand: 'hikvision'
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
  process.env.RTSP_PORT = '554';
  process.env.BRAND = 'auto';
  
  // Check if required services are available
  if (process.env.CHECK_SERVICES !== 'false') {
    console.log('Setting up RTSP service test environment...');
  }
});

afterAll(async () => {
  // Cleanup global test environment
  console.log('RTSP Service Test Suite completed');
});

// Custom matchers for RTSP testing
expect.extend({
  toBeValidRTSPResponse(received) {
    const pass = received && 
                 typeof received === 'string' && 
                 received.startsWith('RTSP/1.0') &&
                 received.includes('\r\n\r\n');
    
    if (pass) {
      return {
        message: () => `Expected response not to be a valid RTSP response`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected response to be a valid RTSP response, got ${JSON.stringify(received)}`,
        pass: false
      };
    }
  },
  
  toBeValidRTSPStatus(received, expectedStatus) {
    const pass = received && 
                 typeof received === 'string' && 
                 received.includes(`RTSP/1.0 ${expectedStatus}`);
    
    if (pass) {
      return {
        message: () => `Expected response not to have status ${expectedStatus}`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected response to have status ${expectedStatus}, got ${JSON.stringify(received)}`,
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
  },
  
  toBeValidBrand(received) {
    const validBrands = ['hikvision', 'dahua', 'axis', 'reolink', 'mobotix', 'vstarcam'];
    const pass = typeof received === 'string' && validBrands.includes(received);
    
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid brand`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid brand (${validBrands.join(', ')}), got ${received}`,
        pass: false
      };
    }
  },
  
  toContainPayload(received) {
    const pass = received && 
                 typeof received === 'object' && 
                 (received.payload || received.request || received.response);
    
    if (pass) {
      return {
        message: () => `Expected response not to contain payload data`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected response to contain payload data, got ${JSON.stringify(received)}`,
        pass: false
      };
    }
  }
});

// Mock network modules to prevent actual network calls during tests
jest.mock('net', () => ({
  createServer: jest.fn(() => ({
    listen: jest.fn(),
    close: jest.fn(),
    on: jest.fn()
  }))
}));

jest.mock('dgram', () => ({
  createSocket: jest.fn(() => ({
    send: jest.fn(),
    close: jest.fn(),
    on: jest.fn()
  }))
}));

// Mock bcrypt to prevent native module loading issues
jest.mock('bcrypt', () => ({
  compareSync: jest.fn((password, hash) => {
    if (password === 'testpass' && hash === 'hashedpassword123') return true;
    if (password === 'adminpass' && hash === 'adminhash456') return true;
    return false;
  }),
  hashSync: jest.fn((password, saltRounds) => `hashed_${password}`),
  genSaltSync: jest.fn(() => 'salt123')
}));

// Mock mysql2 with flexible behavior
const mockPool = {
  getConnection: jest.fn((callback) => {
    if (callback) {
      callback(null, { release: jest.fn() });
    }
    return Promise.resolve({ release: jest.fn() });
  }),
  query: jest.fn((query, params, callback) => {
    if (callback) {
      // Default to returning a test user for authentication tests
      callback(null, [{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
    }
    return Promise.resolve([{ name: 'testuser', passwordHash: 'hashedpassword123' }]);
  }),
  execute: jest.fn(() => Promise.resolve([]))
};

jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(() => mockPool)
}));

// Also mock the regular mysql2 module
jest.mock('mysql2', () => ({
  createPool: jest.fn(() => mockPool)
}));

// Export the mock pool so tests can modify it
global.mockMysqlPool = mockPool;



// Mock file system operations
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => Buffer.from('fake-image-data')),
  existsSync: jest.fn(() => true),
  writeFileSync: jest.fn(),
  accessSync: jest.fn(),
  createWriteStream: jest.fn(() => ({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn()
  })),
  watch: jest.fn(() => ({
    on: jest.fn(),
    close: jest.fn()
  })),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  readdirSync: jest.fn(() => [])
}));

// Mock path operations
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn(() => '/mock/path'),
  resolve: jest.fn((...args) => args.join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
  extname: jest.fn((path) => {
    const ext = path.split('.').pop();
    return ext === path ? '' : `.${ext}`;
  })
}));

// Mock winston-daily-rotate-file
jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
    write: jest.fn()
  }));
});

// Mock winston transports
jest.mock('winston', () => ({
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    on: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn()
  })),
  transports: {
    Console: jest.fn(() => ({
      on: jest.fn(),
      close: jest.fn()
    })),
    DailyRotateFile: jest.fn(() => ({
      on: jest.fn(),
      close: jest.fn(),
      write: jest.fn()
    }))
  }
})); 