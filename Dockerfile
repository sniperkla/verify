# =======================================================
# 1. DEPENDENCIES STAGE
# =======================================================
# FIXED: Changed base image from node:18-alpine to node:20-alpine
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock*.json ./

# Force alternative matching architectures if cross-compiled via Apple Silicon Mac
RUN npm ci --force || npm install --force

# =======================================================
# 2. BUILDER STAGE
# =======================================================
# FIXED: Changed base image from node:18-alpine to node:20-alpine
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# =======================================================
# 3. PRODUCTION RUNNER STAGE
# =======================================================
# FIXED: Changed base image from node:18-alpine to node:20-alpine
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Set up secure unprivileged system users
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy static assets
COPY --from=builder /app/public ./public

# Setup shared persistent media volumes with correct permissions
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

# Optimize execution layers using Next.js standalone output tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
