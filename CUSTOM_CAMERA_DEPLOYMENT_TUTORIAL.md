# SweetCam Custom Camera Deployment Tutorial

This document explains how to deploy a custom number of SweetCam cameras on an Ubuntu VM.

The examples below cover:

- one single camera, with or without authentication
- multiple cameras on the same VM
- no-auth and with-auth cameras in the same deployment
- local VM deployment
- cloud VM deployment

## 1. Basic Idea

SweetCam is split into several Docker services. A camera is not only one container. A realistic camera usually needs:

- a web interface container
- an RTSP H.264 stream publisher
- the shared MediaMTX RTSP server
- an ONVIF service
- the MySQL database
- the internal web backend used for RTSP auth and service metadata

So, when deploying one camera, we still need a few shared services.

For example, a Hikvision camera needs:

```text
mysql_service
web_service
rtsp_h264_media
rtsp_h264_publisher_hikvision_101
rtsp_h264_publisher_hikvision_102
hikvision_service
onvif_service
```

A Dahua camera needs:

```text
mysql_service
web_service
rtsp_h264_media
rtsp_h264_publisher_dahua
dahua_service
onvif_dahua_service
```

The important thing is that `rtsp_h264_media` is the MediaMTX RTSP server, and the `rtsp_h264_publisher_*` services publish the looped H.264 video into it.

In the current implementation, MediaMTX is not pulled from `bluenviron/mediamtx:latest` anymore. SweetCam builds a pinned custom MediaMTX image from `rtspservices/mediamtx-custom`, using MediaMTX `v1.18.2`. This keeps the RTSP behavior stable and changes the scanner-visible RTSP server banner to:

```text
Server: RTSP Server
```

This is still the same MediaMTX-based H.264 RTSP setup, but with a less library-specific fingerprint.

## 2. Install The Necessary Software On The VM

This is for a fresh Ubuntu VM. These are the necessary packages. Node.js, MySQL, FFmpeg, MediaMTX, and Grafana do not need to be installed manually on the host because Docker handles them inside containers.

Update packages:

```bash
sudo apt update
```

Install Git, curl, and certificates:

```bash
sudo apt install -y ca-certificates curl git
```

Add Docker's package repository:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo ${UBUNTU_CODENAME}) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
```

Install Docker and Docker Compose:

```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Check that Docker works:

```bash
docker --version
docker compose version
```

If the VM is small, add swap. This is important because Docker builds and FFmpeg streams can use quite a bit of memory:

