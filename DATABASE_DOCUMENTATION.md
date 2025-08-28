# SweetCam Honeypot Database Documentation

## Overview
The SweetCam honeypot system uses a MySQL database (`sweetcam`) to store logging data from multiple honeypot services. The database is designed with both generic and specialised logging tables to provide flexibility and performance.

## Database Schema

### Core Tables

#### 1. `service_logs` - Universal Service Logging
**Purpose**: Generic logging table for all services with flexible JSON payload storage.

**Structure**:
```sql
CREATE TABLE `service_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `service` varchar(50) NOT NULL,                    -- Service identifier (cowrie, web, onvif, rtsp)
  `event_type` varchar(100) NOT NULL,               -- Event category
  `log_level` varchar(20) NOT NULL DEFAULT 'info',  -- Log severity
  `ip_address` varchar(45) DEFAULT NULL,            -- Source IP address
  `brand` varchar(50) DEFAULT NULL,                  -- Camera brand (hikvision, dahua, etc.)
  `port` int DEFAULT NULL,                          -- Source port
  `username` varchar(255) DEFAULT NULL,             -- Username attempted
  `password` varchar(255) DEFAULT NULL,             -- Password attempted
  `session_id` varchar(255) DEFAULT NULL,           -- Session identifier
  `user_agent` text DEFAULT NULL,                   -- HTTP user agent
  `message` text DEFAULT NULL,                      -- Human-readable message
  `raw_data` json DEFAULT NULL,                     -- Structured JSON data
  `payload` json DEFAULT NULL,                      -- Generic JSON payload
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP
);
```

**Use Cases**:
- Cross-service correlation and analysis
- Generic event storage for any service type
- Historical data analysis across all honeypot components

**Example Queries**:
```sql
-- All events from a specific IP
SELECT * FROM service_logs WHERE ip_address = '192.168.1.100';

-- Failed login attempts across all services
SELECT service, COUNT(*) FROM service_logs 
WHERE event_type = 'auth_failure' 
GROUP BY service;

-- Recent suspicious activity
SELECT * FROM service_logs 
WHERE log_level IN ('warn', 'error') 
ORDER BY timestamp DESC LIMIT 10;
```

#### 2. `web_service_logs` - Web Service Specialized Logging
**Purpose**: Dedicated table for web-based honeypot services with structured fields.

**Structure**:
```sql
CREATE TABLE `web_service_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `event_type` varchar(100) NOT NULL,               -- http_request, auth_failure, login_attempt
  `log_level` varchar(20) NOT NULL DEFAULT 'info',
  `ip_address` varchar(45) DEFAULT NULL,
  `brand` varchar(50) DEFAULT NULL,                  -- Camera brand
  `port` int DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `request_method` varchar(10) DEFAULT NULL,        -- HTTP method (GET, POST, etc.)
  `request_url` text DEFAULT NULL,                  -- Requested URL
  `request_headers` json DEFAULT NULL,              -- HTTP headers
  `request_body` text DEFAULT NULL,                 -- Request body content
  `response_status` int DEFAULT NULL,               -- HTTP response status
  `response_headers` json DEFAULT NULL,             -- Response headers
  `response_body` text DEFAULT NULL,                -- Response body
  `message` text DEFAULT NULL,
  `raw_data` json DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP
);
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
WHERE request_url LIKE '%/login%' 
ORDER BY timestamp DESC;

-- Attack patterns by IP
SELECT ip_address, COUNT(*) as attempts 
FROM web_service_logs 
WHERE event_type = 'http_request' 
GROUP BY ip_address 
HAVING attempts > 10;
```

#### 3. `cowrie_service_logs` - SSH/Telnet Honeypot Logging
**Purpose**: Specialized table for Cowrie SSH honeypot with structured fields for command analysis.

**Structure**:
```sql
CREATE TABLE `cowrie_service_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `event_type` varchar(100) NOT NULL,               -- session_start, command_execution, file_upload
  `log_level` varchar(20) NOT NULL DEFAULT 'info',
  `ip_address` varchar(45) DEFAULT NULL,
  `brand` varchar(50) DEFAULT NULL,
  `port` int DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `command` text DEFAULT NULL,                      -- Executed command
  `file_path` varchar(500) DEFAULT NULL,            -- File path for uploads/downloads
  `file_size` bigint DEFAULT NULL,                  -- File size in bytes
  `geoip_country` varchar(10) DEFAULT NULL,         -- Geographic country
  `geoip_city` varchar(100) DEFAULT NULL,           -- Geographic city
  `threat_level` varchar(20) DEFAULT NULL,          -- low, medium, high, critical
  `alert_type` varchar(100) DEFAULT NULL,           -- Alert category
  `message` text DEFAULT NULL,                      -- Human-readable description
  `raw_data` json DEFAULT NULL,                     -- Full event JSON
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP
);
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

