const mysql = require('mysql2/promise');
const payloadAnalyzer = require('../services/payload-analyzer');

class DatabaseLogger {
    constructor() {
        if (DatabaseLogger.instance) {
            return DatabaseLogger.instance;
        }

        this.pool = null;
        this.initialized = false;
        this.initializing = false;
        this.lastWriteTime = 0;
        this.writeInterval = 50; // Reduced from 100ms to 50ms between writes

        // Smart batching system
        this.logQueue = [];
        this.batchSize = 10;
        this.batchTimeout = 1000; // 1 second
        this.processingBatch = false;
        this.batchTimer = null;

        // Priority system
        this.highPriorityEvents = ['login', 'admin', 'error', 'auth_failure'];

        DatabaseLogger.instance = this;
    }

    // Add log entry to queue and process in batches
    addToQueue(logData, priority = 'normal') {
        const entry = {
            data: logData,
            priority: priority,
            timestamp: Date.now()
        };

        // High priority events go to front of queue
        if (this.highPriorityEvents.some(event =>
            logData.event_type && logData.event_type.includes(event) ||
            logData.message && logData.message.includes(event)
        )) {
            this.logQueue.unshift(entry);
        } else {
            this.logQueue.push(entry);
        }

        // Start batch processing if not already running
        if (!this.processingBatch) {
            this.processBatch();
        }

        // Set timeout to process remaining items
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        this.batchTimer = setTimeout(() => {
            this.processBatch();
        }, this.batchTimeout);
    }

    async processBatch() {
        if (this.processingBatch || this.logQueue.length === 0) {
            return;
        }

        this.processingBatch = true;

        try {
            // Process high priority items first
            const highPriority = this.logQueue.filter(item =>
                this.highPriorityEvents.some(event =>
                    item.data.event_type && item.data.event_type.includes(event) ||
                    item.data.message && item.data.message.includes(event)
                )
            );

            const normalPriority = this.logQueue.filter(item =>
                !this.highPriorityEvents.some(event =>
                    item.data.event_type && item.data.event_type.includes(event) ||
                    item.data.message && item.data.message.includes(event)
                )
            );

            // Combine high priority first, then normal priority
            const itemsToProcess = [...highPriority, ...normalPriority].slice(0, this.batchSize);

            if (itemsToProcess.length === 0) {
                this.processingBatch = false;
                return;
            }

            // Remove processed items from queue
            itemsToProcess.forEach(item => {
                const index = this.logQueue.indexOf(item);
                if (index > -1) {
                    this.logQueue.splice(index, 1);
                }
            });

            // Process batch
            await this.processBatchItems(itemsToProcess);

        } catch (error) {
            console.error('[DATABASE] Error processing batch:', error.message);
        } finally {
            this.processingBatch = false;

            // Continue processing if there are more items
            if (this.logQueue.length > 0) {
                setTimeout(() => this.processBatch(), 100);
            }
        }
    }

