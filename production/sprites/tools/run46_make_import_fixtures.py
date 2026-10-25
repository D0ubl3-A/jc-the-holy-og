#!/usr/bin/env python3
"""Deterministic synthetic fixture generator. Not actual JC game artwork."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib, json, sys

def build(root):
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    manifest = []
    for i in range(1, 13):
        im = Image.new('RGBA', (256, 384), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        color = (35+i*12, 85+i*5, 135+i*7, 255)
        d.ellipse((95,40,160,105), fill=color)
        d.rounded_rectangle((90,104,165,250), radius=15, fill=color)
        d.line([(105,240),(95+i%4,325)], fill=color, width=22)
        d.line([(150,240),(165-i%4,325)], fill=color, width=22)
        d.line([(91,130),(63,213+i%4)], fill=color, width=16)
        d.line([(166,130),(196,215+i%4)], fill=color, width=16)
        p = root / f'sprite_{i:02d}_QA_ONLY.png'
        im.save(p)
        manifest.append({'file':p.name, 'sha256':hashlib.sha256(p.read_bytes()).hexdigest(), 'size':[256,384], 'synthetic_fixture_only':True})
    (root/'fixture_manifest.json').write_text(json.dumps(manifest, indent=2))
    assert len({x['sha256'] for x in manifest}) == 12
    print('Generated 12 synthetic Godot import fixtures; 0 production sprites.')

if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv)>1 else 'fixtures')
