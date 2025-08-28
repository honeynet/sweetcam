    USE sweetcam;

CREATE TABLE `admins`
(
    `id`           int          NOT NULL AUTO_INCREMENT,
    `name`         varchar(255) NOT NULL,
    `passwordHash` varchar(255) NOT NULL,
    `chatId`       varchar(255) DEFAULT NULL,
    `createdAt`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `updatedAt`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);

CREATE TABLE `users`
(
    `id`           int          NOT NULL AUTO_INCREMENT,
    `name`         varchar(255) NOT NULL,
    `passwordHash` varchar(255) NOT NULL,
    `createdAt`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `updatedAt`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);

INSERT INTO `admins` (`name`, `passwordHash`, `chatId`)
    value ('Jonny', '$2b$10$tisI8PSJW8hwC/mjdP9MvOMUeY/wjL0jKeS0jb4lJ9EBWo290rGQ6', '1726197025');

/**
  Jimmy:1234567; Admin:admin; Admin:Admin; admin:12345; root:12345; root:123456; root:admin; root:root; Nancy:1234567
 */
INSERT INTO `users` (`name`, `passwordHash`)
    values ('Jimmy', '$2b$10$tisI8PSJW8hwC/mjdP9MvOMUeY/wjL0jKeS0jb4lJ9EBWo290rGQ6'),
           ('Admin', '$2a$10$KSHYVV4y8jkFhMf45hiX1umUuv.XTijwn2wGnbQa9KyCftNvBV6ia'),
           ('Admin', '$2a$10$bYtlT0RyRS16wTQawb3skOwSh.s2Q1YU9owuxKaHq7cSY5sxBcu.i'),
           ('admin', '$2a$10$IOYkMiX4A/zULMHMsPHg3eclBo.uWviARBNnaogMZfFH0yhhDbj7O'),
           ('root', '$2a$10$Q/JuOhBYQxoqZsM2UdZvXeK5pdFFkW5sCb.DdDAkmpxROSPuUC6.y'),
           ('root', '$2a$10$xBvEwoOwzpApu9JYsL4qsOlSRYaIu3y3nwgael60fJiPVHC0g5TNq'),
           ('root', '$2a$10$SjMRqUPAkXSyphmRXj9TyOTqc1tY/HCOdUsBaw04uyPJe.BVgXsGq'),
           ('root', '$2a$10$39XWechlaS5aPg/4SO.43u2xA6ael3fcOWT8yNEQMHAcGVoe2tF4C'),
           ('Nancy', '$2b$10$tisI8PSJW8hwC/mjdP9MvOMUeY/wjL0jKeS0jb4lJ9EBWo290rGQ6');

