# Run57 — Godot 4 / Android acceptance specification

**Status: QA scaffold only. 0/2000 verified. Godot runtime and Android tests not executed.**

## Source requirements
- For IDs 0001–0012, one **independently rendered original** 1024×1536 RGBA8 PNG per manifest ID; 48px fully transparent alpha-zero margin on all four sides; alpha reaches 255 on opaque body.
- Canonical JC: uncovered long brown hair, beard, white hoodie, white jeans, white sneakers, two gold pistols. No hat, cape, ornate coat, labels, badges, or backdrop. Require original approved face reference for human identity signoff.
- Preserve true 90° left/right profiles and consistent orthographic scale, foot anchor near (512,1450), lighting, anatomy, full hands/feet/guns. Poses are individual stills, not an automatically complete animation cycle.
- Filename format `<ID>_<canonical_slug>.png`. Record generation job ID, SHA256, provenance and semantic uniqueness. Reject composite-derived crops and upscales.

## Godot 4 import
- Use `Sprite2D` with source PNG as a lossless imported Texture2D. Compare linear vs nearest filtering at actual screen scale. Disable mipmaps for pixel-aligned 2D; test mipmaps for scaled 3D-world usage.
- Import using `godot --headless --path godot4 --editor --quit`; run a QA scene showing each sprite in turn, verify alpha edges, no cutoff, correct orientation and scale.
- Do not publish a release solely because a PNG passes automatic pixel tests. A real import and visual review are required.

## Mobile
- Uncompressed RGBA8 1024×1536 = **6 MiB decoded per sprite**, 12 resident = **72 MiB** plus overhead; all 2000 resident ≈11.72 GiB and unacceptable.
- Stream only active sprites; derive 512×768 LOD textures after native master approval. Test ASTC/ETC2 on device rather than assuming savings.
- Physical Android test: 300s representative combat/NPC load, 10th-percentile FPS ≥55, record median FPS, memory and thermal effects. Not executed in this run.

## Status policy
`planned` means no binary; `generated_unverified` means candidate only; `verified` requires independent source, canonical face/anatomy approval, binary and hash, Godot 4 real import and physical mobile acceptance. Prompts, composites, QA fixtures, and screenshots are never counted.
