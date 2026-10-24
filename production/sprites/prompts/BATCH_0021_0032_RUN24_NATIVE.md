# Run 24 — 0021–0032 JC Savior native masters

**Generate each ID in a separate image-generation job. Do not create a sheet, storyboard, infographic, labels, UI, watermark, checkerboard, or printed QA claims.** A prompt is not a completed sprite.

## Locked prefix (include in EVERY generation request)
Hyper-photorealistic, physically plausible full-body game sprite of exactly the same adult JC character: normal human height (~1.83m), long wavy brown hair, natural brown beard, visible uncovered face, white hoodie, ripped white jeans, white sneakers, subtle gold sacred details, matching gold dual pistols and holsters. NO baseball cap, sunglasses, helmet, extra hands, extra weapons or coat replacing the hoodie. Same face, hair, jeans tears, belt, shoes, proportions, pistol geometry, soft studio light and orthographic-style camera across all images. Entire hair, fingers, pistol barrels, clothing and feet within frame with >=6% padding. No ground, horizon, cast shadow or backdrop; TRUE transparent RGBA, straight alpha, sRGB, 1024x1536 PNG at source-native detail (not upscaled). Feet aligned near y=1390 of 1536. Output ONE independent sprite only.

## Twelve distinct requests
- **0021 neutral front:** exactly frontal, balanced stance, shoulders square, hands relaxed, both pistols holstered.
- **0022 neutral left profile:** exact 90-degree side view, nose points SCREEN LEFT; no three-quarter angle, feet fully visible.
- **0023 neutral right profile:** exact 90-degree side view, nose points SCREEN RIGHT; do not mirror 0022; preserve asymmetric clothing details.
- **0024 neutral back:** exact rear view, face unseen, long hair, hood, seams and both holsters visible, hands relaxed.
- **0025 three-quarter left:** torso and gaze ~45 degrees toward SCREEN LEFT, holstered weapons, balanced stance.
- **0026 three-quarter right:** torso and gaze ~45 degrees toward SCREEN RIGHT, same scale and geometry as 0025.
- **0027 idle relaxed:** frontal breathing-ready pose, hands open, one knee relaxed, pistols holstered; NOT aiming.
- **0028 idle alert:** frontal, gaze focused, knees slightly bent, hands close to holsters; pistols not yet drawn.
- **0029 dual pistols aim left:** both weapons drawn in separate hands, muzzles SCREEN LEFT, believable grips, no flash.
- **0030 dual pistols aim right:** both weapons drawn, muzzles SCREEN RIGHT, believable grips, no flash.
- **0031 dual pistols fire left:** SCREEN LEFT firing with recoil; both legs/shoes and all weapon barrels fully in frame; flashes preferably separate FX.
- **0032 dual pistols fire right:** SCREEN RIGHT firing with recoil; no cropped legs, fingers or weapons; flashes preferably separate FX.

## Acceptance and Godot 4 export
Save each native master as `assets/00NN_<manifest_slug>.png`, RGBA8 straight alpha. Preserve generation ID, SHA-256, original native-resolution proof, prompt version and timestamp. Inspect actual body anatomy, left/right orientation, complete silhouette, consistent face/outfit/scale, no baked background or alpha fringe. PNG pixel dimensions alone do not prove source-native detail.

Import as Godot 4 `CompressedTexture2D` (lossless during QA), `Sprite2D`/`Sprite3D`; mobile derivatives 512x768 and 256x384. Pack approved assets into <=2048px atlases with >=8px padding/extrusion, stable pivot and region metadata. Target low-tier Android >=30 FPS, mid-tier >=60 FPS and active sprite textures <=64 MiB; measure on physical devices. One 1024x1536 RGBA8 master ~6 MiB before mipmaps, 12 ~72 MiB. Require human visual signoff, actual Godot import logs, mobile benchmark evidence, unique PNG SHA and CI pass before setting `status=verified`. The 12 entries are individual static poses, NOT a coherent twelve-frame walk animation.
