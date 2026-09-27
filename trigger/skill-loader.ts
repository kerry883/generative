import { logger } from "@trigger.dev/sdk";

// ═══════════════════════════════════════════════════
// Skills are inlined as string constants so they're
// always bundled by Trigger.dev's esbuild pipeline.
// To edit a skill, modify the string below.
//
// Skills use String.raw: a single backslash here is a single backslash in the
// prompt. Code fences are ~~~ because backticks can't appear in String.raw.
// Every example follows the coder rules: timings inside a voiceover block are
// fractions of tracker.duration, and LaTeX is a raw string (r"\frac{a}{b}").
// ═══════════════════════════════════════════════════

export interface SkillManifestEntry {
  name: string;
  description: string;
}

export interface Skill {
  name: string;
  content: string;
}

// ─── SKILL DEFINITIONS ──────────────────────────────

const SKILLS: Record<string, { description: string; content: string }> = {
  text_layouts: {
    description: "Text fitting, overflow prevention, bullet lists, multi-line text, safe area rules. Needed for EVERY video.",
    content: String.raw`# Skill: Text Layout & Fitting

## Rule 1: Long Text MUST Be Scaled
Manim Text() does NOT auto-wrap. Any text longer than 5 words will overflow the screen.

~~~python
# BAD - runs off screen
title = Text("The Fundamental Theorem of Calculus and Its Applications", font_size=48)

# GOOD - fits the screen width
title = Text("The Fundamental Theorem of Calculus and Its Applications")
title.scale_to_fit_width(12)  # screen is 14.2 units wide, 12 leaves a margin
title.to_edge(UP, buff=0.5)
~~~

## Rule 2: Bullet Lists, Revealed One Beat at a Time
~~~python
bullet_items = [
    "Define the function and its domain",
    "Compute the derivative",
    "Evaluate at the critical points",
]

bullets = VGroup()
for text in bullet_items:
    dot = Dot(radius=0.05, color=WHITE)
    label = Text(text, font_size=28)
    label.scale_to_fit_width(min(label.width, 10))  # only scale down
    bullets.add(VGroup(dot, label).arrange(RIGHT, buff=0.3))

bullets.arrange(DOWN, buff=0.4, aligned_edge=LEFT)
bullets.scale_to_fit_width(min(bullets.width, 11))
bullets.move_to(ORIGIN)

# One sentence per bullet keeps each item on screen exactly when it is spoken.
with self.voiceover(text="""First, we define the function and its domain.""") as tracker:
    self.play(FadeIn(bullets[0], shift=RIGHT * 0.3), run_time=tracker.duration)

with self.voiceover(text="""Next, we compute the derivative.""") as tracker:
    self.play(FadeIn(bullets[1], shift=RIGHT * 0.3), run_time=tracker.duration)

with self.voiceover(text="""Finally, we evaluate it at the critical points.""") as tracker:
    self.play(FadeIn(bullets[2], shift=RIGHT * 0.3), run_time=tracker.duration * 0.6)
    self.play(Indicate(bullets[2]), run_time=tracker.duration * 0.4)
~~~

If a single sentence introduces the whole list, split its share across the items:
~~~python
with self.voiceover(text="""There are three steps to follow.""") as tracker:
    for bullet in bullets:
        self.play(FadeIn(bullet, shift=RIGHT * 0.3), run_time=tracker.duration / len(bullets))
~~~

## Rule 3: Text Inside Shapes
~~~python
box = RoundedRectangle(width=4, height=2, corner_radius=0.3, color=BLUE, fill_opacity=0.15)
title = Text("Multi-Head Attention")
title.scale_to_fit_width(box.width * 0.85)  # 85% of the box width = padding
title.move_to(box)
labeled_box = VGroup(box, title)
~~~

## Rule 4: Multi-Line Text (VGroup, never "\n")
~~~python
line1 = Text("Line One", font_size=28)
line2 = Text("Line Two", font_size=28)
multi_line = VGroup(line1, line2).arrange(DOWN, buff=0.2, aligned_edge=LEFT)

# Also fine
para = Paragraph("First line of the paragraph", "Second line continues here", font_size=28, alignment="center")
para.scale_to_fit_width(10)
~~~

## Rule 5: Title + Subtitle
~~~python
title = Text("Chapter 3: Derivatives", font_size=48, color=BLUE)
title.scale_to_fit_width(min(title.width, 11))
title.to_edge(UP, buff=0.8)

subtitle = Text("Understanding rates of change", font_size=30, color=GRAY)
subtitle.scale_to_fit_width(min(subtitle.width, 9))
subtitle.next_to(title, DOWN, buff=0.5)

with self.voiceover(text="""Chapter three. Derivatives, or how things change.""") as tracker:
    self.play(Write(title), run_time=tracker.duration * 0.55)
    self.play(FadeIn(subtitle, shift=UP * 0.3), run_time=tracker.duration * 0.45)

self.play(FadeOut(title), FadeOut(subtitle), run_time=0.8)
~~~

## Rule 6: Safe Area
Screen: 14.2 wide x 8 tall. SAFE AREA: x in [-6, 6], y in [-3.5, 3.5]
  .to_edge(UP, buff=0.5)    -> y ~ 3.5
  .to_edge(DOWN, buff=0.5)  -> y ~ -3.5
  .to_edge(LEFT, buff=0.5)  -> x ~ -6.6
  .to_edge(RIGHT, buff=0.5) -> x ~ 6.6
  .to_corner(UL, buff=0.5)  -> upper-left
  .move_to(ORIGIN)          -> center

## Rule 7: Side-by-Side Layout
~~~python
explanation = VGroup(
    Text("Key Concepts:", font_size=32, color=YELLOW),
    Text("1. Continuity", font_size=26),
    Text("2. Differentiability", font_size=26),
    Text("3. Integrability", font_size=26),
).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
explanation.scale_to_fit_width(5)

formula = MathTex(r"\int_a^b f(x) \, dx = F(b) - F(a)", font_size=40)

layout = VGroup(explanation, formula).arrange(RIGHT, buff=1.5)
layout.scale_to_fit_width(12)
layout.move_to(ORIGIN)
~~~

## Width Reference
| Content | scale_to_fit_width() |
|---|---|
| Full-width title | 12 |
| Body text | 11 |
| Side panel | 5 |
| Text inside a box | box.width * 0.85 |
| Bullet list group | 10 |
| Diagram label | 3-4 |

## Pitfalls
- Never use font_size above 56
- Never .shift(RIGHT * 5) or more; use .to_edge() instead
- Use aligned_edge=LEFT when stacking text vertically
- At most 5 bullet points on screen at once
- Use min(obj.width, X) to scale down only, never up`,
  },

  graphs: {
    description: "Function plotting, coordinate systems, areas under curves, tangent lines, multiple function comparisons.",
    content: String.raw`# Skill: Mathematical Graphs & Plotting

## Basic Function Plot
~~~python
axes = Axes(
    x_range=[-1, 7, 1], y_range=[-1, 10, 1],
    x_length=10, y_length=6,
    axis_config={"include_numbers": True, "font_size": 24},
)
axes_labels = axes.get_axis_labels(x_label="x", y_label="f(x)")
curve = axes.plot(lambda x: 0.5 * x ** 2, x_range=[0, 6], color=YELLOW)
curve_label = axes.get_graph_label(curve, label=r"f(x) = \frac{1}{2}x^2", x_val=5, direction=UP)

graph_group = VGroup(axes, axes_labels, curve, curve_label)
graph_group.scale_to_fit_width(12)
graph_group.move_to(ORIGIN)

with self.voiceover(text="""Here are our axes.""") as tracker:
    self.play(Create(axes), Write(axes_labels), run_time=tracker.duration)

with self.voiceover(text="""And this is the graph of f of x equals one half x squared.""") as tracker:
    self.play(Create(curve), run_time=tracker.duration * 0.7)
    self.play(Write(curve_label), run_time=tracker.duration * 0.3)
~~~

## Area Under a Curve
~~~python
axes = Axes(x_range=[-1, 6, 1], y_range=[-1, 8, 1], x_length=10, y_length=6,
            axis_config={"include_numbers": True, "font_size": 24})
curve = axes.plot(lambda x: 0.3 * x ** 2, x_range=[0, 5], color=BLUE)
area = axes.get_area(curve, x_range=[1, 4], color=YELLOW, opacity=0.4)

line_left = axes.get_vertical_line(axes.c2p(1, 0.3), color=WHITE)
line_right = axes.get_vertical_line(axes.c2p(4, 4.8), color=WHITE)
label_a = MathTex(r"a=1", font_size=28).next_to(axes.c2p(1, 0), DOWN)
label_b = MathTex(r"b=4", font_size=28).next_to(axes.c2p(4, 0), DOWN)

graph_group = VGroup(axes, curve, area, line_left, line_right, label_a, label_b)
graph_group.scale_to_fit_width(12)
graph_group.move_to(ORIGIN)

with self.voiceover(text="""Take the curve y equals zero point three x squared.""") as tracker:
    self.play(Create(axes), run_time=tracker.duration * 0.4)
    self.play(Create(curve), run_time=tracker.duration * 0.6)

with self.voiceover(text="""The shaded region is the integral from one to four.""") as tracker:
    self.play(Create(line_left), Create(line_right), Write(label_a), Write(label_b), run_time=tracker.duration * 0.4)
    self.play(FadeIn(area), run_time=tracker.duration * 0.6)
~~~

## Tangent Line at a Point
~~~python
axes = Axes(x_range=[-1, 6, 1], y_range=[-1, 10, 1], x_length=10, y_length=6)
curve = axes.plot(lambda x: 0.4 * x ** 2, x_range=[0, 5], color=GREEN)

x_val = 3
y_val = 0.4 * x_val ** 2
slope = 0.8 * x_val  # derivative at x = 3

dot = Dot(axes.c2p(x_val, y_val), color=RED, radius=0.08)
tangent = axes.plot(lambda x: slope * (x - x_val) + y_val, x_range=[1, 5], color=RED)
tangent_label = MathTex(r"\text{slope} = 2.4", font_size=28, color=RED)
tangent_label.next_to(dot, UR, buff=0.3)

group = VGroup(axes, curve, dot, tangent, tangent_label)
group.scale_to_fit_width(12)
group.move_to(ORIGIN)

with self.voiceover(text="""At x equals three, the tangent line touches the curve at one point.""") as tracker:
    self.play(FadeIn(dot), run_time=tracker.duration * 0.3)
    self.play(Create(tangent), run_time=tracker.duration * 0.7)

with self.voiceover(text="""Its slope, two point four, is the derivative at that point.""") as tracker:
    self.play(Write(tangent_label), run_time=tracker.duration * 0.6)
    self.play(Indicate(tangent_label), run_time=tracker.duration * 0.4)
~~~

## Moving Tangent (ValueTracker)
~~~python
x_tracker = ValueTracker(1)
moving_dot = always_redraw(lambda: Dot(axes.c2p(x_tracker.get_value(), 0.4 * x_tracker.get_value() ** 2), color=RED))
moving_tangent = always_redraw(lambda: axes.plot(
    lambda x: 0.8 * x_tracker.get_value() * (x - x_tracker.get_value()) + 0.4 * x_tracker.get_value() ** 2,
    x_range=[x_tracker.get_value() - 1.5, x_tracker.get_value() + 1.5], color=RED))

with self.voiceover(text="""As the point moves right, the tangent gets steeper.""") as tracker:
    self.add(moving_dot, moving_tangent)
    self.play(x_tracker.animate.set_value(4.5), run_time=tracker.duration, rate_func=linear)
~~~

## Multiple Functions Comparison
~~~python
axes = Axes(x_range=[-4, 4, 1], y_range=[-2, 8, 1], x_length=10, y_length=6,
            axis_config={"include_numbers": True, "font_size": 24})
f1 = axes.plot(lambda x: x ** 2, x_range=[-2.8, 2.8], color=BLUE)
f2 = axes.plot(lambda x: 2 ** x, x_range=[-3, 3], color=RED)
label1 = axes.get_graph_label(f1, label=r"x^2", x_val=2.5, direction=LEFT)
label2 = axes.get_graph_label(f2, label=r"2^x", x_val=2.5, direction=RIGHT)

legend = VGroup(
    VGroup(Line(ORIGIN, RIGHT * 0.5, color=BLUE), Text("Polynomial", font_size=20)).arrange(RIGHT, buff=0.2),
    VGroup(Line(ORIGIN, RIGHT * 0.5, color=RED), Text("Exponential", font_size=20)).arrange(RIGHT, buff=0.2),
).arrange(DOWN, aligned_edge=LEFT, buff=0.15)
legend.to_corner(UR, buff=0.5)

group = VGroup(axes, f1, f2, label1, label2, legend)
group.scale_to_fit_width(12)
group.move_to(ORIGIN)
~~~

## Pitfalls
- axes.get_bar() and axes.plot_bar_graph() do not exist. Use BarChart.
- Group axes, curves and labels in a VGroup and scale_to_fit_width(12)
- Place labels with Dot + MathTex and .next_to(), not hard-coded coordinates
- axes.c2p(x, y) converts graph coordinates to a screen point
- Keep y values of plotted functions inside y_range, or the curve leaves the axes`,
  },

  math_formulas: {
    description: "Equations, step-by-step algebraic solving, TransformMatchingTex, color highlighting, integrals, derivatives.",
    content: String.raw`# Skill: Mathematical Formulas & Equation Solving

LaTeX strings are always raw strings with single backslashes: MathTex(r"\frac{a}{b}").

## Display and Explain a Formula
~~~python
formula = MathTex(r"E", r"=", r"m", r"c^2", font_size=60)
formula.move_to(ORIGIN)

with self.voiceover(text="""Einstein's famous equation: E equals m c squared.""") as tracker:
    self.play(Write(formula), run_time=tracker.duration)

with self.voiceover(text="""E is energy, m is mass, and c is the speed of light.""") as tracker:
    self.play(formula[0].animate.set_color(YELLOW), run_time=tracker.duration * 0.3)
    self.play(formula[2].animate.set_color(BLUE), run_time=tracker.duration * 0.3)
    self.play(formula[3].animate.set_color(RED), run_time=tracker.duration * 0.4)
~~~
Splitting MathTex into separate strings (as above) is the reliable way to address parts.

## Step-by-Step Equation Solving
~~~python
step1 = MathTex(r"2x + 5 = 15", font_size=48)
step2 = MathTex(r"2x = 15 - 5", font_size=48)
step3 = MathTex(r"2x = 10", font_size=48)
step4 = MathTex(r"x = 5", font_size=48)
for step in (step1, step2, step3, step4):
    step.move_to(ORIGIN)

with self.voiceover(text="""Let's solve two x plus five equals fifteen.""") as tracker:
    self.play(Write(step1), run_time=tracker.duration)

with self.voiceover(text="""Subtract five from both sides.""") as tracker:
    self.play(TransformMatchingTex(step1, step2), run_time=tracker.duration)

with self.voiceover(text="""That simplifies to two x equals ten.""") as tracker:
    self.play(TransformMatchingTex(step2, step3), run_time=tracker.duration)

with self.voiceover(text="""Divide both sides by two, and x equals five.""") as tracker:
    self.play(TransformMatchingTex(step3, step4), run_time=tracker.duration * 0.6)
    self.play(Circumscribe(step4, color=GREEN), run_time=tracker.duration * 0.4)
~~~

## Aligned Equation Steps (Vertical Stack)
~~~python
equations = VGroup(
    MathTex(r"\int_0^3 x^2 \, dx", font_size=40),
    MathTex(r"= \left[ \frac{x^3}{3} \right]_0^3", font_size=40),
    MathTex(r"= \frac{3^3}{3} - \frac{0^3}{3}", font_size=40),
    MathTex(r"= 9", font_size=40),
)
equations.arrange(DOWN, buff=0.4, aligned_edge=LEFT)
equations.scale_to_fit_height(5)
equations.move_to(ORIGIN)

with self.voiceover(text="""We evaluate the integral of x squared from zero to three.""") as tracker:
    self.play(Write(equations[0]), run_time=tracker.duration)

with self.voiceover(text="""The power rule gives x cubed over three.""") as tracker:
    self.play(Write(equations[1]), run_time=tracker.duration)

with self.voiceover(text="""Plugging in the bounds gives twenty seven over three, which is nine.""") as tracker:
    self.play(Write(equations[2]), run_time=tracker.duration * 0.5)
    self.play(Write(equations[3]), run_time=tracker.duration * 0.25)
    self.play(Circumscribe(equations[3], color=YELLOW), run_time=tracker.duration * 0.25)
~~~

## Formula with Annotation Braces
~~~python
formula = MathTex(r"F", r"=", r"m", r"\cdot", r"a", font_size=56)
formula.move_to(UP * 0.5)

brace_f = Brace(formula[0], DOWN, color=YELLOW)
label_f = Text("Force (N)", font_size=22, color=YELLOW).next_to(brace_f, DOWN, buff=0.2)
brace_m = Brace(formula[2], DOWN, color=BLUE)
label_m = Text("Mass (kg)", font_size=22, color=BLUE).next_to(brace_m, DOWN, buff=0.2)
brace_a = Brace(formula[4], DOWN, color=GREEN)
label_a = Text("Acceleration (m/s2)", font_size=22, color=GREEN).next_to(brace_a, DOWN, buff=0.2)

with self.voiceover(text="""Newton's second law: force equals mass times acceleration.""") as tracker:
    self.play(Write(formula), run_time=tracker.duration)

with self.voiceover(text="""F is force, m is mass, and a is acceleration.""") as tracker:
    self.play(GrowFromCenter(brace_f), Write(label_f), run_time=tracker.duration * 0.33)
    self.play(GrowFromCenter(brace_m), Write(label_m), run_time=tracker.duration * 0.33)
    self.play(GrowFromCenter(brace_a), Write(label_a), run_time=tracker.duration * 0.34)
~~~

## Matrix Display
~~~python
matrix = Matrix([["a", "b"], ["c", "d"]], left_bracket="(", right_bracket=")")
label = MathTex(r"A = ", font_size=48).next_to(matrix, LEFT, buff=0.3)
det = MathTex(r"\det(A) = ad - bc", font_size=40).next_to(matrix, DOWN, buff=1)
group = VGroup(label, matrix, det)
group.scale_to_fit_width(10)
group.move_to(ORIGIN)
~~~

## LaTeX Reference (raw strings, single backslash)
- r"\frac{a}{b}", r"\sqrt{x}", r"\int_{a}^{b}", r"\sum_{i=1}^{n}", r"\lim_{x \to 0}"
- r"\cdot", r"\times", r"\pm", r"\infty", r"\theta", r"\pi", r"\Delta"
- r"\text{plain words}" for words inside math
- Never double the backslashes and never drop the r prefix`,
  },

  flowcharts: {
    description: "Architecture diagrams, process flows, box-and-arrow systems, decision trees, zoom-in animations.",
    content: String.raw`# Skill: Flowcharts & System Diagrams

## Simple Flowchart (3 Boxes + Arrows), built up beat by beat
~~~python
def make_box(text, color):
    box = Rectangle(width=3, height=1.5, color=color, fill_opacity=0.2)
    label = Text(text).scale_to_fit_width(box.width * 0.85)
    label.move_to(box)
    return VGroup(box, label)

input_group = make_box("Input Data", BLUE)
process_group = make_box("Process", YELLOW)
output_group = make_box("Output", GREEN)

flow = VGroup(input_group, process_group, output_group).arrange(RIGHT, buff=1.5)
arrow1 = Arrow(input_group.get_right(), process_group.get_left(), buff=0.1, color=WHITE)
arrow2 = Arrow(process_group.get_right(), output_group.get_left(), buff=0.1, color=WHITE)

diagram = VGroup(flow, arrow1, arrow2)
diagram.scale_to_fit_width(12)
diagram.move_to(ORIGIN)

with self.voiceover(text="""Data enters the system on the left.""") as tracker:
    self.play(Create(input_group), run_time=tracker.duration)

with self.voiceover(text="""It flows into the processing stage.""") as tracker:
    self.play(GrowArrow(arrow1), run_time=tracker.duration * 0.4)
    self.play(Create(process_group), run_time=tracker.duration * 0.6)

with self.voiceover(text="""And the result comes out on the right.""") as tracker:
    self.play(GrowArrow(arrow2), run_time=tracker.duration * 0.4)
    self.play(Create(output_group), run_time=tracker.duration * 0.6)
~~~
(make_box only builds mobjects; helpers never call self.play.)

## Zoom Into a Component
~~~python
encoder_box = Rectangle(width=3, height=2, color=YELLOW, fill_opacity=0.15)
encoder_label = Text("Encoder", font_size=24).move_to(encoder_box)

with self.voiceover(text="""Let's zoom into the encoder.""") as tracker:
    self.play(FadeOut(encoder_label), run_time=tracker.duration * 0.3)  # remove the label before zooming
    self.play(self.camera.frame.animate.scale(0.5).move_to(encoder_box), run_time=tracker.duration * 0.7)

# ... beats that show the internal details ...

with self.voiceover(text="""Now back to the full picture.""") as tracker:
    self.play(self.camera.frame.animate.scale(2).move_to(ORIGIN), run_time=tracker.duration * 0.7)
    self.play(FadeIn(encoder_label), run_time=tracker.duration * 0.3)
~~~

## Decision Tree
~~~python
root_box = RoundedRectangle(width=3, height=1, corner_radius=0.2, color=BLUE, fill_opacity=0.2)
root_label = Text("Is x > 0?", font_size=24).move_to(root_box)
root = VGroup(root_box, root_label)

yes_box = RoundedRectangle(width=2.5, height=0.8, corner_radius=0.2, color=GREEN, fill_opacity=0.2)
yes_node = VGroup(yes_box, Text("Positive", font_size=22).move_to(yes_box))
no_box = RoundedRectangle(width=2.5, height=0.8, corner_radius=0.2, color=RED, fill_opacity=0.2)
no_node = VGroup(no_box, Text("Negative", font_size=22).move_to(no_box))

yes_node.next_to(root, DL, buff=1.0)
no_node.next_to(root, DR, buff=1.0)
arrow_yes = Arrow(root_box.get_bottom(), yes_box.get_top(), buff=0.1, color=GREEN)
arrow_no = Arrow(root_box.get_bottom(), no_box.get_top(), buff=0.1, color=RED)

tree = VGroup(root, yes_node, no_node, arrow_yes, arrow_no)
tree.scale_to_fit_width(11)
tree.move_to(ORIGIN)
~~~

## Pitfalls
- Create arrows AFTER positioning the boxes
- Never reference a VGroup inside its own constructor
- Fade out labels before zooming in to show internal details
- Group the entire diagram and scale_to_fit_width(12)`,
  },

  physics: {
    description: "Force diagrams, projectile motion, wave animations, electromagnetic fields, particle simulations.",
    content: String.raw`# Skill: Physics Animations

## Force Diagram (Free Body Diagram)
~~~python
obj = Square(side_length=1.2, color=BLUE, fill_opacity=0.3)
obj_label = Text("m", font_size=28, color=BLUE).move_to(obj)

f_gravity = Arrow(obj.get_center(), obj.get_center() + DOWN * 2, buff=0, color=RED, stroke_width=5)
f_normal = Arrow(obj.get_center(), obj.get_center() + UP * 2, buff=0, color=GREEN, stroke_width=5)
f_friction = Arrow(obj.get_center(), obj.get_center() + LEFT * 1.5, buff=0, color=ORANGE, stroke_width=5)
f_applied = Arrow(obj.get_center(), obj.get_center() + RIGHT * 2.5, buff=0, color=YELLOW, stroke_width=5)

label_g = MathTex(r"F_g = mg", font_size=28, color=RED).next_to(f_gravity, RIGHT, buff=0.2)
label_n = MathTex(r"F_N", font_size=28, color=GREEN).next_to(f_normal, RIGHT, buff=0.2)
label_f = MathTex(r"f", font_size=28, color=ORANGE).next_to(f_friction, UP, buff=0.2)
label_a = MathTex(r"F_{app}", font_size=28, color=YELLOW).next_to(f_applied, UP, buff=0.2)

fbd = VGroup(obj, obj_label, f_gravity, f_normal, f_friction, f_applied, label_g, label_n, label_f, label_a)
fbd.scale_to_fit_width(10)
fbd.move_to(ORIGIN)

with self.voiceover(text="""Here is a block of mass m resting on a surface.""") as tracker:
    self.play(Create(obj), Write(obj_label), run_time=tracker.duration)

with self.voiceover(text="""Gravity pulls it down, and the surface pushes back up.""") as tracker:
    self.play(GrowArrow(f_gravity), Write(label_g), run_time=tracker.duration * 0.5)
    self.play(GrowArrow(f_normal), Write(label_n), run_time=tracker.duration * 0.5)

with self.voiceover(text="""We push it to the right, and friction resists to the left.""") as tracker:
    self.play(GrowArrow(f_applied), Write(label_a), run_time=tracker.duration * 0.5)
    self.play(GrowArrow(f_friction), Write(label_f), run_time=tracker.duration * 0.5)
~~~

## Projectile Motion
~~~python
axes = Axes(x_range=[0, 12, 2], y_range=[0, 8, 2], x_length=10, y_length=5,
            axis_config={"include_numbers": True, "font_size": 20})
x_label = Text("Distance (m)", font_size=22).next_to(axes.x_axis, DOWN, buff=0.3)
y_label = Text("Height (m)", font_size=22).next_to(axes.y_axis, LEFT, buff=0.3).rotate(90 * DEGREES)
trajectory = axes.plot(lambda x: -0.1 * (x - 5) ** 2 + 6, x_range=[0, 10], color=YELLOW)
ball = Dot(color=RED, radius=0.12).move_to(axes.c2p(0, 3.5))

graph_group = VGroup(axes, x_label, y_label, trajectory, ball)
graph_group.scale_to_fit_width(12)
graph_group.move_to(ORIGIN)

with self.voiceover(text="""We launch a ball from the left side.""") as tracker:
    self.play(Create(axes), Write(x_label), Write(y_label), run_time=tracker.duration * 0.6)
    self.play(FadeIn(ball), run_time=tracker.duration * 0.4)

with self.voiceover(text="""Gravity bends its path into a parabola.""") as tracker:
    self.play(MoveAlongPath(ball, trajectory), Create(trajectory), run_time=tracker.duration, rate_func=linear)
~~~

## Simple Wave
~~~python
axes = Axes(x_range=[0, 4 * PI, PI], y_range=[-2, 2, 1], x_length=11, y_length=4)
wave = axes.plot(lambda x: 1.5 * np.sin(x), x_range=[0, 4 * PI], color=BLUE)

wavelength_brace = Brace(VGroup(Dot(axes.c2p(0, 0)), Dot(axes.c2p(2 * PI, 0))), DOWN, color=YELLOW)
wl_label = Text("Wavelength", font_size=22, color=YELLOW).next_to(wavelength_brace, DOWN, buff=0.2)
amplitude_line = DashedLine(axes.c2p(PI / 2, 0), axes.c2p(PI / 2, 1.5), color=RED)
amp_label = Text("Amplitude", font_size=22, color=RED).next_to(amplitude_line, RIGHT, buff=0.2)

group = VGroup(axes, wave, wavelength_brace, wl_label, amplitude_line, amp_label)
group.scale_to_fit_width(12)
group.move_to(ORIGIN)
~~~

## Bar Magnet (no gradients)
~~~python
north_pole = Rectangle(width=1.5, height=0.8, fill_opacity=0.9).set_fill(RED)
south_pole = Rectangle(width=1.5, height=0.8, fill_opacity=0.9).set_fill(BLUE)
south_pole.next_to(north_pole, RIGHT, buff=0)
n_label = Text("N", font_size=28, color=WHITE).move_to(north_pole)
s_label = Text("S", font_size=28, color=WHITE).move_to(south_pole)
magnet = VGroup(north_pole, south_pole, n_label, s_label)
~~~

## Pitfalls
- Never .set_fill(color=[RED, BLUE]) for gradients; use separate solid shapes
- Force arrows: buff=0 so they start at the object's center
- MoveAlongPath needs a Manim mobject path (axes.plot returns one)
- numpy is available as np through "from manim import *"`,
  },

  data_viz: {
    description: "Bar charts, pie charts, data tables, animated counters, statistical comparisons.",
    content: String.raw`# Skill: Data Visualization

## Bar Chart
~~~python
chart = BarChart(
    values=[3, 5, 2, 8, 4],
    bar_names=["A", "B", "C", "D", "E"],
    y_range=[0, 10, 2],
    y_length=5, x_length=10,
    bar_colors=[BLUE, GREEN, YELLOW, RED, PURPLE],
)
bar_labels = chart.get_bar_labels(font_size=24)
group = VGroup(chart, bar_labels)
group.scale_to_fit_width(11)
group.move_to(ORIGIN)

with self.voiceover(text="""Here is the distribution across five categories.""") as tracker:
    self.play(Create(chart), run_time=tracker.duration * 0.7)
    self.play(Write(bar_labels), run_time=tracker.duration * 0.3)
~~~

## Animated Bar Chart (Values Change)
~~~python
chart = BarChart(values=[2, 4, 6, 3, 7], bar_names=["Q1", "Q2", "Q3", "Q4", "Q5"],
                 y_range=[0, 10, 2], bar_colors=[BLUE_D, BLUE_C, BLUE_B, BLUE_A, BLUE])
chart.scale_to_fit_width(11)
chart.move_to(ORIGIN)

with self.voiceover(text="""This is revenue for each quarter last year.""") as tracker:
    self.play(Create(chart), run_time=tracker.duration)

with self.voiceover(text="""This year, revenue grew in almost every quarter.""") as tracker:
    self.play(chart.animate.change_bar_values([5, 8, 4, 9, 6]), run_time=tracker.duration)
~~~

## Pie Chart (built from Sectors)
~~~python
data = [("Python", 35, BLUE), ("JavaScript", 25, YELLOW), ("Java", 20, RED), ("Other", 20, GRAY)]
sectors = VGroup()
labels = VGroup()
start_angle = 0
for name, percentage, color in data:
    angle = percentage / 100 * TAU
    sectors.add(Sector(outer_radius=2, start_angle=start_angle, angle=angle,
                       color=color, fill_opacity=0.8, stroke_width=2, stroke_color=WHITE))
    mid_angle = start_angle + angle / 2
    label_pos = 2.6 * np.array([np.cos(mid_angle), np.sin(mid_angle), 0])
    labels.add(Text(name + " (" + str(percentage) + "%)", font_size=20, color=color).move_to(label_pos))
    start_angle += angle

pie = VGroup(sectors, labels)
pie.scale_to_fit_width(10)
pie.move_to(ORIGIN)

with self.voiceover(text="""Here is how the market is shared between languages.""") as tracker:
    for i in range(len(sectors)):
        self.play(Create(sectors[i]), Write(labels[i]), run_time=tracker.duration / len(sectors))
~~~

## Data Table
~~~python
table = Table(
    [["2020", "100", "85%"],
     ["2021", "250", "90%"],
     ["2022", "500", "92%"],
     ["2023", "800", "95%"]],
    col_labels=[Text("Year"), Text("Users"), Text("Satisfaction")],
    include_outer_lines=True,
    line_config={"stroke_width": 1, "color": GRAY},
).scale(0.7)
for label in table.get_col_labels():
    label.set_color(YELLOW)
table.scale_to_fit_width(10)
table.move_to(ORIGIN)

with self.voiceover(text="""Let's look at the numbers over four years.""") as tracker:
    self.play(Create(table), run_time=tracker.duration)

with self.voiceover(text="""Notice the big jump in twenty twenty two.""") as tracker:
    row_highlight = SurroundingRectangle(table.get_rows()[3], color=GREEN, buff=0.1)
    self.play(Create(row_highlight), run_time=tracker.duration)
~~~

## Animated Number Counter
~~~python
counter = DecimalNumber(0, num_decimal_places=0, font_size=72, color=YELLOW)
counter.move_to(ORIGIN)
label = Text("Total Users", font_size=32).next_to(counter, UP, buff=0.5)

with self.voiceover(text="""Our user base has grown to one million.""") as tracker:
    self.play(Write(label), run_time=tracker.duration * 0.2)
    self.play(ChangeDecimalToValue(counter, 1000000), run_time=tracker.duration * 0.8)
~~~

## Pitfalls
- axes.get_bar() and axes.plot_bar_graph() do not exist; use BarChart
- There is no PieChart; build it from Sector
- Scale tables down (.scale(0.7)) before positioning; they are large by default
- Animate numbers with ChangeDecimalToValue
- chart.animate.change_bar_values() animates bar heights`,
  },
};

