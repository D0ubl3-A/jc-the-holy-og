# Godot 4 — Run42 sprite atlas contract

**Independent JC master:** 1024×1536 RGBA8 PNG, straight alpha, sRGB, transparent with >=48px safety margins. 6 MiB decoded. Do not upscale or extract a composite.

**Full-body animation frame:** 512×768 RGBA8. Eight frames: 4×2 grid, 2048×1536 atlas, 12 MiB decoded. Twelve frames: 4×3 grid, 2048×2304 atlas, 18 MiB decoded. Reserve >=16px clear transparent inset inside every frame; fixed pivot and feet baseline; no frame bleed or clipped weapons.

**Mobile LOD:** 512×768 1.5 MiB/frame, 256×384 0.375 MiB/frame. Generate from approved masters only. Stream active animation and district textures; test <=64 MiB initial RGBA-equivalent residency rather than loading all 2,000 textures.

**Godot:** Sprite2D for static poses; AnimatedSprite2D with SpriteFrames or AtlasTexture for animation. Linear filtering for photorealistic art, repeat disabled. Validate transparency halos with mipmaps and texture compression on target device. Headless import: `godot --headless --path <project> --editor --import`. Then run a scripted asset import check and record logs.

**Verification:** Independent source provenance, exact manifest dimensions and SHA256, approved face/anatomy, no cutoff limbs, correct direction, true alpha, frame consistency, actual Godot import, and a physical midrange Android five-minute stress test at >=55 FPS p10 with no >50ms load spikes. **Neither Godot nor Android testing was executed in Run42.**
