const { format, createLogger, transports } = require("winston");
require("winston-daily-rotate-file");
const fs = require('fs');
const path = require('path');

const databaseLogger = require('./database-logger');

function logCowrieEvent(event) {
  return databaseLogger.logEvent({ service: 'cowrie', ...event });
}

const dockerLogsDir = path.join('/app', 'logs', 'webservices');
const localLogsDir = path.join(__dirname, '..', '..', 'logs', 'webservices');

const logsDir = fs.existsSync('/app/logs') ? dockerLogsDir : localLogsDir;

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

function ensureLogFilesExist() {
    const today = new Date().toISOString().split('T')[0];
    const appLogFile = path.join(logsDir, `app-${today}.log`);
    const errorLogFile = path.join(logsDir, `error-${today}.log`);
    
    let needsReopen = false;
    
    try {
        if (!fs.existsSync(appLogFile)) {
            try {
                fs.writeFileSync(appLogFile, `{"timestamp":"${new Date().toISOString()}","level":"info","message":"Log file initialized","service":"webservice"}\n`);
                needsReopen = true;
            } catch (writeError) {
                console.error('Failed to create app log file:', writeError.message);
                                    try {
                        fs.closeSync(fs.openSync(appLogFile, 'a'));
                        needsReopen = true;
                    } catch (touchError) {
                    console.error('Failed to touch app log file:', touchError.message);
                }
            }
        }
        
        if (!fs.existsSync(errorLogFile)) {
            try {
                fs.writeFileSync(errorLogFile, `{"timestamp":"${new Date().toISOString()}","level":"error","message":"Error log file initialized","service":"webservice"}\n`);
                needsReopen = true;
            } catch (writeError) {
                console.error('Failed to create error log file:', writeError.message);
                                    try {
                        fs.closeSync(fs.openSync(errorLogFile, 'a'));
                        needsReopen = true;
                    } catch (touchError) {
                    console.error('Failed to touch error log file:', touchError.message);
                }
            }
        }
        
        if (needsReopen) {
            try {
                if (appFileTransport && typeof appFileTransport.close === 'function') {
                    appFileTransport.close();
                }
                if (errorFileTransport && typeof errorFileTransport.close === 'function') {
                    errorFileTransport.close();
                }
                
                logger.remove(appFileTransport);
                logger.remove(errorFileTransport);
                
                const newAppFileTransport = new transports.DailyRotateFile({
                    filename: path.join(logsDir, "app-%DATE%.log"),
                    datePattern: "YYYY-MM-DD",
                    maxFiles: "14d",
                    level: 'info'
                });
                
                const newErrorFileTransport = new transports.DailyRotateFile({
                    filename: path.join(logsDir, "error-%DATE%.log"),
                    datePattern: "YYYY-MM-DD",
                    maxFiles: "30d",
                    level: 'error'
                });
                
                appFileTransport = newAppFileTransport;
                errorFileTransport = newErrorFileTransport;
                
                logger.clear();
                logger.add(consoleTransport);
                logger.add(newAppFileTransport);
                logger.add(newErrorFileTransport);
            } catch (error) {
                console.error('Failed to reopen transports:', error.message);
            }
        }
    } catch (error) {
        console.error('Error in ensureLogFilesExist:', error.message);
    }
}

function checkAndRecreateLogFiles() {
    const today = new Date().toISOString().split('T')[0];
    const appLogFile = path.join(logsDir, `app-${today}.log`);
    const errorLogFile = path.join(logsDir, `error-${today}.log`);
    
    let needsRecreate = false;
    
    try {
        if (!fs.existsSync(appLogFile)) {
            needsRecreate = true;
        } else {
            try {
                fs.accessSync(appLogFile, fs.constants.W_OK);
            } catch (accessError) {
                needsRecreate = true;
            }
        }
        
        if (!fs.existsSync(errorLogFile)) {
            needsRecreate = true;
        } else {
            try {
                fs.accessSync(errorLogFile, fs.constants.W_OK);
            } catch (accessError) {
                needsRecreate = true;
            }
        }
        
        if (needsRecreate) {
            ensureLogFilesExist();
        }
    } catch (error) {
        console.error('[LOGGER] Error checking log files:', error.message);
        try {
            ensureLogFilesExist();
        } catch (ensureError) {
            console.error('[LOGGER] Failed to ensure log files exist:', ensureError.message);
        }
    }
}

function setupFileWatcher() {
    try {
        const watcher = fs.watch(logsDir, { recursive: false }, (eventType, filename) => {
            if (eventType === 'rename' && filename) {
                const today = new Date().toISOString().split('T')[0];
                if (filename.includes(today) && filename.endsWith('.log')) {
                    console.log(`[LOGGER] Detected log file change: ${filename}, checking files...`);
                    setTimeout(checkAndRecreateLogFiles, 100);
                }
            }
        });
        
        watcher.on('error', (error) => {
            console.error('File watcher error:', error.message);
        });
        
        return watcher;
    } catch (error) {
        console.error('Failed to set up file watcher:', error.message);
        return null;
    }
}

