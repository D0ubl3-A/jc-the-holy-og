# Run50 Godot 4 export and verification contract

Canonical sources: independently rendered native 1024x1536 RGBA PNG, straight alpha, >=48px transparent safe margins, no background or labels. Do not use reference collage crops as masters.

8-frame animation atlas: 4 columns x 2 rows, 512x768 cells = 2048x1536. 12-frame: 4 columns x 3 rows = 2048x2304. Native 1024x1536 single pose raw RGBA ~6 MiB; twelve simultaneously resident ~72 MiB before mipmaps/overheads. Produce runtime 512x768 or 256x384 LOD only AFTER source master accepted.

Godot 4: Sprite2D or AnimatedSprite2D, consistent feet pivot and baseline, 2D import, filter Linear for photorealistic downscaling, no texture repeat, test alpha fringes under ASTC/ETC2 on Android. Runtime evidence: actual Godot 4 import of each native PNG, then five-minute representative Android scene, measured 10th-percentile FPS >=55, memory and visual artifact log. Neither was executed in Run50.

Release gate also requires visual human QA of exact canonical face, anatomy, all limbs and both pistols, strict left/right camera, frame-to-frame identity, meaningful pose distinction and SHA-256 uniqueness. Missing evidence = unverified.
