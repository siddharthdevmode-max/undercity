# ════════════════════════════════════════════════════════════
# UNDERCITY BACKEND DOCKERFILE
# Multi-stage build for smaller production image
# ════════════════════════════════════════════════════════════

# ─── Stage 1: Build ───
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY tsconfig.json ./
COPY eslint.config.mjs ./
COPY src ./src
RUN npm run build

# ─── Stage 2: Production ───
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY migrations ./migrations

RUN addgroup -g 1001 -S nodejs && \
    adduser -S undercity -u 1001 && \
    chown -R undercity:nodejs /app
USER undercity

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
