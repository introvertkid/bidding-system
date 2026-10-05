# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Cài dependencies riêng 1 layer: chỉ chạy lại khi package*.json thay đổi
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ---- Development: hot reload (dùng với docker compose watch) ----
FROM deps AS dev
COPY . .
EXPOSE 3001
# Gọi thẳng binary thay vì `npm run` để bớt 1 process npm thường trú
CMD ["node_modules/.bin/next", "dev", "-p", "3001"]

# ---- Production (output: standalone, chỉ copy phần cần để chạy) ----
FROM deps AS build
# NEXT_PUBLIC_* được nhúng vào bundle lúc build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
RUN npm run build

FROM base AS prod
ENV NODE_ENV=production PORT=3001 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3001
CMD ["node", "server.js"]
