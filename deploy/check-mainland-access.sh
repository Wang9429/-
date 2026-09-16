#!/usr/bin/env bash
# 在中国大陆普通网络（无需 VPN）的机器上检查正式站点。
# 用法：bash deploy/check-mainland-access.sh https://your-icp-domain.example
set -euo pipefail

BASE="${1:-}"
if [[ -z "$BASE" ]]; then
  echo "用法: $0 https://已备案域名" >&2
  exit 1
fi
BASE="${BASE%/}"

fail=0
check() {
  local path="$1"
  local url="${BASE}${path}"
  local code
  code="$(curl -sS -o /tmp/cnooc-cn-body --connect-timeout 15 --max-time 30 -w '%{http_code}' -L "$url" || true)"
  if [[ "$code" != "200" ]]; then
    echo "FAIL  $code  $url"
    fail=1
    return
  fi
  if grep -Eiq 'localhost:|127\.0\.0\.1|ngrok|trycloudflare|loca\.lt|googleapis\.com|gstatic\.com|fonts\.google' /tmp/cnooc-cn-body; then
    echo "FAIL  页面引用了本机、隧道或境外字体/脚本  $url"
    fail=1
    return
  fi
  echo "OK    $code  $url"
}

echo "检查目标: $BASE"
echo "请确认本机出口不在 VPN / 代理下。"
check /api/health
check /overview
check /funds
check /property-rights
check /settings
check /overview

if [[ "$fail" -ne 0 ]]; then
  echo "未通过。不能把该地址当作大陆验收通过。"
  exit 1
fi
echo "HTTP 检查通过。请再在浏览器中：直接打开、刷新、点击综合总览/资金/产权/系统配置关键入口。"
