const { format, createLogger, transports } = require("winston");
require("winston-daily-rotate-file");
const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
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
            service: info.service || 'rtsp',
            event_type: info.event_type || 'general',
            ip_address: info.ip_address || null,
            user_agent: info.user_agent || null,
            rtsp_method: info.rtsp_method || null,
            rtsp_url: info.rtsp_url || null,
            session_id: info.session_id || null,
            username: info.username || null,
            response_status: info.response_status || null,
            attack_type: info.attack_type || null,
            payload: info.payload || null,
            brand: info.brand || null,
            port: info.port || null,
            stream_path: info.stream_path || null,
            transport_info: info.transport_info || null
        };
        return JSON.stringify(logEntry);
    })
);

const securityFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "rtsp-security-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "30d",
    level: 'info'
});

const appFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "rtsp-app-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "14d",
    level: 'info'
});

const errorFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "rtsp-error-%DATE%.log"),
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
        securityFileTransport,
        errorFileTransport
    ],
    format: securityFormat,
    exitOnError: false
};

const logger = createLogger(logConfiguration);

const rtspLogger = {
    logRTSPConnection: (ip, event, brand, port) => {
        logger.info('RTSP connection event', {
            service: 'rtsp',
            event_type: 'connection_event',
            ip_address: ip,
            event: event,
            brand: brand,
            port: port,
            message: `RTSP connection ${event}: ${ip}`
        });
    },

    logRTSPAuthAttempt: (ip, username, success, reason, brand, port) => {
        logger.info('RTSP authentication attempt', {
            service: 'rtsp',
            event_type: 'auth_attempt',
            ip_address: ip,
            username: username,
            success: success,
            reason: reason,
            brand: brand,
            port: port,
            message: `RTSP auth ${success ? 'successful' : 'failed'} for user: ${username}`
        });
    },

    logRTSPMethod: (ip, method, url, sessionId, brand, port) => {
        logger.info('RTSP method request', {
            service: 'rtsp',
            event_type: 'rtsp_method',
            ip_address: ip,
            rtsp_method: method,
            rtsp_url: url,
            session_id: sessionId,
            brand: brand,
            port: port,
            message: `RTSP ${method} request from ${ip}: ${url}`
        });
    },

    logRTSPResponse: (ip, method, statusCode, sessionId, brand, port) => {
        logger.info('RTSP response', {
            service: 'rtsp',
            event_type: 'rtsp_response',
            ip_address: ip,
            rtsp_method: method,
            response_status: statusCode,
            session_id: sessionId,
            brand: brand,
            port: port,
            message: `RTSP ${method} response: ${statusCode}`
        });
    },

    logRTSPSession: (ip, sessionId, event, streamPath, brand, port) => {
        logger.info('RTSP session event', {
            service: 'rtsp',
            event_type: 'session_event',
            ip_address: ip,
            session_id: sessionId,
            event: event,
            stream_path: streamPath,
            brand: brand,
            port: port,
            message: `RTSP session ${event}: ${sessionId}`
        });
    },

    logRTSPStreamSetup: (ip, sessionId, streamPath, transportInfo, brand, port) => {
        logger.info('RTSP stream setup', {
            service: 'rtsp',
            event_type: 'stream_setup',
            ip_address: ip,
            session_id: sessionId,
            stream_path: streamPath,
            transport_info: transportInfo,
            brand: brand,
            port: port,
            message: `RTSP stream setup: ${streamPath}`
        });
    },

    logRTSPStreamPlay: (ip, sessionId, streamPath, brand, port) => {
        logger.info('RTSP stream play', {
            service: 'rtsp',
            event_type: 'stream_play',
            ip_address: ip,
            session_id: sessionId,
            stream_path: streamPath,
            brand: brand,
            port: port,
            message: `RTSP stream play: ${streamPath}`
        });
    },

    logRTSPStreamPause: (ip, sessionId, streamPath, brand, port) => {
        logger.info('RTSP stream pause', {
            service: 'rtsp',
            event_type: 'stream_pause',
            ip_address: ip,
            session_id: sessionId,
            stream_path: streamPath,
            brand: brand,
            port: port,
            message: `RTSP stream pause: ${streamPath}`
        });
    },

    logRTSPStreamTeardown: (ip, sessionId, streamPath, brand, port) => {
        logger.info('RTSP stream teardown', {
            service: 'rtsp',
            event_type: 'stream_teardown',
            ip_address: ip,
            session_id: sessionId,
            stream_path: streamPath,
            brand: brand,
            port: port,
            message: `RTSP stream teardown: ${streamPath}`
        });
    },

    logRTPStream: (ip, sessionId, event, details, brand, port) => {
        logger.info('RTP stream event', {
            service: 'rtsp',
            event_type: 'rtp_stream',
            ip_address: ip,
            session_id: sessionId,
            event: event,
            details: details,
            brand: brand,
            port: port,
            message: `RTP stream ${event}: ${details}`
        });
    },

    logRTSPSOptions: (ip, userAgent, brand, port) => {
        logger.info('RTSP options request', {
            service: 'rtsp',
            event_type: 'options_request',
            ip_address: ip,
            user_agent: userAgent,
            brand: brand,
            port: port,
            message: `RTSP options request from ${ip}`
        });
    },

    logRTSPDescribe: (ip, url, userAgent, brand, port) => {
        logger.info('RTSP describe request', {
            service: 'rtsp',
            event_type: 'describe_request',
            ip_address: ip,
            rtsp_url: url,
            user_agent: userAgent,
            brand: brand,
            port: port,
            message: `RTSP describe request: ${url}`
        });
    },

    logSuspiciousRTSPActivity: (ip, activity, details, brand, port) => {
        logger.warn('Suspicious RTSP activity', {
            service: 'rtsp',
            event_type: 'suspicious_activity',
            ip_address: ip,
            activity: activity,
            details: details,
            brand: brand,
            port: port,
            message: `Suspicious RTSP activity: ${activity}`
        });
    },

    logRTSPAttackAttempt: (ip, attackType, payload, brand, port) => {
        logger.error('RTSP attack attempt', {
            service: 'rtsp',
            event_type: 'attack_attempt',
            ip_address: ip,
            attack_type: attackType,
            payload: payload,
            brand: brand,
            port: port,
            message: `RTSP attack attempt: ${attackType}`
        });
    },

    logRTSPServiceEvent: (event, details, brand, port) => {
        logger.info('RTSP service event', {
            service: 'rtsp',
            event_type: 'service_event',
            event: event,
            details: details,
            brand: brand,
            port: port,
            message: `RTSP service ${event}: ${details}`
        });
    },

    logRTSPDatabaseAuth: (ip, username, success, error, brand, port) => {
        logger.info('RTSP database authentication', {
            service: 'rtsp',
            event_type: 'database_auth',
            ip_address: ip,
            username: username,
            success: success,
            error: error,
            brand: brand,
            port: port,
            message: `RTSP database auth ${success ? 'successful' : 'failed'} for user: ${username}`
        });
    },
    
    logRTSPError: (error, context, ip, brand, port) => {
        logger.error('RTSP error', {
            service: 'rtsp',
            event_type: 'error',
            error: error.message,
            stack: error.stack,
            context: context,
            ip_address: ip,
            brand: brand,
            port: port,
            message: `RTSP error: ${error.message}`
        });
    }
};

module.exports = { logger, rtspLogger }; 