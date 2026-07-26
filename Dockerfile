FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

# Install ALL dependencies
RUN npm install

# Build
RUN npm run build

EXPOSE 5000

CMD ["node", "dist/app.js"]