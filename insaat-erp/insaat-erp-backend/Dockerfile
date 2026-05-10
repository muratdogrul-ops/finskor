FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
# tsc .sql dosyalarını dist'e kopyalamaz; migration çalışması için zorunlu
RUN mkdir -p dist/migrations && cp src/migrations/*.sql dist/migrations/
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
