FROM node:18
WORKDIR /usr/app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8002
CMD [ "node", "server.js" ]
