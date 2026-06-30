# SweetCam

SweetCam is an IP camera honeypot. It emulates camera web interfaces, ONVIF
discovery/SOAP endpoints, RTSP video streams, and SSH activity logging.

The current implementation uses a shared MediaMTX based RTSP layer for public
H.264 video streams. The older Node RTSP implementation is still kept in the
repository as a legacy/research fallback, but the realistic camera streams are
published through `rtsp_h264_media`.

## Main Components

- `mysql_service`: MySQL 8 database for camera profiles and logs.
- `web_service`: internal backend used for metadata, RTSP auth decisions, and log ingestion.
- Vendor web services: Hikvision, Dahua, Axis, Reolink, Mobotix, VStarCam, and Foscam-style interfaces.
- `rtsp_h264_media`: custom MediaMTX RTSP server pinned to MediaMTX `v1.18.2`.
- `rtsp_h264_publisher_*`: FFmpeg publishers that loop the H.264 camera video into MediaMTX.
- ONVIF services: WS-Discovery and SOAP endpoints for each camera vendor.
- `cowrie_service`: optional SSH honeypot service.
- `grafana`: optional dashboard for database-backed log views.

## Current RTSP Design

The public RTSP streams are served by `rtsp_h264_media`. Each publisher reads
`rtspservices/media/camera-loop-720p15.mp4`, loops it, encodes it as H.264, and
publishes it into a vendor-specific RTSP path.

The custom MediaMTX image is built from:

```text
rtspservices/mediamtx-custom/
```

It pins MediaMTX to:

```text
v1.18.2
```

and changes the scanner-visible RTSP banner from:

```text
Gortsplib
```

to:

```text
RTSP Server
```

This keeps the MediaMTX streaming behavior while avoiding the default library
fingerprint in Censys/Nmap-style scans.

## Service And Port Reference

### Multi-camera deployment ports

These are the default ports from `docker-compose.yml` when several cameras run
on the same VM.

| Vendor | Web URL | RTSP URL | ONVIF HTTP |
|---|---|---|---|
| Hikvision | `http://localhost` | `rtsp://admin:12345@localhost:8554/Streaming/Channels/101` | `http://localhost:8080/onvif/device_service` |
| Dahua | `http://localhost:37777` | `rtsp://localhost:8555/cam/realmonitor?channel=1&subtype=0` | `http://localhost:8086/onvif/device_service` |
| Axis | `http://localhost:10000` | `rtsp://localhost:8556/axis-media/media.amp` | `http://localhost:8087/onvif/device_service` |
| Reolink | `http://localhost:8081` | `rtsp://localhost:8557/h264Preview_01_main` | `http://localhost:8088/onvif/device_service` |
| Mobotix | `http://localhost:443` | `rtsp://localhost:8558/control/faststream.jpg` | `http://localhost:8089/onvif/device_service` |
| VStarCam | `http://localhost:81` | `rtsp://localhost:8559/videostream.cgi` | `http://localhost:8090/onvif/device_service` |
| Foscam | depends on selected web service | `rtsp://localhost:8560/videoMain` | not exposed by a dedicated default ONVIF service |

### Single-camera deployment ports

For one-camera-per-VM deployments, use the single-camera override files:

```text
docker-compose.hikvision-single.yml
docker-compose.dahua-single.yml
docker-compose.axis-single.yml
docker-compose.reolink-single.yml
```

These override the public ports so each VM behaves more like one camera:

- web interface on TCP `80`
- RTSP on TCP `554`
- ONVIF HTTP on TCP `8080`
- WS-Discovery on UDP `3702`

Example single-camera URLs:

| Vendor | Web URL | RTSP URL |
|---|---|---|
| Hikvision | `http://VM_IP` | `rtsp://admin:12345@VM_IP/Streaming/Channels/101` |
| Dahua | `http://VM_IP` | `rtsp://VM_IP/cam/realmonitor?channel=1&subtype=0` |
| Axis | `http://VM_IP` | `rtsp://VM_IP/axis-media/media.amp` |
| Reolink | `http://VM_IP` | `rtsp://VM_IP/h264Preview_01_main` |

## Environment Variables

The most important deployment variable is:

```env
PUBLIC_IP=VM_IP
```

The current override files use `PUBLIC_IP` as the fallback for:

```env
PUBLIC_RTSP_HOST
ONVIF_PUBLIC_HOST
PUBLIC_ONVIF_HOST
```

For no-auth public cameras, set the matching brand names:

```env
NO_AUTH_WEB_BRANDS=dahua,axis,reolink
NO_AUTH_RTSP_BRANDS=dahua,axis,reolink
PUBLIC_VIEWER_USERNAME=guest
```

Do not include a brand in those lists if the camera should require credentials.

Default authenticated Hikvision credentials:

```text
admin:12345
```

## Quick Start

### Prerequisites

- Ubuntu VM or Linux host
- Docker Engine
- Docker Compose plugin
- Git
- curl

For full VM setup instructions, including Docker installation, swap setup, local
VM deployment, cloud deployment, no-auth deployment, and single-camera overrides,
see:

```text
CUSTOM_CAMERA_DEPLOYMENT_TUTORIAL.md
```

### Clone

```bash
git clone https://github.com/honeynet/sweetcam.git
cd sweetcam
git checkout RaduUpdates
```

Use another branch if you are testing a feature branch.

### Start a single Hikvision camera with authentication

```bash
export PUBLIC_IP=VM_IP
docker compose -f docker-compose.yml -f docker-compose.hikvision-single.yml up -d --build --remove-orphans mysql_service web_service rtsp_h264_media rtsp_h264_publisher_hikvision_101 rtsp_h264_publisher_hikvision_102 hikvision_service onvif_service
```

Test:

```bash
curl -I http://VM_IP
```

```powershell
ffplay "rtsp://admin:12345@VM_IP/Streaming/Channels/101"
```

### Start a single Dahua camera without authentication

```bash
export PUBLIC_IP=VM_IP
export NO_AUTH_WEB_BRANDS=dahua
export NO_AUTH_RTSP_BRANDS=dahua
export PUBLIC_VIEWER_USERNAME=guest
docker compose -f docker-compose.yml -f docker-compose.dahua-single.yml up -d --build --remove-orphans mysql_service web_service rtsp_h264_media rtsp_h264_publisher_dahua dahua_service onvif_dahua_service
```

Test:

```bash
curl -I http://VM_IP
```

```powershell
ffplay "rtsp://VM_IP/cam/realmonitor?channel=1&subtype=0"
```

## Checking The Deployment

Show running containers:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Check MediaMTX and publisher status:

```bash
docker logs --tail 80 rtsp_h264_media_service
```

Check the scanner-visible RTSP banner:

```powershell
$tcp = New-Object Net.Sockets.TcpClient("VM_IP", 554)
$stream = $tcp.GetStream()
$writer = New-Object IO.StreamWriter($stream)
$writer.NewLine = "`r`n"
$writer.AutoFlush = $true
$writer.WriteLine("OPTIONS rtsp://VM_IP/ RTSP/1.0")
$writer.WriteLine("CSeq: 1")
$writer.WriteLine("")
$reader = New-Object IO.StreamReader($stream)
$buffer = New-Object char[] 512
$count = $reader.Read($buffer, 0, $buffer.Length)
(-join $buffer[0..($count-1)])
$tcp.Close()
```

Expected banner:

```text
Server: RTSP Server
```

## Logs And Database

SweetCam stores logs in MySQL tables such as:

- `web_service_logs`
- `rtsp_service_logs`
- `onvif_service_logs`
- `cowrie_service_logs`
- `service_logs`
- `camera_profiles`

The MySQL data is persisted in the Docker volume:

```text
mysql-data
```

Use the log manager for quick inspection:

```bash
node log_manager.js --docker --analyze
node log_manager.js --docker --limit 50
node log_manager.js --docker --event-types auth_failure login_attempt --show-passwords --limit 20
```

For database schema and query examples, see:

```text
DATABASE_DOCUMENTATION.md
LOG_MANAGER_README.md
CUSTOM_CAMERA_DEPLOYMENT_TUTORIAL.md
```

## Stopping Services

Use the same compose files that were used to start the deployment.

Example:

```bash
docker compose -f docker-compose.yml -f docker-compose.hikvision-single.yml down
```

Do not use `-v` unless you intentionally want to delete Docker volumes,
including the MySQL database volume:

```bash
docker compose down -v
```

## Additional Documentation

- `CUSTOM_CAMERA_DEPLOYMENT_TUTORIAL.md`: main deployment guide
- `DATABASE_DOCUMENTATION.md`: database tables and useful SQL queries
- `LOG_MANAGER_README.md`: log manager usage
- `rtspservices/README.md`: RTSP and MediaMTX details
- `rtspservices/mediamtx-custom/README.md`: custom MediaMTX image details
- `onvifservices/README.md`: ONVIF service details
- `webservices/README.md`: web service details
- `TOOLS_AND_VERSIONS.md`: tool and image versions