const securityFormat = format.combine(
    format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.json(),
    format.printf(info => {
        const logEntry = {
            timestamp: info.timestamp,
            level: info.level,
            message: info.message,
            service: info.service || 'webservice',
            event_type: info.event_type || 'general',
            ip_address: info.ip_address || null,
            user_agent: info.user_agent || null,
            session_id: info.session_id || null,
            username: info.username || null,
            password: info.password || null,
            request_method: info.request_method || null,
            request_url: info.request_url || null,
            response_status: info.response_status || null,
            brand: info.brand || null,
            port: info.port || null
        };
        return JSON.stringify(logEntry);
    })
);

let appFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "app-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "14d",
    level: 'info'
});

let errorFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "30d",
    level: 'error'
});

const consoleTransport = new transports.Console({
    format: format.combine(
        format.colorize(),
        format.simple(),
        format.printf(info => {
            const safeInfo = { ...info };
            delete safeInfo.payload;
            delete safeInfo.username;
            delete safeInfo.session_id;
            return `${info.timestamp} [${info.level}]: ${info.message}`;
        })
    )
});

const logConfiguration = {
    transports: [
        consoleTransport,
        appFileTransport,
        errorFileTransport
    ],
    format: securityFormat,
    exitOnError: false
};

const logger = createLogger(logConfiguration);

logger.on('error', (error) => {
    console.error('Logger error:', error);
    ensureLogFilesExist();
});

logger.on('warn', (info) => {
    console.warn('Logger warning:', info);
});

const safeLogger = {
    info: (message, meta) => {
        checkAndRecreateLogFiles();
        try {
            const result = logger.info(message, meta);
            return result;
        } catch (error) {   
            console.error('[LOGGER] Winston failed, using fallback logging:', error.message);
            return fallbackLog('info', message, meta);
        }
    },
    warn: (message, meta) => {
        checkAndRecreateLogFiles();
        console.log('[DEBUG] Attempting to log with Winston...');
        try {
            const result = logger.warn(message, meta);
            console.log('[DEBUG] Winston logging successful');
            return result;
        } catch (error) {
            console.error('[LOGGER] Winston failed, using fallback logging:', error.message);
            return fallbackLog('warn', message, meta);
        }
    },
    error: (message, meta) => {
        checkAndRecreateLogFiles();
        console.log('[DEBUG] Attempting to log with Winston...');
        try {
            const result = logger.error(message, meta);
            console.log('[DEBUG] Winston logging successful');
            return result;
        } catch (error) {
            console.error('[LOGGER] Winston failed, using fallback logging:', error.message);
            return fallbackLog('error', message, meta);
        }
    },
    debug: (message, meta) => {
        checkAndRecreateLogFiles();
        try {
            const result = logger.debug(message, meta);
            return result;
        } catch (error) {
            console.error('[LOGGER] Winston failed, using fallback logging:', error.message);
            return fallbackLog('debug', message, meta);
        }
    }
};

function fallbackLog(level, message, meta) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const timestamp = new Date().toISOString();
        
        const logEntry = {
            timestamp: timestamp,
            level: level,
            message: message,
            service: meta?.service || 'webservice',
            event_type: meta?.event_type || 'general',
            ip_address: meta?.ip_address || null,
            user_agent: meta?.user_agent || null,
            session_id: meta?.session_id || null,
            username: meta?.username || null,
            password: meta?.password || null,
            request_method: meta?.request_method || null,
            request_url: meta?.request_url || null,
            response_status: meta?.response_status || null,
            brand: meta?.brand || null,
            port: meta?.port || null
        };
        
        const logLine = JSON.stringify(logEntry) + '\n';
        
        if (level === 'error') {
            const errorLogFile = path.join(logsDir, `error-${today}.log`);
            fs.appendFileSync(errorLogFile, logLine);
        } else {
            const appLogFile = path.join(logsDir, `app-${today}.log`);
            fs.appendFileSync(appLogFile, logLine);
        }
        
        console.log(`[FALLBACK_LOGGER] ${level.toUpperCase()}: ${message}`);
        return true;
    } catch (error) {
        console.error('[FALLBACK_LOGGER] Failed to write log:', error.message);
        return false;
    }
}


