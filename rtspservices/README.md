# RTSP Server

A Real-Time Streaming Protocol (RTSP) server with authentication and brand-specific camera emulation.

## Features

- **Authentication**: RTSP streams only work with valid database credentials
- **Brand Emulation**: Supports multiple camera brands with authentic responses
- **Nmap Recognition**: Each brand appears as the correct camera version to network scanners
- **Comprehensive Logging**: All requests, responses, and payloads are logged to database
- **Session Management**: Full RTSP session lifecycle support

## Supported Camera Brands

- **Hikvision**: Port 80, authentic Hikvision DVR responses
- **Dahua**: Port 37777, authentic Dahua IP camera responses  
- **Axis**: Port 10000, authentic Axis network camera responses
- **Reolink**: Port 8081, authentic Reolink IP camera responses
- **Mobotix**: Port 443, authentic Mobotix IP camera responses
- **Vstarcam**: Port 81, authentic Vstarcam IP camera responses

## Functionality

### RTSP protocol support
- **OPTIONS** - Server capabilities discovery
- **DESCRIBE** - Stream information and SDP 
- **SETUP** - Session establishment and transport configuration 
- **PLAY** - Start video streaming 
- **PAUSE** - Pause video streaming 
- **TEARDOWN** - Session termination 

### Authentication System
The RTSP server implements **HTTP Basic Authentication** with **database integration**.

#### Authentication Methods
**URL Credentials** (VLC style):
   ```shell
   vlc rtsp://jimmy:1234567@127.0.0.1:554/stream
   ```

#### Session-Based Authentication
- Authentication is required for DESCRIBE, SETUP, PLAY, PAUSE, and TEARDOWN methods
- OPTIONS requests are allowed without authentication for client discovery
- Once authenticated during SETUP, the session remains authenticated for subsequent requests
- Username comparison is case-insensitive (e.g., 'jimmy', 'Jimmy', 'JIMMY' all work)

## Installation

```bash
npm install
```

## Configuration

Set environment variables:

```bash
export RTSP_PORT=554
export BRAND=auto  # or specific brand name
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=password
export DB_NAME=sweetcam
export DB_PORT=3306
```

## Usage

### Start Server
```bash
npm start
```

### Development Mode
```bash
npm run dev
```

## Testing

This project includes a comprehensive Jest test suite that verifies:

### Authentication Tests
- RTSP streams only work with valid database credentials
- Invalid credentials are properly rejected
- Session authentication persistence
- Database connection error handling

### Brand Detection Tests
- Port-based brand detection
- Path-based brand detection  
- User-Agent-based brand detection
- Brand configuration validation

### Nmap Recognition Tests
- Each camera brand returns authentic server signatures
- Response patterns match real camera behavior
- Port mappings are correct for each brand
- Consistent unauthorized response formats

### Logging Tests
- All RTSP requests and responses are logged
- Payload data is captured and stored
- Database logging functionality works correctly
- Error handling in logging system

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests with verbose output
npm run test:verbose

# Run tests with debug information
npm run test:debug
```

### Test Structure

```
rtspservices/
├── __tests__/
│   ├── authentication.test.js    # Authentication functionality tests
│   ├── brand-detection.test.js   # Brand detection tests
│   ├── logging.test.js          # Logging system tests
│   └── nmap-recognition.test.js # Nmap fingerprinting tests
├── rtsp.test.js                 # Main comprehensive test suite
├── jest.config.js               # Jest configuration
├── jest.setup.js                # Test setup and utilities
├── jest.global-setup.js         # Global test environment setup
└── jest.global-teardown.js      # Global test cleanup
```

### Test Coverage

The test suite aims for 80%+ coverage across:
- Branches: 80%
- Functions: 80%  
- Lines: 80%
- Statements: 80%

### Test Utilities

The test suite includes custom Jest matchers:

- `toBeValidRTSPResponse()` - Validates RTSP response format
- `toBeValidRTSPStatus()` - Checks for specific HTTP status codes
- `toBeValidPort()` - Validates port numbers
- `toBeValidIPAddress()` - Validates IP address format
- `toBeValidBrand()` - Validates camera brand names
- `toContainPayload()` - Checks for payload data in responses

### Mock System

Tests use comprehensive mocking to:
- Prevent actual network connections
- Mock database operations
- Mock file system operations
- Mock external dependencies

## Database Schema

The server logs to two main tables:

### service_logs
- General service event logging
- Includes payload data for RTSP requests/responses
- Stores authentication attempts and session events

### rtsp_service_logs  
- RTSP-specific event logging
- Detailed stream and session information
- Complete request/response payloads

## Security Features

- **Authentication Required**: All RTSP methods except OPTIONS require valid credentials
- **Session Management**: Authenticated sessions persist across requests
- **Input Validation**: All RTSP requests are parsed and validated
- **Error Handling**: Graceful handling of malformed requests and errors

## Network Scanner Compatibility

The server is designed to appear as authentic camera hardware to network scanners like nmap:

- **Port Mapping**: Each brand uses its standard port
- **Server Signatures**: Authentic server headers and response patterns
- **Protocol Compliance**: Full RTSP/1.0 protocol implementation
- **Brand Consistency**: Responses match expected camera behavior

## Development

### Adding New Camera Brands

1. Add brand configuration to `config/brand-configs.js`
2. Update brand detection logic in `utils/brand-detector.js`
3. Add corresponding tests in the test suite
4. Verify nmap recognition works correctly

### Extending Test Coverage

1. Add new test files to `__tests__/` directory
2. Use existing test utilities and mock system
3. Follow established testing patterns
4. Ensure coverage thresholds are maintained

## Troubleshooting

### Common Test Issues

- **Port Conflicts**: Ensure test port 554 is available
- **Database Connection**: Verify database credentials in test environment
- **Mock Failures**: Check that all dependencies are properly mocked
- **Timeout Issues**: Increase test timeout for network operations

### Debug Mode

Run tests with debug information:

```bash
npm run test:debug
```

This will show:
- Open handles and timers
- Network connection attempts
- Database query details
- Mock interaction logs




