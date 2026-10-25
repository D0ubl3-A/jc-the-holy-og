# Run 46 — Godot 4 mobile export contract

- **Native art master:** independently rendered 1024×1536 RGBA8 sRGB PNG, ≥48px transparent silhouette margin; 6 MiB decoded per sprite. No sheet crops or upscaling.
- **Mobile LOD after master approval:** 512×768 (1.5 MiB decoded) or 256×384 (0.375 MiB). Generate by downsampling verified masters only.
- **Animation atlas:** 8 frames = 4×2 cells at 512×768 -> 2048×1536; 12 frames = 4×3 -> 2048×2304. Preserve exact anchor, frame order, lighting, scale, collision pivot, and coherent motion.
- **Godot 4:** import Texture2D with alpha, verify headless import and readback; QA with lossless, compare Android ETC2/Basis Universal on physical device, linear filtering, mipmaps when scaling down. Sprite2D.hframes=4; vframes=2 or 3. AnimatedSprite2D for per-frame timings.
- **Memory:** all 2,000 sprites at 512×768 RGBA8 would occupy about 2.93 GiB decoded; stream by district/route, don't preload all. Provisional active texture budget ≤64 MiB, not benchmarked.
- **Release gates:** unique SHA256 and semantic review, approved anatomy and identity, correct camera/pose, complete fingers/feet/weapons, actual candidate Godot import, physical Android representative scene ≥5 minutes at p10 FPS ≥55.
- **CI caveat:** Run46 GitHub Actions test imports 12 **synthetic QA fixtures only**. Passing it never verifies game-ready art or mobile FPS.
