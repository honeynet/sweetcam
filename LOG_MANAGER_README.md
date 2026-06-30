# SweetCam Honeypot Log Manager

A Node.js tool for managing and analyzing logs from all honeypot services (Web, RTSP, ONVIF) with Docker container support.

## Features

- **Multi-service support**: Web, RTSP, and ONVIF services
- **Docker integration**: Read logs directly from Docker containers
- **Event type filtering**: Filter by specific event types
- **Log level filtering**: Filter by info, error, warn, debug
- **Time-based filtering**: Custom date ranges
- **IP address filtering**: Filter by specific IP addresses
- **Brand filtering**: Filter by camera brands
- **Log analysis**: Statistical analysis of log data
- **Search functionality**: Text search in logs
- **Old log cleanup**: Delete logs older than specified days
- **Date-specific deletion**: Delete logs from specific dates
- **JSON file support**: Handle both .log and .json files
- **Password display**: Show passwords in authentication logs
- **Dry run mode**: Safe deletion with preview
- **Color-coded output**: Easy-to-read formatted output
- **Cross-container support**: Manage logs across all service containers

## Installation

1. Make sure you have Node.js installed
2. Make sure Docker containers are running
3. The script is ready to use:
   ```shell
   node log_manager.js --help
   ```

## Usage

### Basic Usage

```shell
# Show all logs from Docker containers
node log_manager.js --docker

# Show logs for specific service
node log_manager.js --docker --service web
node log_manager.js --docker --service rtsp
node log_manager.js --docker --service onvif

# Show logs for specific date
node log_manager.js --docker --date 2025-08-14

# Show logs from local files (if available)
node log_manager.js --service web
```

### Filtering Options

```shell
# Filter by event types
node log_manager.js --docker --event-types login_attempt auth_failure
node log_manager.js --docker --event-types soap_request connection_event

# Filter by log levels
node log_manager.js --docker --log-levels error warn
node log_manager.js --docker --log-levels info

# Filter by date range
node log_manager.js --docker --start-date 2025-08-01 --end-date 2025-08-02

# Filter by IP addresses
node log_manager.js --docker --ip-addresses 192.168.1.100 10.0.0.1

# Filter by brands
node log_manager.js --docker --brands hikvision dahua axis
```

### Analysis and Statistics

```shell
# Perform log analysis
node log_manager.js --docker --analyze

# Show passwords in authentication logs
node log_manager.js --docker --show-passwords

# Limit number of displayed entries
node log_manager.js --docker --limit 50
```

### Search Functionality

```shell
# Search for specific text
node log_manager.js --docker --search "admin"

# Case-sensitive search
node log_manager.js --docker --search "Admin" --case-sensitive

# Search in specific service
node log_manager.js --docker --search "password" --service web
```

### Log Management

```shell
# Preview old logs (dry run)
node log_manager.js --docker --delete-old 7

# Actually delete old logs
node log_manager.js --docker --delete-old 7 --execute

# Delete today's logs (use negative number)
node log_manager.js --docker --delete-old -1 --execute

# Delete old logs for specific service
node log_manager.js --docker --delete-old 30 --service web --execute

# Delete logs from specific date (NEW!)
node log_manager.js --docker --delete-by-date 2025-08-30 --execute

# Delete logs from specific date for specific service
node log_manager.js --docker --delete-by-date 2025-08-30 --service onvif --execute

# Preview deletion by date (dry run)
node log_manager.js --docker --delete-by-date 2025-08-30
```

## Docker Integration

The `--docker` flag enables reading logs from the running Docker deployment.
Most useful analysis should be done from the MySQL tables because the current
services write structured events there.

The important containers are:

- **web_service**: internal backend logs, RTSP authorization decisions, and shared service events
- **vendor web services**: `hikvision_service`, `dahua_service`, `axis_service`, `reolink_service`, etc.
- **rtsp_h264_media_service**: MediaMTX runtime logs for the public H.264 RTSP server
- **rtsp_h264_publisher_*_service**: FFmpeg publisher containers for each stream
- **onvif_service** and vendor ONVIF services: ONVIF SOAP and WS-Discovery logs
- **cowrie-services**: SSH honeypot logs

### Docker Container Mapping

| Area | Current Containers | Main Persistent Data |
|---------|------------------------------|------------------------------|
| Web | `web_service`, vendor web containers | `web_service_logs`, `service_logs` |
| RTSP public stream | `rtsp_h264_media_service`, `rtsp_h264_publisher_*_service` | `rtsp_service_logs`, MediaMTX container logs |
| RTSP legacy fallback | `rtsp_main_service`, `rtsp_hikvision_service`, etc. if started manually | `rtsp_service_logs` |
| ONVIF | `onvif_service`, `onvif_dahua_service`, `onvif_axis_service`, etc. | `onvif_service_logs` |
| SSH | `cowrie-services` | `cowrie_service_logs` |

For current deployments, the realistic public RTSP traffic is handled by
MediaMTX. The old Node RTSP containers are only relevant if they are started
explicitly as legacy/fallback services.

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
- `database_auth`: Database authentication events

For MediaMTX deployments, RTSP authorization and request metadata are logged by
the web backend hooks and stored in `rtsp_service_logs`. MediaMTX itself also
prints runtime connection and publisher status to the Docker logs of
`rtsp_h264_media_service`.

### ONVIF Services
- `soap_request`: SOAP requests
- `connection_event`: Connection events
- `ws_discovery`: WS-Discovery events
- `device_info_request`: Device information requests
- `service_event`: General service events

