#!/bin/bash

# Check if camera type is provided
if [ -z "$1" ]; then
    echo "Usage: ./run-camera.sh [dahua|hikvision]"
    exit 1
fi

CAMERA_TYPE=$1

# Check if the camera type is valid
if [ "$CAMERA_TYPE" != "dahua" ] && [ "$CAMERA_TYPE" != "hikvision" ]; then
    echo "Invalid camera type. Use 'dahua' or 'hikvision'"
    exit 1
fi

# Export the camera type for docker-compose
export CAMERA_TYPE=$CAMERA_TYPE

# Run the specific camera instance
docker-compose up -d rtsp_service

echo "Started RTSP service with $CAMERA_TYPE configuration"
echo "You can access the streams at:"
echo "- Dahua: rtsp://localhost:8554/dahua"
echo "- Hikvision: rtsp://localhost:8554/hikvision" 