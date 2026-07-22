from __future__ import annotations

import runpy
from pathlib import Path

patcher = Path(__file__).with_name("expand_full_strip.py")
source = patcher.read_text(encoding="utf-8")
obsolete_check = "index = replace_required(index, '\"<br>STRIP HD: PROXIMITY LOAD\"', '\"<br>FULL STRIP HD: PROXIMITY LOAD\"', \"city progress label\")\n"
if obsolete_check in source:
    source = source.replace(obsolete_check, "")
    patcher.write_text(source, encoding="utf-8")
runpy.run_path(str(patcher), run_name="__main__")
