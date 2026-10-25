extends SceneTree
# Staging-only import check; never promotes assets to verified status.
# Requires PNGs to be present at res://assets/reference/.
func _initialize() -> void:
    var failures: int = 0
    for i in range(1, 13):
        var path: String = "res://assets/reference/ref_panel_%02d_256x384_UNVERIFIED.png" % i
        var texture: Texture2D = load(path) as Texture2D
        if texture == null or texture.get_width() != 256 or texture.get_height() != 384:
            push_error("REFERENCE IMPORT FAIL: " + path)
            failures += 1
    if failures > 0:
        quit(1)
    else:
        print("REFERENCE IMPORT PASS ONLY; no native master, anatomy or device FPS verification")
        quit(0)
