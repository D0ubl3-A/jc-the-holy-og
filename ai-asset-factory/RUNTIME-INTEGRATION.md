# AI VISUAL PIPELINE — LIVE RUNTIME PLAN

The repo already defines the production contract in `ai-asset-factory/`.
This addition makes that contract consumable by the game runtime.

## Runtime flow

1. `asset-manifest.json` is the single source of truth.
2. `ai-asset-runtime.js` loads it and exposes `window.JC_AI_ASSETS`.
3. Existing world/character code can request assets by ID or asset type.
4. Generated images remain visual inputs only; geometry/collision/animation stay authoritative.
5. Building/terrain/sky assets should be atlas-driven and reused.
6. Character outputs are hero assets and should be bound to the JC mesh/material slots.
7. VFX outputs are flipbooks and should be animated by runtime particle/sprite systems.

## Integration targets

- JC: identity/albedo/normal/roughness on the existing hero mesh.
- Buildings: facade/roof/emissive atlases projected onto existing GLB geometry.
- Terrain: seamless PBR material sets plus decals.
- VFX: 8x8/64-frame flipbooks for holy energy, hellfire, lightning, portals, smoke, sparks, dust and impacts.
- Sky: skybox + horizon cards.
- Props: add through the same manifest pattern.

## Acceptance criteria

- No generated image is used as collision geometry.
- No unique 2K texture per ordinary building.
- Far/medium/near LODs do not all load high-resolution assets at once.
- JC keeps one identity across all generated character outputs.
- VFX sprite sheets have safe padding and no clipped frames.
- Runtime still boots if an optional generated asset is missing.
