# Run 49 — Godot 4 / Android sprite export contract

- Source: **independently generated** 1024x1536 8-bit straight-alpha RGBA PNG, sRGB; no collage-derived or upscaled cutouts.
- Safety: >=48px transparent padding all sides; no clipped hands, feet, hair, guns or muzzle flashes; no baked background or checkerboard.
- Camera: front 0°, subject left +90°, subject right -90°, back 180°. Never mirror distinct left/right assets.
- Alignment: foot pivot x=512, foot baseline y<=1488; consistent silhouette scale, face and clothing across frames.
- Godot: Sprite2D/AnimatedSprite2D, preserve alpha, Linear filtering for photoreal sprites, repeat disabled. Keep original master and generate mobile LODs only after native acceptance.
- Raw RGBA source memory: 6 MiB per 1024x1536 sprite; 12 loaded = 72 MiB before mips. 512x768 LOD = 1.5 MiB raw; 256x384 = 0.375 MiB raw. Test ASTC/ETC2 alpha quality on target Android GPUs.
- Atlas examples: 4x2 cells of 512x768 = 2048x1536; 4x3 = 2048x2304. Confirm target device texture limits.
- Release: execute Godot 4 import; measure a representative Hell Vegas Android scene >=5 minutes, p10 >=55 FPS, record device, GPU, draw calls and memory. No runtime performance claim without measured results.
