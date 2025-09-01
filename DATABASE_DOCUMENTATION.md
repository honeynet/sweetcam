# SweetCam Honeypot Database Documentation

## Overview
The SweetCam honeypot system uses a MySQL 8.0 database (`sweetcam`) to store logging data from multiple honeypot services. The database is designed with both generic and specialized logging tables to provide flexibility and performance. **The system now includes advanced unique payloads analysis capabilities to detect and track custom attack patterns across all services.**

## Database Schema

### Core Tables

#### 1. `service_logs` - Universal Service Logging
**Purpose**: Generic logging table for all services with basic event information.

**Structure**:
```sql
CREATE TABLE `service_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IPv4 or IPv6 address',
  `service` varchar(50) NOT NULL COMMENT 'web, rtsp, onvif, cowrie',
  `port` int DEFAULT NULL,
  `time_end` TIMESTAMP NULL DEFAULT NULL,
  `brand` varchar(50) DEFAULT NULL COMMENT 'camera brand',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_service` (`service`),
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_ip_address` (`ip_address`),
  INDEX `idx_brand` (`brand`),
  INDEX `idx_port` (`port`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Use Cases**:
- Cross-service correlation and analysis
- Generic event storage for any service type
- Historical data analysis across all honeypot components

**Example Queries**:
```sql
-- All events from a specific IP
SELECT * FROM service_logs WHERE ip_address = '192.168.1.100';

-- Events by service type
SELECT service, COUNT(*) FROM service_logs 
GROUP BY service;

-- Recent activity by brand
SELECT brand, COUNT(*) FROM service_logs 
WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY brand;
```

#### 2. `web_service_logs` - Web Service Specialized Logging
**Purpose**: Dedicated table for web-based honeypot services with structured fields.

**Structure**:
```sql
CREATE TABLE `web_service_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `event_type` varchar(100) NOT NULL COMMENT 'login_attempt, auth_failure, rtsp_management, rtsp_service_toggle, service_event',
  `log_level` varchar(20) NOT NULL DEFAULT 'info',
  `ip_address` varchar(45) DEFAULT NULL,
  `brand` varchar(50) DEFAULT NULL COMMENT 'Camera brand',
  `port` int DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `request_path` varchar(500) DEFAULT NULL,
  `request_method` varchar(10) DEFAULT NULL,
  `response_code` int DEFAULT NULL,
  `message` text DEFAULT NULL,
  `payload` json DEFAULT NULL COMMENT 'HTTP request and response payloads',
  `raw_data` json DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_event_type` (`event_type`),
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_ip_address` (`ip_address`),
  INDEX `idx_brand` (`brand`),
  INDEX `idx_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Use Cases**:
- Web-based attack analysis
- HTTP request/response logging
- Authentication attempt tracking
- Brand-specific attack patterns

**Example Queries**:
```sql
-- Failed login attempts by brand
SELECT brand, COUNT(*) FROM web_service_logs 
WHERE event_type = 'auth_failure' 
GROUP BY brand;

-- HTTP requests to login endpoints
SELECT * FROM web_service_logs 
WHERE request_path LIKE '%/login%' 
ORDER BY timestamp DESC;

-- Attack patterns by IP
SELECT ip_address, COUNT(*) as attempts 
FROM web_service_logs 
WHERE event_type = 'http_request' 
GROUP BY ip_address 
HAVING attempts > 10;
```

#### 3. `rtsp_service_logs` - RTSP Protocol Logging
**Purpose**: Specialized table for RTSP streaming protocol attacks.

**Structure**:
```sql
CREATE TABLE `rtsp_service_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `event_type` varchar(100) NOT NULL COMMENT 'rtsp_method, connection_event, service_event, auth_attempt',
  `log_level` varchar(20) NOT NULL DEFAULT 'info',
  `ip_address` varchar(45) DEFAULT NULL,
  `brand` varchar(50) DEFAULT NULL,
  `port` int DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `rtsp_method` varchar(20) DEFAULT NULL COMMENT 'DESCRIBE, SETUP, PLAY, etc.',
  `stream_path` varchar(500) DEFAULT NULL,
  `connection_id` varchar(255) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `payload` json DEFAULT NULL COMMENT 'RTSP stream and connection payloads',
  `raw_data` json DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_event_type` (`event_type`),
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_ip_address` (`ip_address`),
  INDEX `idx_brand` (`brand`),
  INDEX `idx_rtsp_method` (`rtsp_method`),
  INDEX `idx_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Use Cases**:
- RTSP protocol attack analysis
- Streaming attempt monitoring
- Media access tracking

**Example Queries**:
```sql
-- RTSP methods by frequency
SELECT rtsp_method, COUNT(*) as frequency 
FROM rtsp_service_logs 
WHERE rtsp_method IS NOT NULL 
GROUP BY rtsp_method 
ORDER BY frequency DESC;

-- Connection attempts by brand
SELECT brand, COUNT(*) FROM rtsp_service_logs 
WHERE event_type = 'connection_event' 
GROUP BY brand;
```

#### 4. `onvif_service_logs` - ONVIF Protocol Logging
**Purpose**: Specialized table for ONVIF camera protocol attacks.

**Structure**:
```sql
CREATE TABLE `onvif_service_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `event_type` varchar(100) NOT NULL COMMENT 'soap_request, connection_event, ws_discovery, device_info_request, service_event',
  `log_level` varchar(20) NOT NULL DEFAULT 'info',
  `ip_address` varchar(45) DEFAULT NULL,
  `brand` varchar(50) DEFAULT NULL,
  `port` int DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `soap_action` varchar(500) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `request_method` varchar(10) DEFAULT NULL,
  `request_url` varchar(500) DEFAULT NULL,
  `response_status` int DEFAULT NULL,
  `device_info` json DEFAULT NULL,
  `discovery_type` varchar(50) DEFAULT NULL COMMENT 'WS-Discovery, Probe, Resolve',
  `message` text DEFAULT NULL,
  `payload` json DEFAULT NULL COMMENT 'HTTP request and response payloads',
  `raw_data` json DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_event_type` (`event_type`),
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_ip_address` (`ip_address`),
  INDEX `idx_brand` (`brand`),
  INDEX `idx_soap_action` (`soap_action`),
  INDEX `idx_user_agent` (`user_agent`(100)),
  INDEX `idx_request_method` (`request_method`),
  INDEX `idx_request_url` (`request_url`(100)),
  INDEX `idx_response_status` (`response_status`),
  INDEX `idx_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Use Cases**:
- ONVIF protocol attack analysis
- Camera discovery attempts
- Device enumeration tracking

**Example Queries**:
```sql
-- SOAP actions by frequency
SELECT soap_action, COUNT(*) as frequency 
FROM onvif_service_logs 
WHERE soap_action IS NOT NULL 
GROUP BY soap_action 
ORDER BY frequency DESC;

-- Discovery attempts by type
SELECT discovery_type, COUNT(*) FROM onvif_service_logs 
WHERE event_type = 'ws_discovery' 
GROUP BY discovery_type;
```

#### 5. `cowrie_service_logs` - SSH/Telnet Honeypot Logging
**Purpose**: Specialized table for Cowrie SSH honeypot with structured fields for command analysis.

**Structure**:
```sql
CREATE TABLE `cowrie_service_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `event_type` varchar(100) NOT NULL COMMENT 'session_start, session_end, login_attempt, command_execution, file_operation, download_attempt, upload_attempt, geoip_lookup, service_event, startup_shutdown',
  `log_level` varchar(20) NOT NULL DEFAULT 'info',
  `ip_address` varchar(45) DEFAULT NULL,
  `brand` varchar(50) DEFAULT NULL,
  `port` int DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `command` text DEFAULT NULL COMMENT 'Executed command',
  `file_path` varchar(500) DEFAULT NULL COMMENT 'File path for uploads/downloads',
  `file_size` bigint DEFAULT NULL COMMENT 'File size in bytes',
  `geoip_country` varchar(10) DEFAULT NULL COMMENT 'Geographic country',
  `geoip_city` varchar(100) DEFAULT NULL COMMENT 'Geographic city',
  `message` text DEFAULT NULL COMMENT 'Human-readable description',
  `raw_data` json DEFAULT NULL COMMENT 'Full event JSON',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_event_type` (`event_type`),
  INDEX `idx_timestamp` (`timestamp`),
  INDEX `idx_ip_address` (`ip_address`),
  INDEX `idx_brand` (`brand`),
  INDEX `idx_session_id` (`session_id`),
  INDEX `idx_geoip_country` (`geoip_country`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Use Cases**:
- SSH attack analysis
- Command execution tracking
- File operation monitoring
- Geographic threat analysis

**Example Queries**:
```sql
-- Most common commands executed
SELECT command, COUNT(*) as frequency 
FROM cowrie_service_logs 
WHERE command IS NOT NULL 
GROUP BY command 
ORDER BY frequency DESC LIMIT 10;

-- File uploads by size
SELECT file_path, file_size, ip_address 
FROM cowrie_service_logs 
WHERE event_type = 'upload_attempt' 
ORDER BY file_size DESC;

-- Geographic distribution of attacks
SELECT geoip_country, COUNT(*) as attacks 
FROM cowrie_service_logs 
GROUP BY geoip_country 
ORDER BY attacks DESC;
```

### User Management Tables

#### 6. `users` - Regular User Accounts
**Purpose**: Store legitimate user accounts for the honeypot system.

**Structure**:
```sql
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
```

#### 7. `admins` - Administrator Accounts
**Purpose**: Store administrator accounts with additional features.

**Structure**:
```sql
CREATE TABLE `admins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `chatId` varchar(255) DEFAULT NULL COMMENT 'Telegram chat ID for notifications',
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
```

### Security and Analytics Tables

#### 8. `ip_reputation` - IP Address Threat Scoring
**Purpose**: Track and score IP addresses based on their behavior.

**Structure**:
```sql
CREATE TABLE `ip_reputation` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ip_address` varchar(45) NOT NULL,
  `first_seen` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_events` int NOT NULL DEFAULT 0,
  `failed_logins` int NOT NULL DEFAULT 0,
  `successful_logins` int NOT NULL DEFAULT 0,
  `threat_score` int NOT NULL DEFAULT 0 COMMENT '0-100 threat score',
  `country` varchar(10) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `is_blocked` boolean NOT NULL DEFAULT FALSE,
  `block_reason` text DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ip_address` (`ip_address`),
  INDEX `idx_threat_score` (`threat_score`),
  INDEX `idx_is_blocked` (`is_blocked`),
  INDEX `idx_country` (`country`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Use Cases**:
- IP threat scoring and blocking
- Geographic attack analysis
- Behavioral pattern recognition

**Example Queries**:
```sql
-- High-threat IPs
SELECT ip_address, threat_score, country 
FROM ip_reputation 
WHERE threat_score > 80 
ORDER BY threat_score DESC;

-- Recently blocked IPs
SELECT ip_address, block_reason, updated_at 
FROM ip_reputation 
WHERE is_blocked = 1 
ORDER BY updated_at DESC;
```

#### 9. `session_tracking` - Session Lifecycle Management
**Purpose**: Track active and completed sessions across all services.

**Structure**:
```sql
CREATE TABLE `session_tracking` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(255) NOT NULL,
  `service` varchar(50) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `brand` varchar(50) DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `start_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` TIMESTAMP NULL DEFAULT NULL,
  `duration_seconds` int DEFAULT NULL,
  `event_count` int NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT 'active, completed, terminated',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_id` (`session_id`),
  INDEX `idx_service` (`service`),
  INDEX `idx_ip_address` (`ip_address`),
  INDEX `idx_status` (`status`),
  INDEX `idx_start_time` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Use Cases**:
- Session lifecycle monitoring
- Attack duration analysis
- User behavior tracking

#### 10. `log_statistics` - Aggregated Log Analytics
**Purpose**: Store pre-calculated statistics for dashboard and reporting.

**Structure**:
```sql
CREATE TABLE `log_statistics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `date` DATE NOT NULL,
  `service` varchar(50) NOT NULL,
  `event_type` varchar(100) NOT NULL,
  `count` int NOT NULL DEFAULT 0,
  `unique_ips` int NOT NULL DEFAULT 0,
  `unique_brands` int NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date_service_event` (`date`, `service`, `event_type`),
  INDEX `idx_date` (`date`),
  INDEX `idx_service` (`service`),
  INDEX `idx_event_type` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Use Cases**:
- Dashboard metrics
- Trend analysis
- Performance optimization

### Views

#### 11. `all_logs` - Unified Log View
**Purpose**: Provide a unified view of all log data across services.

**Structure**:
```sql
CREATE OR REPLACE VIEW all_logs AS
SELECT timestamp, 'web' AS service, event_type, ip_address, brand, port, NULL AS time_end, created_at, message
FROM web_service_logs
UNION ALL
SELECT timestamp, 'rtsp' AS service, event_type, ip_address, brand, port, NULL AS time_end, created_at, message
FROM rtsp_service_logs
UNION ALL
SELECT timestamp, 'onvif' AS service, event_type, ip_address, brand, port, NULL AS time_end, created_at, message
FROM onvif_service_logs
UNION ALL
SELECT timestamp, 'cowrie' AS service, event_type, ip_address, brand, port, NULL AS time_end, created_at, message
FROM cowrie_service_logs;
```

**Use Cases**:
- Cross-service log analysis
- Unified reporting
- Data export

## New: Unique Payloads Table

### 12. `unique_payloads` - Unique Payload Tracking
**Purpose**: Track and analyze unique payloads across all services to detect custom attacks and automated tools.

**Structure**:
```sql
CREATE TABLE `unique_payloads` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `payload_hash` varchar(64) NOT NULL COMMENT 'SHA256 hash of the payload for uniqueness detection',
  `service` varchar(50) NOT NULL COMMENT 'web, rtsp, onvif, cowrie',
  `event_type` varchar(100) NOT NULL COMMENT 'Type of event where payload was found',
  `payload_type` varchar(50) NOT NULL COMMENT 'username, password, command, content-type, etc.',
  `payload_content` text NOT NULL COMMENT 'The actual payload content',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP address where payload was first seen',
  `brand` varchar(50) DEFAULT NULL COMMENT 'Camera brand if applicable',
  `first_seen` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When this payload was first encountered',
  `last_seen` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last time this payload was seen',
  `occurrence_count` int NOT NULL DEFAULT 1 COMMENT 'How many times this payload has been seen',
  `is_suspicious` boolean NOT NULL DEFAULT FALSE COMMENT 'Flag for suspicious payloads',
  `threat_level` varchar(20) DEFAULT 'low' COMMENT 'low, medium, high, critical',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payload_hash_service` (`payload_hash`, `service`),
  INDEX `idx_payload_hash` (`payload_hash`),
  INDEX `idx_service` (`service`),
  INDEX `idx_event_type` (`event_type`),
  INDEX `idx_payload_type` (`payload_type`),
  INDEX `idx_first_seen` (`first_seen`),
  INDEX `idx_last_seen` (`last_seen`),
  INDEX `idx_is_suspicious` (`is_suspicious`),
  INDEX `idx_threat_level` (`threat_level`),
  INDEX `idx_occurrence_count` (`occurrence_count`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Use Cases**:
- **Custom Attack Detection**: Identify payloads that appear only once
- **Automated Tool Recognition**: Track frequently seen payloads (scanner signatures)
- **Threat Intelligence**: Automatic scoring and pattern detection
- **Attack Evolution Tracking**: Monitor how attack patterns change over time

**Key Features**:
- **Automatic Threat Detection**: Uses regex patterns to identify XSS, SQL injection, command injection, etc.
- **Uniqueness Algorithm**: SHA256 hash of `payload + service + type` ensures true uniqueness
- **Threat Scoring**: Automatic classification as low/medium/high/critical
- **Suspicious Flagging**: Automatic detection of potentially malicious patterns

**Example Queries**:
```sql
-- Get last 10 unique payloads for web services
SELECT payload_type, payload_content, threat_level, occurrence_count
FROM unique_payloads 
WHERE service = 'web' 
ORDER BY last_seen DESC 
LIMIT 10;

-- Find suspicious payloads with high threat levels
SELECT * FROM unique_payloads 
WHERE is_suspicious = 1 AND threat_level IN ('high', 'critical')
ORDER BY first_seen DESC;

-- Get trending payloads (most frequently seen)
SELECT payload_content, occurrence_count, threat_level
FROM unique_payloads 
WHERE service = 'web'
ORDER BY occurrence_count DESC, last_seen DESC
LIMIT 10;

-- Analyze payloads by type and threat level
SELECT payload_type, threat_level, COUNT(*) as count
FROM unique_payloads 
WHERE service = 'web'
GROUP BY payload_type, threat_level
ORDER BY count DESC;
```

**Threat Detection Patterns**:
```sql
-- XSS Detection
SELECT * FROM unique_payloads 
WHERE payload_content LIKE '%<script%' 
   OR payload_content LIKE '%javascript:%'
   OR payload_content LIKE '%onclick%';

-- SQL Injection Detection  
SELECT * FROM unique_payloads 
WHERE payload_content REGEXP '\\b(union|select|insert|update|delete)\\b'
   OR payload_content LIKE '%or 1=1%'
   OR payload_content LIKE '%union select%';

-- Command Injection Detection
SELECT * FROM unique_payloads 
WHERE payload_content REGEXP '\\b(cat|ls|pwd|whoami|wget|curl)\\b'
   OR payload_content LIKE '%$(%'
   OR payload_content LIKE '%`%';
```

## Database Relationships

### Primary Keys
- All tables use `id` as primary key with auto-increment
- `session_tracking.session_id` has unique constraint
- `ip_reputation.ip_address` has unique constraint
- `unique_payloads.payload_hash + service` has unique constraint

### Foreign Key Relationships
- `service_logs.service` → service identification
- `web_service_logs.brand` → camera brand
- `cowrie_service_logs.session_id` → `session_tracking.session_id`
- `ip_reputation.ip_address` → various log tables

### Indexes
- `timestamp` columns are indexed for time-based queries
- `ip_address` columns are indexed for IP-based queries
- `service` and `event_type` columns are indexed for filtering
- `brand` columns are indexed for brand-specific analysis

## Data Analysis Examples

```sql
-- Attack patterns by time
SELECT HOUR(timestamp) as hour, COUNT(*) as attacks
FROM web_service_logs 
WHERE event_type = 'auth_failure'
GROUP BY HOUR(timestamp)
ORDER BY hour;

-- Geographic threat distribution
SELECT country, COUNT(*) as attacks
FROM ip_reputation 
WHERE threat_score > 50
GROUP BY country
ORDER BY attacks DESC;

-- Service activity comparison
SELECT service, COUNT(*) as events
FROM all_logs 
WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY service
ORDER BY events DESC;

-- Brand-specific attack analysis
SELECT brand, event_type, COUNT(*) as count
FROM web_service_logs 
WHERE brand IS NOT NULL
GROUP BY brand, event_type
ORDER BY brand, count DESC;
```

## Database Configuration

### Connection Details
- **Host**: `mysql_service` (Docker container)
- **Port**: 3306
- **Database**: `sweetcam`
- **Charset**: `utf8mb4`
- **Collation**: `utf8mb4_unicode_ci`

### User Accounts
- **Root User**: `root` (with full privileges)
- **Grafana User**: `grafana` (read-only access for dashboards)

### Performance Settings
- **Max Connections**: 200
- **Connection Timeout**: 60 seconds
- **Wait Timeout**: 28,800 seconds (8 hours)
- **Interactive Timeout**: 28,800 seconds (8 hours)

## Maintenance and Monitoring

### Regular Tasks
1. **Log Rotation**: Monitor table sizes and implement archival strategies
2. **Index Optimization**: Review query performance and optimize indexes
3. **Statistics Updates**: Ensure `log_statistics` table is regularly updated
4. **Payload Analysis**: Review `unique_payloads` for new threat patterns

### Backup Strategy
- **Volume Mounts**: Database data persisted in `mysql-data` Docker volume
- **Initialization**: Schema automatically created from `initialize.sql`
- **Data Persistence**: Data survives container restarts