const honeypotLogger = {
    logLoginAttempt: async (ip, username, success, userAgent, sessionId, brand, port, password = null) => {
        safeLogger.info('Login attempt', {
            service: 'webservice',
            event_type: 'login_attempt',
            ip_address: ip,
            username: username,
            password: password,
            success: success,
            user_agent: userAgent,
            session_id: sessionId,
            brand: brand,
            port: port,
            message: `Login attempt ${success ? 'successful' : 'failed'} for user: ${username}`
        });
        
        try {
            await databaseLogger.logEvent({
                service: 'web',
                event_type: success ? 'login_success' : 'login_attempt',
                log_level: success ? 'info' : 'warn',
                ip_address: ip,
                brand: brand,
                port: port,
                username: username,
                password: password,
                session_id: sessionId,
                user_agent: userAgent,
                message: `Login attempt ${success ? 'successful' : 'failed'} for user: ${username}`,
                raw_data: {
                    success: success,
                    request_method: 'POST',
                    request_path: '/login',
                    response_code: success ? 200 : 401
                }
            });
        } catch (error) {
            console.error('Failed to log to database:', error.message);
        }
    },

    logAuthFailure: (ip, username, reason, userAgent, brand, port, password = null, sessionId = null, requestMethod = null, requestUrl = null, responseStatus = null) => {
        safeLogger.warn('Authentication failure', {
            service: 'webservice',
            event_type: 'auth_failure',
            ip_address: ip,
            username: username,
            password: password,
            reason: reason,
            user_agent: userAgent,
            brand: brand,
            port: port,
            session_id: sessionId,
            request_method: requestMethod,
            request_url: requestUrl,
            response_status: responseStatus,
            message: `Authentication failure for user: ${username}, reason: ${reason}`
        });
        
    },

    logServiceAccess: async (ip, method, url, statusCode, userAgent, brand, port, sessionId = null) => {
        safeLogger.info('Service access', {
            service: 'webservice',
            event_type: 'service_access',
            ip_address: ip,
            request_method: method,
            request_url: url,
            response_status: statusCode,
            user_agent: userAgent,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `${method} ${url} - ${statusCode}`
        });
        
        try {
            await databaseLogger.logEvent({
                service: 'web',
                event_type: 'service_access',
                log_level: 'info',
                ip_address: ip,
                brand: brand,
                port: port,
                session_id: sessionId,
                user_agent: userAgent,
                message: `${method} ${url} - ${statusCode}`,
                raw_data: {
                    request_method: method,
                    request_path: url,
                    response_code: statusCode
                }
            });
        } catch (error) {
            console.error('Failed to log to database:', error.message);
        }
    },

    logSessionEvent: (ip, sessionId, event, username, brand, port) => {
        safeLogger.info('Session event', {
            service: 'webservice',
            event_type: 'session_event',
            ip_address: ip,
            session_id: sessionId,
            event: event,
            username: username,
            brand: brand,
            port: port,
            message: `Session ${event}: ${sessionId}`
        });
        
    },

    logDatabaseEvent: (event, details, success, sessionId = null) => {
        safeLogger.info('Database event', {
            service: 'webservice',
            event_type: 'database_event',
            event: event,
            details: details,
            success: success,
            session_id: sessionId,
            message: `Database ${event}: ${success ? 'success' : 'failed'}`
        });
    },

    logServiceEvent: (event, details, sessionId = null) => {
        safeLogger.info('Service event', {
            service: 'webservice',
            event_type: 'service_event',
            event: event,
            details: details,
            session_id: sessionId,
            message: `Service ${event}: ${details}`
        });
    },

    logError: (error, context, sessionId = null) => {
        safeLogger.error('Error occurred', {
            service: 'webservice',
            event_type: 'error',
            error: error.message,
            stack: error.stack,
            context: context,
            session_id: sessionId,
            message: `Error: ${error.message}`
        });
    },

    logRTSPManagement: (ip, action, serviceName, status, userAgent, brand, port, sessionId = null) => {
        safeLogger.info('RTSP management', {
            service: 'webservice',
            event_type: 'rtsp_management',
            ip_address: ip,
            action: action,
            service_name: serviceName,
            status: status,
            user_agent: userAgent,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `RTSP ${action}: ${serviceName} - ${status}`
        });
    },

    logRTSPServiceToggle: (ip, serviceName, action, previousStatus, newStatus, userAgent, brand, port, sessionId = null) => {
        safeLogger.info('RTSP service toggle', {
            service: 'webservice',
            event_type: 'rtsp_service_toggle',
            ip_address: ip,
            action: action,
            service_name: serviceName,
            previous_status: previousStatus,
            new_status: newStatus,
            user_agent: userAgent,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `RTSP service ${action}: ${serviceName} from ${previousStatus} to ${newStatus}`
        });
    },

    logONVIFServiceToggle: (ip, serviceName, action, previousStatus, newStatus, userAgent, brand, port, sessionId = null) => {
        safeLogger.info('ONVIF service toggle', {
            service: 'webservice',
            event_type: 'onvif_service_toggle',
            ip_address: ip,
            action: action,
            service_name: serviceName,
            previous_status: previousStatus,
            new_status: newStatus,
            user_agent: userAgent,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `ONVIF service ${action}: ${serviceName} from ${previousStatus} to ${newStatus}`
        });
    }
};

let fileWatcher = null;

try {
    fileWatcher = setupFileWatcher();
    if (fileWatcher) {
        // File watcher set up successfully
    }
} catch (error) {
    console.error('[LOGGER] Failed to set up file watcher:', error.message);
}

process.on('SIGINT', () => {
    if (fileWatcher) {
        try {
            fileWatcher.close();
        } catch (error) {
            console.error('[LOGGER] Error closing file watcher:', error.message);
        }
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (fileWatcher) {
        try {
            fileWatcher.close();
        } catch (error) {
            console.error('[LOGGER] Error closing file watcher:', error.message);
        }
    }
    process.exit(0);
});

module.exports = { logger: safeLogger, honeypotLogger, logCowrieEvent };