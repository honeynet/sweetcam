# SweetCam ONVIF Services

The ONVIF service emulates ONVIF discovery and SOAP endpoints for the camera
honeypot. It is designed to make deployed SweetCam cameras discoverable as
network video devices and to expose metadata that matches the selected camera
profile.

## What It Provides

- WS-Discovery over UDP `3702`.
- HTTP SOAP services for device and media requests.
- Brand-specific metadata for Hikvision, Dahua, Axis, Reolink, Mobotix, and VStarCam.
- Database-backed camera profile support through the `camera_profiles` table.
- RTSP stream URLs that point to the current MediaMTX H.264 stream.
- Logging of discovery and SOAP activity into MySQL.

## Current ONVIF Ports

### Multi-camera deployment

When several cameras run on the same VM, the default compose file exposes
separate ONVIF ports per vendor:

| Vendor | SOAP URL | WS-Discovery UDP |
|---|---|---|
| Hikvision | `http://VM_IP:8080/onvif/device_service` | `3702` |
| Dahua | `http://VM_IP:8086/onvif/device_service` | `3703` |
| Axis | `http://VM_IP:8087/onvif/device_service` | `3704` |
| Reolink | `http://VM_IP:8088/onvif/device_service` | `3705` |
| Mobotix | `http://VM_IP:8089/onvif/device_service` | `3706` |
| VStarCam | `http://VM_IP:8090/onvif/device_service` | `3707` |

### Single-camera deployment

The single-camera override files expose the selected camera's ONVIF service on:

```text
TCP 8080
UDP 3702
```

Example:

```text
http://VM_IP:8080/onvif/device_service
```

## Public Host Variables

ONVIF responses must advertise URLs that are reachable by external clients.
The deployment can use one shared variable:

```env
PUBLIC_IP=VM_IP
```

The current override files use it as a fallback for:

```env
ONVIF_PUBLIC_HOST
PUBLIC_ONVIF_HOST
PUBLIC_RTSP_HOST
```

If needed, the values can also be set explicitly:

```env
ONVIF_PUBLIC_HOST=VM_IP
PUBLIC_ONVIF_HOST=VM_IP
PUBLIC_RTSP_HOST=VM_IP
```

Do not use Docker-internal addresses like `172.18.x.x` in public deployments.

## Database-backed Camera Metadata

The ONVIF service first tries to load vendor metadata from the
`camera_profiles` table. If a matching row exists for the configured vendor,
the ONVIF responses use that profile information. If no row exists, the service
falls back to static brand defaults.

This keeps the web interface, ONVIF service, and RTSP URLs aligned around the
same generated camera identity.

## Implemented ONVIF Methods

The service exposes WSDL pages and SOAP handlers for the main methods used by
camera clients and scanners.

Device service examples:

- `GetDeviceInformation`
- `GetServices`
- `GetCapabilities`
- `GetNetworkInterfaces`
- `GetSystemDateAndTime`
- `GetSystemLog`
- `GetUsers`
- `CreateUsers`
- `DeleteUsers`
- `SetSystemDateAndTime`
- `SystemReboot`

Media service examples:

- `GetProfiles`
- `GetStreamUri`
- `GetVideoSources`
- `GetAudioSources`
- `GetVideoEncoderConfigurations`
- `GetAudioEncoderConfigurations`

The most important one for stream integration is `GetStreamUri`, because it
returns the current MediaMTX H.264 RTSP URL for the camera.

## Architecture

```text
onvifservices/
├── onvif-server.js          # Main HTTP/SOAP server and WSDL pages
├── services/
│   ├── udp-ws-discovery.js  # WS-Discovery service
│   └── onvif-soap.js        # SOAP handlers and camera profile loading
├── config/
│   ├── brand-configs.js     # Static fallback brand configurations
│   └── db-config.js         # Database configuration
├── Dockerfile
├── package.json
└── package-lock.json
```

## Testing

### Test WS-Discovery port

```bash
sudo nmap -sU -p 3702 VM_IP
```

For multi-camera deployments, include the additional discovery ports if they are
exposed:

```bash
sudo nmap -sU -p 3702-3707 VM_IP
```

### Test HTTP/SOAP services

Single-camera deployment:

```bash
curl -I http://VM_IP:8080/onvif/device_service
curl -s http://VM_IP:8080/onvif/device_service
curl -s http://VM_IP:8080/onvif/media_service
```

Multi-camera deployment:

```bash
curl -I http://VM_IP:8080/onvif/device_service
curl -I http://VM_IP:8086/onvif/device_service
curl -I http://VM_IP:8087/onvif/device_service
curl -I http://VM_IP:8088/onvif/device_service
```

### Check logs

```bash
docker logs --tail 80 onvif_service
docker logs --tail 80 onvif_dahua_service
docker logs --tail 80 onvif_axis_service
docker logs --tail 80 onvif_reolink_service
```

Database logs are stored in:

```text
onvif_service_logs
```
