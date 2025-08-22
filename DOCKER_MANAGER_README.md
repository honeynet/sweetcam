# SweetCam Docker Manager

The SweetCam Docker Manager is an interactive CLI tool that provides  management capabilities for the SweetCam honeypot environment. It offers flexible deployment options, service management, health monitoring and automated container orchestration.

## Features

- **Interactive Menu System**: User-friendly CLI interface with numbered menu options
- **Flexible Deployment Options**: Single camera, multi-camera, standard and custom setups
- **Service Management**: Start, stop, restart and remove individual services
- **Health Monitoring**: Real-time container health checks and status overview
- **Log Management**: View service logs with configurable line count (1-100)
- **Automatic Service Dependencies**: Intelligently manages service dependencies and requirements

## Supported Camera Brands

The Docker Manager supports all major IP camera brands with their specific protocols:

| Brand | SSH Support | ONVIF Support | RTSP Support | Web Interface |
|-------|-------------|---------------|--------------|----------------|
| **Axis** |  Yes |  Yes |  Yes |  Yes |
| **Dahua** |  Yes |  Yes |  Yes |  Yes |
| **Hikvision** |  Yes |  Yes |  Yes |  Yes |
| **Mobotix** |  Yes |  Yes |  Yes |  Yes |
| **Reolink** |  No |  Yes |  Yes |  Yes |
| **Vstarcam** |  No |  Yes |  Yes |  Yes |

## Installation

The Docker Manager is included with SweetCam and requires Node.js and Docker to run:

```bash
# Ensure Node.js is installed
node --version

# Ensure Docker and Docker Compose are installed
docker --version
docker compose version

# Make the script executable 
chmod +x docker-manager.js
```

## Usage

### Basic Commands

```shell
# Run the Docker Manager interactively
node docker-manager.js

# Health check only
node docker-manager.js --health-check

# Make executable and run
./docker-manager.js
```

### Interactive Menu System

When you run the Docker Manager, you'll see the main menu:

```
╔══════════════════════════════════════════════════════════════╗
║                    SweetCam Docker Manager                   ║
╚══════════════════════════════════════════════════════════════╝

Main Menu:

1. Single Camera Setup
2. Multi-Camera Setup  
3. Standard Setup (All Services)
4. Custom Setup
5. Health Check & Monitoring
6. Service Management
0. Exit

Select an option (0-6):
```

## Deployment Options

### 1. Single Camera Setup

Deploy a single camera brand with all its supported protocols:

```shell
# Select option 1 from main menu
1

# Choose camera brand
Available Camera Brands:
1. axis - SSH: YES | ONVIF: YES | RTSP: YES
2. dahua - SSH: YES | ONVIF: YES | RTSP: YES
3. hikvision - SSH: YES | ONVIF: YES | RTSP: YES
4. mobotix - SSH: YES | ONVIF: YES | RTSP: YES
5. reolink - SSH: NO | ONVIF: YES | RTSP: YES
6. vstarcam - SSH: NO | ONVIF: YES | RTSP: YES

Select camera brand: 2
```

**What gets deployed:**
- MySQL database service
- Cowrie SSH honeypot (if SSH is supported)
- Camera-specific web service
- Camera-specific ONVIF service
- Camera-specific RTSP service
- Grafana dashboard

### 2. Multi-Camera Setup

Deploy multiple camera brands simultaneously:

```shell
# Select option 2 from main menu
2

# Choose multiple cameras
Available Camera Brands:
1. axis
2. dahua
3. hikvision
4. mobotix
5. reolink
6. vstarcam

Select cameras (enter numbers separated by commas): 1,3,5
```

**What gets deployed:**
- MySQL database service
- Cowrie SSH honeypot (if any selected camera supports SSH)
- All selected camera services with their protocols
- Grafana dashboard

### 3. Standard Setup

Deploy the complete SweetCam honeypot with all services:

```shell
# Select option 3 from main menu
3
```

**What gets deployed:**
- MySQL database service
- Web service (main interface)
- Cowrie SSH honeypot
- Grafana dashboard
- All camera brands with their protocols

