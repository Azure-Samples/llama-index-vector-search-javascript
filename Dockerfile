# syntax=docker/dockerfile:1

# Use full image because we need node-gyp to build native dependencies
FROM node:20-alpine AS build

RUN npm install -g pnpm@9.15.9 && \
    npm cache clean --force

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm add sharp

# Build the application
COPY . .
RUN pnpm build

# ====================================
FROM build AS release

# avoid using npm scripts that create sub-shells
# calling next binary directly
CMD ["/app/node_modules/.bin/next", "start"]