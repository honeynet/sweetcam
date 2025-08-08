const { format, createLogger, transports } = require("winston");
require("winston-daily-rotate-file");
const fs = require('fs');
const path = require('path');
const { writeServiceLog, writeONVIFLog } = require('./db-logger');

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
            brand: info.brand || null,
            port: info.port || null,
            ws_discovery: info.ws_discovery || false,
            session_id: info.session_id || null
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
    logWSDiscovery: (ip, action, details, brand, port, sessionId = null) => {
        logger.info('WS-Discovery event', {
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

    logSOAPRequest: (ip, soapAction, method, url, brand, port, sessionId = null) => {
        logger.info('SOAP request', {
            service: 'onvif',
            event_type: 'soap_request',
            ip_address: ip,
            soap_action: soapAction,
            request_method: method,
            request_url: url,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `SOAP request: ${soapAction} from ${ip}`
        });
        writeServiceLog({ service: 'onvif', event_type: 'soap_request', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `SOAP request: ${soapAction} from ${ip}`, raw_data: { method, url, soapAction } });
        writeONVIFLog({ event_type: 'soap_request', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, soap_action: soapAction, message: `SOAP request: ${soapAction} from ${ip}` });
    },

    logSOAPResponse: (ip, soapAction, statusCode, brand, port, sessionId = null) => {
        logger.info('SOAP response', {
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
        logger.info('Device info request', {
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
        logger.info('Capabilities request', {
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
        logger.info('Services request', {
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
        logger.info('Network interface request', {
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
        logger.info('System request', {
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

    logSuspiciousONVIFActivity: (ip, activity, details, brand, port, sessionId = null) => {
        logger.warn('Suspicious ONVIF activity', {
            service: 'onvif',
            event_type: 'suspicious_activity',
            ip_address: ip,
            activity: activity,
            details: details,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `Suspicious ONVIF activity: ${activity}`
        });
        writeServiceLog({ service: 'onvif', event_type: 'suspicious_activity', log_level: 'warn', ip_address: ip, brand, port, session_id: sessionId, message: `Suspicious ONVIF activity: ${activity}`, raw_data: { details } });
        writeONVIFLog({ event_type: 'suspicious_activity', log_level: 'warn', ip_address: ip, brand, port, session_id: sessionId, message: `Suspicious ONVIF activity: ${activity}`, raw_data: { details } });
    },

    logONVIFAttackAttempt: (ip, _attackType, _payload, brand, port, sessionId = null) => {
        logger.error('ONVIF attack attempt', {
            service: 'onvif',
            event_type: 'attack_attempt',
            ip_address: ip,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `ONVIF attack attempt`
        });
        writeServiceLog({ service: 'onvif', event_type: 'attack_attempt', log_level: 'error', ip_address: ip, brand, port, session_id: sessionId, message: `ONVIF attack attempt` });
        writeONVIFLog({ event_type: 'attack_attempt', log_level: 'error', ip_address: ip, brand, port, session_id: sessionId, message: `ONVIF attack attempt` });
    },

    logONVIFServiceEvent: (event, details, brand, port, sessionId = null) => {
        logger.info('ONVIF service event', {
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

    logONVIFConnection: (ip, event, brand, port, sessionId = null) => {
        logger.info('ONVIF connection event', {
            service: 'onvif',
            event_type: 'connection_event',
            ip_address: ip,
            event: event,
            brand: brand,
            port: port,
            session_id: sessionId,
            message: `ONVIF connection ${event}: ${ip}`
        });
        writeServiceLog({ service: 'onvif', event_type: 'connection_event', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `ONVIF connection ${event}: ${ip}`, raw_data: { event } });
        writeONVIFLog({ event_type: 'connection_event', log_level: 'info', ip_address: ip, brand, port, session_id: sessionId, message: `ONVIF connection ${event}: ${ip}`, raw_data: { event } });
    },

    logONVIFError: (error, context, ip, brand, port, sessionId = null) => {
        logger.error('ONVIF error', {
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

module.exports = { logger, onvifLogger }; 