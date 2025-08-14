const fs = require('fs');
const path = require('path');
const { format, createLogger, transports } = require("winston");
require("winston-daily-rotate-file");

class SessionLogger {
    constructor(serviceName = 'webservice') {
        this.serviceName = serviceName;
        this.activeSessions = new Map(); // sessionId -> sessionData
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.logsDir = this.getLogsDir();
        
        // Create logs directory if it doesn't exist
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
        
        this.setupLogger();
        this.startCleanupInterval();
    }

    getLogsDir() {
        const dockerLogsDir = path.join('/app', 'logs', 'webservices');
        const localLogsDir = path.join(__dirname, '..', '..', 'logs', 'webservices');
        return fs.existsSync('/app/logs') ? dockerLogsDir : localLogsDir;
    }

    setupLogger() {
        const sessionLogFormat = format.combine(
            format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }),
            format.json(),
            format.printf(info => {
                return JSON.stringify(info);
            })
        );

        const sessionFileTransport = new transports.DailyRotateFile({
            filename: path.join(this.logsDir, "session-%DATE%.log"),
            datePattern: "YYYY-MM-DD",
            maxFiles: "30d",
            level: 'info'
        });

        this.sessionLogger = createLogger({
            transports: [sessionFileTransport],
            format: sessionLogFormat,
            exitOnError: false
        });
    }

    startCleanupInterval() {
        // Clean up expired sessions every 5 minutes
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000);
    }

    cleanupExpiredSessions() {
        const now = Date.now();
        for (const [sessionId, sessionData] of this.activeSessions.entries()) {
            if (now - sessionData.lastActivity > this.sessionTimeout) {
                this.finalizeSession(sessionId);
            }
        }
    }

    getOrCreateSession(sessionId, initialData = {}) {
        if (!this.activeSessions.has(sessionId)) {
            this.activeSessions.set(sessionId, {
                sessionId: sessionId,
                events: [],
                firstActivity: Date.now(),
                lastActivity: Date.now(),
                ipAddresses: new Set(),
                eventTypes: new Set(),
                brands: new Set(),
                usernames: new Set(),
                userAgents: new Set(),
                ...initialData
            });
        }
        
        const session = this.activeSessions.get(sessionId);
        session.lastActivity = Date.now();
        return session;
    }

    addEventToSession(sessionId, eventData) {
        const session = this.getOrCreateSession(sessionId);
        
        // Add event to session
        session.events.push({
            timestamp: eventData.timestamp,
            level: eventData.level,
            event_type: eventData.event_type,
            message: eventData.message,
            ip_address: eventData.ip_address,
            username: eventData.username,
            password: eventData.password,
            request_method: eventData.request_method,
            request_url: eventData.request_url,
            response_status: eventData.response_status,
            brand: eventData.brand,
            port: eventData.port
        });
        
        // Update session metadata
        if (eventData.ip_address && eventData.ip_address !== 'Unknown') {
            session.ipAddresses.add(eventData.ip_address);
        }
        if (eventData.event_type) {
            session.eventTypes.add(eventData.event_type);
        }
        if (eventData.brand && eventData.brand !== 'Unknown') {
            session.brands.add(eventData.brand);
        }
        if (eventData.username && eventData.username !== 'Unknown') {
            session.usernames.add(eventData.username);
        }
        if (eventData.user_agent) {
            session.userAgents.add(eventData.user_agent);
        }
        
        // Check if session should be finalized (e.g., logout event)
        if (eventData.event_type === 'session_event' && 
            eventData.message && 
            eventData.message.includes('logout')) {
            this.finalizeSession(sessionId);
        }
    }

    finalizeSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;
        
        const duration = Date.now() - session.firstActivity;
        const durationSeconds = Math.round(duration / 1000);
        
        // Create consolidated session entry
        const consolidatedEntry = {
            session_id: session.sessionId,
            session_start: new Date(session.firstActivity).toISOString(),
            session_end: new Date(session.lastActivity).toISOString(),
            duration_seconds: durationSeconds,
            total_events: session.events.length,
            ip_addresses: Array.from(session.ipAddresses),
            event_types: Array.from(session.eventTypes),
            brands: Array.from(session.brands),
            usernames: Array.from(session.usernames),
            user_agents: Array.from(session.userAgents),
            events: session.events,
            summary: {
                login_attempts: session.events.filter(e => e.event_type === 'login_attempt').length,
                auth_failures: session.events.filter(e => e.event_type === 'auth_failure').length,
                service_access: session.events.filter(e => e.event_type === 'service_access').length,
                session_events: session.events.filter(e => e.event_type === 'session_event').length
            }
        };
        
        // Log the consolidated session
        this.sessionLogger.info('Consolidated session', consolidatedEntry);
        
        // Remove from active sessions
        this.activeSessions.delete(sessionId);
        
        console.log(`[SESSION] Finalized session ${sessionId} with ${session.events.length} events`);
    }

    // Public methods for logging different event types
    logServiceAccess(ip, method, url, statusCode, userAgent, brand, port, sessionId = null) {
        const eventData = {
            timestamp: new Date().toISOString(),
            level: 'info',
            event_type: 'service_access',
            message: `${method} ${url} - ${statusCode}`,
            ip_address: ip,
            user_agent: userAgent,
            request_method: method,
            request_url: url,
            response_status: statusCode,
            brand: brand,
            port: port
        };
        
        if (sessionId) {
            this.addEventToSession(sessionId, eventData);
        }
    }

    logLoginAttempt(ip, username, success, userAgent, sessionId, brand, port, password = null) {
        const eventData = {
            timestamp: new Date().toISOString(),
            level: 'info',
            event_type: 'login_attempt',
            message: `Login attempt ${success ? 'successful' : 'failed'} for user: ${username}`,
            ip_address: ip,
            username: username,
            password: password,
            user_agent: userAgent,
            brand: brand,
            port: port
        };
        
        if (sessionId) {
            this.addEventToSession(sessionId, eventData);
        }
    }

    logAuthFailure(ip, username, reason, userAgent, brand, port, password = null, sessionId = null) {
        const eventData = {
            timestamp: new Date().toISOString(),
            level: 'warn',
            event_type: 'auth_failure',
            message: `Authentication failure for user: ${username}, reason: ${reason}`,
            ip_address: ip,
            username: username,
            password: password,
            user_agent: userAgent,
            brand: brand,
            port: port
        };
        
        if (sessionId) {
            this.addEventToSession(sessionId, eventData);
        }
    }

    logSessionEvent(ip, sessionId, event, username, brand, port) {
        const eventData = {
            timestamp: new Date().toISOString(),
            level: 'info',
            event_type: 'session_event',
            message: `Session ${event}: ${sessionId}`,
            ip_address: ip,
            username: username,
            brand: brand,
            port: port
        };
        
        if (sessionId) {
            this.addEventToSession(sessionId, eventData);
        }
    }

    // Force finalize a session (useful for cleanup)
    forceFinalizeSession(sessionId) {
        this.finalizeSession(sessionId);
    }

    // Get active session count
    getActiveSessionCount() {
        return this.activeSessions.size;
    }

    // Get session data (for debugging)
    getSessionData(sessionId) {
        return this.activeSessions.get(sessionId);
    }
}

module.exports = SessionLogger; 