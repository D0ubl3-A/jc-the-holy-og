# Run 62 — 0001–0012 independent sprite masters

Every prompt is a **separate** 1024×1536 RGBA PNG generation, one full-body JC, at least 48 transparent pixels on every side. Canonical identity: long brown hair, beard, white hoodie with restrained gold cross detail, white jeans, white sneakers, dual gold pistols, no cap or cape. Same body scale, camera, lighting, pivot, hand proportions and weapon geometry. No text, scenery, floor shadow, extra people, extra limbs, clipped limbs, painted checkerboard, or composites. Must pass facial signoff, alpha, Godot 4 import, Android gameplay QA before verified.

0001 — neutral front: facing camera, relaxed stance, both gold pistols pointed down.
0002 — neutral left profile: strict left 90° view, weapons down.
0003 — neutral right profile: strict right 90° view, weapons down.
0004 — neutral back: strict 180° back view, hood and hair visible.
0005 — three-quarter left: 45° left, consistent height.
0006 — three-quarter right: 45° right, consistent height.
0007 — idle relaxed: subtle breathing pose, front.
0008 — idle alert: guarded knees, front.
0009 — dual pistols aim left: both arms and weapons entirely inside canvas.
0010 — dual pistols aim right: both arms and weapons entirely inside canvas.
0011 — dual pistols fire left: muzzle flashes entirely inside canvas, believable recoil.
0012 — dual pistols fire right: muzzle flashes entirely inside canvas, believable recoil.

The 4×3 contact-sheet prompt is for **visual review only**; it cannot replace independent masters. Godot 4 mobile export: 1024×1536 PNG masters, 512×768 LODs, sRGB, linear filtering for photorealistic downscaling, mobile texture compression ETC2/ASTC where supported, on-demand streaming. Native RGBA8 source is 6 MiB decoded VRAM per texture, LOD 1.5 MiB; validate 10-minute Android 60fps target with recorded median FPS, p95 frame time, memory and thermals.
