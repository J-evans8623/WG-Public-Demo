# -----------------------------------------------------------------------------
# PRODUCTION DOCKERFILE FOR NEXT.JS
# -----------------------------------------------------------------------------

# 1. Base Image
FROM node:18-alpine AS base

# 2. Dependencies Stage
#    We install dependencies separately so Docker can cache them.
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json* ./

# Install dependencies (clean install)
RUN npm ci

# 3. Builder Stage
#    This stage copies your source code and builds the app.
FROM base AS builder
WORKDIR /app

# Copy node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# COPY SOURCE CODE
# This copies 'pages', 'components', 'lib', 'public', etc.
# It respects .dockerignore, so it skips local garbage.
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1

# BUILD THE APPLICATION
# This reads next.config.mjs and creates .next/standalone
RUN npm run build

# Build the schema scripts (creates /app/dist/setSchema.js)
RUN npm run build:scripts

# 4. Runner Stage (Production)
#    This is the final, small image that actually runs on the VPS.
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# --- CRITICAL ASSET COPYING ---

# 1. Copy the 'public' folder. 
# Next.js doesn't bundle this, so we copy it manually.
COPY --from=builder /app/public ./public

# 2. Copy the 'standalone' build.
# This contains the minimal necessary server code + node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# 3. Copy the 'static' assets.
# CSS, Images, and JS chunks generated during build.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Set permissions
USER nextjs

# Expose the port
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# We copy the 'dist' folder (where setSchema.js lives) from the builder stage first
COPY --from=builder /app/dist ./dist

# Then we run the schema check, THEN start the server
CMD ["sh", "-c", "node dist/setSchema.js && node server.js"]