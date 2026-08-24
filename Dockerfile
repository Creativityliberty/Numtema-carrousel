# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build Vite frontend + bundle Express server
RUN npm run build

# ── Production stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Only copy built artefacts and runtime deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Runtime config
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health-check so Coolify knows when the container is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/projects || exit 1

CMD ["node", "dist/server.cjs"]
