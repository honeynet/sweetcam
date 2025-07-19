FROM node:18-alpine
WORKDIR /app

#install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

#copy package.json and install dependencies
COPY package*.json ./
RUN npm ci 

#copy the RTSP server and test image
COPY . .

EXPOSE 554 8002 8003 8004 8005

CMD ["node", "rtsp-server.js"]