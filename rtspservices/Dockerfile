FROM node:18-alpine
WORKDIR /app

#install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

#copy package.json and install dependencies
COPY package*.json ./
RUN npm ci 

#copy the RTSP server and fallback images
COPY . .

# Ensure fallback images are available
RUN ls -la *.jpg *.png 2>/dev/null || echo "No image files found, will use fallback frame"

EXPOSE 554 8002 8003 8004 8005

CMD ["node", "rtsp-server.js"]