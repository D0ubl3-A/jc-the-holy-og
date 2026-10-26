# Run68 — Godot 4 / Android sprite export gate

- Master: independently rendered PNG, 1024×1536, RGBA8 sRGB, transparent exterior and >=48px margins, no labels. Confirm anatomy, complete limbs, facial identity and weapon geometry visually.
- Godot 4: AnimatedSprite2D + SpriteFrames; consistent foot-anchor offset, separate FX layer and 4px extruded atlas gutters; 8–12 fps locomotion as initial tuning range.
- LODs from **accepted** masters: 512×768, 384×576, 256×384. Development LODs are not verified sprites.
- Android: ETC2 RGBA8 compatibility baseline, ASTC where supported with fallback. Stream atlases by actor/route/area. RGBA8 512×768 costs 1.5 MiB uncompressed per frame; twelve frames cost 18 MiB before overhead, so avoid loading all simultaneously.
- Physical Galaxy A15-class test: measured 5-minute gameplay with water/VFX, >=30fps median and >=24fps 1% low; 60fps stretch target. Track actual texture residency and thermal effects.
- Full verification requires native image QA, manual character/animation signoff, real Godot 4 import, and real Android benchmark. **Neither runtime test was performed during Run68.**
