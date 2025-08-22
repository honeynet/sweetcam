<h1 align="center">
    <img src="./images/sweetcam.png" alt="SweetCam IP Camera" width='75%'>
   </h1>

# Introduction 

The application SweetCam is a honeypot for IP camera. It can simulate a real IP camera vividly, it can simulate the web interface of the IP camera, ONVIF and RTSP protocol. 

# Components

The SweetCam honeypot consists of **23 containers**:

### Core Services
1. **MySQL service** is service for data storage.
2. **Web service** is main web interface.
3. **Cowrie service** SSH honeypot service.
4. **Grafana service** is a dashboard for visualizing logs.
5. **ONVIF service** is a service for ONVIF protocol.
6. **RTSP service** is a service for RTSP protocol.

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
| Grafana | 3000 | 3001 | HTTP | Dashboards | http://localhost:3001 | `grafana` |

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
## Docker Manager

SweetCam includes a comprehensive **Docker Manager** tool that provides advanced Docker service management, health monitoring and flexible deployment options for the honeypot environment.

For documentation on the Docker Manager, see the [Docker Manager README](./DOCKER_MANAGER_README.md).

### Quick Usage

```shell
# Make executable and run
chmod +x docker-manager.js
./docker-manager.js

# Run the Docker Manager
./docker-manager-js

# Health check only
./docker-manager-js --health-check

```
## Network access

### Port Mapping

Refer to the [Service Configuration](#service-configuration) table above for complete port mapping information.

## Port Management

SweetCam includes a **Port Manager** CLI tool to easily manage port changes for Docker containers with automatic port availability checking and container restart functionality.

For documentation on the Port Manager, see the [Port Manager README](./PORT_MANAGER_README.md).

### Quick Usage

```shell
# Show current port configuration
node port-manager.js list

# Change port for a service
node port-manager.js change dahua_service 8080

# Show help
node port-manager.js help
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

### Setup Scenarios

- **Single Camera Setup**: Deploy individual camera with all supported protocols
- **Multi-Camera Setup**: Deploy multiple cameras simultaneously with shared services
- **Standard Setup**: Complete deployment with all services and cameras
- **Custom Setup**: Selective service deployment based on specific requirements

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

## Accessing logs

### Database (log records)

#### Open MySQL shell:
```shell
docker compose exec -T mysql_service sh -lc 'mysql -uroot -p"$MYSQLDB_ROOT_PASSWORD"'
```
#### Then:
```sql
USE sweetcam;
SHOW TABLES;
SELECT COUNT(*) AS total FROM service_logs;
SELECT * FROM service_logs ORDER BY id DESC LIMIT 20;
```

### Common service-specific queries:
```sql
-- Cowrie
SELECT COUNT(*) FROM cowrie_service_logs;
SELECT * FROM cowrie_service_logs ORDER BY id DESC LIMIT 10;

SELECT COUNT(*) AS total FROM service_logs; \
SELECT COUNT(*) AS cowrie_total FROM cowrie_service_logs; \
SELECT * FROM cowrie_service_logs ORDER BY id DESC LIMIT 5;
-- Web
SELECT COUNT(*) FROM web_service_logs;
SELECT * FROM web_service_logs ORDER BY id DESC LIMIT 10;
-- RTSP
SELECT COUNT(*) FROM rtsp_service_logs;
SELECT * FROM rtsp_service_logs ORDER BY id DESC LIMIT 10;
-- ONVIF
SELECT COUNT(*) FROM onvif_service_logs;
SELECT * FROM onvif_service_logs ORDER BY id DESC LIMIT 10;
```
#### One-liner example:
```shell
docker compose exec -T mysql_service sh -lc "mysql -uroot -p\"$MYSQLDB_ROOT_PASSWORD\" -e 'USE sweetcam; SELECT COUNT(*) AS total FROM service_logs; SELECT COUNT(*) AS cowrie_total FROM cowrie_service_logs;'"
```

## Log Manager

The SweetCam honeypot includes a log manager tool to help you manage and analyze logs from all honeypot services (Web, RTSP, ONVIF).

Refer to the [Log Manager README](./LOG_MANAGER_README.md) for more details.

## Grafana - Visualizing Logs

### Access
- URL: `http://localhost:3001`
- Default credentials: `admin` / `admin` (you will be prompted to change the password on first login)
- Data source: auto-provisioned MySQL pointing to `mysql_service:3306` database `sweetcam`
- Dashboard: "Sweetcam Overview" is auto-loaded

If the dashboard does not appear, check the provisioning mounts in `docker-compose.yml` and the files under `grafana/provisioning` and `grafana/dashboards`.

### What you can see
- **Total logs over time**: time series of all events from `service_logs`
- **Top attacker IPs**: top `ip_address` by frequency from `service_logs`
- **Events by service**: distribution by `service` (web, rtsp, onvif, cowrie) from `service_logs`
- **Events by brand**: distribution by `brand` from `service_logs` (filters out `auto`)
- **Top countries**: counts by `country` from `ip_reputation`
- **Geo attacker distribution**: world map using `ip_reputation.country`
- **Recent all logs (unified)**: most recent entries from the `all_logs` view

Use the Grafana time range selector (top-right) to adjust the period. Most panels honor the time filter.

## Documentation

- **[Main README](./README.md)** - This file, providing an overview and quick start guide
- **[Port Manager README](./PORT_MANAGER_README.md)** - Complete guide to the Port Manager tool
- **[Docker Manager README](./DOCKER_MANAGER_README.md)** - Complete guide to the Docker Manager tool
- **[Log Manager README](./LOG_MANAGER_README.md)** - Guide to the Log Manager tool

## Support

For issues and questions:
- Review the troubleshooting section above
- Check the relevant component README files
- Check Docker and Docker Compose documentation
- Ensure all prerequisites are met
