# Godot 4 / Android sprite release spec — Run 64

Native masters: one independent 1024×1536 sRGB RGBA PNG per manifest ID, real transparent background, >=48px empty alpha margins. No collage crops or upscaled reference pixels may be labeled native. Record SHA-256, source provenance, pose name, pivot, review status.

LOD candidates: 512×768, 384×576, 256×384; do not confuse LOD derivatives with additional unique sprite IDs. RGBA8 memory: native 6.00 MiB, 512×768 1.50 MiB, 384×576 0.844 MiB, 256×384 0.375 MiB, before mipmaps. Twelve simultaneously resident native textures cost about 72 MiB.

Godot 4: import to Sprite2D / SpriteFrames as 2D textures; test lossless PNG source, VRAM compression (ETC2 baseline, ASTC only where supported), alpha edges, filtering and mipmaps at gameplay scale. Maintain uniform pivot/ground line and frame order. Source sprite animation 12–24 authored FPS as needed, game target 60 FPS with 30 FPS fallback on entry-level Android. Actual device performance must be measured, not assumed.

Hard release gates: independent native source; exact pose and ID; unique hash; approved facial identity; correct anatomy and complete silhouette; transparent alpha and safe margins; consistent costume/scale/pivot; executed Godot 4 import; measured Android FPS, GPU memory and overdraw. No current candidate has passed every gate.
