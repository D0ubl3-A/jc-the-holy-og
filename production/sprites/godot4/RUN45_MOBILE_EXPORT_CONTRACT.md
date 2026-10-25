# Run 45 — Godot 4 sprite export contract

- Native independent JC master: **1024×1536 RGBA8 PNG**, true alpha, no background or labels, >=48px transparent margins. Decoded texture memory 6 MiB per image. Composite-derived crops are NOT native masters.
- Shipping near-camera LOD: **512×768** (1.5 MiB decoded RGBA8); distant LOD: **256×384** (0.375 MiB). Downsample from approved independent masters only.
- Eight-frame animation atlas: 4 columns × 2 rows of 512×768 cells = **2048×1536**.
- Twelve-frame animation atlas: 4 columns × 3 rows of 512×768 cells = **2048×2304**.
- Maintain a consistent foot/pivot anchor and character proportions; unrelated pose panels are not animation frames.
- Godot 4: import lossless for QA; separately test Android VRAM compression for alpha halos and appearance. Use linear filtering and mipmaps when minified; stream atlases by active scene. Do not load all 2,000 textures into memory.
- 12 × 512×768 RGBA8 = **18 MiB** decoded. Loading 2,000 at that size would require about **2.93 GiB** decoded; reject eager loading. Proposed resident sprite texture budget <=64 MiB is an untested design target.
- Release requires a unique SHA-256 and semantic identity, approved anatomy/limbs/weapons, correct camera pose, actual Godot import log, and physical Android gameplay test >=5 minutes with p10 FPS >=55. Do not infer FPS from PNG dimensions.
- Run 45: no Godot executable or physical Android benchmark was available; verified game-ready sprites remain **0/2000**.
