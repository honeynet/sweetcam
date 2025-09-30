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

async function writeServiceLog(entry) {
  const sql = `INSERT INTO service_logs 
    (timestamp, ip_address, service, port, time_end, brand) 
    VALUES (COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?)`;
  const params = [
    entry.timestamp || null,
    entry.ip_address || null,
    'rtsp',
    entry.port || null,
    entry.time_end || null,
    entry.brand || null
  ];
  try {
    await pool.execute(sql, params);
  } catch (_) {}
}

async function writeRTSPLog(entry) {
  const sql = `INSERT INTO rtsp_service_logs 
    (timestamp, event_type, log_level, ip_address, brand, port, username, password, session_id, rtsp_method, stream_path, connection_id, message, payload, raw_data) 
    VALUES (COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
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
    entry.rtsp_method || null,
    entry.stream_path || null,
    entry.connection_id || null,
    entry.message || null,
    entry.payload ? JSON.stringify(entry.payload) : null,
    entry.raw_data ? JSON.stringify(entry.raw_data) : null
  ];
  try {
    await pool.execute(sql, params);
  } catch (_) {}
}

module.exports = { writeServiceLog, writeRTSPLog }; 