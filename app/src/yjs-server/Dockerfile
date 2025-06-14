# Dockerfile for Yjs collaboration server
# Responsibilities:
#  - Build a minimal Node.js image with only production dependencies.
#  - Expose configured PORT (default 1234).
FROM node:20-alpine
WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy server code
COPY . .

# Default environment variables
ENV PORT=1234

# Expose the port and launch
EXPOSE ${PORT}
CMD ["node", "server.js"]
