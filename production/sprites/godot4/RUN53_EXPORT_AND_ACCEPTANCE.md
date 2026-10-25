# Run 53 Godot 4 / Android release specification

- Independently render each native 1024x1536 RGBA PNG; preserve masters. No composite crops or artificial upscaling.
- Alpha minimum 0, maximum 255; at least 48 transparent pixels from nonzero-alpha bounding box to all four edges. Check shoes, hair, pistols and muzzle flash.
- Use Sprite2D or AnimatedSprite2D and SpriteFrames. Lossless import for master QA, fixed ground anchor and consistent camera/body proportions. For atlases, exact cell dimensions and padding; no frame bleed. Animation FPS and anchoring visually inspected.
- Runtime LODs (e.g. 512x768) are permitted only as derivatives of accepted independent native masters; they never qualify as masters.
- Execute headless import in Godot 4.4+ then interactive pose review. Physical Android device: 5 minutes representative gameplay, 10th percentile FPS >=55, no sustained thermal throttling, no texture omissions, log device/OS/GPU/build and frame-time series.
- Until face identity, full anatomy, independent source, Godot and Android checks pass, status remains generated_unverified.
