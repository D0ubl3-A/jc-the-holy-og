# Run 58 — Godot 4 / Android sprite acceptance

Native independent master: 1024×1536 RGBA PNG, sRGB, alpha=0 outside silhouette, alpha=255 opaque interior, at least 48px empty border; same full-body scale and pivot, canonical facial identity, hoodie/jeans/sneakers, complete fingers, limbs and pistols. Every ID has an independently generated binary, SHA-256, source provenance and signed visual review. Never promote composites, labels or upscaled crops.

For animation, use aligned 512×768 cells with stable camera and baseline. Example 8-frame atlas: 4×2 cells, 2048×1536; 12-frame atlas: 4×3 cells, 2048×2304. Extrude 2–4px cell padding to prevent frame bleeding. Keep original native masters separate from derived 512×768 and 256×384 LODs; derived LODs are not additional verified sprites.

Godot 4: Sprite2D / SpriteFrames; load and verify actual imported dimensions, alpha, pivot, frame count, and visual continuity. Import losslessly for QA; test device-appropriate GPU compression for release. A 1024×1536 RGBA sprite consumes 6 MiB uncompressed; 12 resident masters ≈72 MiB, while all 2000 ≈11.7 GiB. Stream/cull offscreen assets; do not preload all masters.

Physical Android acceptance: run a five-minute representative crowded Hell Vegas scene, aim 60fps with 10th-percentile >=55fps; record model, OS, Godot version, GPU memory, FPS trace and screenshot evidence. **No actual runtime/device acceptance has been executed in Run 58.**