    async processBatchItems(items) {
        let connection = null;
        try {
            connection = await this.pool.getConnection();

            for (const item of items) {
                try {
                    // Check if this is a web service log that should go to web_service_logs table
                    if (item.data.event_type === 'http_request' ||
                        item.data.event_type === 'http_request_response' ||
                        item.data.event_type === 'auth_failure' ||
                        item.data.event_type === 'login_attempt' ||
                        item.data.event_type === 'login_success' ||
                        item.data.isWebLog === true) {
                        await this.writeWebLogDirect(connection, item.data);
                    } else if (item.data.service === 'cowrie' ||
                               item.data.isCowrieLog === true) {
                        await this.writeCowrieLogDirect(connection, item.data);
                    } else if (item.data.service === 'onvif' ||
                               item.data.isONVIFLog === true) {
                        await this.writeONVIFLogDirect(connection, item.data);
                    } else if (item.data.service === 'rtsp' ||
                               item.data.isRTSPLog === true) {
                        await this.writeRTSPLogDirect(connection, item.data);
                    } else {
                        await this.logEventDirect(connection, item.data);
                    }
                } catch (error) {
                    console.error('[DATABASE] Error processing log item:', error.message);
                }
            }
        } catch (error) {
            console.error('[DATABASE] Error getting connection for batch:', error.message);
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    // Direct logging methods for batch processing
    async writeWebLogDirect(connection, logData) {
            const logEntry = {
                timestamp: logData.timestamp || new Date(),
                event_type: logData.event_type || 'unknown',
                log_level: logData.log_level || 'info',
                ip_address: logData.ip_address || null,
                brand: logData.brand || null,
                port: logData.port || null,
                username: logData.username || null,
                password: logData.password || null,
                session_id: logData.session_id || null,
                user_agent: logData.user_agent || null,
                request_path: logData.request_path || null,
                request_method: logData.request_method || null,
                response_code: logData.response_code || null,
                message: logData.message || null,
                payload: logData.payload ? JSON.stringify(logData.payload) : null,
                raw_data: logData.raw_data ? JSON.stringify(logData.raw_data) : null
            };

            const query = `
                INSERT INTO web_service_logs
                (timestamp, event_type, log_level, ip_address, brand, port, username,
                 password, session_id, user_agent, request_path, request_method,
                 response_code, message, payload, raw_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const params = [
                logEntry.timestamp,
                logEntry.event_type,
                logEntry.log_level,
                logEntry.ip_address,
                logEntry.brand,
                logEntry.port,
                logEntry.username,
                logEntry.password,
                logEntry.session_id,
                logEntry.user_agent,
                logEntry.request_path,
                logEntry.request_method,
                logEntry.response_code,
                logEntry.message,
                logEntry.payload,
                logEntry.raw_data
            ];

        const [result] = await connection.execute(query, params);

        // Analyze and track unique payloads
        try {
            if (logData.username && logData.username.trim()) {
                await payloadAnalyzer.processPayload({
                    service: 'web',
                    eventType: logData.event_type || 'unknown',
                    payloadType: 'username',
                    payloadContent: logData.username.trim(),
                    ipAddress: logData.ip_address,
                    brand: logData.brand,
                    timestamp: logData.timestamp || new Date()
                });
            }

            if (logData.password && logData.password.trim()) {
                await payloadAnalyzer.processPayload({
                    service: 'web',
                    eventType: logData.event_type || 'unknown',
                    payloadType: 'password',
                    payloadContent: logData.password.trim(),
                    ipAddress: logData.ip_address,
                    brand: logData.brand,
                    timestamp: logData.timestamp || new Date()
                });
            }

            if (logData.payload && typeof logData.payload === 'object') {
                // Extract content-type and other payload fields
                for (const [key, value] of Object.entries(logData.payload)) {
                    if (value && typeof value === 'string' && value.trim()) {
                        await payloadAnalyzer.processPayload({
                            service: 'web',
                            eventType: logData.event_type || 'unknown',
                            payloadType: key,
                            payloadContent: value.trim(),
                            ipAddress: logData.ip_address,
                            brand: logData.brand,
                            timestamp: logData.timestamp || new Date()
                        });
                    }
                }
            }
        } catch (error) {
            console.error('[DATABASE] Error analyzing payloads:', error.message);
        }

        return result.insertId;
    }

    async writeCowrieLogDirect(connection, logData) {
        const logEntry = {
            timestamp: logData.timestamp || new Date(),
            event_type: logData.event_type || 'unknown',
            log_level: logData.log_level || 'info',
            ip_address: logData.ip_address || null,
            brand: logData.brand || null,
            port: logData.port || null,
            username: logData.username || null,
            password: logData.password || null,
            session_id: logData.session_id || null,
            command: logData.command || null,
            file_path: logData.file_path || null,
            file_size: logData.file_size || null,
            geoip_country: logData.geoip_country || null,
            geoip_city: logData.geoip_city || null,
            alert_type: logData.alert_type || null,
            message: logData.message || null,
            raw_data: logData.raw_data ? JSON.stringify(logData.raw_data) : null
        };

        const query = `
            INSERT INTO cowrie_service_logs
            (timestamp, event_type, log_level, ip_address, brand, port, username,
             password, session_id, command, file_path, file_size, geoip_country,
             geoip_city, alert_type, message, raw_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            logEntry.timestamp,
            logEntry.event_type,
            logEntry.log_level,
            logEntry.ip_address,
            logEntry.brand,
            logEntry.port,
            logEntry.username,
            logEntry.password,
            logEntry.session_id,
            logEntry.command,
            logEntry.file_path,
            logEntry.file_size,
            logEntry.geoip_country,
            logEntry.geoip_city,

            logEntry.alert_type,
            logEntry.message,
            logEntry.raw_data
        ];

        const [result] = await connection.execute(query, params);

        // Analyze and track unique payloads for Cowrie
        try {
            if (logData.username && logData.username.trim()) {
                await payloadAnalyzer.processPayload({
                    service: 'cowrie',
                    eventType: logData.event_type || 'unknown',
                    payloadType: 'username',
                    payloadContent: logData.username.trim(),
                    ipAddress: logData.ip_address,
                    brand: logData.brand,
                    timestamp: logData.timestamp || new Date()
                });
            }

            if (logData.password && logData.password.trim()) {
                await payloadAnalyzer.processPayload({
                    service: 'cowrie',
                    eventType: logData.event_type || 'unknown',
                    payloadType: 'password',
                    payloadContent: logData.password.trim(),
                    ipAddress: logData.ip_address,
                    brand: logData.brand,
                    timestamp: logData.timestamp || new Date()
                });
            }

            if (logData.command && logData.command.trim()) {
                await payloadAnalyzer.processPayload({
                    service: 'cowrie',
                    eventType: logData.event_type || 'unknown',
                    payloadType: 'command',
                    payloadContent: logData.command.trim(),
                    ipAddress: logData.ip_address,
                    brand: logData.brand,
                    timestamp: logData.timestamp || new Date()
                });
            }
        } catch (error) {
            console.error('[DATABASE] Error analyzing Cowrie payloads:', error.message);
        }

        return result.insertId;
    }

    async logEventDirect(connection, logData) {
        const logEntry = {
            timestamp: logData.timestamp || new Date(),
            ip_address: logData.ip_address || null,
            service: logData.service || 'unknown',
            port: logData.port || null,
            time_end: logData.time_end || null,
            brand: logData.brand || null
        };

        const query = `
            INSERT INTO service_logs
            (timestamp, ip_address, service, port, time_end, brand)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const params = [
            logEntry.timestamp,
            logEntry.ip_address,
            logEntry.service,
            logEntry.port,
            logEntry.time_end,
            logEntry.brand
        ];

        const [result] = await connection.execute(query, params);
        return result.insertId;
    }

    async writeONVIFLogDirect(connection, logData) {
        const logEntry = {
            timestamp: logData.timestamp || new Date(),
            event_type: logData.event_type || 'unknown',
            log_level: logData.log_level || 'info',
            ip_address: logData.ip_address || null,
            brand: logData.brand || null,
            port: logData.port || null,
            username: logData.username || null,
            password: logData.password || null,
            session_id: logData.session_id || null,
            user_agent: logData.user_agent || null,
            request_method: logData.request_method || null,
            request_url: logData.request_url || null,
            response_status: logData.response_status || null,
            message: logData.message || null,
            payload: logData.payload ? JSON.stringify(logData.payload) : null,
            raw_data: logData.raw_data ? JSON.stringify(logData.raw_data) : null
        };

        const query = `
            INSERT INTO onvif_service_logs
            (timestamp, event_type, log_level, ip_address, brand, port, username,
             password, session_id, user_agent, request_method, request_url,
             response_status, message, payload, raw_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            logEntry.timestamp,
            logEntry.event_type,
            logEntry.log_level,
            logEntry.ip_address,
            logEntry.brand,
            logEntry.port,
            logEntry.username,
            logEntry.password,
            logEntry.session_id,
            logEntry.user_agent,
            logEntry.request_method,
            logEntry.request_url,
            logEntry.response_status,
            logEntry.message,
            logEntry.payload,
            logEntry.raw_data
        ];

        const [result] = await connection.execute(query, params);

        // Analyze and track unique payloads for ONVIF
        try {
            if (logData.username && logData.username.trim()) {
                await payloadAnalyzer.processPayload({
                    service: 'onvif',
                    eventType: logData.event_type || 'unknown',
                    payloadType: 'username',
                    payloadContent: logData.username.trim(),
                    ipAddress: logData.ip_address,
                    brand: logData.brand,
                    timestamp: logData.timestamp || new Date()
                });
            }

            if (logData.password && logData.password.trim()) {
                await payloadAnalyzer.processPayload({
                    service: 'onvif',
                    eventType: logData.event_type || 'unknown',
                    payloadType: 'password',
                    payloadContent: logData.password.trim(),
                    ipAddress: logData.ip_address,
                    brand: logData.brand,
                    timestamp: logData.timestamp || new Date()
                });
            }

            if (logData.payload && typeof logData.payload === 'object') {
                // Extract SOAP actions and other payload fields
                for (const [key, value] of Object.entries(logData.payload)) {
                    if (value && typeof value === 'string' && value.trim()) {
                        await payloadAnalyzer.processPayload({
                            service: 'onvif',
                            eventType: logData.event_type || 'unknown',
                            payloadType: key,
                            payloadContent: value.trim(),
                            ipAddress: logData.ip_address,
                            brand: logData.brand,
                            timestamp: logData.timestamp || new Date()
                        });
                    }
                }
            }
        } catch (error) {
            console.error('[DATABASE] Error analyzing ONVIF payloads:', error.message);
        }

        return result.insertId;
    }

    async writeRTSPLogDirect(connection, logData) {
        const logEntry = {
            timestamp: logData.timestamp || new Date(),
            event_type: logData.event_type || 'unknown',
            log_level: logData.log_level || 'info',
            ip_address: logData.ip_address || null,
            brand: logData.brand || null,
            port: logData.port || null,
            username: logData.username || null,
                password: logData.password || null,
                session_id: logData.session_id || null,
                rtsp_method: logData.rtsp_method || null,
                stream_path: logData.stream_path || null,
                connection_id: logData.connection_id || null,
            message: logData.message || null,
            payload: logData.payload ? JSON.stringify(logData.payload) : null,
            raw_data: logData.raw_data ? JSON.stringify(logData.raw_data) : null
        };

        const query = `
            INSERT INTO rtsp_service_logs
            (timestamp, event_type, log_level, ip_address, brand, port, username,
             password, session_id, rtsp_method, stream_path,
             connection_id, message, payload, raw_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            logEntry.timestamp,
            logEntry.event_type,
            logEntry.log_level,
            logEntry.ip_address,
            logEntry.brand,
            logEntry.port,
                logEntry.username,
                logEntry.password,
                logEntry.session_id,
                logEntry.rtsp_method,
                logEntry.stream_path,
                logEntry.connection_id,
            logEntry.message,
            logEntry.payload,
            logEntry.raw_data
        ];

        const [result] = await connection.execute(query, params);

        // Analyze and track unique payloads for RTSP
        try {
            if (logData.username && logData.username.trim()) {
                await payloadAnalyzer.processPayload({
                    service: 'rtsp',
                    eventType: logData.event_type || 'unknown',
                    payloadType: 'username',
                    payloadContent: logData.username.trim(),
                    ipAddress: logData.ip_address,
                    brand: logData.brand,
                    timestamp: logData.timestamp || new Date()
                });
            }

            if (logData.password && logData.password.trim()) {
                await payloadAnalyzer.processPayload({
                    service: 'rtsp',
                    eventType: logData.event_type || 'unknown',
                    payloadType: 'password',
                    payloadContent: logData.password.trim(),
                    ipAddress: logData.ip_address,
                    brand: logData.brand,
                    timestamp: logData.timestamp || new Date()
                });
            }

            if (logData.payload && typeof logData.payload === 'object') {
                // Extract RTSP method and other payload fields
                for (const [key, value] of Object.entries(logData.payload)) {
                    if (value && typeof value === 'string' && value.trim()) {
                        await payloadAnalyzer.processPayload({
                            service: 'rtsp',
                            eventType: logData.event_type || 'unknown',
                            payloadType: key,
                            payloadContent: value.trim(),
                            ipAddress: logData.ip_address,
                            brand: logData.brand,
                            timestamp: logData.timestamp || new Date()
                        });
                    }
                }
            }
        } catch (error) {
            console.error('[DATABASE] Error analyzing RTSP payloads:', error.message);
        }

        return result.insertId;
    }

    async initialize() {
        if (this.initialized) return;
        if (this.initializing) {
            // Wait for initialization to complete
            while (this.initializing) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            return;
        }

        this.initializing = true;

        try {
            const config = {
                host: process.env.DB_HOST || 'mysql_service',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || 'rootpassword',
                database: process.env.DB_NAME || 'sweetcam',
                port: parseInt(process.env.DB_PORT) || 3306,
                waitForConnections: true,
                connectionLimit: 15,        // Increased from 10 to 15 for batch processing
                queueLimit: 100,           // Increased from 50 to 100
                multipleStatements: false  // Disable multiple statements for security
            };

            this.pool = mysql.createPool(config);

            // Test the connection
            const connection = await this.pool.getConnection();
            connection.release(); // Release the test connection immediately

            // Set up pool event listeners for monitoring
            this.pool.on('connection', (connection) => {
                // Only log when debugging is enabled
                if (process.env.DEBUG_DB_CONNECTIONS === 'true') {
                    console.log('[DATABASE] New connection created');
                }
            });

            this.pool.on('acquire', (connection) => {
                // Only log when debugging is enabled
                if (process.env.DEBUG_DB_CONNECTIONS === 'true') {
                    console.log('[DATABASE] Connection acquired');
                }
            });

            this.pool.on('release', (connection) => {
                // Only log when debugging is enabled
                if (process.env.DEBUG_DB_CONNECTIONS === 'true') {
                    console.log('[DATABASE] Connection released');
                }
            });

            this.pool.on('enqueue', () => {
                console.log('[DATABASE] Waiting for available connection slot');
            });

            await this.ensurePayloadFieldExists();

            this.initialized = true;
            console.log('[DATABASE] Database logger initialized successfully');
        } catch (error) {
            console.error('[DATABASE] Failed to initialize database logger:', error.message);
            throw error;
        } finally {
            this.initializing = false;
        }
    }

    async ensurePayloadFieldExists() {
        let connection = null;
        try {
            connection = await this.pool.getConnection();

            //check if payload field exists in service_logs table
            const [columns] = await connection.execute(`
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = ?
                AND TABLE_NAME = 'service_logs'
                AND COLUMN_NAME = 'payload'
            `, [process.env.DB_NAME || 'sweetcam']);

            if (columns.length === 0) {
                console.log('[DATABASE] Adding payload field to service_logs table...');
                await connection.execute(`
                    ALTER TABLE service_logs
                    ADD COLUMN payload JSON DEFAULT NULL
                    COMMENT 'HTTP request and response payloads'
                `);
                console.log('[DATABASE] Payload field added successfully');
            }

            //check if payload field exists in web_service_logs table
            const [webColumns] = await connection.execute(`
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = ?
                AND TABLE_NAME = 'web_service_logs'
                AND COLUMN_NAME = 'payload'
            `, [process.env.DB_NAME || 'sweetcam']);

            if (webColumns.length === 0) {
                console.log('[DATABASE] Adding payload field to web_service_logs table...');
                await connection.execute(`
                    ALTER TABLE web_service_logs
                    ADD COLUMN payload JSON DEFAULT NULL
                    COMMENT 'HTTP request and response payloads'
                `);
                console.log('[DATABASE] Payload field added to web_service_logs successfully');
            }
        } catch (error) {
            console.error('[DATABASE] Error ensuring payload field exists:', error.message);
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async logEvent(logData) {
        if (!this.initialized) {
            await this.initialize();
        }

        // Use queue system instead of direct writes
        this.addToQueue(logData, 'normal');
        return 'queued';
    }

    async writeWebLog(logData) {
        if (!this.initialized) {
            console.log('[DATABASE] Initializing database logger...');
            await this.initialize();
        }

        // Add flag to indicate this is a web service log
        logData.isWebLog = true;

        // Use queue system instead of direct writes
        this.addToQueue(logData, 'normal');
        return 'queued';
    }

    async writeCowrieLog(logData) {
        if (!this.initialized) {
            console.log('[DATABASE] Initializing database logger...');
            await this.initialize();
        }

        // Add flag to indicate this is a cowrie service log
        logData.isCowrieLog = true;

        // Use queue system instead of direct writes
        this.addToQueue(logData, 'normal');
        return 'queued';
    }

    async writeONVIFLog(logData) {
        if (!this.initialized) {
            console.log('[DATABASE] Initializing database logger...');
            await this.initialize();
        }

        // Add flag to indicate this is an ONVIF service log
        logData.isONVIFLog = true;

        // Use queue system instead of direct writes
        this.addToQueue(logData, 'normal');
        return 'queued';
    }

    async writeRTSPLog(logData) {
        if (!this.initialized) {
            console.log('[DATABASE] Initializing database logger...');
            await this.initialize();
        }

        // Add flag to indicate this is an RTSP service log
        logData.isRTSPLog = true;

        // Use queue system instead of direct writes
        this.addToQueue(logData, 'normal');
        return 'queued';
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
        }
    }

    getPoolStatus() {
        if (!this.pool) {
            return { status: 'not_initialized' };
        }

        return {
            status: 'active',
            totalConnections: this.pool.pool.config.connectionLimit,
            idleConnections: this.pool.pool._freeConnections.length,
            activeConnections: this.pool.pool._allConnections.length - this.pool.pool._freeConnections.length,
            waitingConnections: this.pool.pool._connectionQueue.length
        };
    }

    async healthCheck() {
        try {
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();
            return { status: 'healthy', message: 'Database connection is working' };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: 'Database connection failed',
                error: error.message
            };
        }
    }
}

const databaseLogger = new DatabaseLogger();
module.exports = databaseLogger;