-- Log tables for all services
CREATE TABLE IF NOT EXISTS `service_logs`
(
    `id`           bigint       NOT NULL AUTO_INCREMENT,
    `timestamp`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `service`      varchar(50)  NOT NULL COMMENT 'web, rtsp, onvif, cowrie',
    `event_type`   varchar(100) NOT NULL,
    `log_level`    varchar(20)  NOT NULL DEFAULT 'info' COMMENT 'info, error, warn, debug',
    `ip_address`   varchar(45)  DEFAULT NULL COMMENT 'IPv4 or IPv6 address',
    `brand`        varchar(50)  DEFAULT NULL COMMENT 'camera brand',
    `port`         int          DEFAULT NULL,
    `username`     varchar(255) DEFAULT NULL,
    `password`     varchar(255) DEFAULT NULL,
    `session_id`   varchar(255) DEFAULT NULL,
    `user_agent`   text         DEFAULT NULL,
    `message`      text         DEFAULT NULL,
    `payload`      json         DEFAULT NULL COMMENT 'HTTP request and response payloads',
    `raw_data`     json         DEFAULT NULL COMMENT 'Complete log entry as JSON',
    `created_at`   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_service` (`service`),
    INDEX `idx_event_type` (`event_type`),
    INDEX `idx_timestamp` (`timestamp`),
    INDEX `idx_ip_address` (`ip_address`),
    INDEX `idx_brand` (`brand`),
    INDEX `idx_session_id` (`session_id`),
    INDEX `idx_log_level` (`log_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Web service specific logs
CREATE TABLE IF NOT EXISTS `web_service_logs`
(
    `id`             bigint       NOT NULL AUTO_INCREMENT,
    `timestamp`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `event_type`     varchar(100) NOT NULL COMMENT 'login_attempt, auth_failure, rtsp_management, rtsp_service_toggle, service_event',
    `log_level`      varchar(20)  NOT NULL DEFAULT 'info',
    `ip_address`     varchar(45)  DEFAULT NULL,
    `brand`          varchar(50)  DEFAULT NULL,
    `port`           int          DEFAULT NULL,
    `username`       varchar(255) DEFAULT NULL,
    `password`       varchar(255) DEFAULT NULL,
    `session_id`     varchar(255) DEFAULT NULL,
    `user_agent`     text         DEFAULT NULL,
    `request_path`   varchar(500) DEFAULT NULL,
    `request_method` varchar(10)  DEFAULT NULL,
    `response_code`  int          DEFAULT NULL,
    `message`        text         DEFAULT NULL,
    `payload`        json         DEFAULT NULL COMMENT 'HTTP request and response payloads',
    `raw_data`       json         DEFAULT NULL,
    `created_at`     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_event_type` (`event_type`),
    INDEX `idx_timestamp` (`timestamp`),
    INDEX `idx_ip_address` (`ip_address`),
    INDEX `idx_brand` (`brand`),
    INDEX `idx_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- RTSP service specific logs
CREATE TABLE IF NOT EXISTS `rtsp_service_logs`
(
    `id`             bigint       NOT NULL AUTO_INCREMENT,
    `timestamp`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `event_type`     varchar(100) NOT NULL COMMENT 'rtsp_method, connection_event, service_event, auth_attempt',
    `log_level`      varchar(20)  NOT NULL DEFAULT 'info',
    `ip_address`     varchar(45)  DEFAULT NULL,
    `brand`          varchar(50)  DEFAULT NULL,
    `port`           int          DEFAULT NULL,
    `username`       varchar(255) DEFAULT NULL,
    `password`       varchar(255) DEFAULT NULL,
    `session_id`     varchar(255) DEFAULT NULL,
    `rtsp_method`    varchar(20)  DEFAULT NULL COMMENT 'DESCRIBE, SETUP, PLAY, etc.',
    `stream_path`    varchar(500) DEFAULT NULL,
    `connection_id`  varchar(255) DEFAULT NULL,
    `message`        text         DEFAULT NULL,
    `payload`        json         DEFAULT NULL COMMENT 'RTSP stream and connection payloads',
    `raw_data`       json         DEFAULT NULL,
    `created_at`     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_event_type` (`event_type`),
    INDEX `idx_timestamp` (`timestamp`),
    INDEX `idx_ip_address` (`ip_address`),
    INDEX `idx_brand` (`brand`),
    INDEX `idx_rtsp_method` (`rtsp_method`),
    INDEX `idx_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ONVIF service specific logs
CREATE TABLE IF NOT EXISTS `onvif_service_logs`
(
    `id`             bigint       NOT NULL AUTO_INCREMENT,
    `timestamp`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `event_type`     varchar(100) NOT NULL COMMENT 'soap_request, connection_event, ws_discovery, device_info_request, service_event',
    `log_level`      varchar(20)  NOT NULL DEFAULT 'info',
    `ip_address`     varchar(45)  DEFAULT NULL,
    `brand`          varchar(50)  DEFAULT NULL,
    `port`           int          DEFAULT NULL,
    `username`       varchar(255) DEFAULT NULL,
    `password`       varchar(255) DEFAULT NULL,
    `session_id`     varchar(255) DEFAULT NULL,
    `soap_action`    varchar(500) DEFAULT NULL,
    `user_agent`     text         DEFAULT NULL,
    `request_method` varchar(10)  DEFAULT NULL,
    `request_url`    varchar(500) DEFAULT NULL,
    `response_status` int         DEFAULT NULL,
    `device_info`    json         DEFAULT NULL,
    `discovery_type` varchar(50)  DEFAULT NULL COMMENT 'WS-Discovery, Probe, Resolve',
    `message`        text         DEFAULT NULL,
    `payload`        json         DEFAULT NULL COMMENT 'HTTP request and response payloads',
    `raw_data`       json         DEFAULT NULL,
    `created_at`     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
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

-- Cowrie service specific logs (honeypot)
CREATE TABLE IF NOT EXISTS `cowrie_service_logs`
(
    `id`             bigint       NOT NULL AUTO_INCREMENT,
    `timestamp`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `event_type`     varchar(100) NOT NULL COMMENT 'session_start, session_end, login_attempt, command_execution, file_operation, download_attempt, upload_attempt, geoip_lookup, service_event, startup_shutdown',
    `log_level`      varchar(20)  NOT NULL DEFAULT 'info',
    `ip_address`     varchar(45)  DEFAULT NULL,
    `brand`          varchar(50)  DEFAULT NULL,
    `port`           int          DEFAULT NULL,
    `username`       varchar(255) DEFAULT NULL,
    `password`       varchar(255) DEFAULT NULL,
    `session_id`     varchar(255) DEFAULT NULL,
    `command`        text         DEFAULT NULL,
    `file_path`      varchar(500) DEFAULT NULL,
    `file_size`      bigint       DEFAULT NULL,
    `geoip_country`  varchar(10)  DEFAULT NULL,
    `geoip_city`     varchar(100) DEFAULT NULL,
    `message`        text         DEFAULT NULL,
    `raw_data`       json         DEFAULT NULL,
    `created_at`     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_event_type` (`event_type`),
    INDEX `idx_timestamp` (`timestamp`),
    INDEX `idx_ip_address` (`ip_address`),
    INDEX `idx_brand` (`brand`),
    INDEX `idx_session_id` (`session_id`),
    INDEX `idx_geoip_country` (`geoip_country`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Statistics table for aggregated data
CREATE TABLE IF NOT EXISTS `log_statistics`
(
    `id`             bigint       NOT NULL AUTO_INCREMENT,
    `date`           DATE         NOT NULL,
    `service`        varchar(50)  NOT NULL,
    `event_type`     varchar(100) NOT NULL,
    `count`          int          NOT NULL DEFAULT 0,
    `unique_ips`     int          NOT NULL DEFAULT 0,
    `unique_brands`  int          NOT NULL DEFAULT 0,
    `created_at`     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `updated_at`     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_date_service_event` (`date`, `service`, `event_type`),
    INDEX `idx_date` (`date`),
    INDEX `idx_service` (`service`),
    INDEX `idx_event_type` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IP reputation table
CREATE TABLE IF NOT EXISTS `ip_reputation`
(
    `id`                   bigint       NOT NULL AUTO_INCREMENT,
    `ip_address`           varchar(45)  NOT NULL,
    `first_seen`           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `last_seen`            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `total_events`         int          NOT NULL DEFAULT 0,
    `failed_logins`        int          NOT NULL DEFAULT 0,
    `successful_logins`    int          NOT NULL DEFAULT 0,
    `threat_score`         int          NOT NULL DEFAULT 0 COMMENT '0-100 threat score',
    `country`              varchar(10)  DEFAULT NULL,
    `city`                 varchar(100) DEFAULT NULL,
    `is_blocked`           boolean      NOT NULL DEFAULT FALSE,
    `block_reason`         text         DEFAULT NULL,
    `created_at`           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `updated_at`           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_ip_address` (`ip_address`),
    INDEX `idx_threat_score` (`threat_score`),
    INDEX `idx_is_blocked` (`is_blocked`),
    INDEX `idx_country` (`country`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Session tracking table
CREATE TABLE IF NOT EXISTS `session_tracking`
(
    `id`               bigint       NOT NULL AUTO_INCREMENT,
    `session_id`       varchar(255) NOT NULL,
    `service`          varchar(50)  NOT NULL,
    `ip_address`       varchar(45)  DEFAULT NULL,
    `brand`            varchar(50)  DEFAULT NULL,
    `username`         varchar(255) DEFAULT NULL,
    `start_time`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `end_time`         TIMESTAMP    NULL DEFAULT NULL,
    `duration_seconds` int          DEFAULT NULL,
    `event_count`      int          NOT NULL DEFAULT 0,
    `status`           varchar(20)  NOT NULL DEFAULT 'active' COMMENT 'active, completed, terminated',
    `created_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    `updated_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_session_id` (`session_id`),
    INDEX `idx_service` (`service`),
    INDEX `idx_ip_address` (`ip_address`),
    INDEX `idx_status` (`status`),
    INDEX `idx_start_time` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Unified view for Grafana
CREATE OR REPLACE VIEW all_logs AS
SELECT timestamp, service, event_type, ip_address, brand, message
FROM service_logs
UNION ALL
SELECT timestamp, 'web' AS service, event_type, ip_address, brand, message
FROM web_service_logs
UNION ALL
SELECT timestamp, 'rtsp' AS service, event_type, ip_address, brand, message
FROM rtsp_service_logs
UNION ALL
SELECT timestamp, 'onvif' AS service, event_type, ip_address, brand, message
FROM onvif_service_logs
UNION ALL
SELECT timestamp, 'cowrie' AS service, event_type, ip_address, brand, message
FROM cowrie_service_logs;

-- Read-only user for Grafana
CREATE USER IF NOT EXISTS 'grafana'@'%' IDENTIFIED BY 'grafana_pass';
GRANT SELECT ON sweetcam.* TO 'grafana'@'%';
FLUSH PRIVILEGES;