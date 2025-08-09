const { format, createLogger, transports } = require("winston");
require("winston-daily-rotate-file");
const fs = require('fs');
const path = require('path');
const SessionLogger = require('./session_logger');

// Import database logger
const databaseLogger = require('./database-logger');

function logCowrieEvent(event) {
  return databaseLogger.logEvent({ service: 'cowrie', ...event });
}

// Create logs directory if it doesn't exist
// Check if we're running in Docker container (logs directory exists at /app/logs)
const dockerLogsDir = path.join('/app', 'logs', 'webservices');
const localLogsDir = path.join(__dirname, '..', '..', 'logs', 'webservices');

const logsDir = fs.existsSync('/app/logs') ? dockerLogsDir : localLogsDir;

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Initialize session logger
const sessionLogger = new SessionLogger('webservice');

// Security-focused log format for honeypot events
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

// Separate transport for security events (honeypot-specific)
const securityFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "security-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "30d",
    level: 'info'
});

// Regular application logs
const appFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "app-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "14d",
    level: 'info'
});

// Error logs
const errorFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "30d",
    level: 'error'
});

// Console transport (only in development)
const consoleTransport = new transports.Console({
    format: format.combine(
        format.colorize(),
        format.simple(),
        format.printf(info => {
            // Don't log sensitive information to console
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
        securityFileTransport,
        errorFileTransport
    ],
    format: securityFormat,
    // Don't exit on error
    exitOnError: false
};

const logger = createLogger(logConfiguration);

// Add error handling to the logger
logger.on('error', (error) => {
    console.error('Logger error:', error);
});

logger.on('warn', (info) => {
    console.warn('Logger warning:', info);
});





// Helper functions for honeypot-specific logging
const honeypotLogger = {
    // Log login attempts
    logLoginAttempt: async (ip, username, success, userAgent, sessionId, brand, port, password = null) => {
        // Log to regular log file
        logger.info('Login attempt', {
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
        
        // Also log to session logger for consolidation
        if (sessionId) {
            sessionLogger.logLoginAttempt(ip, username, success, userAgent, sessionId, brand, port, password);
        }

        // Log to database
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

    // Log authentication failures
    logAuthFailure: (ip, username, reason, userAgent, brand, port, password = null, sessionId = null) => {
        // Log to regular log file
        logger.warn('Authentication failure', {
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
            message: `Authentication failure for user: ${username}, reason: ${reason}`
        });
        
        // Also log to session logger for consolidation
        if (sessionId) {
            sessionLogger.logAuthFailure(ip, username, reason, userAgent, brand, port, password, sessionId);
        }
    },

    // Log suspicious activities
    logSuspiciousActivity: (ip, activity, details, userAgent, brand, port, sessionId = null) => {
        // Log to regular log file
        logger.warn('Suspicious activity detected', {
            service: 'webservice',
            event_type: 'suspicious_activity',
            ip_address: ip,
            activity: activity,
            details: details,
            user_agent: userAgent,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `Suspicious activity detected: ${activity}`
        });
        
        // Also log to session logger for consolidation
        if (sessionId) {
            sessionLogger.logSuspiciousActivity(ip, activity, details, userAgent, brand, port, sessionId);
        }
    },

    // Log attack attempts
    logAttackAttempt: (ip, attackType, userAgent, brand, port, sessionId = null) => {
        logger.error('Attack attempt detected', {
            service: 'webservice',
            event_type: 'attack_attempt',
            ip_address: ip,
            user_agent: userAgent,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `Attack attempt detected: ${attackType}`
        });
    },

    // Log service access
    logServiceAccess: async (ip, method, url, statusCode, userAgent, brand, port, sessionId = null) => {
        // Log to regular log file
        logger.info('Service access', {
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
        
        // Also log to session logger for consolidation
        if (sessionId) {
            sessionLogger.logServiceAccess(ip, method, url, statusCode, userAgent, brand, port, sessionId);
        }

        // Log to database
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

    // Log session events
    logSessionEvent: (ip, sessionId, event, username, brand, port) => {
        // Log to regular log file
        logger.info('Session event', {
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
        
        // Also log to session logger for consolidation
        if (sessionId) {
            sessionLogger.logSessionEvent(ip, sessionId, event, username, brand, port);
        }
    },

    // Log database events
    logDatabaseEvent: (event, details, success, sessionId = null) => {
        logger.info('Database event', {
            service: 'webservice',
            event_type: 'database_event',
            event: event,
            details: details,
            success: success,
            session_id: sessionId,
            message: `Database ${event}: ${success ? 'success' : 'failed'}`
        });
    },

    // Log service startup/shutdown
    logServiceEvent: (event, details, sessionId = null) => {
        logger.info('Service event', {
            service: 'webservice',
            event_type: 'service_event',
            event: event,
            details: details,
            session_id: sessionId,
            message: `Service ${event}: ${details}`
        });
    },

    // General error logging
    logError: (error, context, sessionId = null) => {
        logger.error('Error occurred', {
            service: 'webservice',
            event_type: 'error',
            error: error.message,
            stack: error.stack,
            context: context,
            session_id: sessionId,
            message: `Error: ${error.message}`
        });
    },

    // Log RTSP service management
    logRTSPManagement: (ip, action, serviceName, status, userAgent, brand, port, sessionId = null) => {
        logger.info('RTSP management', {
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

    // Log RTSP service toggle
    logRTSPServiceToggle: (ip, serviceName, action, previousStatus, newStatus, userAgent, brand, port, sessionId = null) => {
        logger.info('RTSP service toggle', {
            service: 'webservice',
            event_type: 'rtsp_service_toggle',
            ip_address: ip,
            service_name: serviceName,
            action: action,
            previous_status: previousStatus,
            new_status: newStatus,
            user_agent: userAgent,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `RTSP service ${action}: ${serviceName} from ${previousStatus} to ${newStatus}`
        });
    },

    // Log ONVIF service toggle
    logONVIFServiceToggle: (ip, serviceName, action, previousStatus, newStatus, userAgent, brand, port, sessionId = null) => {
        logger.info('ONVIF service toggle', {
            service: 'webservice',
            event_type: 'onvif_service_toggle',
            ip_address: ip,
            service_name: serviceName,
            action: action,
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

module.exports = { logger, honeypotLogger, logCowrieEvent };