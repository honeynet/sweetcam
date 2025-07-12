FROM node:18-alpine
WORKDIR /app

#install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

#copy the RTSP server and test image
COPY rtsp-server.js ./
COPY img.jpg ./

EXPOSE 554 8002 8003 8004 8005

CMD ["node", "rtsp-server.js"]