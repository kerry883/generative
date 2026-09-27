# Skill: Text Layout & Fitting

> **Use when:** ANY video — this skill covers essential text rendering rules that apply universally. The LLM should ALWAYS use these patterns.

## Rule 1: Long Text MUST Be Scaled

Manim `Text()` does NOT auto-wrap. Any text > 5 words WILL overflow the screen.

```python
# ❌ BAD - Text runs off screen
title = Text("The Fundamental Theorem of Calculus and Its Applications", font_size=48)

# ✅ GOOD - Auto-fits to screen width
title = Text("The Fundamental Theorem of Calculus and Its Applications")
title.scale_to_fit_width(12)  # Screen is 14.2 units wide, 12 gives margin
title.to_edge(UP, buff=0.5)
```

## Rule 2: Bullet Lists with Proper Alignment

```python
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
```

## Rule 3: Text Inside Shapes

```python
box = RoundedRectangle(width=4, height=2, corner_radius=0.3, color=BLUE, fill_opacity=0.15)
title = Text("Multi-Head Attention")
title.scale_to_fit_width(box.width * 0.85)  # 85% of box width = padding
title.move_to(box)

labeled_box = VGroup(box, title)
```

## Rule 4: Multi-Line Text (VGroup, NOT \\n)

```python
# ❌ BAD - \\n renders as literal characters
label = Text("Line One\\nLine Two", font_size=24)

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
```

## Rule 5: Title + Subtitle Pattern

```python
title = Text("Chapter 3: Derivatives", font_size=48, color=BLUE)
title.scale_to_fit_width(min(title.width, 11))
title.to_edge(UP, buff=0.8)

subtitle = Text("Understanding rates of change", font_size=30, color=GRAY)
subtitle.scale_to_fit_width(min(subtitle.width, 9))
subtitle.next_to(title, DOWN, buff=0.5)

with self.voiceover(text="""Chapter 3. Derivatives. Understanding rates of change.""") as tracker:
    self.play(Write(title), run_time=1.5)
    self.play(FadeIn(subtitle, shift=UP * 0.3), run_time=1)

self.wait(1)
self.play(FadeOut(title), FadeOut(subtitle))
```

## Rule 6: Safe Area Boundaries

```
Screen: 14.2 wide × 8 tall
SAFE AREA: x ∈ [-6, 6], y ∈ [-3.5, 3.5]

Positioning cheat sheet:
  .to_edge(UP, buff=0.5)    → y ≈ 3.5
  .to_edge(DOWN, buff=0.5)  → y ≈ -3.5
  .to_edge(LEFT, buff=0.5)  → x ≈ -6.6
  .to_edge(RIGHT, buff=0.5) → x ≈ 6.6
  .to_corner(UL, buff=0.5)  → upper-left
  .move_to(ORIGIN)          → center (0, 0)
```

## Rule 7: Side-by-Side Layout

```python
# Left side: text explanation
explanation = VGroup(
    Text("Key Concepts:", font_size=32, color=YELLOW),
    Text("1. Continuity", font_size=26),
    Text("2. Differentiability", font_size=26),
    Text("3. Integrability", font_size=26),
).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
explanation.scale_to_fit_width(5)

# Right side: formula
formula = MathTex("\\\\int_a^b f(x) \\\\, dx = F(b) - F(a)", font_size=40)

# Arrange side by side
layout = VGroup(explanation, formula).arrange(RIGHT, buff=1.5)
layout.scale_to_fit_width(12)
layout.move_to(ORIGIN)
```

## Quick Reference: Width Values

| Content Type               | scale_to_fit_width() |
| -------------------------- | -------------------- |
| Full-width title           | 12                   |
| Body text                  | 11                   |
| Side panel (left or right) | 5                    |
| Text inside box            | box.width \* 0.85    |
| Bullet list group          | 10                   |
| Diagram label              | 3-4                  |

## Common Pitfalls

- **NEVER** use `font_size > 56` for any text
- **NEVER** use `.shift(RIGHT * 5)` or larger — use `.to_edge()` instead
- **ALWAYS** use `aligned_edge=LEFT` when stacking text vertically
- **NEVER** create more than 6 bullet points on screen at once
- Use `min(obj.width, X)` to only scale DOWN, never up