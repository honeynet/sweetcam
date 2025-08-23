const mysql = require('mysql2/promise');
const dbConfig = require('../config/db-config');

const pool = mysql.createPool({
  host: dbConfig.HOST,
  user: dbConfig.USER,
  password: dbConfig.PASSWORD,
  database: dbConfig.DB,
  port: dbConfig.PORT || dbConfig.port || 3306,
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

// Test database connection
async function testConnection() {
  try {
    const [rows] = await pool.execute('SELECT 1 as test');
    console.log('[DB-LOGGER] Database connection test successful');
    return true;
  } catch (error) {
    console.error('[DB-LOGGER] Database connection test failed:', error.message);
    return false;
  }
}

testConnection();

async function writeServiceLog(entry) {
  console.log('[DB-LOGGER] Attempting to write service log:', JSON.stringify(entry, null, 2));
  
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
  
  console.log('[DB-LOGGER] SQL Query:', sql);
  console.log('[DB-LOGGER] Parameters:', JSON.stringify(params, null, 2));
  
  try {
    const result = await pool.execute(sql, params);
    console.log('[DB-LOGGER] Service log written successfully. Insert ID:', result[0].insertId);
  } catch (error) {
    console.error('[DB-LOGGER] Failed to write service log:', error.message);
    console.error('[DB-LOGGER] Error code:', error.code);
    console.error('[DB-LOGGER] Error SQL state:', error.sqlState);
    console.error('[DB-LOGGER] SQL:', sql);
    console.error('[DB-LOGGER] Params:', JSON.stringify(params));
    console.error('[DB-LOGGER] Full error:', error);
  }
}

async function writeONVIFLog(entry) {
  console.log('[DB-LOGGER] Attempting to write ONVIF log:', JSON.stringify(entry, null, 2));
  
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
  
  console.log('[DB-LOGGER] ONVIF SQL Query:', sql);
  console.log('[DB-LOGGER] ONVIF Parameters:', JSON.stringify(params, null, 2));
  
  try {
    const result = await pool.execute(sql, params);
    console.log('[DB-LOGGER] ONVIF log written successfully. Insert ID:', result[0].insertId);
  } catch (error) {
    console.error('[DB-LOGGER] Failed to write ONVIF log (primary):', error.message);
    console.error('[DB-LOGGER] Error code:', error.code);
    console.error('[DB-LOGGER] Error SQL state:', error.sqlState);
    console.error('[DB-LOGGER] SQL:', sql);
    console.error('[DB-LOGGER] Params:', JSON.stringify(params));
    console.error('[DB-LOGGER] Full error:', error);
    
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
      
      console.log('[DB-LOGGER] Attempting fallback ONVIF query:', sql);
      console.log('[DB-LOGGER] Fallback parameters:', JSON.stringify(params, null, 2));
      
      const fallbackResult = await pool.execute(sql, params);
      console.log('[DB-LOGGER] ONVIF log written with fallback query. Insert ID:', fallbackResult[0].insertId);
    } catch (fallbackError) {
      console.error('[DB-LOGGER] Failed to write ONVIF log (fallback):', fallbackError.message);
      console.error('[DB-LOGGER] Fallback error code:', fallbackError.code);
      console.error('[DB-LOGGER] Fallback error SQL state:', fallbackError.sqlState);
      console.error('[DB-LOGGER] Fallback SQL:', sql);
      console.error('[DB-LOGGER] Fallback Params:', JSON.stringify(params));
      console.error('[DB-LOGGER] Full fallback error:', fallbackError);
    }
  }
}

module.exports = { writeServiceLog, writeONVIFLog }; 