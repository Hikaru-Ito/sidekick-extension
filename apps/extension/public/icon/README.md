# Icons

`source.svg` is the canonical icon. PNG sizes (16/32/48/96/128) are required by Chrome.

Regenerate PNGs with any of:

```bash
# resvg-cli (recommended, very fast)
for s in 16 32 48 96 128; do resvg --width $s source.svg ${s}.png; done

# Or using ImageMagick (rsvg-convert)
for s in 16 32 48 96 128; do rsvg-convert -w $s source.svg -o ${s}.png; done

# Or using Inkscape
for s in 16 32 48 96 128; do inkscape source.svg --export-type=png --export-width=$s --export-filename=${s}.png; done
```

PNGs are committed to git so contributors don't need a renderer.