## Examples

### 1. Check Recent Authentication Failures
```shell
node log_manager.js --docker --event-types auth_failure --log-levels error warn --limit 20
```

### 2. Analyze ONVIF Activity by Brand
```shell
node log_manager.js --docker --service onvif --brands hikvision dahua --analyze
```

### 3. Search for Suspicious IP Activity
```shell
node log_manager.js --docker --ip-addresses 192.168.1.100 --analyze
```

### 4. Check RTSP Service Management
```shell
node log_manager.js --docker --service web --event-types rtsp_management rtsp_service_toggle
```

### 5. Find Failed Login Attempts with Passwords
```shell
node log_manager.js --docker --event-types auth_failure --show-passwords --limit 10
```

### 6. Clean Up Old Logs (Preview)
```shell
node log_manager.js --docker --delete-old 7 --service web
```

### 7. Delete Today's Logs
```shell
node log_manager.js --docker --delete-old -1 --execute
```

### 8. Comprehensive Analysis
```shell
node log_manager.js --docker --start-date 2025-08-01 --end-date 2025-08-02 --analyze
```

### 9. Monitor Specific Attack Patterns
```shell
node log_manager.js --docker --search "sql injection" --case-sensitive
node log_manager.js --docker --search "xss" --case-sensitive
```

### 10. View All Recent Activity
```shell
node log_manager.js --docker --limit 100
```

### 11. Check Service Startup Events
```shell
node log_manager.js --docker --event-types service_event --search "started"
```

### 12. Monitor Database Authentication
```shell
node log_manager.js --docker --service rtsp --event-types database_auth
```

### 13. Delete Today's Logs and JSON Files (NEW!)
```shell
node log_manager.js --docker --delete-by-date 2025-08-30 --execute
```

### 14. Clean Up Specific Date for All Services
```shell
node log_manager.js --docker --delete-by-date 2025-08-29 --execute
```

### 15. Delete Audit JSON Files from Specific Date
```shell
node log_manager.js --docker --delete-by-date 2025-08-30 --service onvif --execute
```

## Log Deletion Guidelines

### Understanding `--delete-old` Parameter

- `--delete-old 0`: Delete files **older than 0 days** (yesterday and earlier)
- `--delete-old 1`: Delete files **older than 1 day** (day before yesterday and earlier)
- `--delete-old 7`: Delete files **older than 7 days** (keep last week)
- `--delete-old -1`: Delete files **older than -1 days** (today's files)

### Understanding `--delete-by-date` Parameter (NEW!)

- `--delete-by-date 2025-08-30`: Delete files **from August 30, 2025**
- `--delete-by-date 2025-08-29`: Delete files **from August 29, 2025**
- `--delete-by-date 2025-08-28`: Delete files **from August 28, 2025**

### When to Use Each Method

- **Use `--delete-old`** when you want to keep logs from the last N days
- **Use `--delete-by-date`** when you want to delete logs from a specific date
- **Use `--delete-by-date`** for precise cleanup of specific dates
- **Use `--delete-old`** for regular maintenance cleanup

### Recommended Cleanup Schedule

```shell
# Daily: Clean up logs older than 30 days
node log_manager.js --docker --delete-old 30 --execute

# Weekly: Clean up logs older than 7 days (if needed)
node log_manager.js --docker --delete-old 7 --execute

# Emergency: Clean up today's logs
node log_manager.js --docker --delete-old -1 --execute

# Specific date cleanup (NEW!)
node log_manager.js --docker --delete-by-date 2025-08-30 --execute
```

### File Types Supported

The Log Manager now supports both file types:
- **`.log` files**: Traditional log files with date patterns
- **`.json` files**: Audit files, configuration files, and other JSON data
- **Date pattern files**: Files with names like `app-2025-08-30.log` or `data-2025-08-30.json`
- **Non-pattern files**: Files like `.017fa2c86641803faec32927dcb40f1108374ed9-audit.json` (deleted by modification time)

## Troubleshooting

### Common Issues

1. **"No old log files found to delete"**
   - This is normal if all logs are from today
   - Use `--delete-old -1` to delete today's files

2. **"Container not found"**
   - Ensure Docker containers are running
   - Check container names with `docker ps`

3. **"Logs directory not found"**
   - Use `--docker` flag to read from containers
   - Or ensure local logs directory exists

### Performance Tips

- Use `--limit` to restrict output size
- Use `--service` to focus on specific services
- Use `--date` to limit time range
- Use `--execute` only when ready to delete

## Advanced Usage

### Custom Log Directory (Local Files)
```shell
node log_manager.js --logs-dir /path/to/logs --service web
```

### New Features in Latest Version

#### Date-Specific Deletion
```shell
# Delete all files from a specific date
node log_manager.js --delete-by-date 2025-08-30 --execute

# Delete files from specific date for specific service
node log_manager.js --delete-by-date 2025-08-30 --service onvif --execute

# Preview what would be deleted
node log_manager.js --delete-by-date 2025-08-30
```

#### JSON File Support
```shell
# The Log Manager now automatically detects and handles:
# - .log files (traditional logs)
# - .json files (audit files, configs, etc.)
# - Files with date patterns in names
# - Files without date patterns (using modification time)
```

### Combined Filters
```shell
node log_manager.js --docker --service web --event-types auth_failure --log-levels error --limit 50 --show-passwords
```

### Real-time Monitoring
```shell
# Monitor logs every 30 seconds
watch -n 30 'node log_manager.js --docker --limit 10'
```
