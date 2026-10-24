extends Node2D
## Run 35 physical-device probe. Not executed; no benchmark results are claimed.
## Assign real res:// texture paths in the Inspector.
@export var texture_paths: PackedStringArray = []
@export var warmup_seconds: float = 5.0
@export var sample_seconds: float = 60.0
@export var visible_sprite_scale: float = 0.35
var elapsed := 0.0
var samples: Array[float] = []
var missing: Array[String] = []

func _ready() -> void:
    for path in texture_paths:
        if not ResourceLoader.exists(path):
            missing.append(path)
            continue
        var tex: Texture2D = load(path)
        if tex == null:
            missing.append(path)
            continue
        var sprite := Sprite2D.new()
        sprite.texture = tex
        sprite.position = Vector2(180.0 + (get_child_count() % 4) * 160.0, 270.0)
        sprite.scale = Vector2.ONE * visible_sprite_scale
        add_child(sprite)
    print("JC_MOBILE_PROBE_START loaded=", get_child_count(), " missing=", missing.size())

func _process(delta: float) -> void:
    elapsed += delta
    if elapsed >= warmup_seconds and elapsed < warmup_seconds + sample_seconds:
        samples.append(float(Engine.get_frames_per_second()))
    if elapsed >= warmup_seconds + sample_seconds:
        samples.sort()
        var p10: float = 0.0
        if samples.size() > 0:
            var idx: int = int(floor(float(samples.size() - 1) * 0.10))
            p10 = samples[idx]
        print("JC_MOBILE_PROBE_RESULT p10_fps=", p10, " samples=", samples.size(), " missing=", missing.size())
        print("RECORD DEVICE MODEL, RENDERER, THERMAL STATE, OS, BUILD HASH AND TIMESTAMP")
        set_process(false)
