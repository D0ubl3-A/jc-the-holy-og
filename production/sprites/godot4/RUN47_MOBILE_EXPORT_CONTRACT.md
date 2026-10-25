# Run 47 — Godot 4 Mobile Sprite Export

These are specifications, not claims of executed Godot or Android tests.

- Native independent sprite: PNG RGBA8 1024×1536; one character per file, no text/background, >=48px transparent margin.
- After native master acceptance, derive 512×768 (1.5 MiB uncompressed RGBA8) and 256×384 (0.375 MiB) runtime LODs; native 1024×1536 is 6 MiB uncompressed.
- 8-frame 512×768 atlas: 2048×1536 (~12 MiB RGBA8); 12-frame: 2048×2304 (~18 MiB). Do not preload all 2,000 masters.
- Use 2D textures, alpha retained, linear filtering for photorealistic sprites, mipmaps only when appropriate for zoom/3D use.
- Stable bottom-center standing pivot; airborne poses have explicit pivot metadata; consistent camera scale and facing.
- Godot 4 headless import and scene verification must run on actual binaries; synthetic fixtures prove only import infrastructure.
- Android acceptance: five-minute representative gameplay on physical device, >=55 FPS at 10th percentile, device model and raw measurement SHA256 recorded.
