extends SceneTree
# JC Hell Vegas Run37: fail-closed Godot 4 import probe.
# Run from a Godot 4 project root:
# godot --headless --path production/sprites/godot4/run37 --script res://qa_import.gd
# Place independent native PNGs in res://sprites/masters/
func _initialize() -> void:
    var failed := 0
    var folder := "res://sprites/masters/"
    var files := DirAccess.get_files_at(folder)
    for n in range(1, 13):
        var id := "%04d" % n
        var path := ""
        for f in files:
            if f.begins_with(id + "_") and f.ends_with(".png"):
                path = folder + f
                break
        if path == "":
            print("FAIL missing independent master: ", id)
            failed += 1
            continue
        var im := Image.new()
        var err := im.load(path)
        if err != OK:
            print("FAIL image decode: ", id, " error=", err)
            failed += 1
            continue
        if im.get_size() != Vector2i(1024, 1536):
            print("FAIL native dimensions: ", id, " ", im.get_size())
            failed += 1
            continue
        if im.get_format() != Image.FORMAT_RGBA8:
            print("FAIL not RGBA8: ", id)
            failed += 1
            continue
        var tex := ImageTexture.create_from_image(im)
        if tex == null or tex.get_size() != Vector2(1024, 1536):
            print("FAIL texture import: ", id)
            failed += 1
            continue
        print("PASS Godot decode and texture creation: ", id)
    print("Godot import probe failures: ", failed)
    quit(1 if failed > 0 else 0)
