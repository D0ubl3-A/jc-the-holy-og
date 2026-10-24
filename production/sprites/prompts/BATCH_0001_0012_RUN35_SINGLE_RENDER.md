# Run 35 — independent native render prompts, 0001–0012

**Production rule:** Generate **one image per ID**, never a contact sheet. Prompts and composite boards contribute **zero** verified sprites. Render the actual PNG master independently at **1024 × 1536 RGBA8** with true transparent background (alpha 0 outside, 255 inside opaque subject). Keep ≥48px transparent margin around hair, feet, hands and gun barrels. No text, grid, captions, checkerboard, logos, borders, upscaled crops or opaque gray background.

**Canonical JC:** normal-height adult male, long uncovered wavy brown hair, beard, white hoodie, ripped white jeans, white sneakers, gold jewelry and dual polished gold pistols. Maintain same face, proportions, lighting and camera across all IDs. Human review must reject extra fingers, duplicated limbs, cutoff shoes/hair, wrong directions, inconsistent weapon grips, missing weapons and fused hands. Native source and Godot/mobile test logs are mandatory for verification.

| ID | Independent image prompt (append canonical rules above) |
|---|---|
| 0001 | One full-body photorealistic JC in **neutral front** pose, with complete silhouette and coherent anatomy; preserve the exact direction and action. | 
| 0002 | One full-body photorealistic JC in **neutral left profile** pose, with complete silhouette and coherent anatomy; preserve the exact direction and action. | 
| 0003 | One full-body photorealistic JC in **neutral right profile** pose, with complete silhouette and coherent anatomy; preserve the exact direction and action. | 
| 0004 | One full-body photorealistic JC in **neutral back** pose, with complete silhouette and coherent anatomy; preserve the exact direction and action. | 
| 0005 | One full-body photorealistic JC in **three-quarter left** pose, with complete silhouette and coherent anatomy; preserve the exact direction and action. | 
| 0006 | One full-body photorealistic JC in **three-quarter right** pose, with complete silhouette and coherent anatomy; preserve the exact direction and action. | 
| 0007 | One full-body photorealistic JC in **idle relaxed** pose, with complete silhouette and coherent anatomy; preserve the exact direction and action. | 
| 0008 | One full-body photorealistic JC in **idle alert** pose, with complete silhouette and coherent anatomy; preserve the exact direction and action. | 
| 0009 | One full-body photorealistic JC in **dual pistols aim left** pose, with complete silhouette and coherent anatomy; preserve the exact direction and action. | 
| 0010 | One full-body photorealistic JC in **dual pistols aim right** pose, with complete silhouette and coherent anatomy; preserve the exact direction and action. | 
| 0011 | One full-body photorealistic JC in **dual pistols fire left** pose, with complete silhouette and coherent anatomy; preserve the exact direction and action. | 
| 0012 | One full-body photorealistic JC in **dual pistols fire right** pose, with complete silhouette and coherent anatomy; preserve the exact direction and action. | 

**One output filename per ID:** `<ID>_jc_base_<manifest_slug>.png`. Use exact manifest ID/title for the filename; never trust ID captions printed in generated composites.

**Godot 4 export:** Texture2D/Sprite2D, linear filtering for photorealism, repeat disabled; compare mipmaps on/off by use case. A 1024×1536 RGBA8 master occupies 6 MiB before mipmaps; do not preload 2,000 assets. LOD 512×768 occupies 1.5 MiB and is **not** a second sprite. Validate import in actual Godot 4 project and physical mobile p10 FPS ≥55 after 5s warmup and 60s representative play; record device and logs.

**Staged next 0013–0020:** holster pistols, prayer kneeling, transformation beginning, transformation halfway, transformation completed, airborne front, airborne side, hero portrait full body. Do not advance until 0001–0012 are verified.
