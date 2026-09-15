#!/usr/bin/env bash
# 常驻演示服务：生产构建启动，进程意外退出时自动拉起。
set -u
cd "$(dirname "$0")/.."
PORT="${PORT:-43917}"

if [ ! -d .next ]; then
  echo "[serve-demo] 未找到构建产物，先执行 next build"
  npx next build || exit 1
fi

while true; do
  echo "[serve-demo] $(date '+%F %T') 启动 next start -p ${PORT}"
  npx next start -H 0.0.0.0 -p "${PORT}"
  echo "[serve-demo] $(date '+%F %T') 进程退出，3 秒后重启"
  sleep 3
done
