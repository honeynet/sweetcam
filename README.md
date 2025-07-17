<h1 align="center">
    <img src="./images/sweetcam.png" alt="SweetCam IP Camera" width='75%'>
   </h1>

# Introduction 

The application SweetCam is a honeypot for IP camera. It can simulate a real IP camera vividly, including the interaction with user for rotating and zooming.

# Components

The SweetCam honeypot consists of **11 containers**:

### Core Services
1. **MySQL service** is service for data storage.
2. **RTSP streaming service** used to provide the RTSP service for attackers.
3. **Web service** is main web interface.
4. **Cowrie service** SSH honeypot service.

### Camera Brand Services (6 containers)
4. **Dahua Service**: port 37777
5. **Hikvision Service**: port 80  
6. **VStarcam Service**: port 81
7. **Mobotix Service**: port 443
8. **Axis Service**: port 10000
9. **Reolink Service**: port 8081


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

## Accessing Camera Interfaces

All cameras can be accessed with defeault login credentials available in initialize.sql.
To access cameras' web pages you can use your default browser. 

#### 1. **Dahua Camera (Port 37777)**
http://localhost:37777

#### 2. **Hikvision Camera (Port 80)**
http://localhost:80

#### 3. **VStarcam Camera (Port 81)**
http://localhost:81

#### 4. **Mobotix Camera (Port 443)**
http://localhost:443

#### 5. **Axis Camera (Port 10000)**
http://localhost:10000

#### 6. **Reolink Camera (Port 8081)**
http://localhost:8081

## RTSP Streaming Access
```shell
# Stream URL
rtsp://localhost:554/stream
# Test with VLC
vlc rtsp://localhost:554/stream
# Test with FFplay
ffplay rtsp://localhost:554/stream
```

## Accessing Logs and Monitoring
### 1. **Container Logs**
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
### Container Operations
#### Restart Services:
```shell
# Restart all services
docker compose restart
# Restart specific service
docker compose restart [service_name]
```

#### Stop/Start Services:
```shell
# Stop all services
docker compose down
# Start all services
docker compose up -d
# Stop with volume cleanup
docker compose down -v
```

## Network Access

### Port Mapping

| Service      | Internal Port | External Port | Protocol | Purpose                    |
|--------------|---------------|---------------|----------|----------------------------|
| Dahua        | 37777         | 37777         | HTTP     | Dahua camera interface     |
| Hikvision    | 80            | 80            | HTTP     | Hikvision camera interface |
| VStarcam     | 81            | 81            | HTTP     | VStarcam camera interface  |
| Mobotix      | 443           | 443           | HTTPS    | Mobotix camera interface   |
| Axis         | 10000         | 10000         | HTTP     | Axis camera interface      |
| Reolink      | 8081          | 8081          | HTTP     | Reolink camera interface   |
| RTSP         | 554           | 554           | RTSP     | Video streaming            |
| RTP          | 8002-8005     | 8002-8005     | UDP      | RTP/RTCP data              |
| SSH Honeypot | 2222          | 2222          | SSH      | Cowrie SSH service         |
| MySQL        | 3306          | 3306          | TCP      | Database                   |

## Port Management

SweetCam includes a **Port Manager** CLI tool to easily manage port changes for Docker containers with automatic port availability checking and container restart functionality.

### Features
- Check if a port is available before changing
- Update docker-compose.yml automatically
- Ask for user confirmation before making changes
- Automatically restart the specific container after port change
- List current port configuration
- Support for all SweetCam services

### Prerequisites
- Node.js installed on your system
- Docker and Docker Compose running
- Root/sudo access (for port checking)

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

### Available Services for Port Management

| Service | Default Port | Description |
|---------|-------------|-------------|
| `web_service` | 3000 | Main web service |
| `axis_service` | 10000 | Axis camera service |
| `dahua_service` | 37777 | Dahua camera service |
| `hikvision_service` | 80 | Hikvision camera service |
| `mobotix_service` | 443 | Mobotix camera service |
| `reolink_service` | 8081 | Reolink camera service |
| `vstarcam_service` | 81 | Vstarcam camera service |
| `rtsp_streaming_service` | 554 | RTSP streaming service |
| `mysql_service` | 3306 | MySQL database service |
| `cowrie_service` | ENV_VAR | Cowrie honeypot service (uses environment variables) |

### Port Management Examples

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
