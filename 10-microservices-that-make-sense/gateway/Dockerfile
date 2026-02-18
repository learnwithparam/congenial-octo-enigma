FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY shared/ ./shared/
COPY gateway/ ./gateway/
COPY tsconfig.json ./
EXPOSE 3000
CMD ["npx", "tsx", "gateway/src/index.ts"]
