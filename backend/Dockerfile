# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app

# Cài dependencies riêng 1 layer: chỉ chạy lại khi package*.json thay đổi
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ---- Development: hot reload (dùng với docker compose watch) ----
FROM deps AS dev
COPY . .
EXPOSE 3000
# Gọi thẳng binary thay vì `npm run` để bớt 1 process npm thường trú
CMD ["node_modules/.bin/nest", "start", "--watch"]

# ---- Production ----
FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

FROM base AS prod
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
