const mysql = require('mysql2/promise');

class DatabaseLogger {
    constructor() {
        this.pool = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            // Use environment variables with fallbacks
            const config = {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || 'rootpassword',
                database: process.env.DB_NAME || 'sweetcam',
                port: parseInt(process.env.DB_PORT) || 3306,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            };

            console.log(`[DATABASE] Connecting to ${config.host}:${config.port}/${config.database}`);
            
            this.pool = mysql.createPool(config);

            // Test connection
            await this.pool.getConnection();
            this.initialized = true;
            console.log('[DATABASE] Database logger initialized successfully');
        } catch (error) {
            console.error('[DATABASE] Failed to initialize database logger:', error.message);
            throw error;
        }
    }

    async logEvent(logData) {
        if (!this.initialized) {
            await this.initialize();
        }

        const {
            service,
            event_type,
            log_level = 'info',
            ip_address,
            brand,
            port,
            username,
            password,
            session_id,
            user_agent,
            message,
            raw_data,
            timestamp = new Date()
        } = logData;

        try {
            // Insert into main service_logs table
            const mainQuery = `
                INSERT INTO service_logs 
                (timestamp, service, event_type, log_level, ip_address, brand, port, 
                 username, password, session_id, user_agent, message, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const mainParams = [
                timestamp,
                service,
                event_type,
                log_level,
                ip_address || null,
                brand || null,
                port || null,
                username || null,
                password || null,
                session_id || null,
                user_agent || null,
                message || null,
                raw_data ? JSON.stringify(raw_data) : null
            ];

            const [mainResult] = await this.pool.execute(mainQuery, mainParams);

            // Insert into service-specific table
            await this.insertServiceSpecificLog(logData, mainResult.insertId);

            // Update session tracking if session_id is provided
            if (session_id) {
                await this.updateSessionTracking(logData);
            }

            // Update IP reputation
            if (ip_address) {
                await this.updateIpReputation(logData);
            }

            // Check for security events
            await this.checkSecurityEvent(logData);

            return mainResult.insertId;
        } catch (error) {
            console.error('[DATABASE] Error logging event:', error.message);
            throw error;
        }
    }

    async insertServiceSpecificLog(logData, mainLogId) {
        const { service, event_type } = logData;

        try {
            switch (service) {
                case 'web':
                    await this.insertWebServiceLog(logData, mainLogId);
                    break;
                case 'rtsp':
                    await this.insertRtspServiceLog(logData, mainLogId);
                    break;
                case 'onvif':
                    await this.insertOnvifServiceLog(logData, mainLogId);
                    break;
                case 'cowrie':
                    await this.insertCowrieServiceLog(logData, mainLogId);
                    break;
                default:
                    console.warn(`[DATABASE] Unknown service type: ${service}`);
            }
        } catch (error) {
            console.error(`[DATABASE] Error inserting ${service} specific log:`, error.message);
        }
    }

    async insertWebServiceLog(logData, mainLogId) {
        const {
            timestamp,
            event_type,
            log_level,
            ip_address,
            brand,
            port,
            username,
            password,
            session_id,
            user_agent,
            message,
            raw_data
        } = logData;

        const request_path = raw_data?.request_path || null;
        const request_method = raw_data?.request_method || null;
        const response_code = raw_data?.response_code || null;

        const query = `
            INSERT INTO web_service_logs 
            (timestamp, event_type, log_level, ip_address, brand, port, 
             username, password, session_id, user_agent, request_path, 
             request_method, response_code, message, raw_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            timestamp,
            event_type,
            log_level,
            ip_address || null,
            brand || null,
            port || null,
            username || null,
            password || null,
            session_id || null,
            user_agent || null,
            request_path || null,
            request_method || null,
            response_code || null,
            message || null,
            raw_data ? JSON.stringify(raw_data) : null
        ];



        await this.pool.execute(query, params);
    }

    async insertRtspServiceLog(logData, mainLogId) {
        const {
            timestamp,
            event_type,
            log_level,
            ip_address,
            brand,
            port,
            username,
            password,
            session_id,
            message,
            raw_data
        } = logData;

        const rtsp_method = raw_data?.rtsp_method || null;
        const stream_path = raw_data?.stream_path || null;
        const connection_id = raw_data?.connection_id || null;

        const query = `
            INSERT INTO rtsp_service_logs 
            (timestamp, event_type, log_level, ip_address, brand, port, 
             username, password, session_id, rtsp_method, stream_path, 
             connection_id, message, raw_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            timestamp,
            event_type,
            log_level,
            ip_address || null,
            brand || null,
            port || null,
            username || null,
            password || null,
            session_id || null,
            rtsp_method || null,
            stream_path || null,
            connection_id || null,
            message || null,
            raw_data ? JSON.stringify(raw_data) : null
        ];

        await this.pool.execute(query, params);
    }

    async insertOnvifServiceLog(logData, mainLogId) {
        const {
            timestamp,
            event_type,
            log_level,
            ip_address,
            brand,
            port,
            username,
            password,
            session_id,
            message,
            raw_data
        } = logData;

        const soap_action = raw_data?.soap_action || null;
        const device_info = raw_data?.device_info || null;
        const discovery_type = raw_data?.discovery_type || null;

        const query = `
            INSERT INTO onvif_service_logs 
            (timestamp, event_type, log_level, ip_address, brand, port, 
             username, password, session_id, soap_action, device_info, 
             discovery_type, message, raw_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            timestamp,
            event_type,
            log_level,
            ip_address || null,
            brand || null,
            port || null,
            username || null,
            password || null,
            session_id || null,
            soap_action || null,
            device_info ? JSON.stringify(device_info) : null,
            discovery_type || null,
            message || null,
            raw_data ? JSON.stringify(raw_data) : null
        ];

        await this.pool.execute(query, params);
    }

    async insertCowrieServiceLog(logData, mainLogId) {
        const {
            timestamp,
            event_type,
            log_level,
            ip_address,
            brand,
            port,
            username,
            password,
            session_id,
            message,
            raw_data
        } = logData;

        const command = raw_data?.command || null;
        const file_path = raw_data?.file_path || null;
        const file_size = raw_data?.file_size || null;
        const geoip_country = raw_data?.geoip_country || null;
        const geoip_city = raw_data?.geoip_city || null;
        const threat_level = raw_data?.threat_level || null;
        const alert_type = raw_data?.alert_type || null;

        const query = `
            INSERT INTO cowrie_service_logs 
            (timestamp, event_type, log_level, ip_address, brand, port, 
             username, password, session_id, command, file_path, file_size,
             geoip_country, geoip_city, threat_level, alert_type, message, raw_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            timestamp,
            event_type,
            log_level,
            ip_address || null,
            brand || null,
            port || null,
            username || null,
            password || null,
            session_id || null,
            command || null,
            file_path || null,
            file_size || null,
            geoip_country || null,
            geoip_city || null,
            threat_level || null,
            alert_type || null,
            message || null,
            raw_data ? JSON.stringify(raw_data) : null
        ];

        await this.pool.execute(query, params);
    }

    async updateSessionTracking(logData) {
        const { session_id, service, ip_address, brand, username, event_type } = logData;

        try {
            // Check if session exists
            const [existing] = await this.pool.execute(
                'SELECT * FROM session_tracking WHERE session_id = ?',
                [session_id]
            );

            if (existing.length === 0) {
                // Create new session
                await this.pool.execute(`
                    INSERT INTO session_tracking 
                    (session_id, service, ip_address, brand, username, start_time, status)
                    VALUES (?, ?, ?, ?, ?, NOW(), 'active')
                `, [session_id, service, ip_address, brand, username]);
            } else {
                // Update existing session
                const session = existing[0];
                let status = session.status;

                // Update status based on event type
                if (event_type === 'session_end') {
                    status = 'completed';
                } else if (event_type === 'session_start') {
                    status = 'active';
                }

                await this.pool.execute(`
                    UPDATE session_tracking 
                    SET event_count = event_count + 1,
                        status = ?,
                        updated_at = NOW()
                    WHERE session_id = ?
                `, [status, session_id]);
            }
        } catch (error) {
            console.error('[DATABASE] Error updating session tracking:', error.message);
        }
    }

    async updateIpReputation(logData) {
        const { ip_address, event_type, brand, raw_data } = logData;

        try {
            // Check if IP exists
            const [existing] = await this.pool.execute(
                'SELECT * FROM ip_reputation WHERE ip_address = ?',
                [ip_address]
            );

            const geoip_country = raw_data?.geoip_country || null;
            const geoip_city = raw_data?.geoip_city || null;

            if (existing.length === 0) {
                // Create new IP reputation entry
                await this.pool.execute(`
                    INSERT INTO ip_reputation 
                    (ip_address, first_seen, last_seen, total_events, country, city)
                    VALUES (?, NOW(), NOW(), 1, ?, ?)
                `, [ip_address, geoip_country, geoip_city]);
            } else {
                // Update existing IP reputation
                const reputation = existing[0];
                let failed_logins = reputation.failed_logins;
                let successful_logins = reputation.successful_logins;
                let suspicious_activities = reputation.suspicious_activities;

                // Update counters based on event type
                if (event_type === 'auth_failure' || event_type === 'login_attempt') {
                    failed_logins++;
                } else if (event_type === 'login_success') {
                    successful_logins++;
                } else if (event_type === 'suspicious_activity' || event_type === 'attack_attempt') {
                    suspicious_activities++;
                }

                // Calculate threat score (0-100)
                let threat_score = 0;
                if (failed_logins > 0) threat_score += Math.min(failed_logins * 10, 40);
                if (suspicious_activities > 0) threat_score += Math.min(suspicious_activities * 20, 60);

                await this.pool.execute(`
                    UPDATE ip_reputation 
                    SET total_events = total_events + 1,
                        failed_logins = ?,
                        successful_logins = ?,
                        suspicious_activities = ?,
                        threat_score = ?,
                        last_seen = NOW(),
                        updated_at = NOW()
                    WHERE ip_address = ?
                `, [failed_logins, successful_logins, suspicious_activities, threat_score, ip_address]);
            }
        } catch (error) {
            console.error('[DATABASE] Error updating IP reputation:', error.message);
        }
    }

    async checkSecurityEvent(logData) {
        const { event_type, ip_address, service, message, raw_data } = logData;

        // Define security event patterns
        const securityEvents = [
            'auth_failure',
            'suspicious_activity',
            'attack_attempt',
            'brute_force',
            'unauthorized_access'
        ];

        if (securityEvents.includes(event_type)) {
            try {
                let severity = 'medium';
                let threat_type = event_type;

                // Determine severity based on event type and context
                if (event_type === 'attack_attempt' || event_type === 'brute_force') {
                    severity = 'high';
                } else if (event_type === 'suspicious_activity') {
                    severity = 'medium';
                } else if (event_type === 'auth_failure') {
                    severity = 'low';
                }

                await this.pool.execute(`
                    INSERT INTO security_events 
                    (timestamp, service, event_type, severity, ip_address, 
                     username, password, session_id, threat_type, description, raw_data)
                    VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    service,
                    event_type,
                    severity,
                    ip_address,
                    logData.username,
                    logData.password,
                    logData.session_id,
                    threat_type,
                    message,
                    raw_data ? JSON.stringify(raw_data) : null
                ]);
            } catch (error) {
                console.error('[DATABASE] Error creating security event:', error.message);
            }
        }
    }

    async getLogs(filters = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        const {
            service,
            event_type,
            log_level,
            ip_address,
            brand,
            start_date,
            end_date,
            limit = 100,
            offset = 0
        } = filters;

        let whereConditions = [];
        let params = [];

        if (service) {
            whereConditions.push('service = ?');
            params.push(service);
        }

        if (event_type) {
            whereConditions.push('event_type = ?');
            params.push(event_type);
        }

        if (log_level) {
            whereConditions.push('log_level = ?');
            params.push(log_level);
        }

        if (ip_address) {
            whereConditions.push('ip_address = ?');
            params.push(ip_address);
        }

        if (brand) {
            whereConditions.push('brand = ?');
            params.push(brand);
        }

        if (start_date) {
            whereConditions.push('timestamp >= ?');
            params.push(start_date);
        }

        if (end_date) {
            whereConditions.push('timestamp <= ?');
            params.push(end_date);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Build query without LIMIT and OFFSET first
        let query = `
            SELECT * FROM service_logs 
            ${whereClause}
            ORDER BY timestamp DESC
        `;

        try {
            const [rows] = await this.pool.execute(query, params);
            
            // Apply limit and offset in JavaScript
            const limitNum = parseInt(limit) || 100;
            const offsetNum = parseInt(offset) || 0;
            const limitedRows = rows.slice(offsetNum, offsetNum + limitNum);
            
            return limitedRows;
        } catch (error) {
            console.error('[DATABASE] Error getting logs:', error.message);
            throw error;
        }
    }

    async getStatistics(startDate, endDate, service = null) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            // For now, return empty array since statistics table might be empty
            // In a real implementation, this would aggregate data from service_logs
            return [];
        } catch (error) {
            console.error('[DATABASE] Error getting statistics:', error.message);
            throw error;
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.initialized = false;
        }
    }
}

// Create singleton instance
const databaseLogger = new DatabaseLogger();

module.exports = databaseLogger; 