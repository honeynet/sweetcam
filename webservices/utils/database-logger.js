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
            
            await this.ensurePayloadFieldExists();
            
            this.initialized = true;
        } catch (error) {
            console.error('[DATABASE] Failed to initialize database logger:', error.message);
            throw error;
        }
    }

    async ensurePayloadFieldExists() {
        try {
            //check if payload field exists in service_logs table
            const [columns] = await this.pool.execute(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? 
                AND TABLE_NAME = 'service_logs' 
                AND COLUMN_NAME = 'payload'
            `, [process.env.DB_NAME || 'sweetcam']);

            if (columns.length === 0) {
                console.log('[DATABASE] Adding payload field to service_logs table...');
                await this.pool.execute(`
                    ALTER TABLE service_logs 
                    ADD COLUMN payload JSON DEFAULT NULL 
                    COMMENT 'HTTP request and response payloads'
                `);
                console.log('[DATABASE] Payload field added successfully');
            }

            //check if payload field exists in web_service_logs table
            const [webColumns] = await this.pool.execute(`
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = ? 
                AND TABLE_NAME = 'web_service_logs' 
                AND COLUMN_NAME = 'payload'
            `, [process.env.DB_NAME || 'sweetcam']);

            if (webColumns.length === 0) {
                console.log('[DATABASE] Adding payload field to web_service_logs table...');
                await this.pool.execute(`
                    ALTER TABLE web_service_logs 
                    ADD COLUMN payload JSON DEFAULT NULL 
                    COMMENT 'HTTP request and response payloads'
                `);
                console.log('[DATABASE] Payload field added to web_service_logs successfully');
            }
        } catch (error) {
            console.error('[DATABASE] Error ensuring payload field exists:', error.message);
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
                payload: logData.payload ? JSON.stringify(logData.payload) : null,
                raw_data: logData.raw_data ? JSON.stringify(logData.raw_data) : null
            };



            const query = `
                INSERT INTO service_logs 
                (timestamp, service, event_type, log_level, ip_address, brand, port, 
                 username, password, session_id, user_agent, message, payload, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                logEntry.payload,
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