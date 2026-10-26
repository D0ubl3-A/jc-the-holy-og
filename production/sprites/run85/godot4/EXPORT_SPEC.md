# Run85 Godot 4 export specification
- Godot 4.x, Sprite2D with AtlasTexture.region, Compatibility renderer for development.
- 512×768 derived PNGs in a 1088×1600 RGBA8 2×2 atlas, 16px gutters, 544×800 cells.
- 256×384 derived mobile PNGs in a 1152×416 RGBA8 4×1 atlas, 16px gutters, 288×416 cells.
- Calculated raw memory: 6.64 MiB high, 1.83 MiB mobile, excluding mipmaps and other overhead.
- Import with sRGB color, transparency and linear filtering; disable texture repeat; use mipmaps only for distant/scaled sprites and budget ~33% extra memory.
- Keep atlas dimensions ≤2048 for conservative mobile compatibility; this does not guarantee support.
- Accept only after independent 1024×1536 master, clean alpha, complete anatomy, identity/weapon continuity, unique hash, Godot import and 15-minute physical Android benchmark (p10 FPS ≥55, 0 OOM/crashes).
- **No Godot or Android runtime pass has been recorded.** The atlas PNGs are in the Run85 downloadable package, not this repository folder.
