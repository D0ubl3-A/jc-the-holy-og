#!/usr/bin/env python3
"""Guard against accidental promotion of unverified JC sprite records."""
import copy,json,subprocess,sys,tempfile
from pathlib import Path
manifest=Path(sys.argv[1] if len(sys.argv)>1 else "production/sprites/manifest_0001-2000.json")
validator=Path(__file__).with_name("validate_sprite_manifest.py")
base=json.loads(manifest.read_text())
cases=[]
def test(name,data,should_pass):
 with tempfile.TemporaryDirectory() as tmp:
  p=Path(tmp)/"manifest_0001-2000.json";p.write_text(json.dumps(data))
  result=subprocess.run([sys.executable,str(validator),str(p)],capture_output=True,text=True)
  ok=(result.returncode==0)==should_pass
  cases.append({"case":name,"passed":ok,"exit":result.returncode})
test("valid unverified registry",base,True)
d=copy.deepcopy(base);d["assets"][0]["id"]="0002";test("duplicate ID must fail",d,False)
d=copy.deepcopy(base);d["assets"][20]["status"]="verified";d["generated_unverified"]-=1;d["verified_completed"]+=1;test("status-only promotion must fail",d,False)
d=copy.deepcopy(base);d["category_targets"]["humans"]+=1;test("tampered category totals must fail",d,False)
print(json.dumps({"passed":all(c["passed"] for c in cases),"cases":cases},indent=2))
sys.exit(0 if all(c["passed"] for c in cases) else 1)
