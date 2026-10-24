extends SceneTree

# Run with: godot --headless --editor --path . --quit
# Then: godot --headless --path . --script res://production/sprites/godot4/tests/validate_native_sprites.gd
# Place independent native masters under res://production/sprites/godot4/sprites_native/
func _initialize() -> void:
    var folder := "res://production/sprites/godot4/sprites_native/"
    var dir := DirAccess.open(folder)
    if dir == null:
        printerr("FAIL: sprites_native directory not found")
        quit(2)
        return
    var pass_count := 0
    var failures := []
    for n in range(1, 13):
        var prefix := "%04d_" % n
        var file := ""
        dir.list_dir_begin()
        while true:
            var candidate := dir.get_next()
            if candidate == "":
                break
            if candidate.begins_with(prefix) and candidate.ends_with(".png"):
                file = candidate
                break
        dir.list_dir_end()
        if file == "":
            failures.append("Missing native master for %s" % prefix)
            continue
        var path := folder + file
        var img := Image.load_from_file(path)
        if img == null or img.is_empty():
            failures.append("Image decode failed: %s" % path)
            continue
        if img.get_width() != 1024 or img.get_height() != 1536:
            failures.append("Wrong dimensions: %s" % path)
            continue
        if img.detect_alpha() == Image.ALPHA_NONE:
            failures.append("No alpha: %s" % path)
            continue
        var tex := load(path) as Texture2D
        if tex == null or tex.get_width() != 1024 or tex.get_height() != 1536:
            failures.append("Texture2D import failed: %s" % path)
            continue
        pass_count += 1
    print("Godot native import gate: %d/12 pass" % pass_count)
    for failure in failures:
        printerr(failure)
    # Import gate alone is not verification; anatomy/identity/mobile signoff still required.
    quit(0 if pass_count == 12 else 1)
