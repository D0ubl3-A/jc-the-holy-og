extends SceneTree
# godot --headless --path ./godot4 --editor --quit
# godot --headless --path ./godot4 --script res://tools/run33_import_audit.gd
# Import/format gate only: never grants identity, anatomy or mobile verification.
const EXPECTED := 12
const W := 1024
const H := 1536
const MARGIN := 48

func _initialize() -> void:
    var dir := DirAccess.open("res://sprites_native")
    if dir == null:
        printerr("FAIL: sprites_native missing")
        quit(2)
        return
    var seen := {}
    var failures := []
    for filename in dir.get_files():
        if not filename.ends_with(".png"):
            continue
        var id := filename.substr(0, 4)
        if not id.is_valid_int() or int(id) < 1 or int(id) > EXPECTED:
            failures.append("Unexpected ID: " + filename)
            continue
        if seen.has(id):
            failures.append("Duplicate ID: " + id)
        seen[id] = true
        var path := "res://sprites_native/" + filename
        var im := Image.load_from_file(path)
        if im == null or im.is_empty():
            failures.append("Cannot decode: " + filename)
            continue
        if im.get_width() != W or im.get_height() != H or im.get_format() != Image.FORMAT_RGBA8:
            failures.append("Invalid dimensions/format: " + filename)
        var r := im.get_used_rect()
        if r.size.x == 0 or r.size.y == 0 or r.position.x < MARGIN or r.position.y < MARGIN or W-r.end.x < MARGIN or H-r.end.y < MARGIN:
            failures.append("Empty or clipped alpha: " + filename)
        var texture := load(path) as Texture2D
        if texture == null or texture.get_width() != W or texture.get_height() != H:
            failures.append("Texture import failure: " + filename)
    for n in range(1, EXPECTED + 1):
        if not seen.has("%04d" % n):
            failures.append("Missing sprite %04d" % n)
    for f in failures:
        printerr("FAIL: ", f)
    if failures.is_empty():
        print("PASS import checks only; identity, anatomy, provenance and mobile tests pending")
    quit(2 if not failures.is_empty() else 0)
