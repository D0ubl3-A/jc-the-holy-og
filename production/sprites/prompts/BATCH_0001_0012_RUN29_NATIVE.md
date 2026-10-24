# JC Hell Vegas — Run29 native single-asset generation batch 0001–0012

**ONE independent 1024×1536 RGBA PNG per request. No sprite sheets, posters, checkerboards, labels, multiple poses, or upscale/crops.** Source identity: original user-supplied Oct 23 JC facial reference (not yet available for new signoff). Character: uncovered long wavy brown hair, beard, white hoodie, white ripped jeans, white sneakers, exactly two gold pistols. Full anatomy and weapons with >=64px clear margins, feet on fixed y≈1440 baseline, consistent 5600K light and orthographic eye-level camera; true alpha=0 outside silhouette. Do not add cap, armor, sunglasses, cape or scarf. Retain original render provenance and SHA-256. Prompts never count as verified sprites.

| ID | Native pose requirement |
|---|---|
| 0001 | Neutral front, direct eye contact, both pistols down, full-body. |
| 0002 | Strict 90° left profile: nose and shoes face IMAGE LEFT, guns down. |
| 0003 | Strict 90° right profile: nose and shoes face IMAGE RIGHT, guns down. |
| 0004 | Strict back: face not visible, both heels visible, guns down. |
| 0005 | 45° three-quarter left, neutral stance. |
| 0006 | 45° three-quarter right, neutral stance. |
| 0007 | Relaxed idle front, weight on right leg, shoulders down. |
| 0008 | Alert idle front, bent knees, head slightly left, guns ready/down. |
| 0009 | Aim left with both pistols, anatomically correct extended arms; no muzzle flash. |
| 0010 | Aim right with both pistols, anatomically correct extended arms; no muzzle flash. |
| 0011 | Fire-left recoil phase, elbows flexed, gun barrels +6°, flash in separate FX asset. |
| 0012 | Fire-right recoil phase, elbows flexed, gun barrels +6°, flash in separate FX asset. |

**Reject:** incomplete fingers, cropped limbs/guns, duplicate arms, pose-direction inversion, distorted facial identity, background, baked checkerboard, poster or collage. Verify each with source-provenance, pixel/alpha, SHA and visual uniqueness, Godot 4 actual import and physical mobile performance before promotion.
