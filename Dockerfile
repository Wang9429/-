# 海油工程穿透式监管平台 · 中国大陆独立运行镜像
# 国内机器构建示例：
#   docker build \
#     --build-arg NODE_IMAGE=docker.m.daocloud.io/library/node:22-bookworm-slim \
#     --build-arg NPM_REGISTRY=https://registry.npmmirror.com \
#     -t cnooc-supervision:1.6.1 .

ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS deps
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set registry "${NPM_REGISTRY}" \
  && npm ci

FROM ${NODE_IMAGE} AS builder
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm config set registry "${NPM_REGISTRY}" \
  && npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=43917
ENV HOSTNAME=0.0.0.0
ENV ENABLE_SOURCE_PACKAGE=0

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 43917
# Docker 会写入 HOSTNAME=容器名；必须在启动时覆盖，否则 Next 可能只绑在容器名上。
CMD ["sh", "-c", "export HOSTNAME=0.0.0.0 PORT=${PORT:-43917} ENABLE_SOURCE_PACKAGE=0; exec node server.js"]
