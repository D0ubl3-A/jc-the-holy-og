# Run 38 — Godot 4 mobile export contract

- Source master: 1024x1536 sRGB PNG RGBA8 straight alpha, independent native render; preserve 48px transparent safe margin.
- Runtime mobile LOD: 256x384 or 512x768 derived ONLY from approved master; never ship all 2000 native masters at once. Each 1024x1536 RGBA texture costs 6 MiB decoded.
- Atlases must be PACKED from independently verified masters. Example 4x2 frames at 512x768 yields 2048x1536 atlas before padding; padding/extrusion at least 4px as supported. Keep max mobile atlas edge <=2048 initially, benchmark target devices.
- Godot 4: Sprite2D/AnimatedSprite2D, SpriteFrames for animated sequences; linear filtering for photorealistic art, lossless texture import, repeat off, mipmaps conditional on minification. Consistent foot-center pivot; verify no frame bleed, fixed camera and contact points.
- Release evidence: anatomy/identity reviewer and timestamp, source hash/provenance, Godot 4 import log and version, physical Android device model and warmed >=60s x3 FPS trace with p10 >=55, no crash or texture hitch.
- Static directional poses are NOT automatically full animation cycles. Prompts, composite sheets and extracted panels count 0 verified.
