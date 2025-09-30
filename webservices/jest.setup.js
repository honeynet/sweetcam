// Global Jest setup for web services testing

// Mock express and related modules
jest.mock('express', () => {
  const mockExpress = () => {
    const app = {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      set: jest.fn(),
      listen: jest.fn(),
      use: jest.fn()
    };
    app.use.mockReturnValue(app);
    app.get.mockReturnValue(app);
    app.post.mockReturnValue(app);
    app.set.mockReturnValue(app);
    app.listen.mockReturnValue(app);
    return app;
  };
  
  mockExpress.json = jest.fn();
  mockExpress.urlencoded = jest.fn();
  mockExpress.static = jest.fn();
  mockExpress.Router = jest.fn(() => ({
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  }));
  
  return mockExpress;
});

// Mock express-session
jest.mock('express-session', () => {
  return jest.fn(() => (req, res, next) => {
    req.session = {
      username: null,
      isAdmin: false,
      locale: 'en',
      loginTimes: 0,
      destroy: jest.fn((callback) => callback && callback())
    };
    next();
  });
});

// Mock i18n
jest.mock('i18n', () => ({
  configure: jest.fn(),
  init: jest.fn((req, res, next) => {
    req.setLocale = jest.fn();
    next();
  })
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
  genSalt: jest.fn(),
  compareSync: jest.fn(),
  hashSync: jest.fn(),
  genSaltSync: jest.fn()
}));

// Mock fs
jest.mock('fs', () => ({
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  closeSync: jest.fn(),
  openSync: jest.fn()
}));

// Mock path
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  extname: jest.fn(),
  basename: jest.fn()
}));

// Mock sequelize
jest.mock('sequelize', () => {
  const mockSequelize = {
    authenticate: jest.fn(),
    sync: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    update: jest.fn()
  };
  
  return {
    Sequelize: jest.fn(() => mockSequelize)
  };
});

// Mock mysql2
jest.mock('mysql2', () => ({
  createPool: jest.fn()
}));

// Mock winston
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
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn()
  })),
  transports: {
    Console: jest.fn(),
    DailyRotateFile: jest.fn()
  }
}));

// Mock winston-daily-rotate-file
jest.mock('winston-daily-rotate-file', () => jest.fn());

// Mock multer
jest.mock('multer', () => {
  const mockMulter = jest.fn(() => (req, res, next) => next());
  mockMulter.diskStorage = jest.fn();
  return mockMulter;
});

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn()
  }))
}));



// Mock line-reader
jest.mock('line-reader', () => ({
  eachLine: jest.fn()
}));



// Mock cookie-parser
jest.mock('cookie-parser', () => jest.fn());

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Global test utilities
global.mockRequest = (options = {}) => {
  const req = {
    ip: '192.168.1.100',
    method: 'GET',
    url: '/',
    body: {},
    query: {},
    params: {},
    session: {
      username: null,
      isAdmin: false,
      locale: 'en',
      loginTimes: 0,
      destroy: jest.fn((callback) => callback && callback())
    },
    sessionID: 'test-session-id',
    get: jest.fn(),
    connection: {
      server: {
        address: () => ({ port: 80 })
      }
    },
    ...options
  };
  
  // Mock get method for headers
  req.get.mockImplementation((header) => {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Test Browser)',
      'Content-Type': 'application/json',
      'Content-Length': '0',
      ...options.headers
    };
    return headers[header] || null;
  });
  
  return req;
};

global.mockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    render: jest.fn().mockReturnThis(),
    getHeaders: jest.fn(() => ({})),
    setHeader: jest.fn(),
    end: jest.fn()
  };
  
  // Mock original methods for payload logging
  res.originalSend = res.send;
  res.originalJson = res.json;
  
  return res;
};

global.mockNext = jest.fn();

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Set up process.env for testing
process.env.PORT = '80';
process.env.SESSION_SECRET = 'test-secret';
process.env.COWRIE_INGESTOR_ENABLED = 'false'; 