FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

RUN npm install
RUN npm run build

ENV PORT=5000
EXPOSE 5000

CMD ["node", "dist/app.js"]