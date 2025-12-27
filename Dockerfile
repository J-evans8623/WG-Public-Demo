# -----------------------------------------------------------------------------
# PRODUCTION DOCKERFILE FOR NEXT.JS (Stable SWC Build)
# - Uses Debian (glibc) instead of Alpine (musl) to prevent SWC binary failures
# - Multi-stage: deps -> builder -> runner
# -----------------------------------------------------------------------------

# 1. Base Image (glibc)
FROM node:18-bookworm-slim AS base
WORKDIR /app

# 2. Dependencies Stage
FROM base AS deps
WORKDIR /app

# Minimal packages (safe defaults)
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# 3. Builder Stage
FROM base AS builder
WORKDIR /app

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Disable telemetry
ENV NEXT_TELEMETRY_DISABLED=1
# --- [CRITICAL UPDATE] ---
# Accept Build Arguments passed by Coolify
# These are required for 'npm run build' to bake public vars into the JS bundles.

ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_API_SERVER_URL
ARG NEXT_PUBLIC_YJS_ENDPOINT
ARG NEXT_PUBLIC_WEBSOCKET_ORIGIN
ARG NEXT_PUBLIC_WEBSOCKET_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_YJS_WS_URL

# Map ARGs to ENVs so Next.js build process can see them
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_API_SERVER_URL=$NEXT_PUBLIC_API_SERVER_URL
ENV NEXT_PUBLIC_YJS_ENDPOINT=$NEXT_PUBLIC_YJS_ENDPOINT
ENV NEXT_PUBLIC_WEBSOCKET_ORIGIN=$NEXT_PUBLIC_WEBSOCKET_ORIGIN
ENV NEXT_PUBLIC_WEBSOCKET_URL=$NEXT_PUBLIC_WEBSOCKET_URL
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_YJS_WS_URL=$NEXT_PUBLIC_YJS_WS_URL

# Also inject the Mock Trigger for Firebase (so it doesn't crash on missing file)
# We don't need the file path here, just the knowledge that it's a build.
# (npm_lifecycle_event=build is automatic, but we can set a flag just in case)
ENV IS_DOCKER_BUILD=true

# Build Next.js
RUN npm run build

# Build the schema scripts
RUN npm run build:scripts

# 4. Runner Stage
FROM node:18-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public folder
COPY --from=builder /app/public ./public

# Copy standalone output (requires next.config output: "standalone")
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy your dist scripts
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist

# Create keys folder (volume can mount over it at runtime)
RUN mkdir -p ./keys && chown -R nextjs:nodejs ./keys

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>{if(!r.ok) throw new Error();}).catch(()=>process.exit(1));"

CMD ["sh", "-c", "node dist/setSchema.js && node server.js"]