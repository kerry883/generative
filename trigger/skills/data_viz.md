# Skill: Data Visualization

> **Use when:** The video involves bar charts, pie charts, data tables, animated counters, or statistical comparisons.

## Pattern: Bar Chart

```python
# Manim has a built-in BarChart class
chart = BarChart(
    values=[3, 5, 2, 8, 4],
    bar_names=["A", "B", "C", "D", "E"],
    y_range=[0, 10, 2],
    y_length=5,
    x_length=10,
    bar_colors=[BLUE, GREEN, YELLOW, RED, PURPLE],
)

# Add value labels on top of each bar
bar_labels = chart.get_bar_labels(font_size=24)

group = VGroup(chart, bar_labels)
group.scale_to_fit_width(11)
group.move_to(ORIGIN)

with self.voiceover(text="""Here is the distribution of values across five categories.""") as tracker:
    self.play(Create(chart), run_time=2)
    self.play(Write(bar_labels), run_time=1)
```

## Pattern: Animated Bar Chart (Values Change)

```python
chart = BarChart(
    values=[2, 4, 6, 3, 7],
    bar_names=["Q1", "Q2", "Q3", "Q4", "Q5"],
    y_range=[0, 10, 2],
    bar_colors=[BLUE_D, BLUE_C, BLUE_B, BLUE_A, BLUE],
)
chart.scale_to_fit_width(11)
chart.move_to(ORIGIN)

with self.voiceover(text="""Watch how the values change over time.""") as tracker:
    self.play(Create(chart), run_time=2)

with self.voiceover(text="""Revenue increased significantly in the second period.""") as tracker:
    new_values = [5, 8, 4, 9, 6]
    self.play(chart.animate.change_bar_values(new_values), run_time=2)
```

## Pattern: Pie Chart (Manual Construction)

```python
# Manim doesn't have a built-in PieChart, build with Sectors
data = [("Python", 35, BLUE), ("JavaScript", 25, YELLOW), ("Java", 20, RED), ("Other", 20, GRAY)]

sectors = VGroup()
labels = VGroup()
start_angle = 0

for name, percentage, color in data:
    angle = percentage / 100 * TAU  # Convert percentage to radians
    sector = Sector(
        outer_radius=2,
        start_angle=start_angle,
        angle=angle,
        color=color,
        fill_opacity=0.8,
        stroke_width=2,
        stroke_color=WHITE
    )
    sectors.add(sector)

    # Label positioned at midpoint of arc
    mid_angle = start_angle + angle / 2
    label_pos = 2.5 * np.array([np.cos(mid_angle), np.sin(mid_angle), 0])
    label = Text(f"{name} ({percentage}%)", font_size=20, color=color)
    label.move_to(label_pos)
    labels.add(label)

    start_angle += angle

pie = VGroup(sectors, labels)
pie.scale_to_fit_width(10)
pie.move_to(ORIGIN)

with self.voiceover(text="""Here is the market share breakdown by programming language.""") as tracker:
    for i, sector in enumerate(sectors):
        self.play(Create(sector), Write(labels[i]), run_time=0.8)
```

## Pattern: Data Table

```python
# Use Manim's Table class
table = Table(
    [["2020", "100", "85%"],
     ["2021", "250", "90%"],
     ["2022", "500", "92%"],
     ["2023", "800", "95%"]],
    col_labels=[Text("Year"), Text("Users"), Text("Satisfaction")],
    include_outer_lines=True,
    line_config={"stroke_width": 1, "color": GRAY},
).scale(0.7)

# Color the header row
for label in table.get_col_labels():
    label.set_color(YELLOW)

table.scale_to_fit_width(10)
table.move_to(ORIGIN)

with self.voiceover(text="""Let us examine the data over the past four years.""") as tracker:
    self.play(Create(table), run_time=2)

# Highlight a specific row
with self.voiceover(text="""Notice the significant growth in 2022.""") as tracker:
    row_highlight = SurroundingRectangle(table.get_rows()[3], color=GREEN, buff=0.1)
    self.play(Create(row_highlight), run_time=1)
```

## Pattern: Animated Number Counter

```python
# Use DecimalNumber for animated counting
counter = DecimalNumber(0, num_decimal_places=0, font_size=72, color=YELLOW)
counter.move_to(ORIGIN)

label = Text("Total Users", font_size=32)
label.next_to(counter, UP, buff=0.5)

with self.voiceover(text="""Our user base has grown to one million.""") as tracker:
    self.play(Write(label), run_time=0.5)
    self.play(ChangeDecimalToValue(counter, 1000000), run_time=3)
```

## Pattern: Comparison Side-by-Side

```python
# Two bar charts side by side for comparison
chart_before = BarChart(
    values=[3, 5, 2],
    bar_names=["A", "B", "C"],
    y_range=[0, 10, 2],
    x_length=5,
    y_length=4,
    bar_colors=[RED, RED, RED],
)
title_before = Text("Before", font_size=28, color=RED)
title_before.next_to(chart_before, UP, buff=0.3)

chart_after = BarChart(
    values=[7, 8, 6],
    bar_names=["A", "B", "C"],
    y_range=[0, 10, 2],
    x_length=5,
    y_length=4,
    bar_colors=[GREEN, GREEN, GREEN],
)
title_after = Text("After", font_size=28, color=GREEN)
title_after.next_to(chart_after, UP, buff=0.3)

before_group = VGroup(title_before, chart_before)
after_group = VGroup(title_after, chart_after)

comparison = VGroup(before_group, after_group).arrange(RIGHT, buff=1.5)
comparison.scale_to_fit_width(12)
comparison.move_to(ORIGIN)
```

## Common Pitfalls

- **NEVER** use `axes.get_bar()` or `axes.plot_bar_graph()` — they don't exist
- Use the dedicated `BarChart` class for bar charts
- Manim has NO built-in `PieChart` — construct manually with `Sector`
- For `Table`, always call `.scale(0.7)` or similar before positioning — tables are large by default
- `ChangeDecimalToValue` is the correct way to animate numbers, not manual updates
- `chart.animate.change_bar_values()` animates bar height changes