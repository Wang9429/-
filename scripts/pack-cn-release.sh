#!/usr/bin/env bash
# 生成可拷到中国大陆云主机的部署包。产物不包含临时隧道或 Vercel 链接。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SHA="$(git rev-parse HEAD)"
SHORT="$(git rev-parse --short HEAD)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${OUT_DIR:-$ROOT/dist}"
ART="${ARTIFACT_DIR:-/opt/cursor/artifacts}"
SRC_NAME="cnooc-supervision-cn-src-${SHORT}"
BIN_NAME="cnooc-supervision-cn-standalone-${SHORT}"
STAGE="$OUT/stage"

rm -rf "$STAGE"
mkdir -p "$STAGE/$SRC_NAME" "$STAGE/$BIN_NAME" "$OUT" "$ART"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "[pack] 构建 Next.js standalone（$SHORT）"
  if [[ ! -d node_modules ]]; then
    npm ci
  fi
  NEXT_TELEMETRY_DISABLED=1 npm run build
else
  echo "[pack] SKIP_BUILD=1，使用已有 .next"
  if [[ ! -f .next/standalone/server.js ]]; then
    echo "缺少 .next/standalone/server.js" >&2
    exit 1
  fi
fi

echo "[pack] 组装源码部署包（到国内主机再 docker build）"
tar -C "$ROOT" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.vercel' \
  --exclude='dist' \
  --exclude='coverage' \
  -cf - . | tar -C "$STAGE/$SRC_NAME" -xf -

cat > "$STAGE/$SRC_NAME/RELEASE.txt" <<EOF
name=cnooc-eng-penetrating-supervision-demo
version=1.6.1
commit=$SHA
built_at_utc=$STAMP
pack=source-for-cn-cloud
mainland_deployed=no
fixed_https_url=(none)
EOF

echo "[pack] 组装预构建独立运行包（国内主机只需 Node 20+）"
cp -a "$ROOT/.next/standalone/." "$STAGE/$BIN_NAME/"
mkdir -p "$STAGE/$BIN_NAME/.next/static" "$STAGE/$BIN_NAME/public"
cp -a "$ROOT/.next/static/." "$STAGE/$BIN_NAME/.next/static/"
if [[ -d "$ROOT/public" ]]; then
  cp -a "$ROOT/public/." "$STAGE/$BIN_NAME/public/"
fi
cp "$ROOT/deploy/check-mainland-access.sh" "$STAGE/$BIN_NAME/"
cat > "$STAGE/$BIN_NAME/RELEASE.txt" <<EOF
name=cnooc-eng-penetrating-supervision-demo
version=1.6.1
commit=$SHA
built_at_utc=$STAMP
pack=prebuilt-standalone
mainland_deployed=no
fixed_https_url=(none)
start=HOSTNAME=0.0.0.0 PORT=43917 node server.js
EOF
cat > "$STAGE/$BIN_NAME/start.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1
export ENABLE_SOURCE_PACKAGE=0
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-43917}"
exec node server.js
EOF
chmod +x "$STAGE/$BIN_NAME/start.sh" "$STAGE/$BIN_NAME/check-mainland-access.sh"

echo "[pack] 打包 tar.gz"
tar -C "$STAGE" -czf "$OUT/${SRC_NAME}.tar.gz" "$SRC_NAME"
tar -C "$STAGE" -czf "$OUT/${BIN_NAME}.tar.gz" "$BIN_NAME"
cp -f "$OUT/${SRC_NAME}.tar.gz" "$ART/${SRC_NAME}.tar.gz"
cp -f "$OUT/${BIN_NAME}.tar.gz" "$ART/${BIN_NAME}.tar.gz"

{
  echo "commit=$SHA"
  echo "src=$OUT/${SRC_NAME}.tar.gz"
  echo "standalone=$OUT/${BIN_NAME}.tar.gz"
  echo "mainland_deployed=no"
} | tee "$OUT/RELEASE.txt" "$ART/cnooc-cn-release-${SHORT}.txt"

echo "[pack] 完成。尚未部署到中国大陆云，无固定 HTTPS 交付地址。"
