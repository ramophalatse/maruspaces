#!/bin/bash
set -e
for leg in leg1 leg2 leg3 leg4 leg5; do
  for variant in day night; do
    src="renders/${leg}_${variant}.mp4"
    out="encoded/${leg}_${variant}.mp4"
    ffmpeg -y -i "$src" -an -vf "unsharp=5:5:0.8:5:5:0.0" \
      -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
      -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart "$out" \
      > "encoded/${leg}_${variant}.log" 2>&1
    echo "encoded $leg $variant"
  done
done
