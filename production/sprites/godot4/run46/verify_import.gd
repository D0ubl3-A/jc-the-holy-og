extends SceneTree
# Synthetic 256x384 import fixtures ONLY. Does not certify actual sprite artwork.
func _initialize() -> void:
    var failures := 0
    for i in range(1, 13):
        var path := "res://fixtures/sprite_%02d_QA_ONLY.png" % i
        var texture := load(path) as Texture2D
        if texture == null:
            push_error("IMPORT FAIL: " + path)
            failures += 1
            continue
        if texture.get_width() != 256 or texture.get_height() != 384:
            push_error("DIMENSION FAIL: " + path)
            failures += 1
            continue
        var image := texture.get_image()
        if image == null:
            push_error("READBACK FAIL: " + path)
            failures += 1
            continue
        if image.get_pixel(0, 0).a > 0.05 or image.get_pixel(125, 150).a < 0.95:
            push_error("ALPHA FAIL: " + path)
            failures += 1
    if failures > 0:
        push_error("Synthetic import smoke test failed: %d failures" % failures)
        quit(1)
    else:
        print("PASS: 12 synthetic fixture imports, dimensions and alpha. RELEASE SPRITES VERIFIED: ZERO.")
        quit(0)
