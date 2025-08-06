<h1 align="center">
    <img src="./images/sweetcam.png" alt="SweetCam IP Camera" width='75%'>
   </h1>

# Introduction 

The application SweetCam is a honeypot for IP camera. It can simulate a real IP camera vividly, it can simulate the web interface of the IP camera, ONVIF and RTSP protocol. 

# Components

The SweetCam honeypot consists of **22 containers**:

### Core Services
1. **MySQL service** is service for data storage.
2. **Web service** is main web interface.
3. **Cowrie service** SSH honeypot service.


## Service Configuration

Below is the list of all services with their ports, protocols and access URLs:

| Service | Internal Port | External Port | Protocol | Purpose | Access URL | Service Name |
|---------|---------------|---------------|----------|---------|------------|--------------|
| Dahua Camera | 37777 | 37777 | HTTP | Dahua camera interface | http://localhost:37777 | `dahua_service` |
| Hikvision Camera | 80 | 80 | HTTP | Hikvision camera interface | http://localhost:80 | `hikvision_service` |
| VStarcam Camera | 81 | 81 | HTTP | VStarcam camera interface | http://localhost:81 | `vstarcam_service` |
| Mobotix Camera | 443 | 443 | HTTP | Mobotix camera interface | http://localhost:443 | `mobotix_service` |
| Axis Camera | 10000 | 10000 | HTTP | Axis camera interface | http://localhost:10000 | `axis_service` |
| Reolink Camera | 8081 | 8081 | HTTP | Reolink camera interface | http://localhost:8081 | `reolink_service` |
| RTSP Main Streaming | 554 | 554 | RTSP | Main video streaming | rtsp://localhost:554/stream | `rtsp_main` |
| RTSP Hikvision | 8554 | 8554 | RTSP | Hikvision video streaming | rtsp://localhost:8554/stream | `rtsp_hikvision` |
| RTSP Dahua | 8555 | 8555 | RTSP | Dahua video streaming | rtsp://localhost:8555/stream | `rtsp_dahua` |
| RTSP Axis | 8556 | 8556 | RTSP | Axis video streaming | rtsp://localhost:8556/stream | `rtsp_axis` |
| RTSP Reolink | 8557 | 8557 | RTSP | Reolink video streaming | rtsp://localhost:8557/stream | `rtsp_reolink` |
| RTSP Mobotix | 8558 | 8558 | RTSP | Mobotix video streaming | rtsp://localhost:8558/stream | `rtsp_mobotix` |
| RTSP VStarcam | 8559 | 8559 | RTSP | VStarcam video streaming | rtsp://localhost:8559/stream | `rtsp_vstarcam` |
| RTP Data | 8002-8017 | 8002-8017 | TCP | RTP/RTCP data for all RTSP services | - | - |
| SSH Honeypot | 2222 | 2222 | SSH | Cowrie SSH service | ssh://localhost:2222 | `cowrie_service` |
| ONVIF Hikvision | 8080, 3702 | 8080, 3702 | HTTP/UDP | Hikvision ONVIF SOAP & Discovery | http://localhost:8080 | `onvif_service` |
| ONVIF Dahua | 8086, 3703 | 8086, 3703 | HTTP/UDP | Dahua ONVIF SOAP & Discovery | http://localhost:8086 | `onvif_dahua_service` |
| ONVIF Axis | 8087, 3704 | 8087, 3704 | HTTP/UDP | Axis ONVIF SOAP & Discovery | http://localhost:8087 | `onvif_axis_service` |
| ONVIF Reolink | 8088, 3705 | 8088, 3705 | HTTP/UDP | Reolink ONVIF SOAP & Discovery | http://localhost:8088 | `onvif_reolink_service` |
| ONVIF Mobotix | 8089, 3706 | 8089, 3706 | HTTP/UDP | Mobotix ONVIF SOAP & Discovery | http://localhost:8089 | `onvif_mobotix_service` |
| ONVIF VStarcam | 8090, 3707 | 8090, 3707 | HTTP/UDP | VStarcam ONVIF SOAP & Discovery | http://localhost:8090 | `onvif_vstarcam_service` |
| MySQL Database | 3306 | 3306 | TCP | Database | - | `mysql_service` |
| Web Service | 3000 | 3000 | HTTP | Main web interface | http://localhost:3000 | `web_service` |

