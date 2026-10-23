# Hell Vegas sprite production — 2,000 asset registry

**Current verified count: 0 / 2,000** (2026-10-23). **Next batch: 0001–0012**.

This directory holds the canonical, deduplicated numbered manifest for JC: The Holy OG. Do not infer completion from concept art, image-generation prompts, old archives or presentation boards. Every verified record needs a unique isolated binary PNG, SHA-256, dimensions/alpha QA, human anatomy/frame review and a Godot 4 mobile test.

The first twelve full-body JC base poses use a locked 6-foot, average-build, brown-haired, short-bearded character in a white hoodie, blue jeans and white sneakers. Five route transformations preserve the same facial identity.

**Export:** static master 1024×1024 RGBA PNG, 8% padding; 8-frame animations 4×2 cells at 512 px each (2048×1024); 12-frame animations 4×3 (2048×1536); mobile atlas maximum 2048 px per side; LOD derivatives 512/256/128; use AnimatedSprite2D/3D or Sprite3D impostors in Godot 4, with selective streaming.

**Provisional runtime gates:** representative low-tier phone ≥30 FPS, mid-tier ≥60 FPS, active sprite texture residency target ≤64 MiB. These are targets, not measured results.

**Anatomy and QA:** no cropped limbs/wings/vehicles, extra fingers, broken weapon grips, face morphing, baked checkerboards, wrong ground baselines, repeated frames or near-duplicates. Automated checks do not replace visual sign-off.

**Counting rule:** one verified atlas = one asset, not eight or twelve. Never count prompts, briefs or concept sheets.
