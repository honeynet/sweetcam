# Web Services

This folder contains the **main web application**.

### Directory structure
- **`config/`** - Camera brand configurations and database settings
- **`controllers/`** - Request handlers for admin and camera operations
- **`database/`** - Database connection and models
- **`locales/`** - Internationalization files (en, es)
- **`logs/`** - Application log files
- **`model/`** - Database models for users and admins
- **`public/`** - Static assets (images, videos, JavaScript)
- **`services/`** - Business logic services
- **`utils/`** - Utility functions (JWT, logging, email, Telegram)
- **`views/`** - Pug template files for camera interfaces

## Features

### Multi-brand support
- **Dahua** (Port 37777)
- **Hikvision** (Port 80)
- **VStarcam** (Port 81)
- **Mobotix** (Port 443)
- **Axis** (Port 10000)
- **Reolink** (Port 8081)

### Database-backed camera profiles

The web services can load generated camera metadata from the MySQL
`camera_profiles` table. When a matching vendor profile exists, the web pages
use that profile for values such as model names, firmware-like metadata, stream
paths, and page titles. If no generated profile exists for a vendor, the service
uses its static fallback values.

### No-auth camera mode

Public/no-auth web access is controlled with:

```env
NO_AUTH_WEB_BRANDS=dahua,axis,reolink
PUBLIC_VIEWER_USERNAME=guest
```

Brands listed in `NO_AUTH_WEB_BRANDS` can expose their camera page without a
normal login flow. Brands not listed there still require credentials.

RTSP no-auth behavior is controlled separately by:

```env
NO_AUTH_RTSP_BRANDS=dahua,axis,reolink
```

For one-camera-per-VM deployments, the single-camera compose overrides already
set the intended no-auth values for Dahua, Axis, and Reolink. Hikvision remains
authenticated by default.

### Current stream integration

The video shown in the camera web interface is aligned with the current H.264
RTSP implementation. The public RTSP host is controlled by:

```env
PUBLIC_RTSP_HOST=VM_IP
```

or, with the current override files:

```env
PUBLIC_IP=VM_IP
```

The web service also uses the `MEDIAMTX_*_RTSP_PORT` variables to show correct
stream URLs when a deployment maps RTSP to vendor-specific ports or to the
standard single-camera port `554`.

### HTTP fingerprint cleanup

The Express `X-Powered-By` header is disabled so external scanners do not see an
obvious Express application banner in normal HTTP responses.