```bash
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

## 3. Clone The Project

Clone SweetCam:

```bash
cd /opt
sudo git clone https://github.com/honeynet/sweetcam.git
cd /opt/sweetcam
```

Use the branch with the current changes. Replace `mediamtx-custom-banner` with the branch you want to deploy if needed:

```bash
git checkout mediamtx-custom-banner
git pull --ff-only origin mediamtx-custom-banner
```

## 4. Choose The Correct IP

The services need to know what IP they should advertise in RTSP and ONVIF URLs.

For a cloud VM, use the public IP.

For a local VM using bridged networking, use the LAN IP of the VM.

Find the VM IP:

```bash
hostname -I
```

Use the reachable VM IP, for example:

```text
192.168.1.45
```

Do not use Docker internal IPs like:

```text
172.18.x.x
```

For the current override files, you usually only need one IP variable:

```bash
export PUBLIC_IP=VM_IP
```

Example:

```bash
export PUBLIC_IP=192.168.1.45
```

The Compose files automatically use `PUBLIC_IP` for:

```text
PUBLIC_RTSP_HOST
ONVIF_PUBLIC_HOST
PUBLIC_ONVIF_HOST
```

This variable only exists in the current shell. If you open a new SSH session, set it again before running `docker compose up`.

To avoid setting it every time, add it once to the `.env` file on that VM:

```bash
nano .env
```

Add the correct IP:

```env
PUBLIC_IP=VM_IP
```

You can also put no-auth settings in `.env` if that VM should always start with the same public camera behavior:

```env
NO_AUTH_WEB_BRANDS=dahua
NO_AUTH_RTSP_BRANDS=dahua
PUBLIC_VIEWER_USERNAME=guest
```

## 5. Authentication Settings

SweetCam can deploy cameras with authentication or without authentication.

These variables control no-auth cameras:

```bash
NO_AUTH_WEB_BRANDS
NO_AUTH_RTSP_BRANDS
```

Example:

```bash
export NO_AUTH_WEB_BRANDS=dahua,axis
export NO_AUTH_RTSP_BRANDS=dahua,axis
```

This means:

- Dahua and Axis web pages can be opened without login
- Dahua and Axis RTSP streams can be opened without credentials
- other brands still require authentication

For a protected/authenticated camera, do not include the brand in those variables.

The default Hikvision credentials are:

```text
admin:12345
```

## 6. Camera Service Reference

Use this table when building a custom deployment command.

| Vendor | Web Service | RTSP Publisher | ONVIF Service | Multi-camera Web URL | Multi-camera RTSP URL |
|---|---|---|---|---|---|
| Hikvision | `hikvision_service` | `rtsp_h264_publisher_hikvision_101`, `rtsp_h264_publisher_hikvision_102` | `onvif_service` | `http://VM_IP` | `rtsp://admin:12345@VM_IP:8554/Streaming/Channels/101` |
| Dahua | `dahua_service` | `rtsp_h264_publisher_dahua` | `onvif_dahua_service` | `http://VM_IP:37777` | `rtsp://VM_IP:8555/cam/realmonitor?channel=1&subtype=0` |
| Axis | `axis_service` | `rtsp_h264_publisher_axis` | `onvif_axis_service` | `http://VM_IP:10000` | `rtsp://VM_IP:8556/axis-media/media.amp` |
| Reolink | `reolink_service` | `rtsp_h264_publisher_reolink` | `onvif_reolink_service` | `http://VM_IP:8081` | `rtsp://VM_IP:8557/h264Preview_01_main` |
| Mobotix | `mobotix_service` | `rtsp_h264_publisher_mobotix` | `onvif_mobotix_service` | `http://VM_IP:8088` | `rtsp://VM_IP:8558/control/faststream.jpg` |
| VStarCam | `vstarcam_service` | `rtsp_h264_publisher_vstarcam` | `onvif_vstarcam_service` | `http://VM_IP:8089` | `rtsp://VM_IP:8559/videostream.cgi` |

Every deployment also needs:

```text
mysql_service
web_service
rtsp_h264_media
```

For single-camera-per-VM deployments, the override files expose the camera web page on port `80`, RTSP on port `554`, and ONVIF HTTP on port `8080`. In that case the public URLs are simpler:

| Vendor | Single-VM Web URL | Single-VM RTSP URL |
|---|---|---|
| Hikvision | `http://VM_IP` | `rtsp://admin:12345@VM_IP/Streaming/Channels/101` |
| Dahua | `http://VM_IP` | `rtsp://VM_IP/cam/realmonitor?channel=1&subtype=0` |
| Axis | `http://VM_IP` | `rtsp://VM_IP/axis-media/media.amp` |
| Reolink | `http://VM_IP` | `rtsp://VM_IP/h264Preview_01_main` |

## 7. Deploy One Camera On One VM

### 7.1 Hikvision With Authentication

```bash
export PUBLIC_IP=VM_IP
```

Start Hikvision:

```bash
docker compose -f docker-compose.yml -f docker-compose.hikvision-single.yml up -d --build --remove-orphans mysql_service web_service rtsp_h264_media rtsp_h264_publisher_hikvision_101 rtsp_h264_publisher_hikvision_102 hikvision_service onvif_service
```

Test:

```bash
curl -I http://VM_IP
```

RTSP test from Windows:

```powershell
ffplay "rtsp://admin:12345@VM_IP/Streaming/Channels/101"
```

### 7.2 Dahua Without Authentication

Set Dahua as no-auth:

```bash
export NO_AUTH_WEB_BRANDS=dahua
export NO_AUTH_RTSP_BRANDS=dahua
export PUBLIC_VIEWER_USERNAME=guest
export PUBLIC_IP=VM_IP
```

