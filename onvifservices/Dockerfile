FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose ports for ONVIF services
EXPOSE 3702/udp
EXPOSE 8080/tcp

# Set environment variables
ENV NODE_ENV=production

# Start the ONVIF honeypot
CMD ["npm", "start"] 
