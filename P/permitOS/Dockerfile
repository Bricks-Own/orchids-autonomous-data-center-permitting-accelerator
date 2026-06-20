# ─── Brick PermitOS — Production Dockerfile ──────────────────────────────
# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Stage 2: Build backend dependencies
FROM node:22-alpine AS backend-builder
WORKDIR /app/server
RUN apk add --no-cache python3 make g++
RUN corepack enable
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Stage 3: Production image
FROM node:22-alpine
WORKDIR /app

# Create non-root user
RUN addgroup -S permitos && adduser -S permitos -G permitos

# Copy backend
COPY --from=backend-builder /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY src/ ./src/

# Copy built frontend
COPY --from=frontend-builder /app/dist ./dist

# Set production defaults
ENV NODE_ENV=production
ENV PORT=3001
ENV CORS_ORIGIN=http://localhost:3001
ENV LOG_LEVEL=info

# Data directory for SQLite
RUN mkdir -p /app/data && chown -R permitos:permitos /app

USER permitos
EXPOSE 3001
VOLUME ["/app/data"]

WORKDIR /app/server
CMD ["node", "server.js"]
