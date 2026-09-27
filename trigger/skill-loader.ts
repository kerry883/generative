import { logger } from "@trigger.dev/sdk/v3";

// ═══════════════════════════════════════════════════
// Skills are inlined as string constants so they're
// always bundled by Trigger.dev's esbuild pipeline.
// To edit a skill, modify the string below.
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
    content: `# Skill: Text Layout & Fitting

## Rule 1: Long Text MUST Be Scaled
Manim Text() does NOT auto-wrap. Any text > 5 words WILL overflow the screen.

\`\`\`python
# ❌ BAD - Text runs off screen
title = Text("The Fundamental Theorem of Calculus and Its Applications", font_size=48)

# ✅ GOOD - Auto-fits to screen width
title = Text("The Fundamental Theorem of Calculus and Its Applications")
title.scale_to_fit_width(12)  # Screen is 14.2 units wide, 12 gives margin
title.to_edge(UP, buff=0.5)
\`\`\`

## Rule 2: Bullet Lists with Proper Alignment
\`\`\`python
bullet_items = [
    "First, define the function and its domain",
    "Second, compute the derivative using the power rule",
    "Third, evaluate at the critical points",
    "Finally, determine the maximum value",
]

bullets = VGroup()
for text in bullet_items:
    dot = Dot(radius=0.05, color=WHITE)
    label = Text(text, font_size=28)
    label.scale_to_fit_width(min(label.width, 10))  # Only scale if too wide
    item = VGroup(dot, label).arrange(RIGHT, buff=0.3)
    bullets.add(item)

bullets.arrange(DOWN, buff=0.4, aligned_edge=LEFT)
bullets.scale_to_fit_width(min(bullets.width, 11))  # Safety scale for entire group
bullets.move_to(ORIGIN)

# Reveal one at a time
with self.voiceover(text="""Let us go through each step.""") as tracker:
    for bullet in bullets:
        self.play(FadeIn(bullet, shift=RIGHT * 0.3), run_time=0.8)
        self.wait(0.5)
\`\`\`

## Rule 3: Text Inside Shapes
\`\`\`python
box = RoundedRectangle(width=4, height=2, corner_radius=0.3, color=BLUE, fill_opacity=0.15)
title = Text("Multi-Head Attention")
title.scale_to_fit_width(box.width * 0.85)  # 85% of box width = padding
title.move_to(box)
labeled_box = VGroup(box, title)
\`\`\`

## Rule 4: Multi-Line Text (VGroup, NOT \\\\n)
\`\`\`python
# ❌ BAD - \\\\n renders as literal characters
label = Text("Line One\\\\nLine Two", font_size=24)

# ✅ GOOD - Use VGroup
line1 = Text("Line One", font_size=28)
line2 = Text("Line Two", font_size=28)
multi_line = VGroup(line1, line2).arrange(DOWN, buff=0.2, aligned_edge=LEFT)

# ✅ ALSO GOOD - Use Paragraph
from manim import Paragraph
para = Paragraph(
    "First line of the paragraph",
    "Second line continues here",
    font_size=28,
    alignment="center"
)
para.scale_to_fit_width(10)
\`\`\`

## Rule 5: Title + Subtitle Pattern
\`\`\`python
title = Text("Chapter 3: Derivatives", font_size=48, color=BLUE)
title.scale_to_fit_width(min(title.width, 11))
title.to_edge(UP, buff=0.8)

subtitle = Text("Understanding rates of change", font_size=30, color=GRAY)
subtitle.scale_to_fit_width(min(subtitle.width, 9))
subtitle.next_to(title, DOWN, buff=0.5)

with self.voiceover(text="""Chapter 3. Derivatives.""") as tracker:
    self.play(Write(title), run_time=1.5)
    self.play(FadeIn(subtitle, shift=UP * 0.3), run_time=1)

self.wait(1)
self.play(FadeOut(title), FadeOut(subtitle))
\`\`\`

## Rule 6: Safe Area Boundaries
Screen: 14.2 wide x 8 tall. SAFE AREA: x in [-6, 6], y in [-3.5, 3.5]

Positioning cheat sheet:
  .to_edge(UP, buff=0.5)    -> y ~ 3.5
  .to_edge(DOWN, buff=0.5)  -> y ~ -3.5
  .to_edge(LEFT, buff=0.5)  -> x ~ -6.6
  .to_edge(RIGHT, buff=0.5) -> x ~ 6.6
  .to_corner(UL, buff=0.5)  -> upper-left
  .move_to(ORIGIN)          -> center (0, 0)

## Rule 7: Side-by-Side Layout
\`\`\`python
explanation = VGroup(
    Text("Key Concepts:", font_size=32, color=YELLOW),
    Text("1. Continuity", font_size=26),
    Text("2. Differentiability", font_size=26),
    Text("3. Integrability", font_size=26),
).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
explanation.scale_to_fit_width(5)

formula = MathTex("\\\\\\\\int_a^b f(x) \\\\\\\\, dx = F(b) - F(a)", font_size=40)

layout = VGroup(explanation, formula).arrange(RIGHT, buff=1.5)
layout.scale_to_fit_width(12)
layout.move_to(ORIGIN)
\`\`\`

## Width Reference
| Content Type | scale_to_fit_width() |
|---|---|
| Full-width title | 12 |
| Body text | 11 |
| Side panel (left or right) | 5 |
| Text inside box | box.width * 0.85 |
| Bullet list group | 10 |
| Diagram label | 3-4 |

## Pitfalls
- NEVER use font_size > 56 for any text
- NEVER use .shift(RIGHT * 5) or larger — use .to_edge() instead
- ALWAYS use aligned_edge=LEFT when stacking text vertically
- NEVER create more than 6 bullet points on screen at once
- Use min(obj.width, X) to only scale DOWN, never up`,
  },

  graphs: {
    description: "Function plotting, coordinate systems, areas under curves, tangent lines, multiple function comparisons.",
    content: `# Skill: Mathematical Graphs & Plotting

## Basic Function Plot
\`\`\`python
axes = Axes(
    x_range=[-1, 7, 1], y_range=[-1, 10, 1],
    x_length=10, y_length=6,
    axis_config={"include_numbers": True, "font_size": 24},
)
axes_labels = axes.get_axis_labels(x_label="x", y_label="f(x)")
curve = axes.plot(lambda x: 0.5 * x ** 2, x_range=[0, 6], color=YELLOW)
curve_label = axes.get_graph_label(curve, label="f(x) = \\\\\\\\frac{1}{2}x^2", x_val=5, direction=UP)

graph_group = VGroup(axes, axes_labels, curve, curve_label)
graph_group.scale_to_fit_width(12)
graph_group.move_to(ORIGIN)

with self.voiceover(text="""Let us look at the graph of f of x equals one half x squared.""") as tracker:
    self.play(Create(axes), Write(axes_labels), run_time=2)
    self.play(Create(curve), Write(curve_label), run_time=2)
\`\`\`

## Area Under a Curve
\`\`\`python
axes = Axes(x_range=[-1, 6, 1], y_range=[-1, 8, 1], x_length=10, y_length=6,
            axis_config={"include_numbers": True, "font_size": 24})
curve = axes.plot(lambda x: 0.3 * x ** 2, x_range=[0, 5], color=BLUE)
area = axes.get_area(curve, x_range=[1, 4], color=YELLOW, opacity=0.4)

line_left = axes.get_vertical_line(axes.c2p(1, 0.3), color=WHITE)
line_right = axes.get_vertical_line(axes.c2p(4, 4.8), color=WHITE)
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
\`\`\`

## Tangent Line at a Point
\`\`\`python
axes = Axes(x_range=[-1, 6, 1], y_range=[-1, 10, 1], x_length=10, y_length=6)
curve = axes.plot(lambda x: 0.4 * x ** 2, x_range=[0, 5], color=GREEN)

x_val = 3
y_val = 0.4 * x_val ** 2
slope = 0.8 * x_val  # derivative at x=3

dot = Dot(axes.c2p(x_val, y_val), color=RED, radius=0.08)
tangent = axes.plot(lambda x: slope * (x - x_val) + y_val, x_range=[1, 5], color=RED)
tangent_label = MathTex("\\\\\\\\text{slope} = 2.4", font_size=28, color=RED)
tangent_label.next_to(dot, UR, buff=0.3)

group = VGroup(axes, curve, dot, tangent, tangent_label)
group.scale_to_fit_width(12)
group.move_to(ORIGIN)
\`\`\`

## Multiple Functions Comparison
\`\`\`python
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
\`\`\`

## Pitfalls
- NEVER use axes.get_bar() or axes.plot_bar_graph() — these don't exist. Use BarChart class instead.
- ALWAYS group axes + curves + labels into a VGroup and scale_to_fit_width(12)
- For labeled points, use Dot + MathTex with .next_to(), not hardcoded coordinates
- Use axes.c2p(x, y) (coords to point) to position elements on the graph`,
  },

  math_formulas: {
    description: "Equations, step-by-step algebraic solving, TransformMatchingTex, color highlighting, integrals, derivatives.",
    content: `# Skill: Mathematical Formulas & Equation Solving

## Display and Explain a Formula
\`\`\`python
formula = MathTex("E = mc^2", font_size=60)
formula.move_to(ORIGIN)

with self.voiceover(text="""Einstein's famous equation, E equals m c squared.""") as tracker:
    self.play(Write(formula), run_time=2)

# Highlight specific parts
with self.voiceover(text="""E represents energy. M is mass. And c is the speed of light.""") as tracker:
    self.play(formula[0][0].animate.set_color(YELLOW), run_time=0.5)  # E
    self.play(Indicate(formula[0][0]), run_time=1)
    self.play(formula[0][2].animate.set_color(BLUE), run_time=0.5)   # m
    self.play(formula[0][3:5].animate.set_color(RED), run_time=0.5)  # c^2
\`\`\`

## Step-by-Step Equation Solving
\`\`\`python
step1 = MathTex("2x + 5 = 15", font_size=48)
step2 = MathTex("2x = 15 - 5", font_size=48)
step3 = MathTex("2x = 10", font_size=48)
step4 = MathTex("x = 5", font_size=48)
step1.move_to(ORIGIN)

with self.voiceover(text="""Let us solve step by step. We start with 2x plus 5 equals 15.""") as tracker:
    self.play(Write(step1), run_time=2)

with self.voiceover(text="""Subtract 5 from both sides.""") as tracker:
    step2.move_to(step1)
    self.play(TransformMatchingTex(step1, step2), run_time=2)

with self.voiceover(text="""This simplifies to 2x equals 10.""") as tracker:
    step3.move_to(step2)
    self.play(TransformMatchingTex(step2, step3), run_time=1.5)

with self.voiceover(text="""Divide both sides by 2. x equals 5.""") as tracker:
    step4.move_to(step3)
    self.play(TransformMatchingTex(step3, step4), run_time=1.5)
    self.play(Circumscribe(step4, color=GREEN), run_time=1)
\`\`\`

## Aligned Equation Steps (Vertical Stack)
\`\`\`python
equations = VGroup(
    MathTex("\\\\\\\\int_0^3 x^2 \\\\\\\\, dx", font_size=40),
    MathTex("= \\\\\\\\left[ \\\\\\\\frac{x^3}{3} \\\\\\\\right]_0^3", font_size=40),
    MathTex("= \\\\\\\\frac{3^3}{3} - \\\\\\\\frac{0^3}{3}", font_size=40),
    MathTex("= \\\\\\\\frac{27}{3} - 0", font_size=40),
    MathTex("= 9", font_size=40),
)
equations.arrange(DOWN, buff=0.4, aligned_edge=LEFT)
equations.scale_to_fit_height(5)
equations.move_to(ORIGIN)

# Reveal one at a time
with self.voiceover(text="""We evaluate the integral of x squared from 0 to 3.""") as tracker:
    self.play(Write(equations[0]), run_time=1.5)

with self.voiceover(text="""Applying the power rule.""") as tracker:
    self.play(Write(equations[1]), run_time=1.5)

with self.voiceover(text="""Plugging in the bounds.""") as tracker:
    self.play(Write(equations[2]), run_time=1.5)

with self.voiceover(text="""Simplifying gives us 27 over 3, which is 9.""") as tracker:
    self.play(Write(equations[3]), run_time=1)
    self.play(Write(equations[4]), run_time=1)
    self.play(Circumscribe(equations[4], color=YELLOW), run_time=1)
\`\`\`

## Formula with Annotation Braces
\`\`\`python
formula = MathTex("F = m \\\\\\\\cdot a", font_size=56)
formula.move_to(UP * 0.5)

brace_f = Brace(formula[0][0], DOWN, color=YELLOW)
label_f = Text("Force (N)", font_size=22, color=YELLOW)
label_f.next_to(brace_f, DOWN, buff=0.2)

brace_m = Brace(formula[0][2], DOWN, color=BLUE)
label_m = Text("Mass (kg)", font_size=22, color=BLUE)
label_m.next_to(brace_m, DOWN, buff=0.2)

brace_a = Brace(formula[0][4], DOWN, color=GREEN)
label_a = Text("Acceleration (m/s2)", font_size=22, color=GREEN)
label_a.next_to(brace_a, DOWN, buff=0.2)

with self.voiceover(text="""Newton's second law: Force equals mass times acceleration.""") as tracker:
    self.play(Write(formula), run_time=2)
with self.voiceover(text="""F is force, measured in Newtons.""") as tracker:
    self.play(GrowFromCenter(brace_f), Write(label_f), run_time=1.5)
with self.voiceover(text="""m is mass in kilograms.""") as tracker:
    self.play(GrowFromCenter(brace_m), Write(label_m), run_time=1.5)
with self.voiceover(text="""And a is acceleration.""") as tracker:
    self.play(GrowFromCenter(brace_a), Write(label_a), run_time=1.5)
\`\`\`

## Matrix Display
\`\`\`python
matrix = Matrix(
    [["a", "b"], ["c", "d"]],
    left_bracket="(",
    right_bracket=")",
)
matrix.scale(1.2)
matrix.move_to(ORIGIN)

label = MathTex("A = ", font_size=48)
label.next_to(matrix, LEFT, buff=0.3)

det = MathTex("\\\\\\\\det(A) = ad - bc", font_size=40)
det.next_to(matrix, DOWN, buff=1)

group = VGroup(label, matrix, det)
group.scale_to_fit_width(10)
group.move_to(ORIGIN)
\`\`\`

## LaTeX Escaping (CRITICAL)
- ALWAYS use \\\\\\\\ (four backslashes) for LaTeX commands in Python strings
- \\\\\\\\frac{a}{b} -> fraction, \\\\\\\\int_{a}^{b} -> integral, \\\\\\\\sqrt{x} -> square root
- \\\\\\\\cdot -> dot multiplication, \\\\\\\\text{word} -> plain text inside math
- NEVER use raw strings r"..." with MathTex`,
  },

  flowcharts: {
    description: "Architecture diagrams, process flows, box-and-arrow systems, decision trees, zoom-in animations.",
    content: `# Skill: Flowcharts & System Diagrams

## Simple Flowchart (3 Boxes + Arrows)
\`\`\`python
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

flow = VGroup(input_group, process_group, output_group).arrange(RIGHT, buff=1.5)
arrow1 = Arrow(box_input.get_right(), box_process.get_left(), buff=0.1, color=WHITE)
arrow2 = Arrow(box_process.get_right(), box_output.get_left(), buff=0.1, color=WHITE)

diagram = VGroup(flow, arrow1, arrow2)
diagram.scale_to_fit_width(12)
diagram.move_to(ORIGIN)
\`\`\`

## Zoom Into a Component
\`\`\`python
encoder_box = Rectangle(width=3, height=2, color=YELLOW, fill_opacity=0.15)
encoder_label = Text("Encoder", font_size=24).move_to(encoder_box)
encoder_group = VGroup(encoder_box, encoder_label)

# ZOOM IN - MUST fade label first
with self.voiceover(text="""Let us zoom into the encoder.""") as tracker:
    self.play(FadeOut(encoder_label))  # CRITICAL: remove label before zoom
    self.play(self.camera.frame.animate.scale(0.5).move_to(encoder_box), run_time=2)
    # Show internal details...

# ZOOM OUT - restore label
self.play(self.camera.frame.animate.scale(2).move_to(ORIGIN), run_time=2)
\`\`\`

## Decision Tree
\`\`\`python
root_box = RoundedRectangle(width=3, height=1, corner_radius=0.2, color=BLUE, fill_opacity=0.2)
root_label = Text("Is x > 0?", font_size=24).move_to(root_box)
root = VGroup(root_box, root_label)

yes_box = RoundedRectangle(width=2.5, height=0.8, corner_radius=0.2, color=GREEN, fill_opacity=0.2)
yes_label = Text("Positive", font_size=22).move_to(yes_box)
yes_node = VGroup(yes_box, yes_label)

no_box = RoundedRectangle(width=2.5, height=0.8, corner_radius=0.2, color=RED, fill_opacity=0.2)
no_label = Text("Negative", font_size=22).move_to(no_box)
no_node = VGroup(no_box, no_label)

yes_node.next_to(root, DL, buff=1.0)
no_node.next_to(root, DR, buff=1.0)
arrow_yes = Arrow(root_box.get_bottom(), yes_box.get_top(), buff=0.1, color=GREEN)
arrow_no = Arrow(root_box.get_bottom(), no_box.get_top(), buff=0.1, color=RED)

tree = VGroup(root, yes_node, no_node, arrow_yes, arrow_no)
tree.scale_to_fit_width(11)
tree.move_to(ORIGIN)
\`\`\`

## Pitfalls
- ALWAYS create arrows AFTER positioning boxes
- NEVER reference a VGroup during its own creation
- ALWAYS fade out labels before zooming in to show internal details
- Group entire diagram and scale_to_fit_width(12)`,
  },

  physics: {
    description: "Force diagrams, projectile motion, wave animations, electromagnetic fields, particle simulations.",
    content: `# Skill: Physics Animations

## Force Diagram (Free Body Diagram)
\`\`\`python
obj = Square(side_length=1.2, color=BLUE, fill_opacity=0.3)
obj_label = Text("m", font_size=28, color=BLUE).move_to(obj)

f_gravity = Arrow(obj.get_center(), obj.get_center() + DOWN * 2, buff=0, color=RED, stroke_width=5)
f_normal = Arrow(obj.get_center(), obj.get_center() + UP * 2, buff=0, color=GREEN, stroke_width=5)
f_friction = Arrow(obj.get_center(), obj.get_center() + LEFT * 1.5, buff=0, color=ORANGE, stroke_width=5)
f_applied = Arrow(obj.get_center(), obj.get_center() + RIGHT * 2.5, buff=0, color=YELLOW, stroke_width=5)

label_g = MathTex("F_g = mg", font_size=28, color=RED).next_to(f_gravity, RIGHT, buff=0.2)
label_n = MathTex("F_N", font_size=28, color=GREEN).next_to(f_normal, RIGHT, buff=0.2)
label_f = MathTex("f", font_size=28, color=ORANGE).next_to(f_friction, UP, buff=0.2)
label_a = MathTex("F_{app}", font_size=28, color=YELLOW).next_to(f_applied, UP, buff=0.2)

fbd = VGroup(obj, obj_label, f_gravity, f_normal, f_friction, f_applied, label_g, label_n, label_f, label_a)
fbd.scale_to_fit_width(10)
fbd.move_to(ORIGIN)

with self.voiceover(text="""Here is the free body diagram showing all forces acting on the object.""") as tracker:
    self.play(Create(obj), Write(obj_label), run_time=1)
    self.play(GrowArrow(f_gravity), Write(label_g), run_time=1)
    self.play(GrowArrow(f_normal), Write(label_n), run_time=1)
    self.play(GrowArrow(f_friction), Write(label_f), run_time=1)
    self.play(GrowArrow(f_applied), Write(label_a), run_time=1)
\`\`\`

## Projectile Motion
\`\`\`python
axes = Axes(x_range=[0, 12, 2], y_range=[0, 8, 2], x_length=10, y_length=5,
            axis_config={"include_numbers": True, "font_size": 20})
x_label = Text("Distance (m)", font_size=22).next_to(axes.x_axis, DOWN, buff=0.3)
y_label = Text("Height (m)", font_size=22).next_to(axes.y_axis, LEFT, buff=0.3).rotate(90 * DEGREES)
trajectory = axes.plot(lambda x: -0.1 * (x - 5) ** 2 + 6, x_range=[0, 10], color=YELLOW)
ball = Dot(color=RED, radius=0.12).move_to(axes.c2p(0, 3.5))

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
    self.play(
        MoveAlongPath(ball, trajectory), Create(trajectory),
        FadeOut(v_x), FadeOut(v_y), FadeOut(v_x_label), FadeOut(v_y_label),
        run_time=3
    )
\`\`\`

## Simple Wave Animation
\`\`\`python
axes = Axes(x_range=[0, 4 * PI, PI], y_range=[-2, 2, 1], x_length=11, y_length=4)
wave = axes.plot(lambda x: 1.5 * np.sin(x), x_range=[0, 4 * PI], color=BLUE)

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
\`\`\`

## Bar Magnet (NO GRADIENTS)
\`\`\`python
# Use two separate rectangles with solid colors — NOT gradients
north_pole = Rectangle(width=1.5, height=0.8, fill_opacity=0.9).set_fill(RED)
south_pole = Rectangle(width=1.5, height=0.8, fill_opacity=0.9).set_fill(BLUE)
south_pole.next_to(north_pole, RIGHT, buff=0)
n_label = Text("N", font_size=28, color=WHITE).move_to(north_pole)
s_label = Text("S", font_size=28, color=WHITE).move_to(south_pole)
magnet = VGroup(north_pole, south_pole, n_label, s_label)
\`\`\`

## Pitfalls
- NEVER use .set_fill(color=[RED, BLUE]) for gradients — Manim doesn't support this reliably
- For magnets, use two separate rectangles with solid colors side by side
- Arrow for force vectors: use buff=0 to start from the exact center of the object
- For MoveAlongPath, the path must be a Manim mobject (ParametricFunction from axes.plot works)
- Import numpy as np or use from manim import * which includes it`,
  },

  data_viz: {
    description: "Bar charts, pie charts, data tables, animated counters, statistical comparisons.",
    content: `# Skill: Data Visualization

## Bar Chart
\`\`\`python
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
    self.play(Create(chart), run_time=2)
    self.play(Write(bar_labels), run_time=1)
\`\`\`

## Animated Bar Chart (Values Change)
\`\`\`python
chart = BarChart(values=[2, 4, 6, 3, 7], bar_names=["Q1", "Q2", "Q3", "Q4", "Q5"],
                y_range=[0, 10, 2], bar_colors=[BLUE_D, BLUE_C, BLUE_B, BLUE_A, BLUE])
chart.scale_to_fit_width(11)
chart.move_to(ORIGIN)

with self.voiceover(text="""Watch how the values change over time.""") as tracker:
    self.play(Create(chart), run_time=2)

with self.voiceover(text="""Revenue increased significantly.""") as tracker:
    new_values = [5, 8, 4, 9, 6]
    self.play(chart.animate.change_bar_values(new_values), run_time=2)
\`\`\`

## Pie Chart (Manual with Sectors)
\`\`\`python
data = [("Python", 35, BLUE), ("JavaScript", 25, YELLOW), ("Java", 20, RED), ("Other", 20, GRAY)]
sectors = VGroup()
labels = VGroup()
start_angle = 0

for name, percentage, color in data:
    angle = percentage / 100 * TAU
    sector = Sector(outer_radius=2, start_angle=start_angle, angle=angle,
                    color=color, fill_opacity=0.8, stroke_width=2, stroke_color=WHITE)
    sectors.add(sector)
    mid_angle = start_angle + angle / 2
    label_pos = 2.5 * np.array([np.cos(mid_angle), np.sin(mid_angle), 0])
    label = Text(f"{name} ({percentage}%)", font_size=20, color=color).move_to(label_pos)
    labels.add(label)
    start_angle += angle

pie = VGroup(sectors, labels)
pie.scale_to_fit_width(10)
pie.move_to(ORIGIN)

with self.voiceover(text="""Here is the market share breakdown.""") as tracker:
    for i, sector in enumerate(sectors):
        self.play(Create(sector), Write(labels[i]), run_time=0.8)
\`\`\`

## Data Table
\`\`\`python
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

with self.voiceover(text="""Let us examine the data over the past four years.""") as tracker:
    self.play(Create(table), run_time=2)

# Highlight a specific row
with self.voiceover(text="""Notice the significant growth in 2022.""") as tracker:
    row_highlight = SurroundingRectangle(table.get_rows()[3], color=GREEN, buff=0.1)
    self.play(Create(row_highlight), run_time=1)
\`\`\`

## Animated Number Counter
\`\`\`python
counter = DecimalNumber(0, num_decimal_places=0, font_size=72, color=YELLOW)
counter.move_to(ORIGIN)

label = Text("Total Users", font_size=32)
label.next_to(counter, UP, buff=0.5)

with self.voiceover(text="""Our user base has grown to one million.""") as tracker:
    self.play(Write(label), run_time=0.5)
    self.play(ChangeDecimalToValue(counter, 1000000), run_time=3)
\`\`\`

## Comparison Side-by-Side
\`\`\`python
chart_before = BarChart(
    values=[3, 5, 2], bar_names=["A", "B", "C"],
    y_range=[0, 10, 2], x_length=5, y_length=4,
    bar_colors=[RED, RED, RED],
)
title_before = Text("Before", font_size=28, color=RED)
title_before.next_to(chart_before, UP, buff=0.3)

chart_after = BarChart(
    values=[7, 8, 6], bar_names=["A", "B", "C"],
    y_range=[0, 10, 2], x_length=5, y_length=4,
    bar_colors=[GREEN, GREEN, GREEN],
)
title_after = Text("After", font_size=28, color=GREEN)
title_after.next_to(chart_after, UP, buff=0.3)

before_group = VGroup(title_before, chart_before)
after_group = VGroup(title_after, chart_after)

comparison = VGroup(before_group, after_group).arrange(RIGHT, buff=1.5)
comparison.scale_to_fit_width(12)
comparison.move_to(ORIGIN)
\`\`\`

## Pitfalls
- NEVER use axes.get_bar() or axes.plot_bar_graph() — they don't exist
- Use the dedicated BarChart class for bar charts
- Manim has NO built-in PieChart — construct manually with Sector
- For Table, always call .scale(0.7) or similar before positioning — tables are large by default
- ChangeDecimalToValue is the correct way to animate numbers, not manual updates
- chart.animate.change_bar_values() animates bar height changes`,
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