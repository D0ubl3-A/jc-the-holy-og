#!/usr/bin/env python3
"""Manifest regression tests. Fake completions MUST fail."""
import copy,json,tempfile,unittest
from pathlib import Path
from validate_manifest_integrity import audit
ROOT=Path(__file__).resolve().parents[3]
MANIFEST=ROOT/"production/sprites/manifest_0001-2000.json"
LEDGER=ROOT/"production/sprites/progress_ledger.json"
class IntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.original=json.loads(MANIFEST.read_text())
    def check(self,edit):
        m=copy.deepcopy(self.original);edit(m)
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/"manifest.json";path.write_text(json.dumps(m))
            return audit(path,LEDGER,ROOT)
    def test_current_registry(self): self.assertTrue(self.check(lambda m:None)["passed"])
    def test_duplicate_id_rejected(self):
        self.assertFalse(self.check(lambda m:m["assets"][1].update(id="0001"))["passed"])
    def test_duplicate_hash_rejected(self):
        self.assertFalse(self.check(lambda m:(m["assets"][0].update(sha256="a"*64),m["assets"][1].update(sha256="a"*64)))["passed"])
    def test_false_verified_rejected(self):
        def fake(m):
            m["assets"][0]["status"]="verified"
            m["verified_completed"]=1
            m["generated_unverified"]-=1
        self.assertFalse(self.check(fake)["passed"])
    def test_duplicate_archive_hash_rejected(self):
        def fake(m):
            h=m["assets"][0]["run29_archived_candidate_audit"]["sha256_archived_binary"]
            m["assets"][1]["run29_archived_candidate_audit"]["sha256_archived_binary"]=h
        self.assertFalse(self.check(fake)["passed"])
    def test_wrong_category_rejected(self):
        self.assertFalse(self.check(lambda m:m["assets"][-1].update(category="ui"))["passed"])
    def test_square_animation_cells_rejected(self):
        def bad(m):
            a=m["assets"][120]
            a["cell_px"]=[512,512]
            a["master_px"]=[a["grid"][0]*512,a["grid"][1]*512]
        self.assertFalse(self.check(bad)["passed"])
    def test_wrong_animation_master_dimensions_rejected(self):
        self.assertFalse(self.check(lambda m:m["assets"][120].update(master_px=[2048,1024]))["passed"])
    def test_incorrect_ending_route_rejected(self):
        self.assertFalse(self.check(lambda m:m["assets"][-1].update(route="Savior"))["passed"])
    def test_duplicate_slug_rejected(self):
        self.assertFalse(self.check(lambda m:m["assets"][1].update(slug=m["assets"][0]["slug"]))["passed"])
if __name__=="__main__": unittest.main()
