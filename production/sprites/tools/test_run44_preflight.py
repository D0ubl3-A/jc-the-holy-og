import sys, unittest, tempfile
from pathlib import Path
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parent))
from run44_preflight import check_png

class TestRun44Preflight(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = Path(self.tmp.name) / "x.png"
    def tearDown(self):
        self.tmp.cleanup()
    def render(self, sz=(1024,1536), bbox=(100,100,924,1436), mode="RGBA"):
        im = Image.new(mode, sz, (0,0,0,0) if mode=="RGBA" else (255,255,255))
        ImageDraw.Draw(im).rectangle(bbox, fill=(255,255,255,255) if mode=="RGBA" else (0,0,0))
        im.save(self.p)
    def test_missing_binary(self):
        self.assertFalse(check_png(self.p)["passed"])
    def test_good_without_provenance_rejected(self):
        self.render()
        self.assertFalse(check_png(self.p)["passed"])
    def test_good_with_provenance(self):
        self.render()
        self.assertTrue(check_png(self.p, independent=True)["passed"])
    def test_composite_dimensions_rejected(self):
        self.render((1448,1086),(50,50,1398,1036))
        self.assertFalse(check_png(self.p, independent=True)["passed"])
    def test_border_touch_rejected(self):
        self.render(bbox=(0,0,1023,1535))
        self.assertFalse(check_png(self.p, independent=True)["passed"])
    def test_no_alpha_rejected(self):
        self.render(mode="RGB")
        self.assertFalse(check_png(self.p, independent=True)["passed"])
    def test_empty_silhouette_rejected(self):
        Image.new("RGBA",(1024,1536),(0,0,0,0)).save(self.p)
        self.assertFalse(check_png(self.p, independent=True)["passed"])

if __name__ == "__main__":
    unittest.main()
