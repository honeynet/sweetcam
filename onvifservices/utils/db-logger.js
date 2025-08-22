const mysql = require('mysql2/promise');
const { pool: existingPool } = require('../config/db-config');

const pool = existingPool || mysql.createPool({
  host: process.env.DB_HOST || 'mysql_service',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'sweetcam',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function ensureColumnsExist() {
  try {
    const [rows] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'onvif_service_logs' 
      AND COLUMN_NAME IN ('user_agent', 'request_method', 'request_url', 'response_status')
    `, [process.env.DB_NAME || 'sweetcam']);
    
    const existingColumns = rows.map(row => row.COLUMN_NAME);
    const missingColumns = [];
    
    if (!existingColumns.includes('user_agent')) {
      missingColumns.push('ADD COLUMN `user_agent` TEXT DEFAULT NULL AFTER `soap_action`');
    }
    if (!existingColumns.includes('request_method')) {
      missingColumns.push('ADD COLUMN `request_method` VARCHAR(10) DEFAULT NULL AFTER `user_agent`');
    }
    if (!existingColumns.includes('request_url')) {
      missingColumns.push('ADD COLUMN `request_url` VARCHAR(500) DEFAULT NULL AFTER `request_method`');
    }
    if (!existingColumns.includes('response_status')) {
      missingColumns.push('ADD COLUMN `response_status` INT DEFAULT NULL AFTER `request_url`');
    }
    
    if (missingColumns.length > 0) {
      console.log('[DB-LOGGER] Adding missing columns to onvif_service_logs table:', missingColumns);
      const alterSql = `ALTER TABLE onvif_service_logs ${missingColumns.join(', ')}`;
      await pool.execute(alterSql);
      
      try {
        await pool.execute('ALTER TABLE `onvif_service_logs` ADD INDEX `idx_user_agent` (`user_agent`(100))');
      } catch (e) {
      }
      try {
        await pool.execute('ALTER TABLE `onvif_service_logs` ADD INDEX `idx_request_method` (`request_method`)');
      } catch (e) {
      }
      try {
        await pool.execute('ALTER TABLE `onvif_service_logs` ADD INDEX `idx_request_url` (`request_url`(100))');
      } catch (e) {
      }
      try {
        await pool.execute('ALTER TABLE `onvif_service_logs` ADD INDEX `idx_response_status` (`response_status`)');
      } catch (e) {
      }
      
      console.log('[DB-LOGGER] Successfully added missing columns to onvif_service_logs table');
    }
  } catch (error) {
    console.error('[DB-LOGGER] Error ensuring columns exist:', error.message);
  }
}

ensureColumnsExist();

async function writeServiceLog(entry) {
  const sql = `INSERT INTO service_logs 
    (timestamp, service, event_type, log_level, ip_address, brand, port, username, password, session_id, user_agent, message, payload, raw_data) 
    VALUES (COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    entry.timestamp || null,
    'onvif',
    entry.event_type,
    entry.log_level || 'info',
    entry.ip_address || null,
    entry.brand || null,
    entry.port || null,
    entry.username || null,
    entry.password || null,
    entry.session_id || null,
    entry.user_agent || null,
    entry.message || null,
    entry.payload ? JSON.stringify(entry.payload) : null,
    entry.raw_data ? JSON.stringify(entry.raw_data) : null
  ];
  try {
    await pool.execute(sql, params);
  } catch (_) {}
}

async function writeONVIFLog(entry) {
  let sql = `INSERT INTO onvif_service_logs 
    (timestamp, event_type, log_level, ip_address, brand, port, username, password, session_id, soap_action, user_agent, request_method, request_url, response_status, device_info, discovery_type, message, payload, raw_data) 
    VALUES (COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  let params = [
    entry.timestamp || null,
    entry.event_type,
    entry.log_level || 'info',
    entry.ip_address || null,
    entry.brand || null,
    entry.port || null,
    entry.username || null,
    entry.password || null,
    entry.session_id || null,
    entry.soap_action || null,
    entry.user_agent || null,
    entry.request_method || null,
    entry.request_url || null,
    entry.response_status || null,
    entry.device_info ? JSON.stringify(entry.device_info) : null,
    entry.discovery_type || null,
    entry.message || null,
    entry.payload ? JSON.stringify(entry.payload) : null,
    entry.raw_data ? JSON.stringify(entry.raw_data) : null
  ];
  
  try {
    await pool.execute(sql, params);
  } catch (error) {
    try {
      sql = `INSERT INTO onvif_service_logs 
        (timestamp, event_type, log_level, ip_address, brand, port, username, password, session_id, soap_action, device_info, discovery_type, message, raw_data) 
        VALUES (COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      params = [
        entry.timestamp || null,
        entry.event_type,
        entry.log_level || 'info',
        entry.ip_address || null,
        entry.brand || null,
        entry.port || null,
        entry.username || null,
        entry.password || null,
        entry.session_id || null,
        entry.soap_action || null,
        entry.device_info ? JSON.stringify(entry.device_info) : null,
        entry.discovery_type || null,
        entry.message || null,
        entry.raw_data ? JSON.stringify(entry.raw_data) : null
      ];
      
      await pool.execute(sql, params);
    } catch (fallbackError) {
      console.error('[DB-LOGGER] Failed to write ONVIF log:', fallbackError.message);
    }
  }
}

module.exports = { writeServiceLog, writeONVIFLog }; 