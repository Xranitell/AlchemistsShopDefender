#!/usr/bin/env bash
#
# Optimise sprite PNGs (pngquant + optipng) and music MP3s (96 kbps mono).
# Run after dropping in new artwork or audio loops; rerun is idempotent —
# already-optimised files stay roughly the same size on subsequent passes.
#
# Tooling required: pngquant, optipng, ffmpeg.
# Yandex Games / CrazyGames care about the zipped build size, and the
# defaults coming out of typical art/music pipelines are 3–5× larger
# than they need to be for pixel art + lo-fi loops.
#
# Quality knobs were chosen so the result is perceptually indistinguishable
# from the source at the in-game zoom levels we ship at:
#   - PNG:  pngquant --quality=80-100 (lossy palette where worth it,
#           skip if savings <10%) followed by optipng -o3 (lossless).
#   - MP3:  -b:a 96k -ac 1 — half the size of the 192 kbps masters with no
#           audible difference for procedurally-mixed lo-fi music.

set -euo pipefail
cd "$(dirname "$0")/.."

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: '$1' not installed" >&2
    case "$1" in
      pngquant|optipng|ffmpeg) echo "       sudo apt-get install -y $1" >&2 ;;
    esac
    exit 1
  fi
}

need pngquant
need optipng
need ffmpeg

human() { numfmt --to=iec --suffix=B "$1"; }

before_total=0
after_total=0

echo "=== PNG sprites ==="
for f in public/sprites/*.png; do
  [ -e "$f" ] || continue
  before=$(stat -c %s "$f")
  before_total=$((before_total + before))
  tmp="${f}.tmp.png"
  pngquant --quality=80-100 --speed 1 --strip --force --output "$tmp" "$f" 2>/dev/null \
    || cp "$f" "$tmp"
  optipng -o3 -strip all -quiet "$tmp"
  new=$(stat -c %s "$tmp")
  if [ "$new" -lt "$before" ]; then
    mv -f "$tmp" "$f"
  else
    rm -f "$tmp"
    new=$before
  fi
  after_total=$((after_total + new))
  printf '  %-30s %10s -> %10s\n' "$(basename "$f")" "$(human "$before")" "$(human "$new")"
done

echo
echo "=== Music MP3s (target: 96 kbps mono) ==="
for f in public/audio/*.mp3; do
  [ -e "$f" ] || continue
  before=$(stat -c %s "$f")
  before_total=$((before_total + before))
  br=$(ffprobe -v error -show_entries format=bit_rate -of csv=p=0 "$f" || echo 0)
  if [ "${br:-0}" -le 100000 ]; then
    after_total=$((after_total + before))
    printf '  %-30s %10s   (already <=96k, skipped)\n' "$(basename "$f")" "$(human "$before")"
    continue
  fi
  tmp="${f}.tmp.mp3"
  ffmpeg -y -loglevel error -i "$f" -codec:a libmp3lame -b:a 96k -ac 1 "$tmp"
  new=$(stat -c %s "$tmp")
  if [ "$new" -lt "$before" ]; then
    mv -f "$tmp" "$f"
  else
    rm -f "$tmp"
    new=$before
  fi
  after_total=$((after_total + new))
  printf '  %-30s %10s -> %10s\n' "$(basename "$f")" "$(human "$before")" "$(human "$new")"
done

saved=$((before_total - after_total))
echo
printf 'Total before: %s\n' "$(human "$before_total")"
printf 'Total after:  %s\n' "$(human "$after_total")"
printf 'Saved:        %s\n' "$(human "$saved")"
