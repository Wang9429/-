#!/usr/bin/env bash
# 在已备案域名解析到本机的中国大陆云主机上安装本原型。
# 不连接 Cursor、GitHub Pages 或 Vercel。需要：root 或 sudo、Docker、80/443、证书或随后用 certbot 申请。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="$ROOT/deploy"
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"
MODE="${MODE:-https}" # https | bootstrap

if [[ "${EUID}" -ne 0 ]]; then
  echo "请用 root 或 sudo 运行。" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "未检测到 Docker，尝试用阿里云镜像安装……"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y ca-certificates curl
    curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
  elif command -v yum >/dev/null 2>&1; then
    yum install -y yum-utils
    yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
    yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable --now docker
  else
    echo "请先安装 Docker Engine 与 Compose 插件。" >&2
    exit 1
  fi
fi

mkdir -p "$COMPOSE_DIR/certs" "$COMPOSE_DIR/certbot-www"
if [[ ! -f "$COMPOSE_DIR/.env" && -f "$COMPOSE_DIR/env.example" ]]; then
  cp "$COMPOSE_DIR/env.example" "$COMPOSE_DIR/.env"
fi

if [[ "$MODE" == "bootstrap" ]]; then
  echo "使用 HTTP 引导配置申请证书。验收前必须切回 HTTPS。"
  docker compose --project-directory "$COMPOSE_DIR" \
    -f "$COMPOSE_DIR/docker-compose.yml" \
    -f "$COMPOSE_DIR/docker-compose.bootstrap.yml" \
    up -d --build
  echo "HTTP 已启动。申请证书示例："
  echo "  certbot certonly --webroot -w $COMPOSE_DIR/certbot-www -d ${DOMAIN:-your.example.com} --email ${EMAIL:-ops@example.com} --agree-tos"
  echo "  cp /etc/letsencrypt/live/${DOMAIN:-your.example.com}/fullchain.pem $COMPOSE_DIR/certs/"
  echo "  cp /etc/letsencrypt/live/${DOMAIN:-your.example.com}/privkey.pem $COMPOSE_DIR/certs/"
  echo "  MODE=https $0"
  exit 0
fi

if [[ ! -f "$COMPOSE_DIR/certs/fullchain.pem" || ! -f "$COMPOSE_DIR/certs/privkey.pem" ]]; then
  echo "缺少 $COMPOSE_DIR/certs/fullchain.pem 或 privkey.pem。" >&2
  echo "请先放入 TLS 证书，或 MODE=bootstrap $0 走 HTTP 申请证书（申请后必须改回 HTTPS）。" >&2
  exit 1
fi

docker compose --project-directory "$COMPOSE_DIR" \
  -f "$COMPOSE_DIR/docker-compose.yml" \
  up -d --build

echo "服务已按 HTTPS 编排启动。"
echo "请从中国大陆普通网络打开：https://${DOMAIN:-<已备案域名>}/overview"
echo "并执行：bash deploy/check-mainland-access.sh https://${DOMAIN:-<已备案域名>}"
