# syntax=docker/dockerfile:1

# ---- Build stage -----------------------------------------------------------
# Vite 6 supports Node ^18 || ^20 || >=22 — use the current LTS alpine image.
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first (cached layer — only invalidated when the lockfile
# changes). `npm ci` installs devDependencies too, which vite/vue-tsc need.
COPY package.json package-lock.json ./
RUN npm ci

# Type-check (vue-tsc --noEmit) + build -> dist/
COPY . .
RUN npm run build

# ---- Runtime stage ---------------------------------------------------------
# The app is a fully static PWA after build — plain nginx is enough (low RAM,
# no Node process at runtime).
FROM nginx:1.27-alpine

# SPA fallback, cache headers, gzip (see nginx.conf comments).
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx runs in the foreground via the stock entrypoint; no CMD override needed.
