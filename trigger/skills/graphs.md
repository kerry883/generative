# Skill: Mathematical Graphs & Plotting

> **Use when:** The video involves plotting functions, coordinate systems, areas under curves, tangent lines, or comparing multiple functions.

## Core Pattern: Basic Function Plot

```python
# Create axes with labeled ticks
axes = Axes(
    x_range=[-1, 7, 1],
    y_range=[-1, 10, 1],
    x_length=10,
    y_length=6,
    axis_config={"include_numbers": True, "font_size": 24},
)
axes_labels = axes.get_axis_labels(x_label="x", y_label="f(x)")

# Plot a function
curve = axes.plot(lambda x: 0.5 * x ** 2, x_range=[0, 6], color=YELLOW)
curve_label = axes.get_graph_label(curve, label="f(x) = \\\\frac{1}{2}x^2", x_val=5, direction=UP)

# Group everything and scale to fit screen
graph_group = VGroup(axes, axes_labels, curve, curve_label)
graph_group.scale_to_fit_width(12)
graph_group.move_to(ORIGIN)

with self.voiceover(text="""Let us look at the graph of f of x equals one half x squared.""") as tracker:
    self.play(Create(axes), Write(axes_labels), run_time=2)
    self.play(Create(curve), Write(curve_label), run_time=2)
```

## Pattern: Area Under a Curve

```python
axes = Axes(x_range=[-1, 6, 1], y_range=[-1, 8, 1], x_length=10, y_length=6,
            axis_config={"include_numbers": True, "font_size": 24})

curve = axes.plot(lambda x: 0.3 * x ** 2, x_range=[0, 5], color=BLUE)

# Shade area between x=1 and x=4
area = axes.get_area(curve, x_range=[1, 4], color=YELLOW, opacity=0.4)

# Add boundary lines
line_left = axes.get_vertical_line(axes.c2p(1, 0.3), color=WHITE)
line_right = axes.get_vertical_line(axes.c2p(4, 4.8), color=WHITE)

# Labels for bounds
label_a = MathTex("a=1", font_size=28).next_to(axes.c2p(1, 0), DOWN)
label_b = MathTex("b=4", font_size=28).next_to(axes.c2p(4, 0), DOWN)

graph_group = VGroup(axes, curve, area, line_left, line_right, label_a, label_b)
graph_group.scale_to_fit_width(12)
graph_group.move_to(ORIGIN)

with self.voiceover(text="""The shaded region represents the definite integral from a equals 1 to b equals 4.""") as tracker:
    self.play(Create(axes), run_time=1.5)
    self.play(Create(curve), run_time=1.5)
    self.play(FadeIn(area), Create(line_left), Create(line_right), run_time=2)
    self.play(Write(label_a), Write(label_b), run_time=1)
```

## Pattern: Tangent Line at a Point

```python
axes = Axes(x_range=[-1, 6, 1], y_range=[-1, 10, 1], x_length=10, y_length=6)

curve = axes.plot(lambda x: 0.4 * x ** 2, x_range=[0, 5], color=GREEN)

# Point of tangency
x_val = 3
y_val = 0.4 * x_val ** 2
slope = 0.8 * x_val  # derivative at x=3

# Dot at the point
dot = Dot(axes.c2p(x_val, y_val), color=RED, radius=0.08)

# Tangent line through the point
tangent = axes.plot(lambda x: slope * (x - x_val) + y_val, x_range=[1, 5], color=RED)

tangent_label = MathTex("\\\\text{slope} = 2.4", font_size=28, color=RED)
tangent_label.next_to(dot, UR, buff=0.3)

group = VGroup(axes, curve, dot, tangent, tangent_label)
group.scale_to_fit_width(12)
group.move_to(ORIGIN)
```

## Pattern: Multiple Functions Comparison

```python
axes = Axes(x_range=[-4, 4, 1], y_range=[-2, 8, 1], x_length=10, y_length=6,
            axis_config={"include_numbers": True, "font_size": 24})

f1 = axes.plot(lambda x: x ** 2, x_range=[-3, 3], color=BLUE)
f2 = axes.plot(lambda x: 2 ** x, x_range=[-3, 3], color=RED)

label1 = axes.get_graph_label(f1, label="x^2", x_val=2.5, direction=LEFT)
label2 = axes.get_graph_label(f2, label="2^x", x_val=2.5, direction=RIGHT)

# Legend in corner
legend = VGroup(
    VGroup(Line(ORIGIN, RIGHT * 0.5, color=BLUE), Text("Polynomial", font_size=20)).arrange(RIGHT, buff=0.2),
    VGroup(Line(ORIGIN, RIGHT * 0.5, color=RED), Text("Exponential", font_size=20)).arrange(RIGHT, buff=0.2),
).arrange(DOWN, aligned_edge=LEFT, buff=0.15)
legend.to_corner(UR, buff=0.5)

group = VGroup(axes, f1, f2, label1, label2, legend)
group.scale_to_fit_width(12)
group.move_to(ORIGIN)
```

## Common Pitfalls

- **NEVER** use `axes.get_bar()` or `axes.plot_bar_graph()` — these don't exist. Use `BarChart` class instead.
- **ALWAYS** group axes + curves + labels into a `VGroup` and `scale_to_fit_width(12)`.
- For labeled points, use `Dot` + `MathTex` with `.next_to()`, not hardcoded coordinates.
- Use `axes.c2p(x, y)` (coords to point) to position elements on the graph.