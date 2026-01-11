FROM node:20-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN mkdir -p /app/logs /app/uploads && chown -R node:node /app
USER node
EXPOSE 37100
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:37100/health || exit 1
CMD ["node", "server.js"]
