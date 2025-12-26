FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma

RUN npm install --no-audit --no-fund
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

EXPOSE 8080
CMD ["npm","run","start"]
