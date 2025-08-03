# SweetCam Honeypot Log Manager

A Node.js tool for managing and analyzing logs from all honeypot services (Web, RTSP, ONVIF).

## Features

- **Multi-service support**: Web, RTSP, and ONVIF services
- **Event type filtering**: Filter by specific event types
- **Log level filtering**: Filter by info, error, warn, debug
- **Time-based filtering**: Custom date ranges
- **IP address filtering**: Filter by specific IP addresses
- **Brand filtering**: Filter by camera brands
- **Log analysis**: Statistical analysis of log data
- **Search functionality**: Text search in logs
- **Old log cleanup**: Delete logs older than specified days
- **Password display**: Show passwords in authentication logs
- **Dry run mode**: Safe deletion with preview
- **Color-coded output**: Easy-to-read formatted output

## Installation

1. Make sure you have Node.js installed
2. Make the script executable:
   ```shell
   chmod +x log_manager.js
   ```

## Usage

### Basic Usage

```shell
# Show all logs
node log_manager.js

# Show logs for specific service
node log_manager.js --service web
node log_manager.js --service rtsp
node log_manager.js --service onvif

# Show logs for specific date
node log_manager.js --date 2025-08-02
```

### Filtering Options

```shell
# Filter by event types
node log_manager.js --event-types login_attempt auth_failure
node log_manager.js --event-types soap_request connection_event

# Filter by log levels
node log_manager.js --log-levels error warn
node log_manager.js --log-levels info

# Filter by date range
node log_manager.js --start-date 2025-08-01 --end-date 2025-08-02

# Filter by IP addresses
node log_manager.js --ip-addresses 192.168.1.100 10.0.0.1

# Filter by brands
node log_manager.js --brands hikvision dahua axis
```

### Analysis and Statistics

```shell
# Perform log analysis
node log_manager.js --analyze

# Show passwords in authentication logs
node log_manager.js --show-passwords

# Limit number of displayed entries
node log_manager.js --limit 50
```

### Search Functionality

```shell
# Search for specific text
node log_manager.js --search "admin"

# Case-sensitive search
node log_manager.js --search "Admin" --case-sensitive

# Search in specific service
node log_manager.js --search "password" --service web
```

### Log Management

```shell
# Preview old logs (dry run)
node log_manager.js --delete-old 30

# Actually delete old logs
node log_manager.js --delete-old 30 --execute

# Delete old logs for specific service
node log_manager.js --delete-old 30 --service web --execute
```

## Event Types by Service

### Web Services
- `login_attempt`: User login attempts
- `auth_failure`: Authentication failures
- `rtsp_management`: RTSP service management
- `rtsp_service_toggle`: RTSP service enable/disable
- `service_event`: General service events
- `service_access`: HTTP service access

### RTSP Services
- `rtsp_method`: RTSP method calls
- `connection_event`: Connection events
- `service_event`: General service events
- `auth_attempt`: Authentication attempts

### ONVIF Services
- `soap_request`: SOAP requests
- `connection_event`: Connection events
- `ws_discovery`: WS-Discovery events
- `device_info_request`: Device information requests
- `service_event`: General service events

## Examples

### 1. Check Recent Authentication Failures
```shell
node log_manager.js --event-types auth_failure --log-levels error warn --limit 20
```

### 2. Analyze ONVIF Activity by Brand
```shell
node log_manager.js --service onvif --brands hikvision dahua --analyze
```

### 3. Search for Suspicious IP Activity
```shell
node log_manager.js --ip-addresses 192.168.1.100 --analyze
```

### 4. Check RTSP Service Management
```shell
node log_manager.js --service web --event-types rtsp_management rtsp_service_toggle
```

### 5. Find Failed Login Attempts with Passwords
```shell
node log_manager.js --event-types auth_failure --show-passwords --limit 10
```

### 6. Clean Up Old Logs (Preview)
```shell
node log_manager.js --delete-old 7 --service web
```

### 7. Comprehensive Analysis
```shell
node log_manager.js --start-date 2025-08-01 --end-date 2025-08-02 --analyze
```

### 8. Monitor Specific Attack Patterns
```shell
node log_manager.js --search "sql injection" --case-sensitive
node log_manager.js --search "xss" --case-sensitive
```

### Custom Log Directory
```shell
node log_manager.js --logs-dir /path/to/logs --service web
```
