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
        
        // Suspicious patterns for threat detection
        this.suspiciousPatterns = [
            // XSS patterns
            /<script[^>]*>/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /<iframe[^>]*>/i,
            /<object[^>]*>/i,
            /<embed[^>]*>/i,
            
            // SQL Injection patterns
            /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
            /(\b(or|and)\b\s+\d+\s*=\s*\d+)/i,
            /(\b(union|select)\b\s+.*\bfrom\b)/i,
            
            // Command injection patterns
            /(\b(cat|ls|pwd|whoami|id|uname|wget|curl|nc|netcat|bash|sh)\b)/i,
            /(\$\(.*\))/,
            /(\`.*\`)/,
            
            // Path traversal patterns
            /\.\.\//,
            /\.\.\\/,
            /\/etc\/passwd/,
            /\/proc\/version/,
            
            // PHP patterns
            /\.php\?/i,
            /php:\/\/filter/i,
            /php:\/\/input/i,
            
            // Suspicious URLs
            /https?:\/\/[^\s<>"']*\.(com|net|org|ru|cn|tk|ml|ga|gq|cf|cc|xyz)/i,
            
            // Encoded patterns
            /%3cscript/i,
            /%3ciframe/i,
            /&#x3c;script/i,
            /&#60;script/i
        ];
        
        // Threat level scoring
        this.threatScores = {
            low: 1,
            medium: 2,
            high: 3,
            critical: 4
        };
        
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
     * Analyze payload for suspicious patterns and determine threat level
     * @param {string} payload - The payload content
     * @returns {Object} Analysis result with threat level and suspicious flag
     */
    analyzePayload(payload) {
        if (!payload || typeof payload !== 'string') {
            return { threatLevel: 'low', isSuspicious: false, score: 0 };
        }

        let score = 0;
        let isSuspicious = false;
        const matchedPatterns = [];

        // Check against suspicious patterns
        for (const pattern of this.suspiciousPatterns) {
            if (pattern.test(payload)) {
                score += 2;
                isSuspicious = true;
                matchedPatterns.push(pattern.source);
            }
        }

        // Additional scoring based on payload characteristics
        if (payload.length > 1000) score += 1; // Very long payloads
        if (payload.includes('eval(')) score += 3; // Dangerous functions
        if (payload.includes('document.cookie')) score += 2; // Cookie theft
        if (payload.includes('keylog')) score += 2; // Keylogging
        if (payload.includes('attacker.com')) score += 2; // Suspicious domains
        if (payload.includes('<?php')) score += 3; // PHP code
        if (payload.includes('${')) score += 2; // Template injection

        // Determine threat level based on score
        let threatLevel = 'low';
        if (score >= 8) threatLevel = 'critical';
        else if (score >= 6) threatLevel = 'high';
        else if (score >= 4) threatLevel = 'medium';

        return {
            threatLevel,
            isSuspicious,
            score,
            matchedPatterns
        };
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
                // Analyze the payload
                const analysis = this.analyzePayload(payloadContent);
                
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
                    // Insert new payload
                    const [insertResult] = await connection.execute(`
                        INSERT INTO unique_payloads 
                        (payload_hash, service, event_type, payload_type, payload_content, 
                         ip_address, brand, first_seen, last_seen, occurrence_count, 
                         is_suspicious, threat_level, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
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
                        analysis.isSuspicious,
                        analysis.threatLevel,
                        timestamp,
                        timestamp
                    ]);

                    return {
                        action: 'inserted',
                        payloadId: insertResult.insertId,
                        occurrenceCount: 1,
                        isNew: true,
                        threatLevel: analysis.threatLevel,
                        isSuspicious: analysis.isSuspicious
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
                        occurrence_count,
                        is_suspicious,
                        threat_level
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
                        COUNT(CASE WHEN is_suspicious = 1 THEN 1 END) as suspicious_payloads,
                        COUNT(CASE WHEN threat_level = 'critical' THEN 1 END) as critical_payloads,
                        COUNT(CASE WHEN threat_level = 'high' THEN 1 END) as high_payloads,
                        COUNT(CASE WHEN threat_level = 'medium' THEN 1 END) as medium_payloads,
                        COUNT(CASE WHEN threat_level = 'low' THEN 1 END) as low_payloads,
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
                        occurrence_count,
                        is_suspicious,
                        threat_level
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