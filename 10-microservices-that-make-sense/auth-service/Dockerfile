FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY shared/ ./shared/
COPY auth-service/ ./auth-service/
COPY tsconfig.json ./
EXPOSE 3001
CMD ["npx", "tsx", "auth-service/src/index.ts"]
