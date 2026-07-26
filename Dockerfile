FROM node:20-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies (no dev dependencies needed)
RUN npm install --omit=dev && npm cache clean --force

# Copy the pre-built dist folder and src (for reference)
COPY dist ./dist
COPY src ./src 2>/dev/null || echo "No src folder"

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "dist/app.js"]