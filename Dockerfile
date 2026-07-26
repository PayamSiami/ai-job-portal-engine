FROM node:20-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Start the app
CMD ["sh", "-c", "if [ -f \"dist/app.js\" ]; then node dist/app.js; else node src/app.js; fi"]