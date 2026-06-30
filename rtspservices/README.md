# SweetCam RTSP Services

This folder contains both the current H.264 RTSP streaming pipeline and the
older Node.js RTSP implementation that is kept as a legacy/research fallback.

## Current Public RTSP Pipeline

The current realistic RTSP stream is served through MediaMTX:

```text
rtsp_h264_media
```

The camera video is published by FFmpeg containers:

```text
rtsp_h264_publisher_hikvision_101
rtsp_h264_publisher_hikvision_102
rtsp_h264_publisher_dahua
rtsp_h264_publisher_axis
rtsp_h264_publisher_reolink
rtsp_h264_publisher_mobotix
rtsp_h264_publisher_vstarcam
rtsp_h264_publisher_foscam
rtsp_h264_publisher_foscam_sub
```

Each publisher loops:

```text
rtspservices/media/camera-loop-720p15.mp4
```

and publishes it into MediaMTX as H.264. The encoding settings in
`docker-compose.yml` use `libx264`, 15 fps, baseline profile, repeated SPS/PPS
headers, and low-latency settings so RTSP clients can join the stream reliably.

## Custom MediaMTX Image

The MediaMTX image is built from:

```text
rtspservices/mediamtx-custom/
```

It pins MediaMTX to:

```text
v1.18.2
```

and replaces the default RTSP library banner:

```text
Gortsplib
```

with:

```text
RTSP Server
```

This avoids exposing the underlying RTSP library name to external scanners while
keeping MediaMTX's RTSP/H.264 behavior.

The MediaMTX runtime configuration is:

```text
rtspservices/mediamtx.yml
```

Authentication checks are delegated to the web backend through MediaMTX HTTP
hooks. The backend uses the database credentials and the no-auth brand settings
to decide whether a reader is allowed.

## Public Stream Paths

### Multi-camera deployment

When several cameras run on the same VM, `rtsp_h264_media` maps the same
MediaMTX listener to several public ports:

| Vendor | Public URL |
|---|---|
| Hikvision main stream | `rtsp://admin:12345@VM_IP:8554/Streaming/Channels/101` |
| Hikvision substream | `rtsp://admin:12345@VM_IP:8554/Streaming/Channels/102` |
| Dahua | `rtsp://VM_IP:8555/cam/realmonitor?channel=1&subtype=0` |
| Axis | `rtsp://VM_IP:8556/axis-media/media.amp` |
| Reolink | `rtsp://VM_IP:8557/h264Preview_01_main` |
| Mobotix | `rtsp://VM_IP:8558/control/faststream.jpg` |
| VStarCam | `rtsp://VM_IP:8559/videostream.cgi` |
| Foscam main stream | `rtsp://VM_IP:8560/videoMain` |
| Foscam substream | `rtsp://VM_IP:8560/videoSub` |

### Single-camera deployment

When one camera runs on one VM, the single-camera override files expose RTSP on
the realistic default RTSP port:

```text
554
```

Example URLs:

| Vendor | Single-VM RTSP URL |
|---|---|
| Hikvision | `rtsp://admin:12345@VM_IP/Streaming/Channels/101` |
| Dahua | `rtsp://VM_IP/cam/realmonitor?channel=1&subtype=0` |
| Axis | `rtsp://VM_IP/axis-media/media.amp` |
| Reolink | `rtsp://VM_IP/h264Preview_01_main` |

Port `554` does not need to be written in the URL because it is the RTSP default.

## No-auth RTSP Cameras

No-auth RTSP behavior is controlled by:

```env
NO_AUTH_RTSP_BRANDS=dahua,axis,reolink
```

If a brand is listed there, RTSP readers for that brand are allowed without
credentials. If a brand is not listed, the stream requires valid credentials.

The same idea exists for the web pages:

```env
NO_AUTH_WEB_BRANDS=dahua,axis,reolink
```

The current single-camera override files already set no-auth values for Dahua,
Axis, and Reolink. Hikvision single-camera deployment keeps authentication
enabled by default.

## Testing

Use `ffplay` from a client machine:

```powershell
ffplay "rtsp://admin:12345@VM_IP/Streaming/Channels/101"
ffplay "rtsp://VM_IP/cam/realmonitor?channel=1&subtype=0"
ffplay "rtsp://VM_IP/axis-media/media.amp"
ffplay "rtsp://VM_IP/h264Preview_01_main"
```

For a multi-camera deployment, include the vendor-specific public port:

```powershell
ffplay "rtsp://admin:12345@VM_IP:8554/Streaming/Channels/101"
ffplay "rtsp://VM_IP:8555/cam/realmonitor?channel=1&subtype=0"
ffplay "rtsp://VM_IP:8556/axis-media/media.amp"
ffplay "rtsp://VM_IP:8557/h264Preview_01_main"
```

Check MediaMTX logs:

```bash
docker logs --tail 80 rtsp_h264_media_service
```

You should see publishers becoming available, for example:

```text
stream is available and online, 1 track (H264)
```

Check the public RTSP banner with an `OPTIONS` request. A successful updated
deployment should expose:

```text
Server: RTSP Server
```

## Legacy Node RTSP Service

The Node.js RTSP server still exists in this folder and is still useful for
research around RTSP request parsing, authentication behavior, logging, and
brand-specific protocol emulation.

In the current deployment it should be treated as a fallback/legacy component.
The realistic public video feed is the H.264 MediaMTX stream, not the old MJPEG
Node stream.

Legacy services in `docker-compose.yml` include:

```text
rtsp_main
rtsp_hikvision
rtsp_dahua
rtsp_axis
rtsp_reolink
rtsp_mobotix
rtsp_vstarcam
```

Do not start those services for the normal current deployment unless you are
explicitly testing the old Node RTSP implementation.

## Useful Files

- `Dockerfile`: base image used by the FFmpeg publisher containers and legacy Node RTSP service.
- `rtsp-server.js`: legacy Node RTSP server.
- `media/camera-loop-720p15.mp4`: current looped H.264 source video.
- `mediamtx.yml`: MediaMTX runtime configuration.
- `mediamtx-custom/Dockerfile`: custom pinned MediaMTX build.
- `mediamtx-custom/rtsp-server-banner.patch`: patch for the RTSP banner string.
