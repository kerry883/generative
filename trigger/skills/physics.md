# Skill: Physics Animations

> **Use when:** The video involves force diagrams, projectile motion, waves, electromagnetic fields, circuits, or particle physics.

## Pattern: Force Diagram (Free Body Diagram)

```python
# Object in center
obj = Square(side_length=1.2, color=BLUE, fill_opacity=0.3)
obj_label = Text("m", font_size=28, color=BLUE).move_to(obj)

# Force arrows (from center of object outward)
f_gravity = Arrow(obj.get_center(), obj.get_center() + DOWN * 2, buff=0, color=RED, stroke_width=5)
f_normal = Arrow(obj.get_center(), obj.get_center() + UP * 2, buff=0, color=GREEN, stroke_width=5)
f_friction = Arrow(obj.get_center(), obj.get_center() + LEFT * 1.5, buff=0, color=ORANGE, stroke_width=5)
f_applied = Arrow(obj.get_center(), obj.get_center() + RIGHT * 2.5, buff=0, color=YELLOW, stroke_width=5)

# Labels for each force
label_g = MathTex("F_g = mg", font_size=28, color=RED).next_to(f_gravity, RIGHT, buff=0.2)
label_n = MathTex("F_N", font_size=28, color=GREEN).next_to(f_normal, RIGHT, buff=0.2)
label_f = MathTex("f", font_size=28, color=ORANGE).next_to(f_friction, UP, buff=0.2)
label_a = MathTex("F_{app}", font_size=28, color=YELLOW).next_to(f_applied, UP, buff=0.2)

fbd = VGroup(obj, obj_label, f_gravity, f_normal, f_friction, f_applied,
             label_g, label_n, label_f, label_a)
fbd.scale_to_fit_width(10)
fbd.move_to(ORIGIN)

with self.voiceover(text="""Here is the free body diagram showing all forces acting on the object.""") as tracker:
    self.play(Create(obj), Write(obj_label), run_time=1)
    self.play(GrowArrow(f_gravity), Write(label_g), run_time=1)
    self.play(GrowArrow(f_normal), Write(label_n), run_time=1)
    self.play(GrowArrow(f_friction), Write(label_f), run_time=1)
    self.play(GrowArrow(f_applied), Write(label_a), run_time=1)
```

## Pattern: Projectile Motion

```python
axes = Axes(x_range=[0, 12, 2], y_range=[0, 8, 2], x_length=10, y_length=5,
            axis_config={"include_numbers": True, "font_size": 20})
x_label = Text("Distance (m)", font_size=22).next_to(axes.x_axis, DOWN, buff=0.3)
y_label = Text("Height (m)", font_size=22).next_to(axes.y_axis, LEFT, buff=0.3).rotate(90 * DEGREES)

# Parabolic trajectory
trajectory = axes.plot(
    lambda x: -0.1 * (x - 5) ** 2 + 6,
    x_range=[0, 10],
    color=YELLOW
)

# Dot that traces the path
ball = Dot(color=RED, radius=0.12)
ball.move_to(axes.c2p(0, 3.5))

# Velocity components at launch
v_x = Arrow(axes.c2p(0, 3.5), axes.c2p(1.5, 3.5), buff=0, color=BLUE, stroke_width=4)
v_y = Arrow(axes.c2p(0, 3.5), axes.c2p(0, 5.5), buff=0, color=GREEN, stroke_width=4)
v_x_label = MathTex("v_x", font_size=24, color=BLUE).next_to(v_x, DOWN, buff=0.1)
v_y_label = MathTex("v_y", font_size=24, color=GREEN).next_to(v_y, LEFT, buff=0.1)

graph_group = VGroup(axes, x_label, y_label, trajectory, ball, v_x, v_y, v_x_label, v_y_label)
graph_group.scale_to_fit_width(12)
graph_group.move_to(ORIGIN)

with self.voiceover(text="""The projectile follows a parabolic path under gravity.""") as tracker:
    self.play(Create(axes), Write(x_label), Write(y_label), run_time=1.5)
    self.play(FadeIn(ball), GrowArrow(v_x), GrowArrow(v_y), run_time=1)
    self.play(Write(v_x_label), Write(v_y_label), run_time=0.5)
    # Animate ball along trajectory
    self.play(
        MoveAlongPath(ball, trajectory),
        Create(trajectory),
        FadeOut(v_x), FadeOut(v_y), FadeOut(v_x_label), FadeOut(v_y_label),
        run_time=3
    )
```

## Pattern: Simple Wave Animation

```python
axes = Axes(x_range=[0, 4 * PI, PI], y_range=[-2, 2, 1], x_length=11, y_length=4)

# Create a sine wave
wave = axes.plot(lambda x: 1.5 * np.sin(x), x_range=[0, 4 * PI], color=BLUE)

# Labels
wavelength_brace = Brace(
    VGroup(Dot(axes.c2p(0, 0)), Dot(axes.c2p(2 * PI, 0))),
    DOWN, color=YELLOW
)
wl_label = Text("Wavelength", font_size=22, color=YELLOW)
wl_label.next_to(wavelength_brace, DOWN, buff=0.2)

amplitude_line = DashedLine(axes.c2p(PI / 2, 0), axes.c2p(PI / 2, 1.5), color=RED)
amp_label = Text("Amplitude", font_size=22, color=RED)
amp_label.next_to(amplitude_line, RIGHT, buff=0.2)

group = VGroup(axes, wave, wavelength_brace, wl_label, amplitude_line, amp_label)
group.scale_to_fit_width(12)
group.move_to(ORIGIN)
```

## Pattern: Bar Magnet with Field Lines

```python
# Two rectangles for north/south poles (NO GRADIENTS - use solid colors)
north_pole = Rectangle(width=1.5, height=0.8, fill_opacity=0.9).set_fill(RED)
south_pole = Rectangle(width=1.5, height=0.8, fill_opacity=0.9).set_fill(BLUE)
south_pole.next_to(north_pole, RIGHT, buff=0)

n_label = Text("N", font_size=28, color=WHITE).move_to(north_pole)
s_label = Text("S", font_size=28, color=WHITE).move_to(south_pole)

magnet = VGroup(north_pole, south_pole, n_label, s_label)
magnet.move_to(ORIGIN)

# Field lines as curved arrows
field_lines = VGroup()
for y_offset in [0.8, 1.6]:
    for sign in [1, -1]:
        arc = ArcBetweenPoints(
            north_pole.get_right() + UP * y_offset * sign * 0.3,
            south_pole.get_left() + UP * y_offset * sign * 0.3,
            angle=sign * PI * 0.6,
            color=GRAY
        )
        field_lines.add(arc)

diagram = VGroup(magnet, field_lines)
diagram.scale_to_fit_width(10)
diagram.move_to(ORIGIN)
```

## Common Pitfalls

- **NEVER** use `.set_fill(color=[RED, BLUE])` for gradients — Manim doesn't support this reliably
- For magnets, use **two separate rectangles** with solid colors side by side
- `Arrow` for force vectors: use `buff=0` to start from the exact center of the object
- For `MoveAlongPath`, the path must be a Manim mobject (a `ParametricFunction` from `axes.plot()` works)
- Import `numpy as np` or use `from manim import *` which includes it