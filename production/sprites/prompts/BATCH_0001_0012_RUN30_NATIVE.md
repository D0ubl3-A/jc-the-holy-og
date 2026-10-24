# Run 30 — Native independent sprite generation, IDs 0001–0012

## Single-asset generation contract
Generate **exactly ONE isolated sprite per invocation**, not a sprite sheet, collage, dashboard, text-labeled mockup or composite. Each output must be an independently rendered **1024×1536 RGBA8 PNG with true alpha and native texture detail**, not an upscaled crop. Transparent canvas (no baked checkerboard, backdrop, cast shadow, typography, watermark or frame). Entire head, hair, fingers, legs, shoes, pistols, muzzle flash must fit inside **64px target safe margins** (48px minimum release gate).

**Canonical JC:** same adult male face as user-supplied October 23 reference photo (reference currently unavailable for identity signoff), uncovered long wavy brown hair, beard, white hoodie with hood down, white jeans, white sneakers, two gold pistols. No baseball cap, coat, scarf, armor, sunglasses, added jewelry, extra weapons, missing pistols or inconsistent weapon grip. Human-sized proportions. Locked camera height, scale, neutral light, and bottom-center foot pivot at (512,1468). Left/right means the subject's anatomical facing direction; validate visually, do not flip pixels.

## Exact independent outputs
- **0001 — JC Base — neutral front**: undefined; independently render exact named pose, never mirror a left/right image.
- **0002 — JC Base — neutral left profile**: undefined; independently render exact named pose, never mirror a left/right image.
- **0003 — JC Base — neutral right profile**: undefined; independently render exact named pose, never mirror a left/right image.
- **0004 — JC Base — neutral back**: undefined; independently render exact named pose, never mirror a left/right image.
- **0005 — JC Base — three-quarter left**: undefined; independently render exact named pose, never mirror a left/right image.
- **0006 — JC Base — three-quarter right**: undefined; independently render exact named pose, never mirror a left/right image.
- **0007 — JC Base — idle relaxed**: undefined; independently render exact named pose, never mirror a left/right image.
- **0008 — JC Base — idle alert**: undefined; independently render exact named pose, never mirror a left/right image.
- **0009 — JC Base — dual pistols aim left**: undefined; independently render exact named pose, never mirror a left/right image.
- **0010 — JC Base — dual pistols aim right**: undefined; independently render exact named pose, never mirror a left/right image.
- **0011 — JC Base — dual pistols fire left**: undefined; independently render exact named pose, never mirror a left/right image.
- **0012 — JC Base — dual pistols fire right**: undefined; independently render exact named pose, never mirror a left/right image.

## Release gates
1. Native generation provenance (source file and metadata), actual 1024×1536 PNG; no upscaled collage source.
2. Alpha 0–255 with transparent background and 48px safe margins; no cut-off appendages or barrels.
3. Anatomy, weapons, pose, strict camera direction and original-face identity approved.
4. Per-pose baseline/scale/costume continuity and unique SHA-256 **plus visual distinctness**.
5. Godot 4 import smoke test, then physical mobile scene benchmark before promotion to **verified**.

## Godot 4 / mobile
Import PNG as Texture2D with Lossless compression for 2D; set CanvasItem linear filtering for photorealism, repeat disabled. Derive 512×768 and 256×384 LODs only from accepted masters; LODs are not additional distinct sprites. One decoded 1024×1536 RGBA8 texture uses **6.0 MiB** before overhead. Do not certify 60 FPS without real-device measurement.

**Status:** all 12 IDs remain generated_unverified; 0 / 2,000 verified.
