FROM node:22-alpine AS deps

WORKDIR /app

COPY apps/web/package.json apps/web/package-lock.json ./

RUN npm ci

FROM node:22-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_BASE=http://localhost:8080
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000

ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY apps/web ./

RUN mkdir -p public && npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