Start Dahua:

```bash
docker compose -f docker-compose.yml -f docker-compose.dahua-single.yml up -d --build --remove-orphans mysql_service web_service rtsp_h264_media rtsp_h264_publisher_dahua dahua_service onvif_dahua_service
```

Test:

```bash
curl -I http://VM_IP
```

RTSP test from Windows:

```powershell
ffplay "rtsp://VM_IP/cam/realmonitor?channel=1&subtype=0"
```

If the stream works without `admin:12345@`, then no-auth RTSP is working.

## 8. Deploy Two Cameras On One VM

This example deploys:

- Hikvision with authentication
- Dahua without authentication

Set environment:

```bash
export PUBLIC_IP=VM_IP
export NO_AUTH_WEB_BRANDS=dahua
export NO_AUTH_RTSP_BRANDS=dahua
export PUBLIC_VIEWER_USERNAME=guest
```

Create a small override file so no-auth is passed into the right services:

```bash
nano docker-compose.local-2cam.yml
```

Paste:

```yaml
services:
  web_service:
    environment:
      - NO_AUTH_RTSP_BRANDS=dahua
      - NO_AUTH_WEB_BRANDS=dahua
      - PUBLIC_VIEWER_USERNAME=guest
      - PUBLIC_RTSP_HOST=${PUBLIC_RTSP_HOST:-${PUBLIC_IP:-localhost}}
      - ONVIF_PUBLIC_HOST=${ONVIF_PUBLIC_HOST:-${PUBLIC_IP:-localhost}}
      - PUBLIC_ONVIF_HOST=${PUBLIC_ONVIF_HOST:-${PUBLIC_IP:-localhost}}

  dahua_service:
    environment:
      - NO_AUTH_WEB_BRANDS=dahua
      - PUBLIC_VIEWER_USERNAME=guest
      - PUBLIC_RTSP_HOST=${PUBLIC_RTSP_HOST:-${PUBLIC_IP:-localhost}}

  hikvision_service:
    environment:
      - NO_AUTH_WEB_BRANDS=dahua
      - PUBLIC_RTSP_HOST=${PUBLIC_RTSP_HOST:-${PUBLIC_IP:-localhost}}

  onvif_service:
    environment:
      - PUBLIC_RTSP_HOST=${PUBLIC_RTSP_HOST:-${PUBLIC_IP:-localhost}}
      - ONVIF_PUBLIC_HOST=${ONVIF_PUBLIC_HOST:-${PUBLIC_IP:-localhost}}
      - PUBLIC_ONVIF_HOST=${PUBLIC_ONVIF_HOST:-${PUBLIC_IP:-localhost}}

  onvif_dahua_service:
    environment:
      - PUBLIC_RTSP_HOST=${PUBLIC_RTSP_HOST:-${PUBLIC_IP:-localhost}}
      - ONVIF_PUBLIC_HOST=${ONVIF_PUBLIC_HOST:-${PUBLIC_IP:-localhost}}
      - PUBLIC_ONVIF_HOST=${PUBLIC_ONVIF_HOST:-${PUBLIC_IP:-localhost}}
```

Start the two-camera deployment:

```bash
docker compose -f docker-compose.yml -f docker-compose.local-2cam.yml up -d --build --remove-orphans mysql_service web_service rtsp_h264_media rtsp_h264_publisher_hikvision_101 rtsp_h264_publisher_hikvision_102 rtsp_h264_publisher_dahua hikvision_service dahua_service onvif_service onvif_dahua_service
```

Test web:

```bash
curl -I http://VM_IP
curl -I http://VM_IP:37777
```

Test RTSP from Windows:

```powershell
ffplay "rtsp://admin:12345@VM_IP:8554/Streaming/Channels/101"
ffplay "rtsp://VM_IP:8555/cam/realmonitor?channel=1&subtype=0"
```

## 9. Deploy More Than Two Cameras

The pattern is the same:

