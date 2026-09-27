# Skill: Mathematical Formulas & Equation Solving

> **Use when:** The video involves equations, step-by-step algebraic solving, calculus notation, or mathematical proofs.

## Core Pattern: Display and Explain a Formula

```python
# Single formula - centered, properly sized
formula = MathTex(
    "E = mc^2",
    font_size=60
)
formula.move_to(ORIGIN)

with self.voiceover(text="""Einstein's famous equation, E equals m c squared.""") as tracker:
    self.play(Write(formula), run_time=2)

# Highlight specific parts
with self.voiceover(text="""E represents energy. M is mass. And c is the speed of light.""") as tracker:
    self.play(formula[0][0].animate.set_color(YELLOW), run_time=0.5)  # E
    self.play(Indicate(formula[0][0]), run_time=1)
    self.play(formula[0][2].animate.set_color(BLUE), run_time=0.5)   # m
    self.play(formula[0][3:5].animate.set_color(RED), run_time=0.5)  # c^2
```

## Pattern: Step-by-Step Equation Solving

```python
# Each step is a separate MathTex for clean transforms
step1 = MathTex("2x + 5 = 15", font_size=48)
step2 = MathTex("2x = 15 - 5", font_size=48)
step3 = MathTex("2x = 10", font_size=48)
step4 = MathTex("x = 5", font_size=48)

step1.move_to(ORIGIN)

with self.voiceover(text="""Let us solve this equation step by step. We start with 2x plus 5 equals 15.""") as tracker:
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
```

## Pattern: Aligned Equation Steps (Vertical Stack)

```python
# Use aligned equations for showing work
equations = VGroup(
    MathTex("\\\\int_0^3 x^2 \\\\, dx", font_size=40),
    MathTex("= \\\\left[ \\\\frac{x^3}{3} \\\\right]_0^3", font_size=40),
    MathTex("= \\\\frac{3^3}{3} - \\\\frac{0^3}{3}", font_size=40),
    MathTex("= \\\\frac{27}{3} - 0", font_size=40),
    MathTex("= 9", font_size=40),
)
equations.arrange(DOWN, buff=0.4, aligned_edge=LEFT)
equations.scale_to_fit_height(5)
equations.move_to(ORIGIN)

# Reveal one at a time
with self.voiceover(text="""We evaluate the integral of x squared from 0 to 3.""") as tracker:
    self.play(Write(equations[0]), run_time=1.5)

with self.voiceover(text="""Applying the power rule, we get x cubed over 3, evaluated from 0 to 3.""") as tracker:
    self.play(Write(equations[1]), run_time=1.5)

with self.voiceover(text="""Plugging in the bounds.""") as tracker:
    self.play(Write(equations[2]), run_time=1.5)

with self.voiceover(text="""Simplifying gives us 27 over 3, which is 9.""") as tracker:
    self.play(Write(equations[3]), run_time=1)
    self.play(Write(equations[4]), run_time=1)
    self.play(Circumscribe(equations[4], color=YELLOW), run_time=1)
```

## Pattern: Formula with Annotation Braces

```python
formula = MathTex("F = m \\\\cdot a", font_size=56)
formula.move_to(UP * 0.5)

# Annotate each part with braces
brace_f = Brace(formula[0][0], DOWN, color=YELLOW)
label_f = Text("Force (N)", font_size=22, color=YELLOW)
label_f.next_to(brace_f, DOWN, buff=0.2)

brace_m = Brace(formula[0][2], DOWN, color=BLUE)
label_m = Text("Mass (kg)", font_size=22, color=BLUE)
label_m.next_to(brace_m, DOWN, buff=0.2)

brace_a = Brace(formula[0][4], DOWN, color=GREEN)
label_a = Text("Acceleration (m/s²)", font_size=22, color=GREEN)
label_a.next_to(brace_a, DOWN, buff=0.2)

with self.voiceover(text="""Newton's second law: Force equals mass times acceleration.""") as tracker:
    self.play(Write(formula), run_time=2)

with self.voiceover(text="""F is force, measured in Newtons.""") as tracker:
    self.play(GrowFromCenter(brace_f), Write(label_f), run_time=1.5)

with self.voiceover(text="""m is mass in kilograms.""") as tracker:
    self.play(GrowFromCenter(brace_m), Write(label_m), run_time=1.5)

with self.voiceover(text="""And a is acceleration in meters per second squared.""") as tracker:
    self.play(GrowFromCenter(brace_a), Write(label_a), run_time=1.5)
```

## Pattern: Matrix Display

```python
matrix = Matrix(
    [["a", "b"], ["c", "d"]],
    left_bracket="(",
    right_bracket=")",
)
matrix.scale(1.2)
matrix.move_to(ORIGIN)

label = MathTex("A = ", font_size=48)
label.next_to(matrix, LEFT, buff=0.3)

det = MathTex("\\\\det(A) = ad - bc", font_size=40)
det.next_to(matrix, DOWN, buff=1)

group = VGroup(label, matrix, det)
group.scale_to_fit_width(10)
group.move_to(ORIGIN)
```

## LaTeX Escaping Rules (CRITICAL)

- **ALWAYS** use `\\\\` (four backslashes) for LaTeX commands in Python strings
- `\\\\frac{a}{b}` → renders as fraction
- `\\\\int_{a}^{b}` → renders as integral
- `\\\\sqrt{x}` → renders as square root
- `\\\\cdot` → renders as dot multiplication
- `\\\\text{word}` → renders as plain text inside math
- **NEVER** use raw strings (`r"..."`) with MathTex