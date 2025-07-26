<h1 align="center">
    <img src="./images/sweetcam.png" alt="SweetCam IP Camera" width='75%'>
   </h1>

# Introduction 

The application SweetCam is a honeypot for IP camera. It can simulate a real IP camera vividly, including the interaction with user for rotating and zooming.

# Components

The SweetCam honeypot consists of **12 containers**:

### Core Services
1. **MySQL service** is service for data storage.
2. **RTSP streaming service** used to provide the RTSP service for attackers.
3. **Web service** is main web interface.
4. **Cowrie service** SSH honeypot service.
5. **ONVIF service** ONVIF-compliant camera honeypot service.

### Camera Brand Services (6 containers)
6. **Dahua Service**: port 37777
7. **Hikvision Service**: port 80  
8. **VStarcam Service**: port 81
9. **Mobotix Service**: port 443
10. **Axis Service**: port 10000
11. **Reolink Service**: port 8081

## Service Configuration

Below is the comprehensive list of all services with their ports, protocols and access URLs:

| Service | Internal Port | External Port | Protocol | Purpose | Access URL | Service Name |
|---------|---------------|---------------|----------|---------|------------|--------------|
| Dahua Camera | 37777 | 37777 | HTTP | Dahua camera interface | http://localhost:37777 | `dahua_service` |
| Hikvision Camera | 80 | 80 | HTTP | Hikvision camera interface | http://localhost:80 | `hikvision_service` |
| VStarcam Camera | 81 | 81 | HTTP | VStarcam camera interface | http://localhost:81 | `vstarcam_service` |
| Mobotix Camera | 443 | 443 | HTTPS | Mobotix camera interface | http://localhost:443 | `mobotix_service` |
| Axis Camera | 10000 | 10000 | HTTP | Axis camera interface | http://localhost:10000 | `axis_service` |
| Reolink Camera | 8081 | 8081 | HTTP | Reolink camera interface | http://localhost:8081 | `reolink_service` |
| RTSP Streaming | 554 | 554 | RTSP | Video streaming | rtsp://localhost:554/stream | `rtsp_streaming_service` |
| RTP Data | 8002-8005 | 8002-8005 | UDP | RTP/RTCP data | - | - |
| SSH Honeypot | 2222 | 2222 | SSH | Cowrie SSH service | ssh://localhost:2222 | `cowrie_service` |
| ONVIF SOAP | 3702 | 3702 | HTTP | ONVIF SOAP services | http://localhost:3702 | `onvif_service` |
| ONVIF Discovery | 3702 | 3702 | UDP | WS-Discovery multicast | - | - |
| MySQL Database | 3306 | 3306 | TCP | Database | - | `mysql_service` |
| Web Service | 3000 | 3000 | HTTP | Main web interface | http://localhost:3000 | `web_service` |

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Ports 22, 80, 81, 443, 554, 2222, 3306, 37777, 8081, 10000 available

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

## Accessing camera interfaces

All cameras can be accessed with default login credentials available in initialize.sql.
To access cameras' web pages you can use your default browser. 

Refer to the [Service Configuration](#service-configuration) table above for all camera access URLs.

### ONVIF Camera (Port 3702)
- Device Service: http://localhost:3702/onvif/device_service
- Media Service: http://localhost:3702/onvif/media_service
- Health Check: http://localhost:3702/health

## RTSP streaming access
```shell
# Stream URL
rtsp://localhost:554/stream
# Test with VLC
vlc rtsp://localhost:554/stream

```

## ONVIF testing

The ONVIF honeypot responds to WS-Discovery probes and provides SOAP services for device interaction.

### Test WS-Discovery
```shell
# Using netcat to send a probe
echo '<wsd:Probe xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery"/>' | nc -u 239.255.255.250 3702
```

### Test SOAP Services
```shell
# Test device information
curl -X POST http://localhost:3702/onvif/device_service \
  -H "Content-Type: text/xml" \
  -H "SOAPAction: http://www.onvif.org/ver10/device/wsdl/GetDeviceInformation" \
  -d '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
        <soap:Body>
          <GetDeviceInformation xmlns="http://www.onvif.org/ver10/device/wsdl"/>
        </soap:Body>
      </soap:Envelope>'
```

### Run ONVIF Tests
```shell
# Navigate to ONVIF service directory
cd onvifservices

# Run comprehensive tests
npm test
```

## Accessing logs and monitoring
### 1. **Container logs**
#### View all container logs:
```shell
# All containers
docker compose logs
# Specific service
docker compose logs [service_name]
```
#### Real-time log monitoring:
```shell
# Follow logs in real-time
docker compose logs -f
```
### Container operations
#### Restart services:
```shell
# Restart all services
docker compose restart
# Restart specific service
docker compose restart [service_name]
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