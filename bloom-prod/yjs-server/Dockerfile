# -----------------------------------------------------------------------------
# Dockerfile for Yjs Server v2 (Production)
# -----------------------------------------------------------------------------

########################
# 1) Builder (compile) #
########################
FROM node:18-alpine AS builder
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci --only=production
RUN npm install --no-save typescript @types/node

# ---- Copy Source ----
# We need to preserve the src/yws structure for the build imports to work
COPY src/yws/secureSetupWSConnection.ts ./src/yws/secureSetupWSConnection.ts

# Create ambient types
RUN mkdir -p src/types && printf "declare module 'lib0/decoding' {\n\
  export type Decoder = { pos: number };\n\
  export function createDecoder(buf: Uint8Array): Decoder;\n\
  export function readVarUint(dec: Decoder): number;\n\
  export function readVarUint8Array(dec: Decoder): Uint8Array;\n\
}\n\
declare module 'y-websocket/bin/utils' {\n\
  export const setupWSConnection: (conn: any, req: any, opts: any) => void;\n\
}\n" > src/types/ambient.d.ts

# Generate tsconfig
RUN node -e "require('fs').writeFileSync('tsconfig.json', JSON.stringify({\
  compilerOptions:{\
    target:'ES2019', module:'commonjs', outDir:'yws', esModuleInterop:true,\
    strict:false, skipLibCheck:true, moduleResolution:'node', lib:['ES2019']\
  },\
  include:['src/**/*.ts']\
}, null, 2))"

# Compile
RUN npx tsc

######################
# 2) Runtime (lean)  #
######################
FROM node:18-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=1234
ENV JWT_PUBLIC_PATH=/app/keys/jwt_2025.pub

# Copy deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/yws /app/yws

# Copy main server file
COPY yjs-serverv2.js ./yjs-serverv2.js

# Copy Keys
COPY keys/jwt_2025.pub /app/keys/jwt_2025.pub

# Security: Run as non-root
RUN addgroup -g 1001 -S nodejs && adduser -S yjs -u 1001 && chown -R yjs:nodejs /app
USER yjs

EXPOSE 1234

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:1234/healthz || exit 1

CMD ["node", "/app/yjs-serverv2.js"]