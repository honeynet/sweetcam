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

async function writeServiceLog(entry) {
  const sql = `INSERT INTO service_logs 
    (timestamp, service, event_type, log_level, ip_address, brand, port, username, password, session_id, user_agent, message, raw_data) 
    VALUES (COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
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
    entry.raw_data ? JSON.stringify(entry.raw_data) : null
  ];
  try {
    await pool.execute(sql, params);
  } catch (_) {}
}

async function writeONVIFLog(entry) {
  const sql = `INSERT INTO onvif_service_logs 
    (timestamp, event_type, log_level, ip_address, brand, port, username, password, session_id, soap_action, device_info, discovery_type, message, raw_data) 
    VALUES (COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
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
  try {
    await pool.execute(sql, params);
  } catch (_) {}
}

module.exports = { writeServiceLog, writeONVIFLog }; 