// ─── PUBLIC API ──────────────────────────────────────

/**
 * Get a lightweight manifest of all available skills.
 * This is what the Skill Selector LLM sees to make its choice.
 */
export function getSkillManifest(): SkillManifestEntry[] {
  return Object.entries(SKILLS).map(([name, skill]) => ({
    name,
    description: skill.description,
  }));
}

/**
 * Load the full content of specific skills by name.
 * @param skillNames - Array of skill names (e.g. ["text_layouts", "graphs"])
 * @returns Combined skill content as a single string
 */
export function loadSkills(skillNames: string[]): string {
  const loaded: string[] = [];

  for (const name of skillNames) {
    const skill = SKILLS[name];
    if (skill) {
      loaded.push(skill.content);
      logger.info(`Loaded skill: ${name}`, { size: skill.content.length });
    } else {
      logger.warn(`Skill not found: ${name}`);
    }
  }

  if (loaded.length === 0) {
    return "";
  }

  return (
    "\n\n═══════════════════════════════════════\n" +
    "MANIM CODING SKILLS (Follow these patterns exactly)\n" +
    "═══════════════════════════════════════\n\n" +
    loaded.join("\n\n---\n\n") +
    "\n\n═══════════════════════════════════════\n" +
    "END OF SKILLS — Use the patterns above in your code.\n" +
    "═══════════════════════════════════════\n"
  );
}

/**
 * Format the skill manifest for the selector LLM prompt.
 */
export function formatManifestForSelector(manifest: SkillManifestEntry[]): string {
  return manifest.map((s) => `- **${s.name}**: ${s.description}`).join("\n");
}
