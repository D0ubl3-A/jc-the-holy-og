extends SceneTree

# Run30 native sprite import gate. Use ONLY independent accepted masters in sprites_native/.
# Run with: godot --headless --path ./production/sprites/godot4 --editor --quit
# then: godot --headless --path ./production/sprites/godot4 --script res://tools/verify_run30.gd
func _initialize() -> void:
    var dir := DirAccess.open("res://sprites_native")
    if dir == null:
        push_error("Missing sprites_native directory")
        quit(1)
        return
    var count := 0
    for file in dir.get_files():
        if not file.ends_with(".png"):
            continue
        var texture := load("res://sprites_native/" + file) as Texture2D
        if texture == null or texture.get_width() != 1024 or texture.get_height() != 1536:
            push_error("Bad import or size: " + file)
            quit(1)
            return
        var img := texture.get_image()
        if img == null or not img.detect_alpha():
            push_error("Missing transparency: " + file)
            quit(1)
            return
        count += 1
    if count != 12:
        push_error("Expected 12 native masters, got " + str(count))
        quit(1)
        return
    print("IMPORT CHECK PASS: 12 candidate native masters; visual/mobile gates still required")
    quit(0)
