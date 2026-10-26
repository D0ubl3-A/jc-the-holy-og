extends Node2D
# Run85: development-only character turntable; not release approved.
const SHEET = preload("res://assets/JC_0001_0004_512_ATLAS_UNVERIFIED.png")
const CELL_W := 544
const CELL_H := 800
const W := 512
const H := 768
var hero: Sprite2D
var view_index := 0
var caption: Label
func _ready() -> void:
    hero = Sprite2D.new()
    hero.position = Vector2(576, 420)
    hero.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
    add_child(hero)
    caption = Label.new()
    caption.position = Vector2(28, 24)
    add_child(caption)
    _set_view(0)
func _unhandled_input(event: InputEvent) -> void:
    if event.is_action_pressed("ui_right"):
        _set_view((view_index + 1) % 4)
    elif event.is_action_pressed("ui_left"):
        _set_view((view_index + 3) % 4)
func _set_view(index: int) -> void:
    view_index = index
    var region := AtlasTexture.new()
    region.atlas = SHEET
    region.region = Rect2(16 + (index % 2) * CELL_W, 16 + int(index / 2) * CELL_H, W, H)
    hero.texture = region
    caption.text = "UNVERIFIED DEVELOPMENT ART - ID %04d - LEFT/RIGHT to rotate" % (index + 1)
