# Run55 Godot 4 / Android export and acceptance contract

**Status:** Preview configuration prepared locally; no Godot 4 execution or physical Android benchmark has been performed.

1. Render each of IDs 0001–0012 as an independent original 1024×1536 32-bit RGBA PNG. Require actual alpha-zero background, alpha-255 character core, and 48px transparent border on all sides.
2. Use lossless source textures and import each as Texture2D for Sprite2D. Disable mipmaps for pixel-aligned 2D sprites, compare nearest vs linear filtering at gameplay scale, and do not pack or compress before native source acceptance. Record native generator provenance and SHA-256.
3. Memory estimate: 1024×1536 RGBA8 = 6 MiB per decoded texture; 12 simultaneously resident ≈72 MiB before overhead. 2,000 simultaneously resident masters ≈11.72 GiB, not acceptable on target phones. Stream by scene, use approved 512×768 LOD derivatives (~1.5 MiB RGBA8 each), and test device-supported ASTC/ETC2 compression.
4. Run a real Godot 4 import of the 12 independent masters, visually inspect left/right orientation, grounded alignment, body scale, alpha halos, animation consistency, weapon count and complete anatomy.
5. Run on physical Samsung Galaxy A15 or stated Android target for 300 seconds in representative combat and NPC load. Record p10 FPS, median FPS, peak RAM/VRAM and thermal degradation. Release requires p10 >=55 FPS and no cutoff, identity mismatch, or sprite corruption.
6. No reference board, composite-derived crop, staging preview, prompt, synthetic fixture or untested asset can be marked `verified`. Only promote with reproducible evidence in the manifest and the fail-closed release validator.

Current Run55: **0/2,000 verified; batch 0001–0012 remains pending.**
