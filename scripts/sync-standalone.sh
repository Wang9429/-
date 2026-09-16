#!/usr/bin/env bash
# 把构建产物整理成 Next standalone 可执行目录（不经过 tar）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/.next/standalone"
if [[ ! -f "$DEST/server.js" ]]; then
  echo "请先 npm run build（output: standalone）" >&2
  exit 1
fi
mkdir -p "$DEST/.next/static" "$DEST/public"
rm -rf "$DEST/.next/static"
cp -a "$ROOT/.next/static" "$DEST/.next/static"
if [[ -d "$ROOT/public" ]]; then
  cp -a "$ROOT/public/." "$DEST/public/"
fi
echo "已同步静态资源到 $DEST"
echo "启动：HOSTNAME=0.0.0.0 PORT=43917 node $DEST/server.js"
