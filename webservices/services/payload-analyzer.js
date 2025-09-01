const crypto = require('crypto');
const mysql = require('mysql2/promise');

class PayloadAnalyzer {
    constructor() {
        if (PayloadAnalyzer.instance) {
            return PayloadAnalyzer.instance;
        }
        
        this.pool = null;
        this.initialized = false;
        this.initializing = false;
        
        PayloadAnalyzer.instance = this;
    }

    async initialize() {
        if (this.initialized) return;
        if (this.initializing) {
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
                connectionLimit: 10,
                queueLimit: 50,
                multipleStatements: false
            };

            this.pool = mysql.createPool(config);
            
            // Test the connection
            const connection = await this.pool.getConnection();
            connection.release();
            
            this.initialized = true;
            console.log('[PAYLOAD_ANALYZER] Initialized successfully');
        } catch (error) {
            console.error('[PAYLOAD_ANALYZER] Failed to initialize:', error.message);
            throw error;
        } finally {
            this.initializing = false;
        }
    }

    /**
     * Generate a unique hash for a payload
     * @param {string} payload - The payload content
     * @param {string} service - The service name
     * @param {string} payloadType - The type of payload (username, password, etc.)
     * @returns {string} SHA256 hash
     */
    generatePayloadHash(payload, service, payloadType) {
        const combined = `${payload}|${service}|${payloadType}`;
        return crypto.createHash('sha256').update(combined).digest('hex');
    }

    /**
     * Process and store a new payload
     * @param {Object} payloadData - Payload data object
     * @returns {Object} Result of the operation
     */
    async processPayload(payloadData) {
        if (!this.initialized) {
            await this.initialize();
        }

        const {
            service,
            eventType,
            payloadType,
            payloadContent,
            ipAddress,
            brand,
            timestamp = new Date()
        } = payloadData;

        if (!payloadContent || !service || !eventType || !payloadType) {
            throw new Error('Missing required payload data');
        }

        try {
            const connection = await this.pool.getConnection();
            
            try {
                // Generate hash for uniqueness
                const payloadHash = this.generatePayloadHash(payloadContent, service, payloadType);
                
                // Check if payload already exists
                const [existing] = await connection.execute(`
                    SELECT id, occurrence_count, last_seen 
                    FROM unique_payloads 
                    WHERE payload_hash = ? AND service = ?
                `, [payloadHash, service]);

                if (existing.length > 0) {
                    // Update existing payload
                    const [updateResult] = await connection.execute(`
                        UPDATE unique_payloads 
                        SET occurrence_count = occurrence_count + 1,
                            last_seen = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `, [timestamp, existing[0].id]);

                    return {
                        action: 'updated',
                        payloadId: existing[0].id,
                        occurrenceCount: existing[0].occurrence_count + 1,
                        isNew: false
                    };
                } else {
                    // Insert new payload (without threat_level and is_suspicious)
                    const [insertResult] = await connection.execute(`
                        INSERT INTO unique_payloads 
                        (payload_hash, service, event_type, payload_type, payload_content, 
                         ip_address, brand, first_seen, last_seen, occurrence_count, 
                         created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                    `, [
                        payloadHash,
                        service,
                        eventType,
                        payloadType,
                        payloadContent,
                        ipAddress,
                        brand,
                        timestamp,
                        timestamp,
                        timestamp,
                        timestamp
                    ]);

                    return {
                        action: 'inserted',
                        payloadId: insertResult.insertId,
                        occurrenceCount: 1,
                        isNew: true
                    };
                }
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[PAYLOAD_ANALYZER] Error processing payload:', error.message);
            throw error;
        }
    }

    /**
     * Get the last N unique payloads for a specific service
     * @param {string} service - The service name
     * @param {number} limit - Number of payloads to return (default: 10)
     * @returns {Array} Array of unique payloads
     */
    async getLastUniquePayloads(service, limit = 10) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const connection = await this.pool.getConnection();
            
            try {
                const [rows] = await connection.execute(`
                    SELECT 
                        payload_type,
                        payload_content,
                        ip_address,
                        brand,
                        first_seen,
                        last_seen,
                        occurrence_count
                    FROM unique_payloads 
                    WHERE service = ?
                    ORDER BY last_seen DESC
                    LIMIT ?
                `, [service, limit]);

                return rows;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[PAYLOAD_ANALYZER] Error getting unique payloads:', error.message);
            throw error;
        }
    }

    /**
     * Get payload statistics for a service
     * @param {string} service - The service name
     * @returns {Object} Statistics object
     */
    async getPayloadStatistics(service) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const connection = await this.pool.getConnection();
            
            try {
                const [stats] = await connection.execute(`
                    SELECT 
                        COUNT(*) as total_payloads,
                        SUM(occurrence_count) as total_occurrences
                    FROM unique_payloads 
                    WHERE service = ?
                `, [service]);

                return stats[0] || {};
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[PAYLOAD_ANALYZER] Error getting payload statistics:', error.message);
            throw error;
        }
    }

    /**
     * Get trending payloads (most frequently seen)
     * @param {string} service - The service name
     * @param {number} limit - Number of payloads to return (default: 10)
     * @returns {Array} Array of trending payloads
     */
    async getTrendingPayloads(service, limit = 10) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const connection = await this.pool.getConnection();
            
            try {
                const [rows] = await connection.execute(`
                    SELECT 
                        payload_type,
                        payload_content,
                        ip_address,
                        brand,
                        first_seen,
                        last_seen,
                        occurrence_count
                    FROM unique_payloads 
                    WHERE service = ?
                    ORDER BY occurrence_count DESC, last_seen DESC
                    LIMIT ?
                `, [service, limit]);

                return rows;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('[PAYLOAD_ANALYZER] Error getting trending payloads:', error.message);
            throw error;
        }
    }

    /**
     * Close the database connection pool
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
        }
    }
}

const payloadAnalyzer = new PayloadAnalyzer();
module.exports = payloadAnalyzer;
