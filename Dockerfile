# -----------------------------------------------------------------------------
# PRODUCTION DOCKERFILE FOR NEXT.JS
# -----------------------------------------------------------------------------

# 1. Base Image
FROM node:18-alpine AS base

# 2. Dependencies Stage
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json* ./

# Install dependencies (clean install)
RUN npm ci

# 3. Builder Stage
FROM base AS builder
WORKDIR /app

# Copy node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# COPY SOURCE CODE
COPY . .

# Disable telemetry
ENV NEXT_TELEMETRY_DISABLED 1

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

# BUILD THE APPLICATION
RUN npm run build

# Build the schema scripts
RUN npm run build:scripts

# 4. Runner Stage (Production)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public folder
COPY --from=builder /app/public ./public

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy keys folder (Note: Volume mount will override this empty dir at runtime)
# We create it here to ensure permissions are correct if the volume fails
RUN mkdir -p ./keys && chown nextjs:nodejs ./keys

# Set permissions
USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

COPY --from=builder /app/dist ./dist

CMD ["sh", "-c", "node dist/setSchema.js && node server.js"]