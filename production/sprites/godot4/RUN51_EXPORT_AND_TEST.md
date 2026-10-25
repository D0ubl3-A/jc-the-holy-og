# Run 51 Godot 4 export and acceptance contract

- Independent master: single native 1024×1536 RGBA PNG, ≥48px transparent margins, full limbs and weapons, no hat. Do not pad or upscale 1024×1024 archive candidates and claim native detail.
- Runtime LOD: 512×768 RGBA frame; 8-frame 4×2 atlas 2048×1536, 12-frame 4×3 atlas 2048×2304. Keep each animation's feet and hip baseline aligned and camera yaw exact. Use consistent foot pivot and SpriteFrames/AnimatedSprite2D or AtlasTexture.
- 1024×1536 RGBA8 ≈6 MiB per frame uncompressed; 512×768 ≈1.5 MiB. Benchmark actual device memory and ETC2/ASTC alpha quality. Linear filter for photoreal scaled images, edge-dilate transparent RGB before filtering, and test mipmaps as appropriate for zoom.
- Actual Godot 4 headless import must load the approved PNGs and confirm size/alpha, then instantiate Sprite2D without errors. Synthetic-fixture success is not evidence of production-asset success.
- Physical Android target: ≥55 FPS at 10th percentile for ≥5 minutes of representative gameplay, without clipping, halos or texture pop-in. Record device model, renderer, scene, memory and frame times. No benchmark has been performed this run.
- Promotion requires ALL: independent source, native dimensions/detail, unique SHA-256 and pose semantics, true alpha and 48px margins, correct face/outfit/camera/anatomy, frame alignment, actual Godot import, physical Android performance.
