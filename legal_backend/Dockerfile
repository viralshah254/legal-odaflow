FROM node:22.18.0-alpine AS builder

WORKDIR /usr/app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

# One production node_modules tree (includes prisma CLI for migrate deploy).
# Strip tests/docs/maps to shrink the layer copied into the runtime image.
RUN npm prune --omit=dev \
 && npm install --no-save "prisma@$(node -p "require('./package.json').devDependencies.prisma.replace(/^\\^/, '')")" \
 && find node_modules -type d \( \
      -name test -o -name tests -o -name __tests__ -o -name docs \
      -o -name examples -o -name .github -o -name coverage \
    \) -prune -exec rm -rf {} + 2>/dev/null || true \
 && find node_modules -type f \( \
      -name '*.md' -o -name '*.map' -o -name 'LICENSE*' -o -name 'CHANGELOG*' \
    \) -delete 2>/dev/null || true \
 && rm -rf node_modules/typescript node_modules/swagger-ui-dist 2>/dev/null || true \
 && npm cache clean --force

FROM node:22.18.0-alpine AS production

WORKDIR /usr/app

# Headless Chromium for PDF export (HTML → PDF via puppeteer-core).
# Host EC2 Chrome is glibc/Ubuntu and cannot run inside this Alpine image.
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
 && rm -rf /var/cache/apk/*

ARG GIT_COMMIT_SHA=unknown
ARG GIT_BRANCH=unknown
ARG BUILD_TIME=unknown
ARG CI_WORKFLOW=local
ARG CI_RUN_ID=local
ARG DEPLOY_PROBE_MARKER=local-dev
ARG DOCKER_IMAGE_REPO=ayienda/legal-byodaflow

ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV GIT_COMMIT_SHA=$GIT_COMMIT_SHA
ENV GIT_BRANCH=$GIT_BRANCH
ENV BUILD_TIME=$BUILD_TIME
ENV CI_WORKFLOW=$CI_WORKFLOW
ENV CI_RUN_ID=$CI_RUN_ID
ENV DEPLOY_PROBE_MARKER=$DEPLOY_PROBE_MARKER
ENV DOCKER_IMAGE_REPO=$DOCKER_IMAGE_REPO

COPY package*.json ./
COPY prisma ./prisma
COPY --from=builder /usr/app/dist ./dist
COPY --from=builder /usr/app/node_modules ./node_modules

# Statute corpus (India PDFs + manifests) is mounted from the host in docker-stack.yml
# so ~65MB of PDFs are not duplicated in every image pull.

EXPOSE 4000

CMD ["node", "dist/main.js"]
