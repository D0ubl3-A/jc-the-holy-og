# Godot 4 sprite import / mobile release contract — Run41

**Status:** Specification only. Godot headless execution and physical Android benchmark not performed in this run.

## Asset levels
- Release master: one independent 1024×1536 sRGB PNG RGBA8 per numbered ID; alpha=0 outside subject; >=48px transparent safety margins; no captions or floor. 6 MiB decoded per texture. 2,000 simultaneously would occupy about 11.72 GiB uncompressed before GPU overhead.
- Runtime half LOD: 512×768 RGBA8, 1.5 MiB decoded. Quarter LOD: 256×384, 0.375 MiB. Derive these **only after** approval of a native master.
- Eight-frame 512×768 animation: 4 columns × 2 rows = 2048×1536 atlas, 12 MiB RGBA8 decoded. Keep 8px gutters and prevent texture bleed.
- Limit initial active sprite residency to an experimental <=64 MiB RGBA-equivalent; stream by district and animation state. This is a design target, **not** a measured device limit.

## Godot 4 settings
Use `Sprite2D` for static poses; `AnimatedSprite2D` + `SpriteFrames` for real sequential animations; `AtlasTexture` regions for packed frames. Godot 4 Compatibility renderer for broad mobile coverage. Linear filtering for photorealistic art; disable repeat; inspect mipmap alpha halos. Evaluate ETC2/ASTC on target devices. A set of 12 different poses is not automatically a walk cycle.

## QA and acceptance
1. Native independently generated source and exact pixel dimensions, unique SHA256, approved character identity, full anatomy and complete weapons/hair/shoes.
2. True transparency, 48px margin, no embedded background, labels, borders, gray fringe or composite contamination.
3. Fixed camera, scale, lighting and pelvis/foot anchors across animation frames. Walk cycles need real pose changes and no foot sliding.
4. Execute `godot --headless --path godot4 --editor --import` and `godot --headless --path godot4 --script res://qa_import.gd`; retain version, logs and asset hashes.
5. Benchmark on physical midrange Android hardware in a representative Hell Vegas stress scene for >=5 minutes; 10th-percentile FPS >=55 and no sprite-load spikes >50ms. Record device, OS, renderer, thermal state and logs.
6. Mark `status=verified` **only after** all gates, with auditable evidence. Composite sheets, prompts, derived previews and unexecuted test scripts are not completed sprites.

**Current:** 0 / 2,000 verified; next 0001–0012.
