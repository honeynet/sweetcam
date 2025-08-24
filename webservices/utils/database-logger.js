const mysql = require('mysql2/promise');

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
                    if (item.data.event_type === 'http_request') {
                        await this.writeWebLogDirect(connection, item.data);
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
        return result.insertId;
    }

    async logEventDirect(connection, logData) {
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

        const [result] = await connection.execute(query, params);
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