1. Start the shared services.
2. Add the web service for each camera.
3. Add the RTSP publisher for each camera.
4. Add the ONVIF service for each camera.
5. Add brands to `NO_AUTH_WEB_BRANDS` and `NO_AUTH_RTSP_BRANDS` only if they should be public/no-auth.

Example: deploy Hikvision with auth, and Dahua + Axis + Reolink without auth:

```bash
export PUBLIC_IP=VM_IP
export NO_AUTH_WEB_BRANDS=dahua,axis,reolink
export NO_AUTH_RTSP_BRANDS=dahua,axis,reolink
export PUBLIC_VIEWER_USERNAME=guest
```

Start services:

```bash
docker compose -f docker-compose.yml up -d --build --remove-orphans mysql_service web_service rtsp_h264_media rtsp_h264_publisher_hikvision_101 rtsp_h264_publisher_hikvision_102 rtsp_h264_publisher_dahua rtsp_h264_publisher_axis rtsp_h264_publisher_reolink hikvision_service dahua_service axis_service reolink_service onvif_service onvif_dahua_service onvif_axis_service onvif_reolink_service
```

For this exact no-auth setup, it is better to also use an override file like the two-camera example, otherwise some vendor web services may not receive the no-auth settings.

## 10. Single Camera Per VM With Realistic RTSP Port 554

If each camera has its own VM/IP, use the single-camera override files:

```text
docker-compose.hikvision-single.yml
docker-compose.dahua-single.yml
docker-compose.axis-single.yml
docker-compose.reolink-single.yml
```

These expose RTSP on the realistic default port:

```text
554
```

Example Hikvision single-camera VM:

```bash
export PUBLIC_IP=VM_IP
docker compose -f docker-compose.yml -f docker-compose.hikvision-single.yml up -d --build --remove-orphans mysql_service web_service rtsp_h264_media rtsp_h264_publisher_hikvision_101 rtsp_h264_publisher_hikvision_102 hikvision_service onvif_service
```

Example Dahua single-camera VM:

```bash
export PUBLIC_IP=VM_IP
docker compose -f docker-compose.yml -f docker-compose.dahua-single.yml up -d --build --remove-orphans mysql_service web_service rtsp_h264_media rtsp_h264_publisher_dahua dahua_service onvif_dahua_service
```

Example Axis single-camera VM:

```bash
export PUBLIC_IP=VM_IP
docker compose -f docker-compose.yml -f docker-compose.axis-single.yml up -d --build --remove-orphans mysql_service web_service rtsp_h264_media rtsp_h264_publisher_axis axis_service onvif_axis_service
```

Example Reolink single-camera VM:

```bash
export PUBLIC_IP=VM_IP
docker compose -f docker-compose.yml -f docker-compose.reolink-single.yml up -d --build --remove-orphans mysql_service web_service rtsp_h264_media rtsp_h264_publisher_reolink reolink_service onvif_reolink_service
```

For no-auth single-camera VMs, also set the matching brand in `NO_AUTH_WEB_BRANDS` and `NO_AUTH_RTSP_BRANDS` before starting the containers. For example:

```bash
export NO_AUTH_WEB_BRANDS=axis
export NO_AUTH_RTSP_BRANDS=axis
export PUBLIC_VIEWER_USERNAME=guest
```

RTSP tests for single-camera VMs:

```powershell
ffplay "rtsp://admin:12345@HIKVISION_IP/Streaming/Channels/101"
ffplay "rtsp://DAHUA_IP/cam/realmonitor?channel=1&subtype=0"
ffplay "rtsp://AXIS_IP/axis-media/media.amp"
ffplay "rtsp://REOLINK_IP/h264Preview_01_main"
```

Since port `554` is the default RTSP port, it does not need to be written in the URL.

## 11. Check If The Deployment Is Running

Show containers:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Check MediaMTX logs:

```bash
docker logs --tail 80 rtsp_h264_media_service
```

The custom MediaMTX image should still show normal MediaMTX runtime logs, but external RTSP scanners should see the generic banner `RTSP Server` instead of the default library name.

