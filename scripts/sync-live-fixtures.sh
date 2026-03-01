#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURE_DIR="$ROOT_DIR/test/fixtures/live"
TARGET_URL="https://www.zjut.edu.cn/xqbc/list.htm"
BASE_URL="https://www.zjut.edu.cn"
RESOLVE_IP="60.191.28.6"

mkdir -p "$FIXTURE_DIR"

curl_with_retry() {
  local url="$1"
  local output="$2"
  if curl -L -sS \
    --retry 5 \
    --retry-all-errors \
    --retry-delay 2 \
    --max-time 30 \
    "$url" \
    -o "$output"; then
    return 0
  fi

  # DNS 解析失败时，回退到固定 IP + SNI 方式
  curl -L -sS \
    --retry 3 \
    --retry-all-errors \
    --retry-delay 2 \
    --max-time 30 \
    --resolve "www.zjut.edu.cn:443:${RESOLVE_IP}" \
    "$url" \
    -o "$output"
}

curl_with_retry "$TARGET_URL" "$FIXTURE_DIR/list.html"

first_path="$(
  rg -o "href=['\"][^'\"]+/page\\.htm['\"]" "$FIXTURE_DIR/list.html" \
    | head -n 1 \
    | sed -E "s/^href=['\"]//; s/['\"]$//"
)"

if [[ -z "${first_path}" ]]; then
  echo "failed to extract first notice detail path from list.html" >&2
  exit 1
fi

if [[ "$first_path" =~ ^https?:// ]]; then
  detail_url="$first_path"
else
  detail_url="${BASE_URL}${first_path}"
fi

curl_with_retry "$detail_url" "$FIXTURE_DIR/detail.html"
printf "%s\n" "$detail_url" > "$FIXTURE_DIR/detail.url"
