# Run 63 Godot 4 export and Android acceptance

Source: 1024×1536 sRGB RGBA PNG per independently generated sprite, 48px transparent margins, no text, consistent ground-contact pivot and camera. Source RGBA8 is 6 MiB decoded VRAM per sprite; 512×768 LOD is 1.5 MiB, 384×576 LOD is 0.844 MiB, 256×384 LOD is 0.375 MiB, before mipmaps. Do not equate compressed WebP file size with VRAM.

Godot 4: import as 2D Sprite2D/AnimatedSprite2D, texture filtering linear for photographic art; use LODs and GPU ETC2/ASTC compression as supported by target Android hardware. Check straight-alpha edge bleed, frame scale, direction and pivots. Avoid shipping the 12-pose composite.

On physical Android run 10 minutes after warmup, record p10 FPS >=55, p95 frame time <=18.2ms, memory, thermal behavior, texture defects and crashes across idle, movement, combat, flight and dense world scenes. This is an acceptance target, not a measured result. Require human face/anatomy signoff, unique source hashes, executed Godot import and physical mobile pass before marking verified.

**Current:** Godot import NOT EXECUTED, physical Android NOT EXECUTED, verified count 0/2000.
