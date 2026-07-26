# Better Production Stage
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Optimize dependency installation
COPY package*.json ./
COPY package-lock*.json ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

USER nodejs
EXPOSE 5000

# Better health check using node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health',(r)=>{r.statusCode===200?process.exit(0):process.exit(1)})" || exit 1

CMD ["node", "dist/app.js"]