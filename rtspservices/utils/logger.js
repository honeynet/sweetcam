const { format, createLogger, transports } = require("winston");
require("winston-daily-rotate-file");
const fs = require('fs');
const path = require('path');
const { writeServiceLog, writeRTSPLog } = require('./db-logger');

const dockerLogsDir = path.join('/app', 'logs');
const localLogsDir = path.join(__dirname, '..', 'logs');

const logsDir = fs.existsSync('/app/logs') ? dockerLogsDir : localLogsDir;

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

function ensureLogFilesExist() {
    const today = new Date().toISOString().split('T')[0];
    const appLogFile = path.join(logsDir, `rtsp-app-${today}.log`);
    const errorLogFile = path.join(logsDir, `rtsp-error-${today}.log`);
    
    let needsReopen = false;
    
    try {
        if (!fs.existsSync(appLogFile)) {
            try {
                fs.writeFileSync(appLogFile, `{"timestamp":"${new Date().toISOString()}","level":"info","message":"RTSP log file initialized","service":"rtsp"}\n`);
                needsReopen = true;
            } catch (writeError) {
                console.error('Failed to create RTSP app log file:', writeError.message);
                try {
                    fs.closeSync(fs.openSync(appLogFile, 'a'));
                    needsReopen = true;
                } catch (touchError) {
                    console.error('Failed to touch RTSP app log file:', touchError.message);
                }
            }
        }
        
        if (!fs.existsSync(errorLogFile)) {
            try {
                fs.writeFileSync(errorLogFile, `{"timestamp":"${new Date().toISOString()}","level":"error","message":"RTSP error log file initialized","service":"rtsp"}\n`);
                needsReopen = true;
            } catch (writeError) {
                console.error('Failed to create RTSP error log file:', writeError.message);
                try {
                    fs.closeSync(fs.openSync(errorLogFile, 'a'));
                    needsReopen = true;
                } catch (touchError) {
                    console.error('Failed to touch RTSP error log file:', touchError.message);
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
                    filename: path.join(logsDir, "rtsp-app-%DATE%.log"),
                    datePattern: "YYYY-MM-DD",
                    maxFiles: "14d",
                    level: 'info'
                });
                
                const newErrorFileTransport = new transports.DailyRotateFile({
                    filename: path.join(logsDir, "rtsp-error-%DATE%.log"),
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
                console.error('Failed to reopen RTSP transports:', error.message);
            }
        }
    } catch (error) {
        console.error('Error in ensureLogFilesExist:', error.message);
    }
}

function checkAndRecreateLogFiles() {
    const today = new Date().toISOString().split('T')[0];
    const appLogFile = path.join(logsDir, `rtsp-app-${today}.log`);
    const errorLogFile = path.join(logsDir, `rtsp-error-${today}.log`);
    
    let needsRecreate = false;
    
    try {
        if (!fs.existsSync(appLogFile)) {
            console.log(`[LOGGER] RTSP app log file not found: ${appLogFile}`);
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
        console.error('[LOGGER] Error checking RTSP log files:', error.message);
        try {
            ensureLogFilesExist();
        } catch (ensureError) {
            console.error('[LOGGER] Failed to ensure RTSP log files exist:', ensureError.message);
        }
    }
}

function setupFileWatcher() {
    try {
        const watcher = fs.watch(logsDir, { recursive: false }, (eventType, filename) => {
            if (eventType === 'rename' && filename) {
                const today = new Date().toISOString().split('T')[0];
                if (filename.includes(today) && filename.endsWith('.log')) {
                    setTimeout(checkAndRecreateLogFiles, 100);
                }
            }
        });
        
        watcher.on('error', (error) => {
            console.error('RTSP file watcher error:', error.message);
        });
        
        return watcher;
    } catch (error) {
        console.error('Failed to set up RTSP file watcher:', error.message);
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
            service: info.service || 'rtsp',
            event_type: info.event_type || 'general',
            ip_address: info.ip_address || null,
            user_agent: info.user_agent || null,
            rtsp_method: info.rtsp_method || null,
            rtsp_url: info.rtsp_url || null,
            session_id: info.session_id || null,
            username: info.username || null,
            response_status: info.response_status || null,
            brand: info.brand || null,
            port: info.port || null,
            stream_path: info.stream_path || null,
            transport_info: info.transport_info || null
        };
        return JSON.stringify(logEntry);
    })
);

let appFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "rtsp-app-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "14d",
    level: 'info'
});

let errorFileTransport = new transports.DailyRotateFile({
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
    
const safeLogger = {
    info: (message, meta) => {
        checkAndRecreateLogFiles();
        return logger.info(message, meta);
    },
    warn: (message, meta) => {
        checkAndRecreateLogFiles();
        return logger.warn(message, meta);
    },
    error: (message, meta) => {
        checkAndRecreateLogFiles();
        return logger.error(message, meta);
    },
    debug: (message, meta) => {
        checkAndRecreateLogFiles();
        return logger.debug(message, meta);
    }
};

const rtspLogger = {
    logRTSPConnection: (ip, event, brand, port, sessionId = null) => {
        safeLogger.info('RTSP connection event', {
            service: 'rtsp',
            event_type: 'connection_event',
            ip_address: ip,
            event: event,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `RTSP connection ${event}: ${ip}`
        });
        writeServiceLog({ service: 'rtsp', event_type: 'connection_event', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `RTSP connection ${event}: ${ip}`, raw_data: { event } });
        writeRTSPLog({ event_type: 'connection_event', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `RTSP connection ${event}: ${ip}`, raw_data: { event } });
    },

    logRTSPAuthAttempt: (ip, username, success, reason, brand, port, sessionId = null) => {
        safeLogger.info('RTSP authentication attempt', {
            service: 'rtsp',
            event_type: 'auth_attempt',
            ip_address: ip,
            username: username,
            success: success,
            reason: reason,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `RTSP auth ${success ? 'successful' : 'failed'} for user: ${username}`
        });
        writeServiceLog({ service: 'rtsp', event_type: 'auth_attempt', log_level: 'info', ip_address: ip, brand, port, username, session_id: sessionId, message: `RTSP auth ${success ? 'successful' : 'failed'} for user: ${username}`, raw_data: { success, reason } });
        writeRTSPLog({ event_type: 'auth_attempt', log_level: 'info', ip_address: ip, brand, port, username, session_id: sessionId, message: `RTSP auth ${success ? 'successful' : 'failed'} for user: ${username}`, raw_data: { success, reason } });
    },

    logRTSPMethod: (ip, method, url, sessionId, brand, port) => {
        safeLogger.info('RTSP method request', {
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
        writeServiceLog({ service: 'rtsp', event_type: 'rtsp_method', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `RTSP ${method} request from ${ip}: ${url}`, raw_data: { method, url } });
        writeRTSPLog({ event_type: 'rtsp_method', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, rtsp_method: method, stream_path: url, message: `RTSP ${method} request from ${ip}: ${url}` });
    },

    logRTSPResponse: (ip, method, statusCode, sessionId, brand, port) => {
        safeLogger.info('RTSP response', {
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
        writeServiceLog({ service: 'rtsp', event_type: 'rtsp_response', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `RTSP ${method} response: ${statusCode}`, raw_data: { method, statusCode } });
        writeRTSPLog({ event_type: 'rtsp_response', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, rtsp_method: method, message: `RTSP ${method} response: ${statusCode}` });
    },

    logRTSPSession: (ip, sessionId, event, streamPath, brand, port) => {
        safeLogger.info('RTSP session event', {
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
        writeServiceLog({ service: 'rtsp', event_type: 'session_event', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `RTSP session ${event}: ${sessionId}`, raw_data: { streamPath } });
        writeRTSPLog({ event_type: 'session_event', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, stream_path: streamPath, message: `RTSP session ${event}: ${sessionId}` });
    },

    logRTSPStreamSetup: (ip, sessionId, streamPath, transportInfo, brand, port) => {
        safeLogger.info('RTSP stream setup', {
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
        writeServiceLog({ service: 'rtsp', event_type: 'stream_setup', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `RTSP stream setup: ${streamPath}`, raw_data: { transportInfo } });
        writeRTSPLog({ event_type: 'stream_setup', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, stream_path: streamPath, message: `RTSP stream setup: ${streamPath}` });
    },

    logRTSPStreamPlay: (ip, sessionId, streamPath, brand, port) => {
        safeLogger.info('RTSP stream play', {
            service: 'rtsp',
            event_type: 'stream_play',
            ip_address: ip,
            session_id: sessionId,
            stream_path: streamPath,
            brand: brand,
            port: port,
            message: `RTSP stream play: ${streamPath}`
        });
        writeServiceLog({ service: 'rtsp', event_type: 'stream_play', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `RTSP stream play: ${streamPath}` });
        writeRTSPLog({ event_type: 'stream_play', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, stream_path: streamPath, message: `RTSP stream play: ${streamPath}` });
    },

    logRTSPStreamPause: (ip, sessionId, streamPath, brand, port) => {
        safeLogger.info('RTSP stream pause', {
            service: 'rtsp',
            event_type: 'stream_pause',
            ip_address: ip,
            session_id: sessionId,
            stream_path: streamPath,
            brand: brand,
            port: port,
            message: `RTSP stream pause: ${streamPath}`
        });
        writeServiceLog({ service: 'rtsp', event_type: 'stream_pause', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `RTSP stream pause: ${streamPath}`, raw_data: { transportInfo } });
        writeRTSPLog({ event_type: 'stream_pause', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, stream_path: streamPath, message: `RTSP stream pause: ${streamPath}` });
    },

    logRTSPStreamTeardown: (ip, sessionId, streamPath, brand, port) => {
        safeLogger.info('RTSP stream teardown', {
            service: 'rtsp',
            event_type: 'stream_teardown',
            ip_address: ip,
            session_id: sessionId,
            stream_path: streamPath,
            brand: brand,
            port: port,
            message: `RTSP stream teardown: ${streamPath}`
        });
        writeServiceLog({ service: 'rtsp', event_type: 'stream_teardown', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `RTSP stream teardown: ${streamPath}`, raw_data: { transportInfo } });
        writeRTSPLog({ event_type: 'stream_teardown', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, stream_path: streamPath, message: `RTSP stream teardown: ${streamPath}` });
    },

    logRTPStream: (ip, sessionId, event, details, brand, port) => {
        safeLogger.info('RTP stream event', {
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
        writeServiceLog({ service: 'rtsp', event_type: 'rtp_stream', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `RTP stream ${event}: ${details}` });
        writeRTSPLog({ event_type: 'rtp_stream', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `RTP stream ${event}: ${details}`, raw_data: { details } });
    },

    logRTSPSOptions: (ip, userAgent, brand, port, sessionId = null) => {
        safeLogger.info('RTSP options request', {
            service: 'rtsp',
            event_type: 'options_request',
            ip_address: ip,
            user_agent: userAgent,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `RTSP options request from ${ip}`
        });
        writeServiceLog({ service: 'rtsp', event_type: 'options_request', log_level: 'info', ip_address: ip, brand, port, user_agent: userAgent, session_id: sessionId, message: `RTSP options request from ${ip}` });
        writeRTSPLog({ event_type: 'options_request', log_level: 'info', ip_address: ip, brand, port, user_agent: userAgent, session_id: sessionId, message: `RTSP options request from ${ip}` });
    },

    logRTSPDescribe: (ip, url, userAgent, brand, port, sessionId = null) => {
        safeLogger.info('RTSP describe request', {
            service: 'rtsp',
            event_type: 'describe_request',
            ip_address: ip,
            rtsp_url: url,
            user_agent: userAgent,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `RTSP describe request: ${url}`
        });
        writeServiceLog({ service: 'rtsp', event_type: 'describe_request', log_level: 'info', ip_address: ip, brand, port, user_agent: userAgent, session_id: sessionId, message: `RTSP describe request: ${url}`, raw_data: { url } });
        writeRTSPLog({ event_type: 'describe_request', log_level: 'info', ip_address: ip, brand, port, user_agent: userAgent, session_id: sessionId, stream_path: url, message: `RTSP describe request: ${url}` });
    },

    logRTSPServiceEvent: (event, details, brand, port, sessionId = null) => {
        safeLogger.info('RTSP service event', {
            service: 'rtsp',
            event_type: 'service_event',
            event: event,
            details: details,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `RTSP service ${event}: ${details}`
        });
        writeServiceLog({ service: 'rtsp', event_type: 'service_event', log_level: 'info', message: `RTSP service ${event}: ${details}`, raw_data: { details }, brand, port, session_id: sessionId });
        writeRTSPLog({ event_type: 'service_event', log_level: 'info', message: `RTSP service ${event}: ${details}`, raw_data: { details }, brand, port, session_id: sessionId });
    },

    logRTSPDatabaseAuth: (ip, username, success, error, brand, port, sessionId = null) => {
        safeLogger.info('RTSP database authentication', {
            service: 'rtsp',
            event_type: 'database_auth',
            ip_address: ip,
            username: username,
            success: success,
            error: error,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `RTSP database auth ${success ? 'successful' : 'failed'} for user: ${username}`
        });
        writeServiceLog({ service: 'rtsp', event_type: 'database_auth', log_level: 'info', ip_address: ip, brand, port, username, sessionId, message: `RTSP database auth ${success ? 'successful' : 'failed'} for user: ${username}`, raw_data: { error, success } });
        writeRTSPLog({ event_type: 'database_auth', log_level: 'info', ip_address: ip, brand, port, username, sessionId, message: `RTSP database auth ${success ? 'successful' : 'failed'} for user: ${username}`, raw_data: { error, success } });
    },
    
    logRTSPError: (error, context, ip, brand, port, sessionId = null) => {
        safeLogger.error('RTSP error', {
            service: 'rtsp',
            event_type: 'error',
            error: error.message,
            context: context,
            ip_address: ip,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `RTSP error: ${error.message}`
        });
        writeServiceLog({ service: 'rtsp', event_type: 'error', log_level: 'error', ip_address: ip, brand, port, session_id: sessionId, message: `RTSP error: ${error.message}`, raw_data: { context } });
        writeRTSPLog({ event_type: 'error', log_level: 'error', ip_address: ip, brand, port, session_id: sessionId, message: `RTSP error: ${error.message}`, raw_data: { context } });
    }
};

// Set up file watcher when module is loaded
let fileWatcher = null;

try {
    fileWatcher = setupFileWatcher();
    if (fileWatcher) {
        console.log('[LOGGER] RTSP file watcher set up successfully');
    }
} catch (error) {
    console.error('[LOGGER] Failed to set up RTSP file watcher:', error.message);
    // Continue without file watcher, rely on checkAndRecreateLogFiles
}

// Cleanup function for graceful shutdown
process.on('SIGINT', () => {
    if (fileWatcher) {
        try {
            fileWatcher.close();
            console.log('[LOGGER] RTSP file watcher closed');
        } catch (error) {
            console.error('[LOGGER] Error closing RTSP file watcher:', error.message);
        }
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (fileWatcher) {
        try {
        fileWatcher.close();
        console.log('[LOGGER] RTSP file watcher closed');
    } catch (error) {
        console.error('[LOGGER] Error closing RTSP file watcher:', error.message);
    }
    }
    process.exit(0);
});

module.exports = { logger: safeLogger, rtspLogger }; 