## Credentials to use 

### Admin
- Jonny:1234567

### Users
- Jimmy:1234567
- Admin:admin
- Admin:Admin
- admin:12345
- root:12345
- root:123456
- root:admin
- root:root
- Nancy:1234567

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Ports 22, 80, 81, 443, 554, 8554-8559, 2222, 3306, 37777, 8081, 10000, 3702-3707, 8080, 8086-8090, 8002-8017 available

### Installation

1. **Clone the repository:**
   ```shell
   git clone https://github.com/your-repo/sweetcam-GSOC.git
   cd sweetcam-GSOC
   ```

2. **Create environment file:**
   ```shell
   cp .env.example .env
   # Edit .env with your configuration
   nano .env 
   ```

3. **Start all services:**
   ```shell
   docker compose up -d
   ```

4. **Verify containers are running:**
   ```shell
   docker ps
   ```

#### Stop/start services:
```shell
# Stop all services
docker compose down
# Start all services
docker compose up -d
# Stop with volume cleanup
docker compose down -v
```

## Network access

### Port Mapping

Refer to the [Service Configuration](#service-configuration) table above for complete port mapping information.

## Port management

SweetCam includes a **Port Manager** CLI tool to easily manage port changes for Docker containers with automatic port availability checking and container restart functionality.

### Features
- Check if a port is available before changing
- Update docker-compose.yml automatically
- Ask for user confirmation before making changes
- Automatically restart the specific container after port change
- List current port configuration
- Support for all SweetCam services

### Usage

#### Method 1: Using the wrapper script (Recommended)
```shell
# Make the wrapper executable (if not already)
chmod +x ./port-manager

# Show current port configuration
./port-manager list

# Change port for a service
./port-manager change dahua_service 8080

# Show help
./port-manager help
```

#### Method 2: Using Node.js directly
```shell
# Show current port configuration
node port-manager.js list

# Change port for a service
node port-manager.js change dahua_service 8080

# Show help
node port-manager.js help
```

### Available services for port management

Refer to the [Service Configuration](#service-configuration) table above for all available services and their default ports. The "Service Name" column shows the exact service identifier to use with the port manager.

### Port management examples

#### Change Dahua service from port 37777 to 8080
```shell
./port-manager change dahua_service 8080
```

**Output:**
```
Port Change Request:
Service: dahua_service
New Port: 8080

Are you sure you want to change dahua_service from port 37777 to port 8080? (y/N): y

Updating docker-compose.yml...
Port updated in docker-compose.yml

Restarting dahua_service...
dahua_service
dahua_service restarted successfully!

Successfully changed dahua_service from port 37777 to port 8080!
```

#### List current port configuration
```shell
./port-manager list
```

**Output:**
```
Current Port Configuration:
==================================================
web_service              | Port 3000
axis_service             | Port 10000
dahua_service            | Port 37777
hikvision_service        | Port 80
mobotix_service          | Port 443
reolink_service          | Port 8081
vstarcam_service         | Port 81
rtsp_streaming_service   | Port 554
mysql_service            | Port 3306
cowrie_service           | Uses environment variables
==================================================
```

### Network testing
```shell
# Test port accessibility
nmap -sV -p- 127.0.0.1 
# Look for specific ports
nmap -sV -p 80 127.0.0.1
# Test HTTP services
curl -I http://localhost:80
```
## Troubleshooting
### Common issues
#### 1. **Port already in use**
```shell
# Check what's using the port
sudo netstat -tulpn | grep :80
# Kill process using port
sudo fuser -k 80/tcp
```

#### 2. **Container won't start**
```shell
# Check container logs
docker compose logs [service_name]
# Check container status
docker ps -a
# Restart specific service
docker compose restart [service_name]
```
## Log Manager

The SweetCam honeypot includes a log manager tool to help you manage and analyze logs from all honeypot services (Web, RTSP, ONVIF).

Refer to the [Log Manager README](./LOG_MANAGER_README.md) for more details.
