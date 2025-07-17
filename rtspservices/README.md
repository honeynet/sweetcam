# RTSP Services

This folder contains the **RTSP (Real Time Streaming Protocol) streaming service**.

## Functionality

### RTSP protocol support
- **OPTIONS** - Server capabilities discovery
- **DESCRIBE** - Stream information and SDP
- **SETUP** - Session establishment and transport configuration
- **PLAY** - Start video streaming
- **TEARDOWN** - Session termination

### Video streaming
- Simulates JPEG video stream at 30fps
- Uses RTP for video data transmission
- Supports RTCP for stream control
- Generates deterministic timestamps for consistent playback

