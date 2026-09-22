# JC AI Asset Factory

The AI Asset Factory is the visual-production contract for **JC: The Holy OG / Hell Vegas**.

It separates responsibilities:

- **Image generation** creates appearance: facades, roofs, signage, emissive patterns, terrain materials, character identity sheets, props, VFX flipbooks, skies.
- **The game runtime** owns geometry, collisions, animation, lighting, particles, LOD, streaming, buffering and physics.
- **The asset manifest** is the bridge. Game code consumes manifest entries instead of hardcoding every generated asset.

## Asset types

`building`, `residential`, `terrain`, `character`, `prop`, `vfx`, `sky`.

## Required production path

1. Create a request that validates against `schema/asset-request.schema.json`.
2. Select the matching preset from `presets/`.
3. Generate only the requested visual outputs.
4. Optimize textures before runtime use.
5. Add the finished output to `runtime/asset-manifest.json`.
6. Runtime loads/reuses the registered material instead of creating one material per object.

## Runtime rules

- Prefer material atlases over one texture per building.
- Hero assets may use 2K textures; ordinary world assets should normally use 512-1K.
- Use emissive masks rather than transparent neon layers when possible.
- Residential/building variants must be reusable across many meshes.
- VFX must use flipbooks/sprite sheets rather than hundreds of separate image files.
- Far geometry uses LOD/impostors. Medium distance uses simplified geometry/materials. Near range uses full GLB + registered materials.
- Generated images never replace collision geometry.
- Massive maps must not decode all assets simultaneously.

## Current live assets

The initial manifest registers the existing Strip and residential wallpaper atlases already used by the JC runtime.

## Folder layout

```
ai-asset-factory/
  README.md
  schema/
    asset-request.schema.json
  presets/
    building.json
    residential.json
    terrain.json
    character-jc.json
    vfx.json
    sky.json
  runtime/
    asset-manifest.json
```
