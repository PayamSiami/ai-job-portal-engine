FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

ENV PORT=5000
EXPOSE 5000
CMD ["node", "dist/app.js"]