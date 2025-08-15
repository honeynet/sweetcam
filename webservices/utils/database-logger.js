const mysql = require('mysql2/promise');

class DatabaseLogger {
    constructor() {
        this.pool = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            const config = {
                host: process.env.DB_HOST || 'mysql_service',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || 'rootpassword',
                database: process.env.DB_NAME || 'sweetcam',
                port: parseInt(process.env.DB_PORT) || 3306,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            };

            this.pool = mysql.createPool(config);
            await this.pool.getConnection();
            this.initialized = true;
        } catch (error) {
            console.error('[DATABASE] Failed to initialize database logger:', error.message);
            throw error;
        }
    }

    async logEvent(logData) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const logEntry = {
                timestamp: logData.timestamp || new Date(),
                service: logData.service || 'unknown',
                event_type: logData.event_type || 'unknown',
                log_level: logData.log_level || 'info',
                ip_address: logData.ip_address || null,
                brand: logData.brand || null,
                port: logData.port || null,
                username: logData.username || null,
                password: logData.password || null,
                session_id: logData.session_id || null,
                user_agent: logData.user_agent || null,
                message: logData.message || null,
                raw_data: logData.raw_data ? JSON.stringify(logData.raw_data) : null
            };



            const query = `
                INSERT INTO service_logs 
                (timestamp, service, event_type, log_level, ip_address, brand, port, 
                 username, password, session_id, user_agent, message, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                logEntry.timestamp,
                logEntry.service,
                logEntry.event_type,
                logEntry.log_level,
                logEntry.ip_address,
                logEntry.brand,
                logEntry.port,
                logEntry.username,
                logEntry.password,
                logEntry.session_id,
                logEntry.user_agent,
                logEntry.message,
                logEntry.raw_data
            ];

            const [result] = await this.pool.execute(query, params);
            return result.insertId;

        } catch (error) {
            console.error('[DATABASE] Error logging event:', error.message);
            throw error;
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
        }
    }
}

const databaseLogger = new DatabaseLogger();
module.exports = databaseLogger; 