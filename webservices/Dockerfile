FROM node:18-slim

WORKDIR /app

#copy package files
COPY package*.json ./

#install dependencies
RUN npm install

#copy the rest of the application
COPY . .


#expose the port
EXPOSE 3000

#start the application
CMD ["npm", "start"]
