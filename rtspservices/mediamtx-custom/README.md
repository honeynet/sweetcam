# SweetCam MediaMTX image

This build pins MediaMTX to `v1.18.2` and replaces the default RTSP library
banner string `Gortsplib` with the generic banner `RTSP Server`.

The goal is to keep MediaMTX's H.264 RTSP behavior while removing the
library-specific fingerprint that external scanners can report on port 554.

The image is used by the `rtsp_h264_media` service. Camera-specific web,
ONVIF, authentication, and publisher behavior stays outside this image.
