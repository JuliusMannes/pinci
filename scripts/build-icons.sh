#!/bin/sh
# Renders the PWA / home-screen icons (a red seal stamp with 拼 on rice paper) from SVG masters.
# Uses macOS Quick Look (WebKit) for rasterising and sips for resizing.
set -e
cd "$(dirname "$0")/.."
OUT=public/icons
TMP=$(mktemp -d)
mkdir -p "$OUT"

seal_svg() { # background inset radius fontsize
  cat <<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="$1"/>
  <rect x="$2" y="$2" width="$((1024 - 2 * $2))" height="$((1024 - 2 * $2))" rx="$3" fill="#b8322a"/>
  <rect x="$(($2 + 36))" y="$(($2 + 36))" width="$((1024 - 2 * $2 - 72))" height="$((1024 - 2 * $2 - 72))" rx="$(($3 * 2 / 3))" fill="none" stroke="#f6e7d6" stroke-width="16"/>
  <text x="512" y="$((512 + $4 * 36 / 100))" text-anchor="middle" font-size="$4" fill="#fbf3e6" font-family="Kaiti SC, STKaiti, Songti SC, STSong, serif" font-weight="600">拼</text>
</svg>
SVG
}

seal_svg '#f3ebdb' 150 90 520 > "$TMP/icon.svg"
seal_svg '#b8322a' 0 0 430 > "$TMP/maskable.svg"

render() { # svg out size
  qlmanage -t -s 1024 -o "$TMP" "$1" >/dev/null 2>&1
  sips -z "$3" "$3" "$1.png" --out "$2" >/dev/null
}

render "$TMP/icon.svg" "$OUT/icon-512.png" 512
render "$TMP/icon.svg" "$OUT/icon-192.png" 192
render "$TMP/icon.svg" "$OUT/apple-touch-icon.png" 180
render "$TMP/maskable.svg" "$OUT/icon-maskable-512.png" 512

cat > "$OUT/icon.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="4" y="4" width="56" height="56" rx="10" fill="#b8322a"/>
  <rect x="8" y="8" width="48" height="48" rx="7" fill="none" stroke="#f6e7d6" stroke-width="1.6"/>
  <text x="32" y="45" text-anchor="middle" font-size="36" fill="#fbf3e6" font-family="Kaiti SC, STKaiti, Songti SC, serif">拼</text>
</svg>
SVG
rm -rf "$TMP"
echo "icons written to $OUT"
