FROM node:18-slim

WORKDIR /app

# Install Docker CLI and sudo
RUN apt-get update && apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    sudo \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

#copy package files
COPY package*.json ./

#install dependencies
RUN npm ci

#copy the rest of the application
COPY . .



#expose the port
EXPOSE 3000

# Ensure proper permissions for Docker socket
RUN chown -R root:root /app

#start the application
CMD ["npm", "start"]
