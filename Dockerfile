FROM node:20-alpine AS builder

WORKDIR /app

# Install ALL dependencies (including devDependencies for the build)
COPY package*.json ./
RUN npm ci --include=dev --no-audit --no-fund

# Copy source and build
COPY . .
RUN npm run build

# Production stage — only runtime dependencies needed here
FROM node:20-alpine
WORKDIR /app

# Copy built output from builder
COPY --from=builder /app/dist ./dist

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

ENV PORT=5000
EXPOSE 5000
CMD ["node", "dist/app.js"]