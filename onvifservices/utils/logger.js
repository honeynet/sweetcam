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
            service: info.service || 'onvif',
            event_type: info.event_type || 'general',
            ip_address: info.ip_address || null,
            user_agent: info.user_agent || null,
            soap_action: info.soap_action || null,
            request_method: info.request_method || null,
            request_url: info.request_url || null,
            response_status: info.response_status || null,
            attack_type: info.attack_type || null,
            payload: info.payload || null,
            brand: info.brand || null,
            port: info.port || null,
            ws_discovery: info.ws_discovery || false
        };
        return JSON.stringify(logEntry);
    })
);

const securityFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "onvif-security-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "30d",
    level: 'info'
});

const appFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "onvif-app-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "14d",
    level: 'info'
});

const errorFileTransport = new transports.DailyRotateFile({
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
            delete safeInfo.payload;
            delete safeInfo.soap_action;
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

const onvifLogger = {
    logWSDiscovery: (ip, action, details, brand, port) => {
        logger.info('WS-Discovery event', {
            service: 'onvif',
            event_type: 'ws_discovery',
            ip_address: ip,
            action: action,
            details: details,
            brand: brand,
            port: port,
            ws_discovery: true,
            message: `WS-Discovery ${action}: ${details}`
        });
    },

    logSOAPRequest: (ip, soapAction, method, url, brand, port) => {
        logger.info('SOAP request', {
            service: 'onvif',
            event_type: 'soap_request',
            ip_address: ip,
            soap_action: soapAction,
            request_method: method,
            request_url: url,
            brand: brand,
            port: port,
            message: `SOAP request: ${soapAction} from ${ip}`
        });
    },

    logSOAPResponse: (ip, soapAction, statusCode, brand, port) => {
        logger.info('SOAP response', {
            service: 'onvif',
            event_type: 'soap_response',
            ip_address: ip,
            soap_action: soapAction,
            response_status: statusCode,
            brand: brand,
            port: port,
            message: `SOAP response: ${soapAction} - ${statusCode}`
        });
    },

    logDeviceInfoRequest: (ip, brand, port) => {
        logger.info('Device info request', {
            service: 'onvif',
            event_type: 'device_info_request',
            ip_address: ip,
            brand: brand,
            port: port,
            message: `Device information requested from ${ip}`
        });
    },

    logCapabilitiesRequest: (ip, categories, brand, port) => {
        logger.info('Capabilities request', {
            service: 'onvif',
            event_type: 'capabilities_request',
            ip_address: ip,
            categories: categories,
            brand: brand,
            port: port,
            message: `Capabilities requested from ${ip}: ${categories?.join(', ') || 'all'}`
        });
    },

    logServicesRequest: (ip, includeCapability, brand, port) => {
        logger.info('Services request', {
            service: 'onvif',
            event_type: 'services_request',
            ip_address: ip,
            include_capability: includeCapability,
            brand: brand,
            port: port,
            message: `Services requested from ${ip}`
        });
    },

    logNetworkRequest: (ip, brand, port) => {
        logger.info('Network interface request', {
            service: 'onvif',
            event_type: 'network_request',
            ip_address: ip,
            brand: brand,
            port: port,
            message: `Network interfaces requested from ${ip}`
        });
    },

    logSystemRequest: (ip, requestType, brand, port) => {
        logger.info('System request', {
            service: 'onvif',
            event_type: 'system_request',
            ip_address: ip,
            request_type: requestType,
            brand: brand,
            port: port,
            message: `System ${requestType} requested from ${ip}`
        });
    },

    logSuspiciousONVIFActivity: (ip, activity, details, brand, port) => {
        logger.warn('Suspicious ONVIF activity', {
            service: 'onvif',
            event_type: 'suspicious_activity',
            ip_address: ip,
            activity: activity,
            details: details,
            brand: brand,
            port: port,
            message: `Suspicious ONVIF activity: ${activity}`
        });
    },

    logONVIFAttackAttempt: (ip, attackType, payload, brand, port) => {
        logger.error('ONVIF attack attempt', {
            service: 'onvif',
            event_type: 'attack_attempt',
            ip_address: ip,
            attack_type: attackType,
            payload: payload,
            brand: brand,
            port: port,
            message: `ONVIF attack attempt: ${attackType}`
        });
    },

    logONVIFServiceEvent: (event, details, brand, port) => {
        logger.info('ONVIF service event', {
            service: 'onvif',
            event_type: 'service_event',
            event: event,
            details: details,
            brand: brand,
            port: port,
            message: `ONVIF service ${event}: ${details}`
        });
    },

    logONVIFConnection: (ip, event, brand, port) => {
        logger.info('ONVIF connection event', {
            service: 'onvif',
            event_type: 'connection_event',
            ip_address: ip,
            event: event,
            brand: brand,
            port: port,
            message: `ONVIF connection ${event}: ${ip}`
        });
    },

    logONVIFError: (error, context, ip, brand, port) => {
        logger.error('ONVIF error', {
            service: 'onvif',
            event_type: 'error',
            error: error.message,
            stack: error.stack,
            context: context,
            ip_address: ip,
            brand: brand,
            port: port,
            message: `ONVIF error: ${error.message}`
        });
    }
};

module.exports = { logger, onvifLogger }; 