#### 4. `onvif_service_logs` - ONVIF Protocol Logging
**Purpose**: Specialized table for ONVIF camera protocol attacks.

**Structure**: Similar to other service logs with ONVIF-specific fields.

**Use Cases**:
- ONVIF protocol attack analysis
- Camera discovery attempts
- Device enumeration tracking

#### 5. `rtsp_service_logs` - RTSP Protocol Logging
**Purpose**: Specialized table for RTSP streaming protocol attacks.

**Structure**: Similar to other service logs with RTSP-specific fields.

**Use Cases**:
- RTSP protocol attack analysis
- Streaming attempt monitoring
- Media access tracking

### User Management Tables

#### 6. `users` - Regular User Accounts
**Purpose**: Store legitimate user accounts for the honeypot system.

**Structure**:
```sql
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `passwordHash` varchar(255) NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
  `chatId` varchar(255) DEFAULT NULL,               -- Telegram chat ID for notifications
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Security and Analytics Tables

#### 8. `ip_reputation` - IP Address Threat Scoring
**Purpose**: Track and score IP addresses based on their behavior.

**Structure**:
```sql
CREATE TABLE `ip_reputation` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ip_address` varchar(45) NOT NULL UNIQUE,
  `first_seen` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `total_events` int NOT NULL DEFAULT 0,
  `failed_logins` int NOT NULL DEFAULT 0,
  `successful_logins` int NOT NULL DEFAULT 0,
  `suspicious_activities` int NOT NULL DEFAULT 0,
  `threat_score` int NOT NULL DEFAULT 0,            -- 0-100 scale
  `country` varchar(10) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `is_blocked` tinyint(1) NOT NULL DEFAULT 0,
  `block_reason` text DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
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
SELECT ip_address, block_reason, blocked_at 
FROM ip_reputation 
WHERE is_blocked = 1 
ORDER BY updated_at DESC;
```

#### 9. `security_events` - High-Priority Security Alerts
**Purpose**: Store critical security events requiring immediate attention.

**Structure**:
```sql
CREATE TABLE `security_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `service` varchar(50) NOT NULL,
  `event_type` varchar(100) NOT NULL,
  `severity` varchar(20) NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  `ip_address` varchar(45) DEFAULT NULL,
  `brand` varchar(50) DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `threat_type` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `raw_data` json DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP
);
```

**Use Cases**:
- Critical security alert storage
- Incident response tracking
- High-priority event monitoring

#### 10. `session_tracking` - Session Lifecycle Management
**Purpose**: Track active and completed sessions across all services.

**Structure**:
```sql
CREATE TABLE `session_tracking` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(255) NOT NULL UNIQUE,
  `service` varchar(50) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `brand` varchar(50) DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `start_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` timestamp DEFAULT NULL,
  `duration_seconds` int DEFAULT NULL,
  `event_count` int NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'active',   -- active, completed, terminated
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Use Cases**:
- Session lifecycle monitoring
- Attack duration analysis
- User behavior tracking

#### 11. `log_statistics` - Aggregated Log Analytics
**Purpose**: Store pre-calculated statistics for dashboard and reporting.

**Structure**:
```sql
CREATE TABLE `log_statistics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `service` varchar(50) NOT NULL,
  `event_type` varchar(100) NOT NULL,
  `count` int NOT NULL DEFAULT 0,
  `unique_ips` int NOT NULL DEFAULT 0,
  `unique_brands` int NOT NULL DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Use Cases**:
- Dashboard metrics
- Trend analysis
- Performance optimization

### Views

#### 12. `all_logs` - Unified Log View
**Purpose**: Provide a unified view of all log data across services.

**Use Cases**:
- Cross-service log analysis
- Unified reporting
- Data export

## Database Relationships

### Primary Keys
- All tables use `id` as primary key with auto-increment
- `session_tracking.session_id` has unique constraint
- `ip_reputation.ip_address` has unique constraint

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


### Data Analysis
```sql
-- Attack patterns by time
SELECT HOUR(timestamp) as hour, COUNT(*) as attacks
FROM service_logs 
WHERE event_type = 'auth_failure'
GROUP BY HOUR(timestamp)
ORDER BY hour;

-- Geographic threat distribution
SELECT country, COUNT(*) as attacks
FROM ip_reputation 
WHERE threat_score > 50
GROUP BY country
ORDER BY attacks DESC;
```
