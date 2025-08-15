const { format, createLogger, transports } = require("winston");
require("winston-daily-rotate-file");
const fs = require('fs');
const path = require('path');
const { writeServiceLog, writeONVIFLog } = require('./db-logger');

const dockerLogsDir = path.join('/app', 'logs');
const localLogsDir = path.join(__dirname, '..', 'logs');

const logsDir = fs.existsSync('/app/logs') ? dockerLogsDir : localLogsDir;

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

function ensureLogFilesExist() {
    const today = new Date().toISOString().split('T')[0];
    const appLogFile = path.join(logsDir, `onvif-app-${today}.log`);
    const errorLogFile = path.join(logsDir, `onvif-error-${today}.log`);
    
    let needsReopen = false;
    
    try {
        if (!fs.existsSync(appLogFile)) {
            try {
                fs.writeFileSync(appLogFile, `{"timestamp":"${new Date().toISOString()}","level":"info","message":"ONVIF log file initialized","service":"onvif"}\n`);
                needsReopen = true;
            } catch (writeError) {
                console.error('Failed to create ONVIF app log file:', writeError.message);
                try {
                    fs.closeSync(fs.openSync(appLogFile, 'a'));
                    needsReopen = true;
                } catch (touchError) {
                    console.error('Failed to touch ONVIF app log file:', touchError.message);
                }
            }
        }
        
        if (!fs.existsSync(errorLogFile)) {
            try {
                fs.writeFileSync(errorLogFile, `{"timestamp":"${new Date().toISOString()}","level":"error","message":"ONVIF error log file initialized","service":"onvif"}\n`);
                needsReopen = true;
            } catch (writeError) {
                console.error('Failed to create ONVIF error log file:', writeError.message);
                try {
                    fs.closeSync(fs.openSync(errorLogFile, 'a'));
                    needsReopen = true;
                } catch (touchError) {
                    console.error('Failed to touch ONVIF error log file:', touchError.message);
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
                    filename: path.join(logsDir, "onvif-app-%DATE%.log"),
                    datePattern: "YYYY-MM-DD",
                    maxFiles: "14d",
                    level: 'info'
                });
                
                const newErrorFileTransport = new transports.DailyRotateFile({
                    filename: path.join(logsDir, "onvif-error-%DATE%.log"),
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
                console.error('Failed to reopen ONVIF transports:', error.message);
            }
        }
    } catch (error) {
        console.error('Error in ensureLogFilesExist:', error.message);
    }
}

function checkAndRecreateLogFiles() {
    const today = new Date().toISOString().split('T')[0];
    const appLogFile = path.join(logsDir, `onvif-app-${today}.log`);
    const errorLogFile = path.join(logsDir, `onvif-error-${today}.log`);
    
    let needsRecreate = false;
    
    try {
        if (!fs.existsSync(appLogFile)) {
            console.log(`[LOGGER] ONVIF app log file not found: ${appLogFile}`);
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
        console.error('[LOGGER] Error checking ONVIF log files:', error.message);
        try {
            ensureLogFilesExist();
        } catch (ensureError) {
            console.error('[LOGGER] Failed to ensure ONVIF log files exist:', ensureError.message);
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
            console.error('ONVIF file watcher error:', error.message);
        });
        
        return watcher;
    } catch (error) {
        console.error('Failed to set up ONVIF file watcher:', error.message);
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
            service: info.service || 'onvif',
            event_type: info.event_type || 'general',
            ip_address: info.ip_address || null,
            user_agent: info.user_agent || null,
            soap_action: info.soap_action || null,
            request_method: info.request_method || null,
            request_url: info.request_url || null,
            response_status: info.response_status || null,
            brand: info.brand || null,
            port: info.port || null,
            ws_discovery: info.ws_discovery || false,
            session_id: info.session_id || null
        };
        return JSON.stringify(logEntry);
    })
);

let appFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "onvif-app-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "14d",
    level: 'info'
});

let errorFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "onvif-error-%DATE%.log"),
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

