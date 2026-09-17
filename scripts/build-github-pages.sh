#!/usr/bin/env bash
# GitHub Pages 静态导出。访客 Demo 不调用 /api/*；构建时暂移开以免 output: export 失败。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ASIDE=""
cleanup() {
  if [[ -n "$ASIDE" && -d "$ASIDE" ]]; then
    mkdir -p "$ROOT/app"
    mv "$ASIDE" "$ROOT/app/api"
  fi
}
trap cleanup EXIT

if [[ -d app/api ]]; then
  ASIDE="$(mktemp -d)"
  mv app/api "$ASIDE/api"
  ASIDE="$ASIDE/api"
fi

COMMIT="$(git rev-parse HEAD)"
SHORT="$(git rev-parse --short HEAD)"
mkdir -p public/deliverables
cat > public/deliverables/r32-build.json <<EOF
{"version":"FP-20260917-R3.2","commit":"$SHORT","full":"$COMMIT","stamped_at":"github-pages-build"}
EOF
echo "[pages] 打入部署提交 $SHORT"

export GITHUB_PAGES=1
export NEXT_TELEMETRY_DISABLED=1
npm run build
touch out/.nojekyll
echo "[pages] 静态导出完成：out/ （basePath=/-, trailingSlash） 提交 $SHORT"
