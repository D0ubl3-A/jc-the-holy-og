# Run 25 — Source-native Savior render jobs, 0021–0032

**Output each job separately** as a single 1024x1536 RGBA PNG with straight transparent alpha, full body, at least 64px padding on every side. No composite, text, labels, checkerboard, watermarks or extra characters. Keep exactly the same face, proportions, camera distance, lighting and ground baseline.

**Identity lock:** JC is a normal-height adult man, long wavy brown hair, beard, white hoodie, distressed white jeans, white sneakers, gold cross jewelry, dual gold pistols with plausible grips and holsters. No red scarf, no long robe, no gold armor, no sword, no cap or sunglasses. Photoreal skin, hair, cloth and metal, natural fingers, complete limbs and weapons.

| ID | Required single-frame action |
| --- | --- |
| 0021 | Neutral front, shoulders squared, feet planted, pistols muzzle-down |
| 0022 | Strict 90-degree left-facing anatomical profile, no three-quarter |
| 0023 | Strict 90-degree right-facing anatomical profile, no three-quarter |
| 0024 | Strict back view, no visible face |
| 0025 | Neutral 45-degree three-quarter LEFT, not walking |
| 0026 | Neutral 45-degree three-quarter RIGHT, not walking |
| 0027 | Relaxed idle, stationary, subtle weight shift |
| 0028 | Alert idle, stationary ready stance, no cross or sword |
| 0029 | Both gold pistols aiming LEFT, no muzzle flash |
| 0030 | Both gold pistols aiming RIGHT, no muzzle flash |
| 0031 | Both gold pistols firing LEFT, restrained muzzle flashes |
| 0032 | Both gold pistols firing RIGHT, restrained muzzle flashes |

**Release criteria:** independent native render, unique SHA256, correct pose and outfit, clean transparent alpha, full silhouette/weapon padding, no anatomical errors, Godot 4 import, and measured mobile benchmark. Never count a prompt, contact sheet, or preview as a verified sprite.
