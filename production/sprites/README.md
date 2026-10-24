# JC: The Holy OG — Hell Vegas sprite production

**Verified game-ready: 0 / 2,000 (2026-10-24).** Archived candidate IDs: **32** (all unverified). Planned without candidates: **1,968**.

The canonical manifest is `manifest_0001-2000.json`, containing 2,000 contiguous unique IDs and 11 category allocations. Its status fields are the source of truth, not labels printed in generated artwork.

## Next production batch: 0021–0032

Replace twelve JC Savior reference-derived candidates with **twelve independent source-native 1024×1536 transparent RGBA PNGs**, one per exact manifest ID. The manifest maps 0021 front, 0022 left profile, 0023 right profile, 0024 back, 0025 three-quarter left, 0026 three-quarter right, 0027 relaxed idle, 0028 alert idle, 0029/0030 dual aim left/right, 0031/0032 dual fire left/right. Do not substitute a 12-panel contact sheet or mislabel these as a walking sequence.

JC is an average-height, long-brown-haired, bearded adult in a white hoodie, ripped white jeans and white sneakers with gold pistols. No sunglasses or baseball cap. Maintain the same identity, anatomy, proportions, camera, scale, foot baseline, and weapon model across assets and five transformation routes.

## Non-negotiable release gates

- **Image provenance:** independent native-detail source PNG, not an upscaled crop of a collage. Retain generation job ID and source hash.
- **Pixel QA:** dimensions, real alpha (where required), >=2% transparent silhouette safety margin, no truncated limbs or guns, verified SHA-256 and deduplication.
- **Visual QA:** actual human review of anatomy, face, clothing, orientation, full body, hand-to-weapon grip, consistent character identity and frame continuity.
- **Godot 4:** actual import log and alpha-fringe check. Use Sprite2D/AnimatedSprite2D or Sprite3D as appropriate; keep mobile atlases <=2048 px and extrude edges.
- **Mobile QA:** measured device logs. Targets: low-tier Android >=30 FPS, mid-tier >=60 FPS, active sprite texture residency <=64 MiB. These are **targets**, not current measurements.
- **Evidence:** verified entries require existing QA evidence files in the repository, source-native approval, human visual approval, Godot import pass, mobile device pass and the actual PNG binary with matching hash. CI enforces the machine-verifiable parts; no computer vision or automated checks can certify human anatomy.

A single 1024×1536 RGBA8 image is ~6 MiB uncompressed, twelve ~72 MiB before mipmaps. Generate 512×768 (~1.5 MiB each) and 256×384 LODs from approved masters. Test compressed textures on physical hardware.

## Production order

1. 0021–0032 native Savior masters (all remain unverified).
2. Repair 0013–0020 reference crops.
3. 0033–0044 Savior extensions and next transformation.
4. Continue through 2000 only as independently accepted evidence allows.

**Do not count** briefs, prompts, composites, atlases, thumbnails, or PNGs that have not passed all release gates as verified sprites.