### 4. Custom Setup

Selectively deploy specific services:

```shell
# Select option 4 from main menu
4

# Choose from available services
Available Services:
1. mysql_service
2. web_service
3. cowrie_service
4. grafana
5. axis_service
6. dahua_service
7. hikvision_service
8. mobotix_service
9. reolink_service
10. vstarcam_service
11. onvif_service
12. onvif_dahua_service
13. onvif_axis_service
14. onvif_reolink_service
15. onvif_mobotix_service
16. onvif_vstarcam_service
17. rtsp_main
18. rtsp_hikvision
19. rtsp_dahua
20. rtsp_axis
21. rtsp_reolink
22. rtsp_mobotix
23. rtsp_vstarcam

Select services (enter numbers separated by commas): 1,2,5,17
```

## Service Management

### Accessing Service Management

Select option 6 from the main menu to access service management features:

```
Service Management

1. Start Service
2. Stop Service  
3. Restart Service
4. Service Logs
5. Remove Service
6. Back to Main Menu

Select an option (1-6):
```

### Available Operations

#### Start Service
```shell
# Select option 1
Enter service name to start: axis_service
SUCCESS: axis_service started successfully
```

#### Stop Service
```shell
# Select option 2
Enter service name to stop: dahua_service
SUCCESS: dahua_service stopped successfully
```

#### Restart Service
```shell
# Select option 3
Enter service name to restart: hikvision_service
SUCCESS: hikvision_service restarted successfully
```

#### View Service Logs
```shell
# Select option 4
Enter service name to view logs: cowrie_service
Number of log lines to show (max 100): 20

Logs for cowrie_service:
============================================================
[2024-01-15 10:30:15] INFO: SSH connection from 192.168.1.100
[2024-01-15 10:30:16] INFO: Login attempt: admin/12345
[2024-01-15 10:30:17] INFO: Login attempt: root/root
============================================================
```

#### Remove Service
```shell
# Select option 5
Enter service name to remove: vstarcam_service
Are you sure you want to remove vstarcam_service? This will stop and remove the container. (y/n): y
SUCCESS: vstarcam_service removed successfully
```

## Health Check & Monitoring

### Accessing Health Monitoring

Select option 5 from the main menu to access health monitoring:

```
Health Check & Monitoring

Service Health Status:
================================================================================
Name                    Command               State                  Ports
--------------------------------------------------------------------------------
sweetcam-axis_service   /bin/sh -c node ...   Up 2 hours            0.0.0.0:10000->10000/tcp
sweetcam-dahua_service  /bin/sh -c node ...   Up 2 hours            0.0.0.0:37777->37777/tcp
sweetcam-mysql_service  docker-entrypoint.sh  Up 2 hours            0.0.0.0:3306->3306/tcp
sweetcam-cowrie_service /bin/sh -c /usr/...  Up 2 hours            0.0.0.0:2222->2222/tcp

Summary: 4/4 services running
All services are running successfully!
```

## Service Dependencies

The Docker Manager automatically handles service dependencies:

### Required Services
- **MySQL Service**: Required by all other services for logging and data storage
- **Cowrie Service**: Automatically included if any selected camera supports SSH
- **Grafana Service**: Automatically included to view the dashboard

### Camera Service Dependencies
Each camera brand automatically includes:
- Web interface service
- ONVIF service (if supported)
- RTSP service (if supported)
- Grafana service (if supported)

## Configuration Files

The Docker Manager works with these configuration files:

- **`docker-compose.yml`**: Main Docker Compose configuration
- **`.env`**: Environment variables (auto-detected)
- **Camera Configs**: Built-in camera brand configurations

## Troubleshooting

### Common Issues

#### Permission Issues
```shell
# Ensure Docker permissions
sudo usermod -aG docker $USER
# Log out and back in or run with sudo
sudo node docker-manager.js
```
#### Port Conflicts
```shell
# Check what's using the port
sudo netstat -tulpn | grep :<port>

# Use the Port Manager to change ports
node port-manager.js change <service> <new_port>
```
