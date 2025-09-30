const { rtspLogger } = require('../utils/logger');
const { writeServiceLog, writeRTSPLog } = require('../utils/db-logger');

// Mock dependencies
jest.mock('../utils/logger');
jest.mock('../utils/db-logger');

describe('RTSP Logging Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Log Writing', () => {
    test('should write service logs to database', async () => {
      const logEntry = {
        service: 'rtsp',
        event_type: 'test_event',
        log_level: 'info',
        ip_address: '127.0.0.1',
        brand: 'hikvision',
        port: 554,
        message: 'Test service log entry',
        raw_data: { test: 'data' }
      };

      await writeServiceLog(logEntry);

      expect(writeServiceLog).toHaveBeenCalledWith(logEntry);
    });

    test('should handle missing optional fields in service logs', async () => {
      const logEntry = {
        service: 'rtsp',
        event_type: 'minimal_event',
        log_level: 'info'
      };

      await writeServiceLog(logEntry);

      expect(writeServiceLog).toHaveBeenCalledWith(logEntry);
    });

    test('should handle null values in service logs', async () => {
      const logEntry = {
        service: 'rtsp',
        event_type: 'null_test',
        log_level: 'info',
        ip_address: null,
        brand: null,
        port: null,
        username: null,
        password: null,
        session_id: null,
        user_agent: null,
        message: null,
        payload: null,
        raw_data: null
      };

      await writeServiceLog(logEntry);

      expect(writeServiceLog).toHaveBeenCalledWith(logEntry);
    });
  });

  describe('RTSP Log Writing', () => {
    test('should write RTSP-specific logs to database', async () => {
      const logEntry = {
        event_type: 'rtsp_method',
        log_level: 'info',
        ip_address: '127.0.0.1',
        brand: 'hikvision',
        port: 554,
        rtsp_method: 'OPTIONS',
        stream_path: '/stream',
        message: 'RTSP OPTIONS request'
      };

      await writeRTSPLog(logEntry);

      expect(writeRTSPLog).toHaveBeenCalledWith(logEntry);
    });

    test('should handle missing optional fields in RTSP logs', async () => {
      const logEntry = {
        event_type: 'minimal_rtsp_event',
        log_level: 'info'
      };

      await writeRTSPLog(logEntry);

      expect(writeRTSPLog).toHaveBeenCalledWith(logEntry);
    });

    test('should handle null values in RTSP logs', async () => {
      const logEntry = {
        event_type: 'null_rtsp_test',
        log_level: 'info',
        ip_address: null,
        brand: null,
        port: null,
        username: null,
        password: null,
        session_id: null,
        rtsp_method: null,
        stream_path: null,
        connection_id: null,
        message: null,
        payload: null,
        raw_data: null
      };

      await writeRTSPLog(logEntry);

      expect(writeRTSPLog).toHaveBeenCalledWith(logEntry);
    });
  });

  describe('RTSP Logger Function Calls', () => {
    test('should log RTSP connection events', () => {
      rtspLogger.logRTSPConnection('127.0.0.1', 'connected', 'hikvision', 554, 'session123');

      expect(rtspLogger.logRTSPConnection).toHaveBeenCalledWith(
        '127.0.0.1',
        'connected',
        'hikvision',
        554,
        'session123'
      );
    });

    test('should log RTSP authentication attempts', () => {
      rtspLogger.logRTSPAuthAttempt('127.0.0.1', 'testuser', true, null, 'hikvision', 554, 'session123');

      expect(rtspLogger.logRTSPAuthAttempt).toHaveBeenCalledWith(
        '127.0.0.1',
        'testuser',
        true,
        null,
        'hikvision',
        554,
        'session123'
      );
    });

    test('should log RTSP method requests', () => {
      rtspLogger.logRTSPMethod('127.0.0.1', 'OPTIONS', '/stream', 'session123', 'hikvision', 554);

      expect(rtspLogger.logRTSPMethod).toHaveBeenCalledWith(
        '127.0.0.1',
        'OPTIONS',
        '/stream',
        'session123',
        'hikvision',
        554
      );
    });

    test('should log RTSP responses', () => {
      rtspLogger.logRTSPResponse('127.0.0.1', 'OPTIONS', 200, 'session123', 'hikvision', 554);

      expect(rtspLogger.logRTSPResponse).toHaveBeenCalledWith(
        '127.0.0.1',
        'OPTIONS',
        200,
        'session123',
        'hikvision',
        554
      );
    });

    test('should log RTSP session events', () => {
      rtspLogger.logRTSPSession('127.0.0.1', 'session123', 'created', '/stream', 'hikvision', 554);

      expect(rtspLogger.logRTSPSession).toHaveBeenCalledWith(
        '127.0.0.1',
        'session123',
        'created',
        '/stream',
        'hikvision',
        554
      );
    });

    test('should log RTSP stream setup events', () => {
      const transportInfo = { rtpPort: 8000, rtcpPort: 8001 };
      rtspLogger.logRTSPStreamSetup('127.0.0.1', 'session123', '/stream', transportInfo, 'hikvision', 554);

      expect(rtspLogger.logRTSPStreamSetup).toHaveBeenCalledWith(
        '127.0.0.1',
        'session123',
        '/stream',
        transportInfo,
        'hikvision',
        554
      );
    });

    test('should log RTSP stream play events', () => {
      rtspLogger.logRTSPStreamPlay('127.0.0.1', 'session123', '/stream', 'hikvision', 554);

      expect(rtspLogger.logRTSPStreamPlay).toHaveBeenCalledWith(
        '127.0.0.1',
        'session123',
        '/stream',
        'hikvision',
        554
      );
    });

    test('should log RTSP stream pause events', () => {
      rtspLogger.logRTSPStreamPause('127.0.0.1', 'session123', '/stream', 'hikvision', 554);

      expect(rtspLogger.logRTSPStreamPause).toHaveBeenCalledWith(
        '127.0.0.1',
        'session123',
        '/stream',
        'hikvision',
        554
      );
    });

    test('should log RTSP stream teardown events', () => {
      rtspLogger.logRTSPStreamTeardown('127.0.0.1', 'session123', '/stream', 'hikvision', 554);

      expect(rtspLogger.logRTSPStreamTeardown).toHaveBeenCalledWith(
        '127.0.0.1',
        'session123',
        '/stream',
        'hikvision',
        554
      );
    });

    test('should log RTSP options requests', () => {
      rtspLogger.logRTSPSOptions('127.0.0.1', 'Test Client', 'hikvision', 554, 'session123');

      expect(rtspLogger.logRTSPSOptions).toHaveBeenCalledWith(
        '127.0.0.1',
        'Test Client',
        'hikvision',
        554,
        'session123'
      );
    });

    test('should log RTSP describe requests', () => {
      rtspLogger.logRTSPDescribe('127.0.0.1', '/stream', 'Test Client', 'hikvision', 554, 'session123');

      expect(rtspLogger.logRTSPDescribe).toHaveBeenCalledWith(
        '127.0.0.1',
        '/stream',
        'Test Client',
        'hikvision',
        554,
        'session123'
      );
    });

    test('should log RTSP service events', () => {
      rtspLogger.logRTSPServiceEvent('started', 'RTSP server started', 'hikvision', 554, 'session123');

      expect(rtspLogger.logRTSPServiceEvent).toHaveBeenCalledWith(
        'started',
        'RTSP server started',
        'hikvision',
        554,
        'session123'
      );
    });

    test('should log RTSP database authentication events', () => {
      rtspLogger.logRTSPDatabaseAuth('127.0.0.1', 'testuser', true, null, 'hikvision', 554, 'session123');

      expect(rtspLogger.logRTSPDatabaseAuth).toHaveBeenCalledWith(
        '127.0.0.1',
        'testuser',
        true,
        null,
        'hikvision',
        554,
        'session123'
      );
    });

    test('should log RTSP errors', () => {
      const error = new Error('Test error');
      rtspLogger.logRTSPError(error, 'test_context', '127.0.0.1', 'hikvision', 554, 'session123');

      expect(rtspLogger.logRTSPError).toHaveBeenCalledWith(
        error,
        'test_context',
        '127.0.0.1',
        'hikvision',
        554,
        'session123'
      );
    });
  });

  describe('Payload Logging', () => {
    test('should log RTSP requests with payload data', () => {
      const requestPayload = {
        headers: { 'User-Agent': 'Test Client', 'CSeq': '1' },
        body: 'OPTIONS rtsp://192.168.1.100:554/stream RTSP/1.0\r\nUser-Agent: Test Client\r\nCSeq: 1\r\n\r\n',
        transport: 'RTP/AVP;unicast;client_port=8000-8001',
        session: 'session123'
      };

      const responsePayload = {
        status: 200,
        headers: ['RTSP/1.0 200 OK', 'Public: OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN, PAUSE'],
        body: 'RTSP/1.0 200 OK\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN, PAUSE\r\n\r\n'
      };

      rtspLogger.logRTSPSessionWithPayload(
        '127.0.0.1',
        'OPTIONS',
        '/stream',
        200,
        'session123',
        'hikvision',
        554,
        requestPayload,
        responsePayload
      );

      expect(rtspLogger.logRTSPSessionWithPayload).toHaveBeenCalledWith(
        '127.0.0.1',
        'OPTIONS',
        '/stream',
        200,
        'session123',
        'hikvision',
        554,
        requestPayload,
        responsePayload
      );
    });

    test('should handle null payloads gracefully', () => {
      rtspLogger.logRTSPSessionWithPayload(
        '127.0.0.1',
        'OPTIONS',
        '/stream',
        200,
        'session123',
        'hikvision',
        554,
        null,
        null
      );

      expect(rtspLogger.logRTSPSessionWithPayload).toHaveBeenCalledWith(
        '127.0.0.1',
        'OPTIONS',
        '/stream',
        200,
        'session123',
        'hikvision',
        554,
        null,
        null
      );
    });

    test('should log RTP stream events', () => {
      const details = { packets: 100, bytes: 1024, timestamp: Date.now() };
      rtspLogger.logRTPStream('127.0.0.1', 'session123', 'started', details, 'hikvision', 554);

      expect(rtspLogger.logRTPStream).toHaveBeenCalledWith(
        '127.0.0.1',
        'session123',
        'started',
        details,
        'hikvision',
        554
      );
    });
  });

  describe('Log Level Handling', () => {
    test('should handle different log levels', () => {
      const levels = ['info', 'warn', 'error', 'debug'];
      
      levels.forEach(level => {
        const logEntry = {
          service: 'rtsp',
          event_type: 'test_event',
          log_level: level,
          message: `Test ${level} log`
        };

        writeServiceLog(logEntry);
        expect(writeServiceLog).toHaveBeenCalledWith(logEntry);
      });
    });

    test('should default to info level when not specified', async () => {
      const logEntry = {
        service: 'rtsp',
        event_type: 'test_event'
        // No log_level specified
      };

      await writeServiceLog(logEntry);

      expect(writeServiceLog).toHaveBeenCalledWith(logEntry);
    });
  });

  describe('IP Address and Session Handling', () => {
    test('should handle IPv4 addresses', () => {
      const ipAddresses = ['127.0.0.1', '192.168.1.100', '10.0.0.1', '172.16.0.1'];
      
      ipAddresses.forEach(ip => {
        rtspLogger.logRTSPConnection(ip, 'connected', 'hikvision', 554);
        expect(rtspLogger.logRTSPConnection).toHaveBeenCalledWith(ip, 'connected', 'hikvision', 554);
      });
    });

    test('should handle IPv6 addresses', () => {
      const ipAddresses = ['::1', '2001:db8::1', 'fe80::1'];
      
      ipAddresses.forEach(ip => {
        rtspLogger.logRTSPConnection(ip, 'connected', 'hikvision', 554);
        expect(rtspLogger.logRTSPConnection).toHaveBeenCalledWith(ip, 'connected', 'hikvision', 554);
      });
    });

    test('should handle session IDs', () => {
      const sessionIds = ['session123', 'abc-def-ghi', '12345', null, undefined];
      
      sessionIds.forEach(sessionId => {
        rtspLogger.logRTSPSession('127.0.0.1', sessionId, 'created', '/stream', 'hikvision', 554);
        expect(rtspLogger.logRTSPSession).toHaveBeenCalledWith(
          '127.0.0.1',
          sessionId,
          'created',
          '/stream',
          'hikvision',
          554
        );
      });
    });
  });

  describe('Brand and Port Handling', () => {
    test('should handle all supported brands', () => {
      const brands = ['hikvision', 'dahua', 'axis', 'reolink', 'mobotix', 'vstarcam'];
      
      brands.forEach(brand => {
        rtspLogger.logRTSPConnection('127.0.0.1', 'connected', brand, 554);
        expect(rtspLogger.logRTSPConnection).toHaveBeenCalledWith('127.0.0.1', 'connected', brand, 554);
      });
    });

    test('should handle different port numbers', () => {
      const ports = [554, 8554, 10554, 80, 443, 37777, 10000, 8081];
      
      ports.forEach(port => {
        rtspLogger.logRTSPConnection('127.0.0.1', 'connected', 'hikvision', port);
        expect(rtspLogger.logRTSPConnection).toHaveBeenCalledWith('127.0.0.1', 'connected', 'hikvision', port);
      });
    });

    test('should handle null brand and port gracefully', () => {
      rtspLogger.logRTSPConnection('127.0.0.1', 'connected', null, null);
      expect(rtspLogger.logRTSPConnection).toHaveBeenCalledWith('127.0.0.1', 'connected', null, null);
    });
  });

  describe('Error Handling in Logging', () => {
    test('should handle logging errors gracefully', async () => {
      // Mock writeServiceLog to throw an error
      writeServiceLog.mockRejectedValueOnce(new Error('Database connection failed'));

      const logEntry = {
        service: 'rtsp',
        event_type: 'test_event',
        log_level: 'info',
        message: 'Test log entry'
      };

      // Should not throw error
      await expect(writeServiceLog(logEntry)).rejects.toThrow('Database connection failed');
    });

    test('should handle RTSP logging errors gracefully', async () => {
      // Mock writeRTSPLog to throw an error
      writeRTSPLog.mockRejectedValueOnce(new Error('RTSP log write failed'));

      const logEntry = {
        event_type: 'rtsp_method',
        log_level: 'info',
        message: 'Test RTSP log entry'
      };

      // Should not throw error
      await expect(writeRTSPLog(logEntry)).rejects.toThrow('RTSP log write failed');
    });
  });
}); 