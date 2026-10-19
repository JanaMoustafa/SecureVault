# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ── Stage 2: Production Image ───────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# Only copy what is needed
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs src ./src
COPY --chown=nodeuser:nodejs package.json ./

# Create upload directory with correct permissions
RUN mkdir -p /app/uploads && chown -R nodeuser:nodejs /app/uploads

USER nodeuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "src/server.js"]
