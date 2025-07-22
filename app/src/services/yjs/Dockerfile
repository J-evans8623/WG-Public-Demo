# ──────────────────────────────────────────────────────────────────
# Lightweight image with only what the Yjs server needs
# ──────────────────────────────────────────────────────────────────
FROM node:18-alpine

# 1. work inside the server package
WORKDIR /app

# 2. install runtime deps declared in packages/yjs-server/package.json
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 3. copy the actual server source
COPY . .

# 4. drop privileges
RUN addgroup -g 1001 -S nodejs \
 && adduser  -S yjs -u 1001 \
 && chown -R yjs:nodejs /app
USER yjs

# 5. this process listens on 1234
EXPOSE 1234

# 6. simple L4 health-check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:1234/health || exit 1

CMD ["npm", "start"]