const onvifLogger = {
    logWSDiscovery: (ip, action, details, brand, port, sessionId = null) => {
        safeLogger.info('WS-Discovery event', {
            service: 'onvif',
            event_type: 'ws_discovery',
            ip_address: ip,
            action: action,
            details: details,
            brand: brand,
            port: port,
            ws_discovery: true,
            session_id: sessionId,
            message: `WS-Discovery ${action}: ${details}`
        });
        writeServiceLog({ service: 'onvif', event_type: 'ws_discovery', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `WS-Discovery ${action}: ${details}`, raw_data: { action, details } });
        writeONVIFLog({ event_type: 'ws_discovery', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `WS-Discovery ${action}: ${details}`, raw_data: { action, details }, discovery_type: 'WS-Discovery' });
    },

    logSOAPRequest: (ip, soapAction, method, url, brand, port, userAgent = null, responseStatus = null, sessionId = null) => {
        safeLogger.info('SOAP request', {
            service: 'onvif',
            event_type: 'soap_request',
            ip_address: ip,
            soap_action: soapAction,
            request_method: method,
            request_url: url,
            user_agent: userAgent,
            brand: brand,
            port: port,
            response_status: responseStatus,
            session_id: sessionId,
            message: `SOAP request: ${soapAction} from ${ip}`
        });
        writeServiceLog({ service: 'onvif', event_type: 'soap_request', log_level: 'info', ip_address: ip, brand, port, user_agent: userAgent, request_method: method, request_url: url, response_status: responseStatus, session_id: sessionId, message: `SOAP request: ${soapAction} from ${ip}`, raw_data: { method, url, soapAction } });
        writeONVIFLog({ event_type: 'soap_request', log_level: 'info', ip_address: ip, brand, port, user_agent: userAgent, request_method: method, request_url: url, response_status: responseStatus, session_id: sessionId, soap_action: soapAction, message: `SOAP request: ${soapAction} from ${ip}` });
    },

    logSOAPResponse: (ip, soapAction, statusCode, brand, port, sessionId = null) => {
        safeLogger.info('SOAP response', {
            service: 'onvif',
            event_type: 'soap_response',
            ip_address: ip,
            soap_action: soapAction,
            response_status: statusCode,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `SOAP response: ${soapAction} - ${statusCode}`
        });
        writeServiceLog({ service: 'onvif', event_type: 'soap_response', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `SOAP response: ${soapAction} - ${statusCode}`, raw_data: { soapAction, statusCode } });
        writeONVIFLog({ event_type: 'soap_response', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, soap_action: soapAction, message: `SOAP response: ${soapAction} - ${statusCode}` });
    },

    logDeviceInfoRequest: (ip, brand, port, sessionId = null) => {
        safeLogger.info('Device info request', {
            service: 'onvif',
            event_type: 'device_info_request',
            ip_address: ip,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `Device information requested from ${ip}`
        });
        writeServiceLog({ service: 'onvif', event_type: 'device_info_request', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `Device information requested from ${ip}` });
        writeONVIFLog({ event_type: 'device_info_request', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `Device information requested from ${ip}` });
    },

    logCapabilitiesRequest: (ip, categories, brand, port, sessionId = null) => {
        safeLogger.info('Capabilities request', {
            service: 'onvif',
            event_type: 'capabilities_request',
            ip_address: ip,
            categories: categories,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `Capabilities requested from ${ip}: ${categories?.join(', ') || 'all'}`
        });
        writeServiceLog({ service: 'onvif', event_type: 'capabilities_request', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `Capabilities requested from ${ip}`, raw_data: { categories } });
        writeONVIFLog({ event_type: 'capabilities_request', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `Capabilities requested from ${ip}`, raw_data: { categories } });
    },

    logServicesRequest: (ip, includeCapability, brand, port, sessionId = null) => {
        safeLogger.info('Services request', {
            service: 'onvif',
            event_type: 'services_request',
            ip_address: ip,
            include_capability: includeCapability,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `Services requested from ${ip}`
        });
        writeServiceLog({ service: 'onvif', event_type: 'services_request', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `Services requested from ${ip}`, raw_data: { includeCapability } });
        writeONVIFLog({ event_type: 'services_request', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `Services requested from ${ip}` });
    },

    logNetworkRequest: (ip, brand, port, sessionId = null) => {
        safeLogger.info('Network interface request', {
            service: 'onvif',
            event_type: 'network_request',
            ip_address: ip,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `Network interfaces requested from ${ip}`
        });
        writeServiceLog({ service: 'onvif', event_type: 'network_request', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `Network interfaces requested from ${ip}` });
        writeONVIFLog({ event_type: 'network_request', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `Network interfaces requested from ${ip}` });
    },

    logSystemRequest: (ip, requestType, brand, port, sessionId = null) => {
        safeLogger.info('System request', {
            service: 'onvif',
            event_type: 'system_request',
            ip_address: ip,
            request_type: requestType,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `System ${requestType} requested from ${ip}`
        });
        writeServiceLog({ service: 'onvif', event_type: 'system_request', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `System ${requestType} requested from ${ip}`, raw_data: { requestType } });
        writeONVIFLog({ event_type: 'system_request', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `System ${requestType} requested from ${ip}` });
    },

    logONVIFServiceEvent: (event, details, brand, port, sessionId = null) => {
        safeLogger.info('ONVIF service event', {
            service: 'onvif',
            event_type: 'service_event',
            event: event,
            details: details,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `ONVIF service ${event}: ${details}`
        });
        writeServiceLog({ service: 'onvif', event_type: 'service_event', log_level: 'info', message: `ONVIF service ${event}: ${details}`, raw_data: { details }, brand, port, session_id: sessionId });
        writeONVIFLog({ event_type: 'service_event', log_level: 'info', message: `ONVIF service ${event}: ${details}`, raw_data: { details }, brand, port, session_id: sessionId });
    },

    logONVIFConnection: (ip, event, brand, port, userAgent = null, requestMethod = null, requestUrl = null, responseStatus = null, sessionId = null) => {
        safeLogger.info('ONVIF connection event', {
            service: 'onvif',
            event_type: 'connection_event',
            ip_address: ip,
            event: event,
            brand: brand,
            port: port,
            user_agent: userAgent,
            request_method: requestMethod,
            request_url: requestUrl,
            response_status: responseStatus,
            session_id: sessionId,
            message: `ONVIF connection ${event}: ${ip}`
        });
        writeServiceLog({ service: 'onvif', event_type: 'connection_event', log_level: 'info', ip_address: ip, brand, port, user_agent: userAgent, request_method: requestMethod, request_url: requestUrl, response_status: responseStatus, session_id: sessionId, message: `ONVIF connection ${event}: ${ip}`, raw_data: { event } });
        writeONVIFLog({ event_type: 'connection_event', log_level: 'info', ip_address: ip, brand, port, user_agent: userAgent, request_method: requestMethod, request_url: requestUrl, response_status: responseStatus, session_id: sessionId, message: `ONVIF connection ${event}: ${ip}`, raw_data: { event } });
    },

    logONVIFError: (error, context, ip, brand, port, sessionId = null) => {
        safeLogger.error('ONVIF error', {
            service: 'onvif',
            event_type: 'error',
            error: error.message,
            context: context,
            ip_address: ip,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `ONVIF error: ${error.message}`
        });
        writeServiceLog({ service: 'onvif', event_type: 'error', log_level: 'error', ip_address: ip, brand, port, session_id: sessionId, message: `ONVIF error: ${error.message}`, raw_data: { context } });
        writeONVIFLog({ event_type: 'error', log_level: 'error', ip_address: ip, brand, port, session_id: sessionId, message: `ONVIF error: ${error.message}`, raw_data: { context } });
    }
};

let fileWatcher = null;

try {
    fileWatcher = setupFileWatcher();
    if (fileWatcher) {
        console.log('[LOGGER] ONVIF file watcher set up successfully');
    }
} catch (error) {
    console.error('[LOGGER] Failed to set up ONVIF file watcher:', error.message);
}

process.on('SIGINT', () => {
    if (fileWatcher) {
        try {
            fileWatcher.close();
            console.log('[LOGGER] ONVIF file watcher closed');
    } catch (error) {
        console.error('[LOGGER] Error closing ONVIF file watcher:', error.message);
    }
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (fileWatcher) {
        try {
            fileWatcher.close();
            console.log('[LOGGER] ONVIF file watcher closed');
        } catch (error) {
            console.error('[LOGGER] Error closing ONVIF file watcher:', error.message);
        }
    }
    process.exit(0);
});

module.exports = { logger: safeLogger, onvifLogger }; 