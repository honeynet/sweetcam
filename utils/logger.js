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
            service: info.service || 'port_manager',
            event_type: info.event_type || 'general',
            ip_address: info.ip_address || null,
            user_agent: info.user_agent || null,
            service_name: info.service_name || null,
            old_port: info.old_port || null,
            new_port: info.new_port || null,
            operation: info.operation || null,
            success: info.success || null,
            details: info.details || null
        };
        return JSON.stringify(logEntry);
    })
);

//separate transport for security events 
const securityFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "port-manager-security-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "30d",
    level: 'info'
});

//regular application logs
const appFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "port-manager-app-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "14d",
    level: 'info'
});

//error logs
const errorFileTransport = new transports.DailyRotateFile({
    filename: path.join(logsDir, "port-manager-error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "30d",
    level: 'error'
});

//console transport (only in development)
const consoleTransport = new transports.Console({
    format: format.combine(
        format.colorize(),
        format.simple(),
        format.printf(info => {
            //dont log sensitive information to console
            const safeInfo = { ...info };
            delete safeInfo.details;
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

const portManagerLogger = {
    //log port change attempts
    logPortChangeAttempt: (serviceName, oldPort, newPort, success, details) => {
        logger.info('Port change attempt', {
            service: 'port_manager',
            event_type: 'port_change_attempt',
            service_name: serviceName,
            old_port: oldPort,
            new_port: newPort,
            success: success,
            details: details,
            message: `Port change attempt for ${serviceName}: ${oldPort} -> ${newPort} (${success ? 'success' : 'failed'})`
        });
    },

    logServiceOperation: (operation, serviceName, details, success) => {
        logger.info('Service operation', {
            service: 'port_manager',
            event_type: 'service_operation',
            operation: operation,
            service_name: serviceName,
            details: details,
            success: success,
            message: `Service operation ${operation} for ${serviceName}: ${success ? 'success' : 'failed'}`
        });
    },

    logContainerOperation: (operation, serviceName, details, success) => {
        logger.info('Container operation', {
            service: 'port_manager',
            event_type: 'container_operation',
            operation: operation,
            service_name: serviceName,
            details: details,
            success: success,
            message: `Container operation ${operation} for ${serviceName}: ${success ? 'success' : 'failed'}`
        });
    },

    logConfigChange: (serviceName, changeType, details, success) => {
        logger.info('Configuration change', {
            service: 'port_manager',
            event_type: 'config_change',
            service_name: serviceName,
            change_type: changeType,
            details: details,
            success: success,
            message: `Configuration change ${changeType} for ${serviceName}: ${success ? 'success' : 'failed'}`
        });
    },

    logPortCheck: (port, available, serviceName) => {
        logger.info('Port availability check', {
            service: 'port_manager',
            event_type: 'port_check',
            port: port,
            available: available,
            service_name: serviceName,
            message: `Port ${port} availability check: ${available ? 'available' : 'in use'}`
        });
    },

    logFileOperation: (operation, filePath, details, success) => {
        logger.info('File operation', {
            service: 'port_manager',
            event_type: 'file_operation',
            operation: operation,
            file_path: filePath,
            details: details,
            success: success,
            message: `File operation ${operation}: ${success ? 'success' : 'failed'}`
        });
    },

    logCommandExecution: (command, serviceName, details, success) => {
        logger.info('Command execution', {
            service: 'port_manager',
            event_type: 'command_execution',
            command: command,
            service_name: serviceName,
            details: details,
            success: success,
            message: `Command execution: ${command} (${success ? 'success' : 'failed'})`
        });
    },

    logSuspiciousActivity: (activity, details, ip) => {
        logger.warn('Suspicious activity', {
            service: 'port_manager',
            event_type: 'suspicious_activity',
            activity: activity,
            details: details,
            ip_address: ip,
            message: `Suspicious activity detected: ${activity}`
        });
    },

    logAttackAttempt: (attackType, payload, ip) => {
        logger.error('Attack attempt', {
            service: 'port_manager',
            event_type: 'attack_attempt',
            attack_type: attackType,
            payload: payload,
            ip_address: ip,
            message: `Attack attempt detected: ${attackType}`
        });
    },

    logServiceEvent: (event, details) => {
        logger.info('Service event', {
            service: 'port_manager',
            event_type: 'service_event',
            event: event,
            details: details,
            message: `Service event: ${event}`
        });
    },

    logStartupShutdown: (event, details) => {
        logger.info('Startup/shutdown event', {
            service: 'port_manager',
            event_type: 'startup_shutdown',
            event: event,
            details: details,
            message: `Port manager ${event}: ${details}`
        });
    },

    //general error logging
    logError: (error, context) => {
        logger.error('Port manager error', {
            service: 'port_manager',
            event_type: 'error',
            error: error.message,
            stack: error.stack,
            context: context,
            message: `Port manager error: ${error.message}`
        });
    }
};

module.exports = { logger, portManagerLogger }; 