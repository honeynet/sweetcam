# RTSP Services

This folder contains the **RTSP (Real Time Streaming Protocol) streaming service** with **authentication support**.

## Functionality

### RTSP protocol support
- **OPTIONS** - Server capabilities discovery
- **DESCRIBE** - Stream information and SDP 
- **SETUP** - Session establishment and transport configuration 
- **PLAY** - Start video streaming 
- **PAUSE** - Pause video streaming 
- **TEARDOWN** - Session termination 

### Authentication System
The RTSP server implements **HTTP Basic Authentication** with **database integration**.

#### Authentication Methods
**URL Credentials** (VLC style):
   ```shell
   vlc rtsp://jimmy:1234567@127.0.0.1:554/stream
   ```

#### Session-Based Authentication
- Authentication is required for DESCRIBE, SETUP, PLAY, PAUSE, and TEARDOWN methods
- OPTIONS requests are allowed without authentication for client discovery
- Once authenticated during SETUP, the session remains authenticated for subsequent requests
- Username comparison is case-insensitive (e.g., 'jimmy', 'Jimmy', 'JIMMY' all work)


