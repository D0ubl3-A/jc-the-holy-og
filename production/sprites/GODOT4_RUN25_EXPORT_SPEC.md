# Run 25 Godot 4 sprite export specification

- Native masters: one 1024x1536 PNG RGBA straight alpha per ID; 64px minimum silhouette padding, consistent shoe baseline and scale.
- Separate per-frame PNGs for SpriteFrames animation, or an explicit AtlasTexture region manifest with stable pivots. No contact sheets as runtime sprites.
- Mobile LOD: derive 512x768 from **approved native** masters only; never upscale low-res reference crops and call them native.
- Use Godot 4 Sprite2D and verify import in headless editor and rendered scene. Choose ASTC/ETC2 on actual Android hardware and visually inspect alpha-edge artifacts.
- RGBA8 estimate: 1024x1536 = 6 MiB each, 512x768 = 1.5 MiB each; mipmaps add approximately 33% if enabled.
- Proposed device gate: 30 FPS sustained over five minutes on lowest supported Android hardware, no ordinary transition frame above 100ms, no texture eviction, clean alpha and no cutoff. These are **targets**, not tests already run.
- Release requires native provenance, unique hashes, visual anatomy and pose QA, real alpha/dimensions, Godot import and physical mobile benchmark. All remain unverified.
