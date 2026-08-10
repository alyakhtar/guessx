# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Use `npm install` (not `npm ci`) so the build does not require a committed
# lockfile that exactly matches package.json. Keeps CI/dev in sync without a
# brittle lockfile-commit step.
COPY package.json ./
RUN npm install

# Stage 2: Build the Next.js app
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/server ./server
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/i18n.ts ./i18n.ts
COPY --from=builder /app/i18n ./i18n
COPY --from=builder /app/next-intl.config.js ./next-intl.config.js
COPY --from=builder /app/messages ./messages

USER nextjs

EXPOSE 8082

CMD ["node", "server.js"]