Check resource usage:

```bash
docker stats --no-stream
```

## 12. Check Logs And Database Data

Quick log overview:

```bash
node log_manager.js --docker --analyze
```

Recent logs:

```bash
node log_manager.js --docker --limit 50
```

Login attempts with passwords:

```bash
node log_manager.js --docker --event-types auth_failure login_attempt --show-passwords --limit 20
```

Open MySQL:

```bash
docker exec -it mysql_service mysql -u root -p
```

Use password:

```text
rootpassword
```

Inside MySQL:

```sql
USE sweetcam;
SHOW TABLES;
```

Recent web logs:

```sql
SELECT id, timestamp, event_type, ip_address, brand, username, password, request_path, response_code
FROM web_service_logs
ORDER BY timestamp DESC
LIMIT 20;
```

Recent RTSP logs:

```sql
SELECT id, timestamp, event_type, ip_address, brand, port, username, rtsp_method, stream_path, message
FROM rtsp_service_logs
ORDER BY timestamp DESC
LIMIT 20;
```

Recent ONVIF logs:

```sql
SELECT id, timestamp, event_type, ip_address, brand, soap_action, request_url, response_status, message
FROM onvif_service_logs
ORDER BY timestamp DESC
LIMIT 20;
```

Requests per day for each service in the last X days:

Change the number in `INTERVAL 7 DAY` to whatever period you need, for example `INTERVAL 3 DAY`, `INTERVAL 14 DAY`, or `INTERVAL 30 DAY`.

```sql
SELECT DATE(timestamp) AS day, COUNT(*) AS web_requests
FROM web_service_logs
WHERE timestamp >= NOW() - INTERVAL 7 DAY
GROUP BY DATE(timestamp)
ORDER BY day DESC;
```

```sql
SELECT DATE(timestamp) AS day, COUNT(*) AS rtsp_requests
FROM rtsp_service_logs
WHERE timestamp >= NOW() - INTERVAL 7 DAY
GROUP BY DATE(timestamp)
ORDER BY day DESC;
```

```sql
SELECT DATE(timestamp) AS day, COUNT(*) AS onvif_requests
FROM onvif_service_logs
WHERE timestamp >= NOW() - INTERVAL 7 DAY
GROUP BY DATE(timestamp)
ORDER BY day DESC;
```

Combined view for all three services:

```sql
SELECT day, service, requests
FROM (
  SELECT DATE(timestamp) AS day, 'web' AS service, COUNT(*) AS requests
  FROM web_service_logs
  WHERE timestamp >= NOW() - INTERVAL 7 DAY
  GROUP BY DATE(timestamp)

  UNION ALL

  SELECT DATE(timestamp) AS day, 'rtsp' AS service, COUNT(*) AS requests
  FROM rtsp_service_logs
  WHERE timestamp >= NOW() - INTERVAL 7 DAY
  GROUP BY DATE(timestamp)

  UNION ALL

  SELECT DATE(timestamp) AS day, 'onvif' AS service, COUNT(*) AS requests
  FROM onvif_service_logs
  WHERE timestamp >= NOW() - INTERVAL 7 DAY
  GROUP BY DATE(timestamp)
) AS per_service_counts
ORDER BY day DESC, service;
```

## 13. Stop The Deployment

Stop containers but keep data:

```bash
docker compose -f docker-compose.yml down
```

If using an override add the custom .yml file in the command as well:

```bash
docker compose -f docker-compose.yml -f docker-compose.local-2cam.yml down
```

For a single-camera VM, use the same single-camera override that was used when starting it:

```bash
docker compose -f docker-compose.yml -f docker-compose.hikvision-single.yml down
docker compose -f docker-compose.yml -f docker-compose.dahua-single.yml down
docker compose -f docker-compose.yml -f docker-compose.axis-single.yml down
docker compose -f docker-compose.yml -f docker-compose.reolink-single.yml down
```

Do not run this unless you intentionally want to delete MySQL data:

```bash
docker compose down -v
```

The `-v` removes Docker volumes, including the MySQL database volume.
