FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY shared/ ./shared/
COPY notification-service/ ./notification-service/
COPY tsconfig.json ./
EXPOSE 3002
CMD ["npx", "tsx", "notification-service/src/index.ts"]
