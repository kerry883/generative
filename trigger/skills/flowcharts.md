# Skill: Flowcharts & System Diagrams

> **Use when:** The video involves architecture diagrams, process flows, decision trees, or any box-and-arrow visualization.

## Core Pattern: Simple Flowchart (3 Boxes + Arrows)

```python
# 1. Create boxes (keep them small, let VGroup handle spacing)
box_input = Rectangle(width=3, height=1.5, color=BLUE, fill_opacity=0.2)
label_input = Text("Input Data").scale_to_fit_width(box_input.width * 0.85)
label_input.move_to(box_input)
input_group = VGroup(box_input, label_input)

box_process = Rectangle(width=3, height=1.5, color=YELLOW, fill_opacity=0.2)
label_process = Text("Process").scale_to_fit_width(box_process.width * 0.85)
label_process.move_to(box_process)
process_group = VGroup(box_process, label_process)

box_output = Rectangle(width=3, height=1.5, color=GREEN, fill_opacity=0.2)
label_output = Text("Output").scale_to_fit_width(box_output.width * 0.85)
label_output.move_to(box_output)
output_group = VGroup(box_output, label_output)

# 2. Arrange horizontally
flow = VGroup(input_group, process_group, output_group).arrange(RIGHT, buff=1.5)

# 3. Add arrows AFTER arranging (so positions are set)
arrow1 = Arrow(box_input.get_right(), box_process.get_left(), buff=0.1, color=WHITE)
arrow2 = Arrow(box_process.get_right(), box_output.get_left(), buff=0.1, color=WHITE)

# 4. Group everything and scale to fit
diagram = VGroup(flow, arrow1, arrow2)
diagram.scale_to_fit_width(12)
diagram.move_to(ORIGIN)

with self.voiceover(text="""Data flows from input through processing to output.""") as tracker:
    self.play(Create(input_group), run_time=1)
    self.play(GrowArrow(arrow1), run_time=0.5)
    self.play(Create(process_group), run_time=1)
    self.play(GrowArrow(arrow2), run_time=0.5)
    self.play(Create(output_group), run_time=1)
```

## Pattern: Vertical Flow (Top-Down Process)

```python
steps = []
step_names = ["Start", "Collect Data", "Analyze", "Report", "End"]
colors = [BLUE, YELLOW, GREEN, ORANGE, RED]

for i, (name, color) in enumerate(zip(step_names, colors)):
    box = RoundedRectangle(width=3.5, height=1, corner_radius=0.2, color=color, fill_opacity=0.2)
    label = Text(name, font_size=28).move_to(box)
    steps.append(VGroup(box, label))

flow = VGroup(*steps).arrange(DOWN, buff=0.8)

# Add arrows between consecutive steps
arrows = []
for i in range(len(steps) - 1):
    arrow = Arrow(steps[i][0].get_bottom(), steps[i + 1][0].get_top(), buff=0.1, color=GRAY)
    arrows.append(arrow)

diagram = VGroup(flow, *arrows)
diagram.scale_to_fit_height(6.5)
diagram.move_to(ORIGIN)
```

## Pattern: Zoom Into a Component

```python
# Create the overview diagram
encoder_box = Rectangle(width=3, height=2, color=YELLOW, fill_opacity=0.15)
encoder_label = Text("Encoder", font_size=24).move_to(encoder_box)
encoder_group = VGroup(encoder_box, encoder_label)

decoder_box = Rectangle(width=3, height=2, color=BLUE, fill_opacity=0.15)
decoder_label = Text("Decoder", font_size=24).move_to(decoder_box)
decoder_group = VGroup(decoder_box, decoder_label)

overview = VGroup(encoder_group, decoder_group).arrange(RIGHT, buff=2)
conn_arrow = Arrow(encoder_box.get_right(), decoder_box.get_left(), buff=0.1)
full_diagram = VGroup(overview, conn_arrow)
full_diagram.scale_to_fit_width(11)
full_diagram.move_to(ORIGIN)

# Show overview first
with self.voiceover(text="""Here is the full architecture.""") as tracker:
    self.play(Create(full_diagram), run_time=2)

# ZOOM INTO encoder - MUST fade label first to prevent overlap
with self.voiceover(text="""Let us zoom into the encoder.""") as tracker:
    self.play(FadeOut(encoder_label))  # CRITICAL: remove label before zoom
    self.play(
        self.camera.frame.animate.scale(0.5).move_to(encoder_box),
        run_time=2
    )

    # Now show internal details inside the encoder box
    internal_layer1 = Rectangle(width=2.5, height=0.4, color=ORANGE, fill_opacity=0.3)
    internal_label1 = Text("Self-Attention", font_size=16).move_to(internal_layer1)
    layer1 = VGroup(internal_layer1, internal_label1)

    internal_layer2 = Rectangle(width=2.5, height=0.4, color=GREEN, fill_opacity=0.3)
    internal_label2 = Text("Feed Forward", font_size=16).move_to(internal_layer2)
    layer2 = VGroup(internal_layer2, internal_label2)

    internals = VGroup(layer1, layer2).arrange(DOWN, buff=0.3)
    internals.move_to(encoder_box)

    self.play(FadeIn(internals), run_time=1.5)

# Zoom back out
with self.voiceover(text="""Now let us see the full picture again.""") as tracker:
    self.play(FadeOut(internals), FadeIn(encoder_label))
    self.play(self.camera.frame.animate.scale(2).move_to(ORIGIN), run_time=2)
```

## Pattern: Decision Tree / Branching

```python
# Root node
root_box = RoundedRectangle(width=3, height=1, corner_radius=0.2, color=BLUE, fill_opacity=0.2)
root_label = Text("Is x > 0?", font_size=24).move_to(root_box)
root = VGroup(root_box, root_label)

# Yes branch
yes_box = RoundedRectangle(width=2.5, height=0.8, corner_radius=0.2, color=GREEN, fill_opacity=0.2)
yes_label = Text("Positive", font_size=22).move_to(yes_box)
yes_node = VGroup(yes_box, yes_label)

# No branch
no_box = RoundedRectangle(width=2.5, height=0.8, corner_radius=0.2, color=RED, fill_opacity=0.2)
no_label = Text("Negative", font_size=22).move_to(no_box)
no_node = VGroup(no_box, no_label)

# Position manually using next_to
yes_node.next_to(root, DL, buff=1.0)
no_node.next_to(root, DR, buff=1.0)

# Branch arrows with labels
arrow_yes = Arrow(root_box.get_bottom(), yes_box.get_top(), buff=0.1, color=GREEN)
arrow_no = Arrow(root_box.get_bottom(), no_box.get_top(), buff=0.1, color=RED)
label_yes = Text("Yes", font_size=18, color=GREEN).next_to(arrow_yes, LEFT, buff=0.1)
label_no = Text("No", font_size=18, color=RED).next_to(arrow_no, RIGHT, buff=0.1)

tree = VGroup(root, yes_node, no_node, arrow_yes, arrow_no, label_yes, label_no)
tree.scale_to_fit_width(11)
tree.move_to(ORIGIN)
```

## Common Pitfalls

- **ALWAYS** create arrows AFTER positioning boxes (use `.get_right()`, `.get_left()`, etc.)
- **NEVER** reference a VGroup during its own creation (creates `UnboundLocalError`)
- **ALWAYS** fade out labels before zooming in to show internal details
- When zooming, use `self.camera.frame.animate.scale(0.5)` — requires `MovingCameraScene`
- Group the entire diagram and use `scale_to_fit_width(12)` to prevent overflow