# SweetCam Port Manager

The SweetCam Port Manager is a CLI tool designed to manage port configurations for all SweetCam honeypot services. It provides an intuitive interface for changing service ports, checking port availability and automatically updating Docker Compose configurations.

> **Current deployment note:** for the latest camera deployments, prefer the
> Compose override files documented in `CUSTOM_CAMERA_DEPLOYMENT_TUTORIAL.md`.
> The single-camera override files already expose the realistic public ports
> used for deployment: web on `80`, RTSP on `554`, ONVIF HTTP on `8080`, and
> WS-Discovery on UDP `3702`. The Port Manager is still useful for manual
> experiments, but it should not be needed for the normal MediaMTX-based setup.

## Features

- **Port Availability Checking**: Automatically verifies if a port is available before making changes
- **Automatic Configuration Updates**: Modifies `docker-compose.yml` files automatically
- **User Confirmation**: Prompts for confirmation before making port changes
- **Container Management**: Automatically stops, rebuilds and restarts containers after port changes
- **Service Discovery**: Lists all available services and their current port configurations
- **Error Handling**: Error handling with helpful error messages

## Supported Services

The Port Manager supports all SweetCam services:

## Installation

The Port Manager is included with SweetCam and requires Node.js to run:

```shell
# Ensure Node.js is installed
node --version

# Make the script executable (optional)
chmod +x port-manager.js
```

## Usage

### Basic Commands

```shell
# Show help
node port-manager.js help

# List current port configuration
node port-manager.js list

# Change port for a service
node port-manager.js change <service_name> <new_port>
```

### Examples

#### List Current Port Configuration
```shell
node port-manager.js list
```

**Output:**
```
SweetCam Port Configuration:

Service                  Current Port    Internal Port   Status
----------------------------------------------------------------------
web_service             3000           3000           Available
axis_service            10000          10000          Available
dahua_service           37777          37777          Available
hikvision_service       80             80             In Use
mobotix_service         443            443            Available
reolink_service         8081           8081           Available
vstarcam_service        81             81             Available
rtsp_h264_media        8554-8560      8554           Available
rtsp_main              554            554            Legacy fallback
rtsp_hikvision         8655           8554           Legacy fallback
rtsp_dahua             8656           8555           Legacy fallback
rtsp_axis              8657           8556           Legacy fallback
rtsp_reolink           8658           8557           Legacy fallback
rtsp_mobotix           8659           8558           Legacy fallback
rtsp_vstarcam          8660           8559           Legacy fallback
onvif_service          3702           3702           Available
onvif_dahua_service    3703           3702           Available
onvif_axis_service     3704           3702           Available
onvif_reolink_service  3705           3702           Available
onvif_mobotix_service  3706           3702           Available
onvif_vstarcam_service 3707           3702           Available
mysql_service          3306           3306           Available
cowrie_service         N/A            N/A            Not configured
```

#### Change Service Port
```shell
node port-manager.js change dahua_service 8080
```

**Output:**
```
Port Change Request:
Service: dahua_service
New Port: 8080

Are you sure you want to change dahua_service from port 37777 to port 8080? (y/N): y

Updating docker-compose.yml...
Port updated successfully for dahua_service to 8080

Stopping container dahua_service...
Removing container dahua_service...
Rebuilding and starting container dahua_service...
Container dahua_service rebuilt successfully

Successfully changed port for dahua_service from 37777 to 8080!
```

## How It Works

For current single-camera deployments, prefer editing or selecting the matching
override file instead of changing ports manually:

```text
docker-compose.hikvision-single.yml
docker-compose.dahua-single.yml
docker-compose.axis-single.yml
docker-compose.reolink-single.yml
```

Those overrides use Compose `!override` and `!reset` rules to replace the public
ports cleanly without editing the base `docker-compose.yml`.

### 1. Port Availability Check
The tool first checks if the requested port is available using `netstat`:
```shell
netstat -tuln | grep ":<port> "
```

### 2. Configuration Update
It parses the `docker-compose.yml` file and updates the port mapping for the specified service:
```yaml
# Before
ports:
  - "37777:37777"

# After
ports:
  - "8080:37777"
```

### 3. Container Rebuild
The tool automatically:
1. Stops the container
2. Removes the container
3. Rebuilds and starts the container with the new configuration

## Error Handling

The Port Manager includes error handling:

- **Service Not Found**: Lists all available services
- **Port Already in Use**: Suggests choosing a different port
- **Invalid Port Number**: Ensures port is between 1-65535
- **Configuration Errors**: Provides detailed error messages
- **Docker Errors**: Handles Docker Compose failures gracefully

## Troubleshooting

### Common Issues

#### Port Already in Use
```shell
# Check what's using the port
sudo netstat -tulpn | grep :80

# Kill the process using the port
sudo fuser -k 80/tcp
```

#### Permission Denied
```shell
# Ensure you have Docker permissions
sudo usermod -aG docker $USER
# Log out and back in or run with sudo
sudo node port-manager.js change <service> <port>
```

#### Docker Compose Not Found
```shell
# Ensure Docker Compose is installed
docker compose version

# If using older version, use docker-compose instead
# Update the port-manager.js file accordingly
```
