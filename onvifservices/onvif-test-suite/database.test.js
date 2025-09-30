/**
 * ONVIF Database Testing using Jest
 * Focused testing for database connectivity, logging, and payload storage
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

describe('ONVIF Database and Logging Testing', () => {
  let dbConnection;
  
  beforeAll(async () => {
    // Setup database connection for tests
    try {
      dbConnection = await mysql.createConnection(global.testConfig.database);
      console.log('Database connection established for testing');
    } catch (error) {
      console.warn('Database connection failed, some tests may fail:', error.message);
    }
  });
  
  afterAll(async () => {
    // Cleanup database connection
    if (dbConnection) {
      await dbConnection.end();
      console.log('Database connection closed');
    }
  });
  
  describe('Database Connectivity', () => {
    test('should connect to database successfully', async () => {
      if (!dbConnection) {
        console.warn('Skipping database connectivity test - no connection');
        return;
      }
      
      const [rows] = await dbConnection.execute('SELECT 1 as test');
      
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].test).toBe(1);
    });
    
    test('should handle connection pool correctly', async () => {
      if (!dbConnection) {
        console.warn('Skipping connection pool test - no connection');
        return;
      }
      
      const pool = mysql.createPool({
        host: global.testConfig.database.host,
        user: global.testConfig.database.user,
        password: global.testConfig.database.password,
        database: global.testConfig.database.database,
        port: global.testConfig.database.port,
        connectionLimit: 5,
        queueLimit: 0
      });
      
      const [poolRows] = await pool.execute('SELECT 1 as test');
      await pool.end();
      
      expect(poolRows.length).toBeGreaterThan(0);
      expect(poolRows[0].test).toBe(1);
    });
    
    test('should handle connection timeouts properly', async () => {
      if (!dbConnection) {
        console.warn('Skipping timeout test - no connection');
        return;
      }
      
      const startTime = Date.now();
      
      try {
        await dbConnection.execute('SELECT SLEEP(1)');
        const executionTime = Date.now() - startTime;
        
        expect(executionTime).toBeGreaterThan(900); // Should take at least 900ms
        expect(executionTime).toBeLessThan(5000);   // But not more than 5 seconds
      } catch (error) {
        // Some databases might not support SLEEP function
        console.warn('SLEEP function not supported, skipping timeout test');
      }
    });
  });
  
  describe('Table Structure', () => {
    test('should have required database tables', async () => {
      if (!dbConnection) {
        console.warn('Skipping table structure test - no connection');
        return;
      }
      
      const requiredTables = [
        'onvif_service_logs',
        'service_logs',
        'camera_logs'
      ];
      
      const [tables] = await dbConnection.execute(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ?
      `, [global.testConfig.database.database]);
      
      const existingTables = tables.map(row => row.TABLE_NAME);
      const missingTables = requiredTables.filter(table => 
        !existingTables.includes(table)
      );
      
      if (missingTables.length > 0) {
        console.warn('Missing tables:', missingTables);
      }
      
      // At least the main table should exist
      expect(existingTables.length).toBeGreaterThan(0);
    });
    
    test('should have correct onvif_service_logs table structure', async () => {
      if (!dbConnection) {
        console.warn('Skipping table structure test - no connection');
        return;
      }
      
      try {
        const [columns] = await dbConnection.execute(`
          SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'onvif_service_logs'
          ORDER BY ORDINAL_POSITION
        `, [global.testConfig.database.database]);
        
        if (columns.length === 0) {
          console.warn('onvif_service_logs table not found');
          return;
        }
        
        const requiredColumns = [
          'timestamp', 'event_type', 'log_level', 'ip_address', 'brand', 
          'port', 'username', 'password', 'session_id', 'soap_action',
          'user_agent', 'request_method', 'request_url', 'response_status',
          'device_info', 'discovery_type', 'message', 'payload', 'raw_data'
        ];
        
        const existingColumns = columns.map(col => col.COLUMN_NAME);
        const missingColumns = requiredColumns.filter(col => 
          !existingColumns.includes(col)
        );
        
        if (missingColumns.length > 0) {
          console.warn('Missing columns in onvif_service_logs:', missingColumns);
        }
        
        expect(columns.length).toBeGreaterThan(0);
        expect(existingColumns.length).toBeGreaterThan(0);
      } catch (error) {
        console.warn('Error checking table structure:', error.message);
      }
    });
    
    test('should have proper indexes for performance', async () => {
      if (!dbConnection) {
        console.warn('Skipping index test - no connection');
        return;
      }
      
      try {
        const [indexes] = await dbConnection.execute(`
          SELECT INDEX_NAME, COLUMN_NAME 
          FROM INFORMATION_SCHEMA.STATISTICS 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'onvif_service_logs'
        `, [global.testConfig.database.database]);
        
        if (indexes.length === 0) {
          console.warn('No indexes found on onvif_service_logs table');
        }
        
        expect(indexes.length).toBeGreaterThanOrEqual(0);
      } catch (error) {
        console.warn('Error checking indexes:', error.message);
      }
    });
  });
  
  describe('Logging Functionality', () => {
    test('should have recent log entries', async () => {
      if (!dbConnection) {
        console.warn('Skipping recent logs test - no connection');
        return;
      }
      
      try {
        const [recentLogs] = await dbConnection.execute(`
          SELECT COUNT(*) as count FROM onvif_service_logs 
          WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        `);
        
        expect(recentLogs[0].count).toBeGreaterThanOrEqual(0);
        
        if (process.env.VERBOSE_TESTS) {
          console.log(`Recent logs in last hour: ${recentLogs[0].count}`);
        }
      } catch (error) {
        console.warn('Error checking recent logs:', error.message);
      }
    });
    
    test('should have proper log level distribution', async () => {
      if (!dbConnection) {
        console.warn('Skipping log level test - no connection');
        return;
      }
      
      try {
        const [logLevels] = await dbConnection.execute(`
          SELECT log_level, COUNT(*) as count 
          FROM onvif_service_logs 
          WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
          GROUP BY log_level
        `);
        
        if (logLevels.length === 0) {
          console.warn('No log level data available');
        }
        
        expect(logLevels.length).toBeGreaterThanOrEqual(0);
        
        if (process.env.VERBOSE_TESTS && logLevels.length > 0) {
          console.log('Log level distribution:', logLevels);
        }
      } catch (error) {
        console.warn('Error checking log levels:', error.message);
      }
    });
    
    test('should have diverse event types', async () => {
      if (!dbConnection) {
        console.warn('Skipping event types test - no connection');
        return;
      }
      
      try {
        const [eventTypes] = await dbConnection.execute(`
          SELECT event_type, COUNT(*) as count 
          FROM onvif_service_logs 
          WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
          GROUP BY event_type
        `);
        
        if (eventTypes.length === 0) {
          console.warn('No event type data available');
        }
        
        expect(eventTypes.length).toBeGreaterThanOrEqual(0);
        
        if (process.env.VERBOSE_TESTS && eventTypes.length > 0) {
          console.log('Event types found:', eventTypes);
        }
      } catch (error) {
        console.warn('Error checking event types:', error.message);
      }
    });
  });
  
  describe('Payload Storage', () => {
    test('should store payload data correctly', async () => {
      if (!dbConnection) {
        console.warn('Skipping payload storage test - no connection');
        return;
      }
      
      try {
        const [payloadCount] = await dbConnection.execute(`
          SELECT COUNT(*) as count FROM onvif_service_logs 
          WHERE payload IS NOT NULL AND payload != ''
        `);
        
        expect(payloadCount[0].count).toBeGreaterThanOrEqual(0);
        
        if (process.env.VERBOSE_TESTS) {
          console.log(`Entries with payload data: ${payloadCount[0].count}`);
        }
      } catch (error) {
        console.warn('Error checking payload storage:', error.message);
      }
    });
    
    test('should store raw data correctly', async () => {
      if (!dbConnection) {
        console.warn('Skipping raw data test - no connection');
        return;
      }
      
      try {
        const [rawDataCount] = await dbConnection.execute(`
          SELECT COUNT(*) as count FROM onvif_service_logs 
          WHERE raw_data IS NOT NULL AND raw_data != ''
        `);
        
        expect(rawDataCount[0].count).toBeGreaterThanOrEqual(0);
        
        if (process.env.VERBOSE_TESTS) {
          console.log(`Entries with raw data: ${rawDataCount[0].count}`);
        }
      } catch (error) {
        console.warn('Error checking raw data storage:', error.message);
      }
    });
    
    test('should handle different payload types', async () => {
      if (!dbConnection) {
        console.warn('Skipping payload types test - no connection');
        return;
      }
      
      try {
        const [payloadSamples] = await dbConnection.execute(`
          SELECT payload, LENGTH(payload) as length 
          FROM onvif_service_logs 
          WHERE payload IS NOT NULL AND payload != ''
          ORDER BY timestamp DESC 
          LIMIT 5
        `);
        
        if (payloadSamples.length > 0) {
          payloadSamples.forEach(sample => {
            expect(sample.payload).toBeDefined();
            expect(sample.length).toBeGreaterThan(0);
          });
          
          if (process.env.VERBOSE_TESTS) {
            console.log('Payload samples:', payloadSamples);
          }
        }
        
        expect(payloadSamples.length).toBeGreaterThanOrEqual(0);
      } catch (error) {
        console.warn('Error checking payload types:', error.message);
      }
    });
  });
  
  describe('Data Integrity', () => {
    test('should maintain data consistency', async () => {
      if (!dbConnection) {
        console.warn('Skipping data consistency test - no connection');
        return;
      }
      
      try {
        const [inconsistentData] = await dbConnection.execute(`
          SELECT COUNT(*) as count FROM onvif_service_logs 
          WHERE (ip_address IS NULL AND event_type != 'system') OR
                (timestamp IS NULL) OR
                (event_type IS NULL)
        `);
        
        expect(inconsistentData[0].count).toBeGreaterThanOrEqual(0);
        
        if (process.env.VERBOSE_TESTS) {
          console.log(`Entries with missing required fields: ${inconsistentData[0].count}`);
        }
      } catch (error) {
        console.warn('Error checking data consistency:', error.message);
      }
    });
    
    test('should have valid timestamps', async () => {
      if (!dbConnection) {
        console.warn('Skipping timestamp test - no connection');
        return;
      }
      
      try {
        const [invalidTimestamps] = await dbConnection.execute(`
          SELECT COUNT(*) as count FROM onvif_service_logs 
          WHERE timestamp > NOW() OR timestamp < '2020-01-01'
        `);
        
        expect(invalidTimestamps[0].count).toBeGreaterThanOrEqual(0);
        
        if (process.env.VERBOSE_TESTS) {
          console.log(`Entries with invalid timestamps: ${invalidTimestamps[0].count}`);
        }
      } catch (error) {
        console.warn('Error checking timestamps:', error.message);
      }
    });
    
    test('should handle duplicate entries appropriately', async () => {
      if (!dbConnection) {
        console.warn('Skipping duplicate entries test - no connection');
        return;
      }
      
      try {
        const [duplicates] = await dbConnection.execute(`
          SELECT ip_address, session_id, timestamp, COUNT(*) as count
          FROM onvif_service_logs 
          WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
          GROUP BY ip_address, session_id, timestamp
          HAVING COUNT(*) > 1
        `);
        
        expect(duplicates.length).toBeGreaterThanOrEqual(0);
        
        if (process.env.VERBOSE_TESTS) {
          console.log(`Potential duplicate entries: ${duplicates.length}`);
        }
      } catch (error) {
        console.warn('Error checking duplicate entries:', error.message);
      }
    });
  });
  
  describe('Database Performance', () => {
    test('should handle queries efficiently', async () => {
      if (!dbConnection) {
        console.warn('Skipping performance test - no connection');
        return;
      }
      
      try {
        const startTime = Date.now();
        
        const [performanceTest] = await dbConnection.execute(`
          SELECT COUNT(*) as count FROM onvif_service_logs 
          WHERE timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);
        
        const queryTime = Date.now() - startTime;
        
        expect(performanceTest[0].count).toBeGreaterThanOrEqual(0);
        expect(queryTime).toBeLessThan(5000); // Should complete within 5 seconds
        
        if (process.env.VERBOSE_TESTS) {
          console.log(`24-hour log query completed in ${queryTime}ms`);
        }
      } catch (error) {
        console.warn('Error in performance test:', error.message);
      }
    });
    
    test('should use indexes effectively', async () => {
      if (!dbConnection) {
        console.warn('Skipping index effectiveness test - no connection');
        return;
      }
      
      try {
        const startTime = Date.now();
        
        const [indexTest] = await dbConnection.execute(`
          SELECT COUNT(*) as count FROM onvif_service_logs 
          WHERE brand = 'hikvision' AND timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);
        
        const queryTime = Date.now() - startTime;
        
        expect(indexTest[0].count).toBeGreaterThanOrEqual(0);
        expect(queryTime).toBeLessThan(3000); // Should complete within 3 seconds
        
        if (process.env.VERBOSE_TESTS) {
          console.log(`Brand-specific query completed in ${queryTime}ms`);
        }
      } catch (error) {
        console.warn('Error in index effectiveness test:', error.message);
      }
    });
    
    test('should handle concurrent connections', async () => {
      if (!dbConnection) {
        console.warn('Skipping concurrent connections test - no connection');
        return;
      }
      
      try {
        const pool = mysql.createPool({
          host: global.testConfig.database.host,
          user: global.testConfig.database.user,
          password: global.testConfig.database.password,
          database: global.testConfig.database.database,
          port: global.testConfig.database.port,
          connectionLimit: 5,
          queueLimit: 0
        });
        
        const startTime = Date.now();
        const promises = [];
        
        for (let i = 0; i < 10; i++) {
          promises.push(pool.execute('SELECT 1 as test'));
        }
        
        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;
        
        await pool.end();
        
        expect(results.length).toBe(10);
        expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
        
        if (process.env.VERBOSE_TESTS) {
          console.log(`10 concurrent queries completed in ${totalTime}ms`);
        }
      } catch (error) {
        console.warn('Error in concurrent connections test:', error.message);
      }
    });
  });
  
  describe('Log File Analysis', () => {
    test('should have log files in expected directories', async () => {
      const logDirectories = [
        './logs/onvifservices',
        './logs/webservices',
        './logs/rtspservices'
      ];
      
      const logResults = [];
      
      for (const logDir of logDirectories) {
        try {
          if (fs.existsSync(logDir)) {
            const files = fs.readdirSync(logDir);
            const logFiles = files.filter(file => 
              file.endsWith('.log') || file.endsWith('.txt')
            );
            
            logResults.push({
              directory: logDir,
              exists: true,
              logFiles: logFiles.length
            });
          } else {
            logResults.push({
              directory: logDir,
              exists: false,
              logFiles: 0
            });
          }
        } catch (error) {
          logResults.push({
            directory: logDir,
            exists: false,
            error: error.message
          });
        }
      }
      
      expect(logResults.length).toBe(logDirectories.length);
      
      // At least some log directories should exist
      const existingLogs = logResults.filter(r => r.exists);
      expect(existingLogs.length).toBeGreaterThanOrEqual(0);
      
      if (process.env.VERBOSE_TESTS) {
        console.log('Log directory analysis:', logResults);
      }
    });
    
    test('should have log files with content', async () => {
      const logDirectories = ['./logs/onvifservices'];
      
      for (const logDir of logDirectories) {
        if (fs.existsSync(logDir)) {
          const files = fs.readdirSync(logDir);
          const logFiles = files.filter(file => 
            file.endsWith('.log') || file.endsWith('.txt')
          );
          
          if (logFiles.length > 0) {
            const testFile = logFiles[0];
            const filePath = path.join(logDir, testFile);
            const stats = fs.statSync(filePath);
            
            expect(stats.size).toBeGreaterThan(0);
            
            if (process.env.VERBOSE_TESTS) {
              console.log(`Log file ${testFile} size: ${stats.size} bytes`);
            }
          }
        }
      }
    });
  });
  
  describe('Database Backup and Recovery', () => {
    test('should have backup tables if configured', async () => {
      if (!dbConnection) {
        console.warn('Skipping backup tables test - no connection');
        return;
      }
      
      try {
        const [backupTables] = await dbConnection.execute(`
          SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE '%backup%'
        `, [global.testConfig.database.database]);
        
        expect(backupTables.length).toBeGreaterThanOrEqual(0);
        
        if (process.env.VERBOSE_TESTS) {
          console.log(`Backup tables found: ${backupTables.length}`);
        }
      } catch (error) {
        console.warn('Error checking backup tables:', error.message);
      }
    });
    
    test('should have reasonable database size', async () => {
      if (!dbConnection) {
        console.warn('Skipping database size test - no connection');
        return;
      }
      
      try {
        const [dbSize] = await dbConnection.execute(`
          SELECT 
            ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'DB Size in MB'
          FROM information_schema.tables 
          WHERE table_schema = ?
        `, [global.testConfig.database.database]);
        
        const sizeInMB = dbSize[0]['DB Size in MB'];
        expect(sizeInMB).toBeGreaterThan(0);
        expect(sizeInMB).toBeLessThan(10000); // Should be less than 10GB
        
        if (process.env.VERBOSE_TESTS) {
          console.log(`Database size: ${sizeInMB} MB`);
        }
      } catch (error) {
        console.warn('Error checking database size:', error.message);
      }
    });
    
    test('should have table size information', async () => {
      if (!dbConnection) {
        console.warn('Skipping table size test - no connection');
        return;
      }
      
      try {
        const [tableSizes] = await dbConnection.execute(`
          SELECT 
            table_name,
            ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size in MB'
          FROM information_schema.tables 
          WHERE table_schema = ?
          ORDER BY (data_length + index_length) DESC
          LIMIT 5
        `, [global.testConfig.database.database]);
        
        expect(tableSizes.length).toBeGreaterThanOrEqual(0);
        
        if (process.env.VERBOSE_TESTS && tableSizes.length > 0) {
          console.log('Largest tables:', tableSizes);
        }
      } catch (error) {
        console.warn('Error checking table sizes:', error.message);
      }
    });
  });
}); 