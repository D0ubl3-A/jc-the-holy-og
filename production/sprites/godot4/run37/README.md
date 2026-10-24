# Run37 Godot 4 import gate (not yet executed)
Put twelve independently rendered native RGBA8 PNG masters named `0001_slug.png` to `0012_slug.png` under `production/sprites/godot4/run37/masters/`.
Run from a Godot 4 project root:
```
godot --headless --path . --script res://production/sprites/godot4/run37/qa_import.gd
```
A PASS proves image decode, dimensions and texture creation only. It does NOT verify anatomy, canonical identity, native detail, independent provenance, or actual mobile FPS. Keep all sprites unverified until every release gate is evidenced.

Mobile test: warm for 60 seconds, then record 60 seconds of representative gameplay on physical Android with at least 30 actors, VFX and streamed Vegas geometry. Target 10th percentile FPS >=55, no OOM and no >250 ms stalls. Save device model, thermal state, frame times and texture memory. Do not render a 1536-pixel-high sprite at native screen size: use camera-projected character scale and appropriate LOD.
