import { logger, task } from "@trigger.dev/sdk/v3";
import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { getSkillManifest, loadSkills, formatManifestForSelector } from "./skill-loader";

// Qwen via the OpenAI-compatible ModelScope inference API
const qwen = createOpenAICompatible({
  name: "qwen",
  baseURL: process.env.QWEN_BASE_URL ?? "https://api-inference.modelscope.ai/v1",
  apiKey: process.env.MODELSCOPE_API_KEY!,
});

// Heavy reasoning model: director script, code generation, code repair
const QWEN_MAX = process.env.QWEN_MAX_MODEL ?? "Qwen-Ambassador/Qwen3.8-Max";
// Fast model: search query extraction, skill selection
const QWEN_PLUS = process.env.QWEN_PLUS_MODEL ?? "Qwen-Ambassador/Qwen3.7-Plus";

// Manim render microservice (hardcoded - verified working endpoint)
const MANIM_API_URL = "https://foldex-renderer-777822234917.us-central1.run.app";

// Some OpenAI-compatible endpoints (like ModelScope) don't reliably support
// tool-calling / structured-output modes, so we ask for plain JSON text and
// validate it with zod, retrying with feedback when parsing fails.
// We also STREAM the response: long non-streaming generations (e.g. the full
// Manim code call) hit the gateway's idle timeout and fail with 504s.
function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in model response: ${text.slice(0, 300)}`);
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function generateJson<T extends z.ZodType>(
  model: string,
  schema: T,
  system: string,
  prompt: string,
): Promise<z.output<T>> {
  const schemaText = JSON.stringify(z.toJSONSchema(schema), null, 2);
  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = streamText({
        model: qwen(model),
        maxRetries: 1,
        system:
          `${system}\n\n` +
          `You MUST respond with ONLY one valid JSON object. No markdown fences, no commentary.\n` +
          `The JSON object must conform to this schema:\n${schemaText}` +
          (lastError
            ? `\n\nYour previous response was invalid: ${lastError}\nReturn the corrected JSON object.`
            : ""),
        prompt,
      });
      const text = await result.text;

      const parsed = schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.message.slice(0, 500);
    } catch (e) {
      lastError = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    }
    logger.warn("Model call failed, retrying", { model, attempt, error: lastError });
  }

  throw new Error(`Model failed to produce valid JSON after 3 attempts: ${lastError}`);
}





// Source type for storing search results
interface Source {
  title: string;
  url: string;
  snippet: string;
}

// Schemas
const videoSchema = z.object({
  scenename: z.string(),
  code: z.string(),
  title: z.string(),
  description: z.string(),
});

const fixSchema = z.object({
  fixedCode: z.string().describe("The corrected Manim python code"),
  explanation: z.string().describe("Brief explanation of what was fixed"),
  scenename: z.string().describe("The name of the scene"),
});


// Search for topic information using Tavily
async function searchTopic(prompt: string): Promise<{ content: string; sources: Source[] }> {
  try {
    logger.info("Searching for topic information", { prompt });

    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(prompt)}`;

    const response = await fetch(url);
    if (!response.ok) {
      return { content: "", sources: [] };
    }

    const data = await response.json();
    logger.info("Search results", { data });
    // Extract snippets and sources
    const sources: Source[] = (data.items ?? []).map(
      (item: { snippet?: string; link?: string; title?: string }) => ({
        snippet: item.snippet ?? "",
        url: item.link ?? "",
        title: item.title ?? "",
      }),
    );

    if (sources.length === 0) {
      return { content: "", sources: [] };
    }

    // Return a clean, simple string for the LLM
    const searchContent = sources
      .slice(0, 5) // Get top 5 results
      .map(
        (item: Source) =>
          `Title: ${item.title}\nSource: ${item.url}\nContent: ${item.snippet}`,
      )
      .join("\n\n---\n\n");
    logger.info("Search completed", {
      numSources: sources.length,
    });

    return { content: searchContent, sources };
  } catch (error) {
    logger.warn("Search failed, continuing without search results", { error: String(error) });
    return { content: "", sources: [] };
  }
}


// Generation prompt (same as in Convex)
const GENERATION_PROMPT = `
      You are VideoSage, an expert AI that generates flawless Manim code for educational math videos. Your code must be production-ready and follow strict patterns to avoid syntax errors. Read these rules carefully before generating any code

🚨🚨🚨 ABSOLUTE RULE #0: GENERATE ALL SCENES IN ONE CODE FILE 🚨🚨🚨
The prompt may contain multiple SCENES (SCENE 1, SCENE 2, SCENE 3, etc.).
You MUST implement EVERY SINGLE SCENE in your code.
❌ FORBIDDEN: Generating only Scene 1 and ignoring the rest
❌ FORBIDDEN: Creating a 30-second video when the prompt says "5 minutes"
✅ REQUIRED: Implement ALL scenes as described, in order, in ONE construct() method
If the prompt has 8 scenes, your code MUST have 8 sections with voiceovers covering all content.

        CRITICAL RULES (Follow Exactly)
1. NO Unicode Characters - Use ASCII Only
❌ NEVER use: ✓ ✅ ✨ 📊 🎬 📹 or any emoji/non-ASCII characters
✅ ALWAYS use: [OK] [INFO] [ERROR] or plain text
2. NO Nested F-Strings
❌ WRONG: f"some text {f'another {var}'}"
✅ CORRECT: Build strings step-by-step or use .format()
3. Backslash Escaping (CRITICAL FOR WINDOWS)
When writing LaTeX in Python strings:

    Single backslash: \\
    Double backslash: \\\\
    Triple backslash: \\\\\\

❌ WRONG: r\"\\frac{x}{y}\"
✅ CORRECT: \"\\\\frac{x}{y}\"
4. Quote Usage Inside Code

    Use single quotes for outer strings: 'text here'
    Use double quotes for inner voiceover text: text=\"""\"Narration here\"\"\"
    Use triple double quotes for multi-line voiceover: """Long text"""
5. Voiceover Pattern (MANDATORY)

6. BRACE ANNOTATION SAFETY
❌ WRONG: brace.get_text("Label", font_size=24) 
   (Causes TypeError because font_size is passed to positioning logic)

✅ CORRECT: 
   label = Text("Label", font_size=24)
   label.next_to(brace, brace.direction, buff=0.2)

7. VGROUP SELF-REFERENCE ERROR (COMMON BUG)
❌ WRONG - Referencing VGroup during its own creation causes UnboundLocalError:
   icon_magnet = VGroup(
       Rectangle(...),
       Text("N").next_to(icon_magnet.submobjects[0], LEFT),  # ERROR: icon_magnet doesn't exist yet!
   )

✅ CORRECT - Create components FIRST, then group:
   magnet_rect = Rectangle(width=1.5, height=0.5, color=WHITE)
   text_n = Text("N", font_size=24).next_to(magnet_rect, LEFT, buff=0.1)
   text_s = Text("S", font_size=24).next_to(magnet_rect, RIGHT, buff=0.1)
   icon_magnet = VGroup(magnet_rect, text_n, text_s)

8. GRADIENT METHODS THAT DON'T EXIST
❌ WRONG - These methods cause TypeError:
   .set_fill(color=[RED, BLUE], direction=RIGHT)  # 'direction' not supported
   .set_gradient_by_direction([RED, BLUE], direction=RIGHT)  # Method doesn't exist

✅ CORRECT - Use two separate shapes with solid colors:
   # For a bar magnet, use two rectangles side by side:
   north_pole = Rectangle(width=0.75, height=0.5, fill_opacity=1).set_fill(RED)
   south_pole = Rectangle(width=0.75, height=0.5, fill_opacity=1).set_fill(BLUE)
   south_pole.next_to(north_pole, RIGHT, buff=0)
   bar_magnet = VGroup(north_pole, south_pole)
  
Every scene must follow this exact structure:

with self.voiceover(text="""Your narration text here.
Can be multiple sentences.""") as tracker:
    # Animations here
    self.play(Write(some_object), run_time=2)

Do NOT:

    Use run_time inside voiceover() call
    Put empty lines inside the text="""...""" block
    Use single quotes for the voiceover text
5. MIXING QUOTES IN Text() CALLS

❌ SYNTAX ERROR: Text('It's working', font_size=30)
                      ^^^ Single quote inside single quotes!

❌ SYNTAX ERROR: Text('Word 'quoted' word', font_size=30)
                           ^^^^^^^^ Quotes collision!

✅ CORRECT: Text("It's working", font_size=30)
✅ CORRECT: Text("Word 'quoted' word", font_size=30)
✅ CORRECT: Text('It\\'s working', font_size=30)  [escaped]

API-Ready Scene Structure
Generate code that matches this template exactly:
from manim import *
from manim_voiceover import VoiceoverScene
import sys
import os

# Import the custom service
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from custom_google_tts import CustomGoogleService

# MUST inherit from MovingCameraScene to allow zooming
class {scene_name}(VoiceoverScene, MovingCameraScene):
    def construct(self):
        # Initialize Camera (Critical for zooming)
        MovingCameraScene.setup(self)

        # Initialize Google TTS (DO NOT MODIFY)
        self.set_speech_service(
            CustomGoogleService(
                voice='en-US-Chirp3-HD-Aoede',
                language_code='en-US',
                speaking_rate=0.90
            )
        )
        
        # SECTION 1: Title
        with self.voiceover(text="""Your narration here.
        Keep sentences concise. Focus on one concept at a time.""") as tracker:
            title = Text('TITLE HERE', font_size=56, color=BLUE)
            subtitle = Text('Subtitle', font_size=32, color=GRAY)
            subtitle.next_to(title, DOWN, buff=0.5)
            self.play(Write(title), run_time=2)
            self.play(FadeIn(subtitle, shift=DOWN), run_time=2)
        
        self.wait(1)
        self.play(FadeOut(title), FadeOut(subtitle))
        
        # SECTION 2: Main Content
        axes = Axes(x_range=[-2, 8, 1], y_range=[-1, 10, 1], x_length=10, y_length=6)
        axes_labels = axes.get_axis_labels(x_label='x', y_label='f(x)')
        
        with self.voiceover(text="""Explain your econcept clearly.
        Use simple language. Reference the visual elements.""") as tracker:
            curve = axes.plot(lambda x: 0.15*x**2 - 0.5*x + 2, x_range=[0, 7], color=YELLOW)
            self.play(Create(axes), Write(axes_labels), run_time=2)
            self.play(Create(curve), run_time=3)
        
        self.wait(1)

Common Error Prevention Checklist
Before returning code, verify:

    [ ] No Unicode: Search for [^\x00-\x7F] and remove
    [ ] No raw strings with escaped quotes: r\"...\" is forbidden
    [ ] All LaTeX properly escaped: \\\\frac, \\\\lim, etc.
    [ ] Voiceover blocks closed: Every with self.voiceover(...) has matching self.wait() after
    [ ] Consistent quotes: Outer ', inner \"\"\"
    [ ] Class name is valid Python identifier: No spaces, starts with letter
    [ ] No trailing backslashes: Lines don't end with \

Educational Best Practices
═══════════════════════════════════════════════════════════════
PART 1: VISUAL LAYOUT & SCREEN BOUNDARIES (CRITICAL)
═══════════════════════════════════════════════════════════════
Screen Dimensions: 14.2 units wide (x: -7.1 to 7.1) and 8 units tall (-4 to +4).
SAFE AREA: x range [-6, 6]. y range [-3.5, 3.5].

� BACKGROUND COLOR: NEVER CHANGE IT (STRICT RULE)
- The background MUST remain BLACK (the default).
- Do NOT add BackgroundRectangle, Rectangle as background, or any fill to simulate backgrounds.
- Do NOT use set_fill on large shapes to create colored backgrounds.
- ❌ FORBIDDEN: bg = Rectangle(...).set_fill(color=[BLUE_D, BLUE_B], opacity=1)
- ❌ FORBIDDEN: self.camera.background_color = BLUE
- The user expects a clean black background. Deviating from this is a CRITICAL ERROR.

�🛑 TEXT WRAPPING RULES (ZERO TOLERANCE):
1. Manim Text() DOES NOT auto-wrap.
   ❌ WRONG: Text("""Long text that goes on multiple lines in python""") -> Renders as one long line off-screen.
   ✅ CORRECT: Text("Long text...", width=11) OR .scale_to_fit_width(11)

2. Paragraphs vs Text:
   - If the text is a full sentence (> 7 words), YOU MUST LIMIT WIDTH.
   - PREFERRED METHOD: 
     explanation = Text("Your long sentence here...", font_size=32)
     explanation.scale_to_fit_width(11) # <--- THIS PREVENTS CHOPPING

3. Bullet Lists Alignment:
   - When listing items, do NOT just shift right.
   - Align left edge: .next_to(prev, DOWN, aligned_edge=LEFT)
   - If bullet points are long, use scale_to_fit_width(10) on the whole group.

4. Positioning:
   - NEVER place content at x > 6 or x < -6.
   - Check your shifts: .shift(RIGHT*4) is dangerous if the object is wide.

Text Sizing Rules (MUST FOLLOW):

1. Title Text:
   ✅ font_size=48-56 (fits on one line)
   ✅ Max 50 characters per line
   ✅ Position: .to_edge(UP) or .shift(UP*3)
   ❌ NEVER use font_size > 60 for titles

2. Body Text:
   ✅ font_size=28-36 (readable but not huge)
   ✅ Max 60 characters per line
   ✅ Use .scale_to_fit_width(12) for long text
   ❌ NEVER let text extend beyond x=±6

3. Bullet Points / Lists:
   ✅ font_size=24-30
   ✅ Spacing: buff=0.3-0.5 between items
   ✅ Start at UP*2, stack downward with .next_to(previous, DOWN)
   ❌ NEVER create more than 5 bullet points

4. Mathematical Expressions:
   ✅ font_size=40-50 for main equations
   ✅ font_size=28-36 for steps/annotations
   ✅ Use .move_to(ORIGIN) to center
   ✅ Use .to_corner(UL) or .to_edge(LEFT) for reference

5. NO "STATIC YAPPING" (Engagement Rule)
   - NEVER allow the voiceover to run for >4 seconds without visual movement.
   - If narration is long, add "Micro-Animations" (Indicate, Wiggle, Circumscribe).
   ❌ BAD: self.wait(tracker.duration) # User falls asleep
   ✅ GOOD: 
     self.play(Write(text), run_time=2)
     self.play(Indicate(text), run_time=1)
     
Layout Examples:

\`\`\`python
# ✅ GOOD - Text fits on screen
title = Text("Introduction to Derivatives", font_size=50)
title.to_edge(UP)

# ✅ GOOD - Auto-scale long text
explanation = Text("This is a longer explanation that might not fit", font_size=32)
explanation.scale_to_fit_width(12)  # Ensures it fits

# ✅ GOOD - Proper bullet list
bullet1 = Text("- First point here", font_size=28).shift(UP*2 + LEFT*4)
bullet2 = Text("- Second point", font_size=28).next_to(bullet1, DOWN, buff=0.4, aligned_edge=LEFT)
bullet3 = Text("- Third point", font_size=28).next_to(bullet2, DOWN, buff=0.4, aligned_edge=LEFT)

# ❌ BAD - Text too big
title = Text("Some Really Long Title That Goes On Forever", font_size=60)  # Will overflow!

# ❌ BAD - No positioning
text = Text("Random text", font_size=40)  # Might overlap other elements
\`\`\`

Diagram Positioning:
- Left side content: .shift(LEFT*3.5)
- Right side content: .shift(RIGHT*3.5)
- Center: .move_to(ORIGIN)
- Corners: .to_corner(UL/UR/DL/DR, buff=0.5)

═══════════════════════════════════════════════════════════════
🚫 ANTI-OVERFLOW RULES (MANDATORY - LET MANIM HANDLE SIZING)
═══════════════════════════════════════════════════════════════
These rules ELIMINATE visual overflow. Manim calculates sizes; you don't guess.

🔷 RULE A: NEVER HARDCODE FONT SIZES FOR LONG TEXT
For ANY text longer than 5 words, you MUST use .scale_to_fit_width() instead of just setting font size.

❌ BAD CODE (Font size guessing - often overflows):
\`\`\`python
title = Text("The Fundamental Theorem of Calculus Explained", font_size=60)
\`\`\`

✅ SAFE CODE (Manim auto-fits to screen):
\`\`\`python
title = Text("The Fundamental Theorem of Calculus Explained").scale_to_fit_width(12)
\`\`\`

Width Reference: Screen is 14.2 units wide. Use 12 for full-width text, 10 for side content.

🔷 RULE B: USE RELATIVE POSITIONING (THE "BUFF" RULE)
NEVER use .shift() with values larger than 4. ALWAYS prefer .to_edge() or .next_to().

❌ BAD CODE (LLM guesses distance - clips off screen):
\`\`\`python
square.shift(RIGHT * 6)  # Might clip!
box2.move_to(np.array([5.5, 2, 0]))  # Hardcoded coordinates = disaster
\`\`\`

✅ SAFE CODE (Relative positioning with safety margins):
\`\`\`python
square.to_edge(RIGHT, buff=1.0)  # Guaranteed on-screen
box2.next_to(box1, RIGHT, buff=1.5)  # Relative to another object
items.arrange(DOWN, buff=0.5, aligned_edge=LEFT)  # Auto-aligned group
\`\`\`

Buff Reference: Always use buff >= 0.5 for breathing room. Use buff >= 1.0 between major elements.

🔷 RULE C: GROUP & SCALE COMPLEX DIAGRAMS
If creating a diagram with 3+ components, ALWAYS group everything and scale the GROUP at the end.

❌ BAD CODE (Individual positioning - elements drift off-screen):
\`\`\`python
box1 = Rectangle(width=4, height=2).shift(LEFT*3)
box2 = Rectangle(width=4, height=2).shift(RIGHT*3)
arrow = Arrow(box1.get_right(), box2.get_left())
# Each element positioned independently = overflow risk
\`\`\`

✅ SAFE CODE (Group first, scale entire diagram to fit):
\`\`\`python
# 1. Create all parts at ORIGIN (no shifting yet)
box1 = Rectangle(width=4, height=2, color=BLUE)
box2 = Rectangle(width=4, height=2, color=YELLOW).next_to(box1, RIGHT, buff=1.5)
arrow = Arrow(box1.get_right(), box2.get_left())

# 2. Group everything
diagram = VGroup(box1, box2, arrow)

# 3. SCALING MAGIC: Fit entire diagram to 80% of screen
diagram.scale_to_fit_width(11)  # Screen width is 14.2
diagram.move_to(ORIGIN)
\`\`\`

Height Reference: Screen is 8 units tall. Use .scale_to_fit_height(6) for tall diagrams.

🔷 RULE D: TEXT INSIDE SHAPES
When placing text inside rectangles/boxes, ALWAYS scale text to fit the container.

❌ BAD CODE (Text overflows container):
\`\`\`python
box = Rectangle(width=3, height=1.5)
label = Text("Multi-Head Attention Layer", font_size=24).move_to(box)
# Text is wider than box!
\`\`\`

✅ SAFE CODE (Text scales to container):
\`\`\`python
box = Rectangle(width=3, height=1.5)
label = Text("Multi-Head Attention Layer")
label.scale_to_fit_width(box.width * 0.85)  # 85% of box width for padding
label.move_to(box)
\`\`\`

🔷 ANTI-OVERFLOW SUMMARY CHECKLIST:
[ ] Every Text() with 5+ words uses .scale_to_fit_width()
[ ] No .shift() with values > 4
[ ] All multi-part diagrams wrapped in VGroup() and scaled
[ ] Text inside shapes uses container.width * 0.85 for width
[ ] All positioning uses .next_to(), .to_edge(), or .arrange()

🔷 RULE E: FADE OUT LABELS BEFORE ADDING INTERNAL DETAILS (ZOOM LAYERING)
When zooming into a component to show internal structure, you MUST fade out the original label first to prevent overlapping text.

❌ BAD CODE (Labels overlap - creates visual mess):
\`\`\`python
encoder_box = self.create_labeled_box("Encoder", YELLOW)  # Has "Encoder" label
self.play(Create(encoder_box))
# Later, zoom into encoder...
internal_parts = VGroup(...)  # New internal structure
internal_parts.move_to(encoder_box)
self.play(FadeIn(internal_parts))  # "Encoder" label is STILL VISIBLE under the new parts!
\`\`\`

✅ SAFE CODE (Hide label before showing internals):
\`\`\`python
encoder_box = Rectangle(width=3, height=2, color=YELLOW)  # Just the box, no label initially
encoder_label = Text("Encoder", font_size=24).move_to(encoder_box)
encoder_group = VGroup(encoder_box, encoder_label)
self.play(Create(encoder_group))

# Later, zoom into encoder...
self.play(FadeOut(encoder_label))  # CRITICAL: Remove label first!
internal_parts = VGroup(...)
internal_parts.move_to(encoder_box)
self.play(FadeIn(internal_parts))

# When zooming out, restore the label
self.play(FadeOut(internal_parts), FadeIn(encoder_label))
\`\`\`

Key Principle: Keep box outlines and labels as SEPARATE objects so you can fade each independently.

🔷 RULE F: MULTI-LINE TEXT RENDERING
Never use the escape sequence \\n inside Text(). It renders as literal characters.

❌ BAD CODE (Shows literal "\\n" on screen):
\`\`\`python
label = Text("Multi-Head\\nAttention", font_size=24)  # Renders as "Multi-Head\\nAttention"
\`\`\`

✅ SAFE CODE (Use VGroup for multi-line text):
\`\`\`python
line1 = Text("Multi-Head", font_size=24)
line2 = Text("Attention", font_size=24)
label = VGroup(line1, line2).arrange(DOWN, buff=0.1)
\`\`\`

✅ ALTERNATIVE (Use Paragraph for wrapping):
\`\`\`python
from manim import Paragraph
label = Paragraph("Multi-Head", "Attention", font_size=24, alignment="center")
\`\`\`

═══════════════════════════════════════════════════════════════
PART 2: IMPLEMENTATION PATTERNS (HOW TO CODE THE SCENES)
═══════════════════════════════════════════════════════════════
Use these code patterns based on what the  requests:

📊 PATTERN A: MATH FORMULAS
- Use MathTex() for equations.
- Align steps vertically using VGroup().arrange(DOWN, aligned_edge=LEFT).
- Highlighting: Use substring isolation -> formula.get_part_by_tex("x").set_color(RED).

📐 PATTERN B: DIAGRAMS & ZOOMING
- ALWAYS create the full diagram first at ORIGIN.
- Group it: diagram = VGroup(box, text, arrows)
- Scale it: diagram.scale_to_fit_width(12)
- Zooming: 
  1. Fade out top-level labels: self.play(FadeOut(label))
  2. Zoom camera: self.play(self.camera.frame.animate.scale(0.5).move_to(target))
  3. Fade in details: self.play(FadeIn(details))

📚 PATTERN C: BULLET LISTS
- Use VGroup for the list.
- Iterate to create items:
  items = VGroup()
  for text in ["Point A", "Point B"]:
      item = Text(text).scale_to_fit_width(10)
      items.add(item)
  items.arrange(DOWN, buff=0.5, aligned_edge=LEFT)

═══════════════════════════════════════════════════════════════
PART 3: NARRATION GUIDELINES BY TYPE
═══════════════════════════════════════════════════════════════

🎤 For Math Topics:
- Use "let's", "we", "our" (inclusive language)
- Narrate EVERY algebraic step
- Pause after complex steps: "Notice what happened here..."
- Signal transitions: "Now we...", "Next step...", "Finally..."
- Example: "Let's solve for x. First, we add three to both sides. This gives us x equals five."

🎤 For Diagrams/Systems:
- Use spatial language: "On the left...", "Moving to the right..."
- Describe relationships: "This connects to...", "Which feeds into..."
- Build anticipation: "Watch what happens when..."
- Example: "Data enters from the left, passes through the processor, and outputs on the right."

🎤 For Theory:
- Start with relatable examples
- Use analogies: "Think of it like..."
- Define terms immediately: "A derivative - that's the rate of change - tells us..."
- Contrast with familiar concepts: "Unlike addition, which combines numbers..."

🎤 Universal Rules:
- Sentence length: 8-12 words for clarity
- Speaking rate: 140-160 words per minute (speaking_rate=0.90)
- Pause between sections: 1-2 seconds of silence
- Engagement phrases: "Notice...", "Here's the key...", "This is crucial..."

═══════════════════════════════════════════════════════════════
PART 4: INTERACTIVE ELEMENTS (For Math Topics)
═══════════════════════════════════════════════════════════════

Practice Problem Pattern:
\`\`\`python
with self.voiceover(text="""Now it's your turn. Pause the video and try this problem: 
Find the derivative of x squared plus three x.""") as tracker:
    
    practice_box = Rectangle(width=8, height=3, color=YELLOW, fill_opacity=0.1)
    practice_title = Text("Practice Problem", font_size=36, color=YELLOW).to_edge(UP)
    practice_problem = MathTex("f(x) = x^2 + 3x", font_size=48)
    practice_instruction = Text("Pause and solve before continuing", font_size=28, color=GRAY)
    practice_instruction.next_to(practice_problem, DOWN, buff=0.5)
    
    practice_group = VGroup(practice_box, practice_title, practice_problem, practice_instruction)
    practice_group.move_to(ORIGIN)
    
    self.play(FadeIn(practice_group), run_time=2)

self.wait(3)  # Give students time to pause

with self.voiceover(text="""Let's solve this together. We'll apply the power rule to each term.""") as tracker:
    self.play(FadeOut(practice_group), run_time=1)
    # Solution steps...
\`\`\`

═══════════════════════════════════════════════════════════════
PART 5: VIDEO LENGTH GUIDELINES
═══════════════════════════════════════════════════════════════

Base your video length on COMPLEXITY, not just topic type:

Simple Topics (90-120 seconds):
- Basic definitions
- Single-step processes
- Simple formulas with one example

Medium Topics (120-180 seconds):
- Multi-step procedures
- Concepts with 3-4 key points
- One detailed example

Complex Topics (180-300 seconds):
- Advanced mathematics with multiple examples
- Multi-component systems
- Theory + application + practice

Very Complex Topics (300-360 seconds):
- Graduate-level concepts
- Proofs and derivations
- Multiple interconnected ideas

⚠️ NEVER make videos shorter than 60 seconds or longer than 6 minutes!

Animation Timing

    Simple write/create: run_time=1.5-2
    Complex transforms: run_time=2.5-3
    Wait after animation: self.wait(0.5-1)
    Scene transitions: self.wait(2)

Example: Generating a Quadratic Formula Video
Request:
"Create a 90-second video explaining the quadratic formula"
Your Code Generation:
# NO - BAD CODE (has errors)
code = f"self.play(Write(MathTex(r'\\frac{{-b \\pm \\sqrt{{b^2-4ac}}}}{{2a}}')))"

# YES - GOOD CODE
code = '''
with self.voiceover(text="""The quadratic formula solves equations of the form a x squared plus b x plus c equals zero.""") as tracker:
    formula = MathTex("x = \\\\frac{-b \\\\pm \\\\sqrt{b^2-4ac}}{2a}", font_size=60)
    self.play(Write(formula), run_time=3)
'''

✓ Does it use double quotes outside? Text("...")
✓ If it contains apostrophes (it's, don't, student's), are outer quotes double?
✓ No Unicode characters anywhere?
✓ LaTeX uses four backslashes (\\\\\\\\)?

═══════════════════════════════════════════════════════════════
PART 6: ANTI-HALLUCINATION & SYNTAX RULES (STRICT)
═══════════════════════════════════════════════════════════════

1. 🛑 NO FAKE METHODS ON AXES:
   - The Manim Axes class DOES NOT have methods like:
     ❌ .get_bar()
     ❌ .plot_bar_graph()
     ❌ .add_bars()
   - **HOW TO DO BAR CHARTS:**
     ✅ Option A (Best): Use the dedicated BarChart class.
         \`\`\`python
        chart = BarChart(values=[1, 3, 2], bar_names=["A", "B", "C"])
         \`\`\`
     ✅ Option B (Manual): Create Rectangle objects and position them using axes.c2p(x, y).
2. 🛑 LATEX ESCAPING (THE DOUBLE BACKSLASH RULE):
   - You are writing Python strings that contain LaTeX.
   - You MUST use double backslashes for ALL LaTeX commands.
   - ❌ WRONG: MathTex("\int_{-\infty}^{\infty}")  -> Python reads \i as escape char.
   - ✅ CORRECT: MathTex("\\\\int_{-\\\\infty}^{\\\\infty}")

3. 🛑 QUOTE CONSISTENCY:
   - ALWAYS use double quotes " for Text() and Voiceover() content.
   - This prevents syntax errors when the text contains apostrophes (e.g., "It's").
   - ❌ WRONG: Text('It's a signal')
   - ✅ CORRECT: Text("It's a signal")

4. 🛑 TEXT SAFETY:
   - Text DOES NOT wrap automatically.
   - For any subtitle or explanation > 5 words, you MUST force it to fit.
   - ✅ CODE: subtitle.scale_to_fit_width(12)

═══════════════════════════════════════════════════════════════
FINAL CHECKLIST BEFORE GENERATING
═══════════════════════════════════════════════════════════════
Content Quality:
[ ] Video length appropriate for complexity (90-360s)
[ ] Structure matches topic type (Math/Diagram/Theory/Hybrid)
[ ] All text will fit on screen (font_size ≤ 56 for titles)
[ ] Diagrams have clear labels and logical flow
[ ] Practice problems included for math topics
[ ] Narration is clear and matches animations

Syntax (Critical):
[ ] ALL Text() uses double quotes: Text("...")
[ ] ALL MathTex() uses double quotes: MathTex("...")
[ ] LaTeX uses four backslashes: \\\\\\\\frac
[ ] No Unicode characters anywhere
[ ] Proper voiceover structure with """..."""
[ ] All objects positioned within screen bounds

Animation Timing:
[ ] Voiceover blocks for all narration
[ ] self.wait() after major transitions (1-2s)
[ ] Appropriate run_time for animations (1.5-3s)
[ ] Pacing matches speaking rate (0.90)

`;

// Payload type
interface GenerateVideoPayload {
  videoId: string;
  prompt: string;
  context: string;
  userId?: string;
}

export const generateVideoTask = task({
  id: "generate-video",
  maxDuration: 3000, // 50 minutes - plenty of headroom
  retry: {
    maxAttempts: 1, // We handle retries internally with AI self-healing
  },
  run: async (payload: GenerateVideoPayload) => {

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const { videoId, prompt, context, userId } = payload;
    const MAX_ATTEMPTS = 4;

    try {
      logger.info("Starting video generation", { videoId });
      logger.info("prompt", { prompt });
      logger.info("context length", { contextLength: context?.length || 0 });
      logger.info("userId", { userId });

      // ═══════════════════════════════════════
      // Step 1: Smart Search — Extract a clean, factual query from the raw prompt
      // ═══════════════════════════════════════
      const searchAnalysis = await generateJson(
        QWEN_PLUS,
        z.object({
          searchQuery: z.string().describe("Clean, factual search query focused on the educational topic"),
          reasoning: z.string().describe("Brief explanation of why this query was chosen"),
        }),
        `You extract optimal web search queries from video generation requests.

Your job: Given a user's prompt (which might be vague like "make a video from this PDF" or specific like "explain quantum entanglement"), extract a CLEAN, FACTUAL search query that will return useful educational content.

Rules:
- Extract the CORE TOPIC, not the video request itself
- If the user says "generate a video about X", the search query should just be about X
- If context (like PDF text) is provided, use it to understand the real topic
- If the prompt mentions specific concepts, include them
- Make the query specific enough to get accurate results
- NEVER include words like "video", "generate", "create", "manim", "animation" in the search query
- Focus on the EDUCATIONAL CONTENT the video needs to teach`,
        `User prompt: ${prompt}\n\nContext provided: ${context ? "Yes — " + context.substring(0, 500) + (context.length > 500 ? "..." : "") : "None"}\n\nExtract the best search query for finding accurate information about this topic.`,
      );

      logger.info("Smart search analysis", {
        extractedQuery: searchAnalysis.searchQuery,
        reasoning: searchAnalysis.reasoning,
      });

      const { content: searchContent, sources } = await searchTopic(searchAnalysis.searchQuery);
      logger.info("Search completed", { numSources: sources.length });

      // ═══════════════════════════════════════
      // Step 2: Director Agent — Digest ALL raw context into a structured script
      // The Director sees everything (prompt + PDF context + search results)
      // and compresses it into a precise production script.
      // This prevents context overflow when users attach large PDFs.
      // ═══════════════════════════════════════
      const directorScript = await generateJson(
        QWEN_MAX,
        z.object({
          script: z.string().describe("The complete structured production script"),
          estimatedDuration: z.string().describe("Estimated video duration"),
          sceneCount: z.number().describe("Number of scenes in the script"),
          title: z.string().describe("Suggested video title"),
        }),
        `You are the Video Script Director. Your job is to transform user video requests into DETAILED PRODUCTION SCRIPTS that a code writer can directly translate into Manim code.

You receive the user's raw prompt, any PDF/document context they attached, and web search results. You DIGEST all of this into a clean, specific visual script.

## CRITICAL RULES

### Rule 0: NEVER Suggest Custom Backgrounds
- Background MUST remain BLACK (default). Never mention backgrounds.

### Rule 0B: NEVER Suggest Gradient Colors on Shapes
- Manim does NOT support gradients. For colored elements, specify SOLID colors.
- For a bar magnet, say "Draw two rectangles side by side: left RED (North), right BLUE (South)"

### Rule 1: Be EXTREMELY Specific in Visual Instructions
Bad: "Show a neural network"
Good: "Draw 3 circles (BLUE) on the left for input layer, 4 circles (YELLOW) in the middle for hidden layer, 2 circles (RED) on the right for output layer. Connect all nodes with gray lines."

### Rule 2: Text Safety
For ANY text longer than 5 words, include "scale to fit width 11"

### Rule 3: Extract Facts from Context
If the context contains specific formulas, dates, numbers, or facts, include them in the script. The code writer will NOT see the original context — only YOUR script.

## VIDEO LENGTH GUIDELINES
| Topic Type | Duration | Sections |
|------------|----------|----------|
| Simple concept | 30-60 seconds | 2-3 sections |
| Medium concept | 1-3 minutes | 4-5 sections |
| Complex concept | 3-6 minutes | 6-8 sections |
| Deep dive / Tutorial | 5-10 minutes | 8-12 sections |

## OUTPUT FORMAT

Create a [DURATION] video explaining "[TOPIC]".

---

SCENE 1: INTRO ([time range])

VISUALS:
- [Specific shapes, positions, colors]

ANIMATIONS:
- [Specific Manim animations with timing]

NARRATION: "[Exact narration text]"

---

SCENE 2: [NAME] ([time range])
[Continue with same format...]

---

SCENE N: CONCLUSION
[Summary and closing]

---

IMPORTANT: Your script IS the only thing the code writer sees. Include ALL facts, formulas, and content from the context. Be complete.`,
        `## USER'S VIDEO REQUEST:
${prompt}

## WEB RESEARCH RESULTS:
${searchContent || "No search results available."}

## ATTACHED CONTEXT (PDF/document content):
${context || "No additional context provided."}

## YOUR TASK:
Transform ALL of the above into a detailed, structured video production script.
Extract all relevant facts, formulas, and content from the context.
The code writer will ONLY see your script — they won't have access to the raw context.`,
      );

      logger.info("Director script generated", {
        estimatedDuration: directorScript.estimatedDuration,
        sceneCount: directorScript.sceneCount,
        scriptLength: directorScript.script.length,
        title: directorScript.title,
      });

      // ═══════════════════════════════════════
      // Step 3: Skill Selection — Based on what the Director wants
      // The selector sees the director's script (not raw context)
      // so it knows exactly what visual patterns are needed.
      // ═══════════════════════════════════════
      const skillManifest = getSkillManifest();
      let skillContent = "";

      if (skillManifest.length > 0) {
        const skillSelection = await generateJson(
          QWEN_PLUS,
          z.object({
            selectedSkills: z.array(z.string()).describe("Skill names to load (e.g. ['text_layouts', 'graphs'])"),
            reasoning: z.string().describe("Why these skills were chosen"),
          }),
          `You are a skill selector for a Manim video generation system. Given a video production script, you choose which coding skills (pattern libraries) the code generator needs.

Rules:
- Select 1-3 skills that are most relevant to the visual elements in the script
- ALWAYS include "text_layouts" — every video needs proper text handling
- For math equations/formulas: include "math_formulas"
- For function plots/graphs: include "graphs"
- For force diagrams/waves/motion: include "physics"
- For box-and-arrow/architecture/flowcharts: include "flowcharts"
- For bar charts/pie charts/tables/data: include "data_viz"
- Fewer but relevant skills is better than loading everything`,
          `Production script from Director:\n${directorScript.script}\n\nAvailable skills:\n${formatManifestForSelector(skillManifest)}\n\nWhich skills does this script need?`,
        );

        logger.info("Skills selected", {
          skills: skillSelection.selectedSkills,
          reasoning: skillSelection.reasoning,
        });

        skillContent = loadSkills(skillSelection.selectedSkills);
      }

      // ═══════════════════════════════════════
      // Step 4: Generate Manim Code
      // The code generator sees ONLY:
      //   1. GENERATION_PROMPT (syntax rules + patterns)
      //   2. Skills (selected Manim code examples)
      //   3. Director's script (structured visual instructions)
      // It does NOT see raw PDF context or search results.
      // ═══════════════════════════════════════
      const codeGenPrompt = `
PRODUCTION SCRIPT (from Director — implement this exactly):
${directorScript.script}
`;
      const fullPrompt = GENERATION_PROMPT + skillContent + "\n\n" + codeGenPrompt;

      logger.info("Code generation prompt size", {
        totalChars: fullPrompt.length,
        generationPromptChars: GENERATION_PROMPT.length,
        skillChars: skillContent.length,
        directorScriptChars: directorScript.script.length,
      });

      const output = await generateJson(
        QWEN_MAX,
        videoSchema,
        "You generate flawless, production-ready Manim code that strictly follows the provided rules and production script.",
        fullPrompt,
      );

      logger.info("LLM generated code", { scenename: output.scenename, code: output.code });

      // Attempt to render with self-healing retry loop
      let lastError: string | null = null;
      let currentCode = output.code;
      let currentSceneName = output.scenename;
      let currentTranscript = '';

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        logger.info(`Rendering attempt ${attempt}/${MAX_ATTEMPTS}`);

        const response = await fetch(`${MANIM_API_URL}/generate-video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            scenename: currentSceneName,
            code: currentCode,
          }),
        });

        if (response.ok) {
          // SUCCESS!
          const data = await response.json();
          logger.info(`Video generated successfully on attempt ${attempt}`);

          await convex.mutation(api.videos.updateVideo, {
            videoId: videoId as Id<"videos">,
            url: data.video_url,
            filesize: data.file_size,
            thumbnail: data.thumbnail_url,
            status: "ready",
            title: output.title,
            description: output.description,
            transcript: currentTranscript,
            sources: sources,
            public: true,
            code: currentCode,
          });
          return { success: true, attempts: attempt, videoUrl: data.video_url, sourcesCount: sources.length };
        }

        // FAILED - Get error details
        const errorData = await response.text();
        lastError = errorData;

        logger.error(`Attempt ${attempt} failed`, { error: errorData });

        // If this was the last attempt, give up
        if (attempt >= MAX_ATTEMPTS) {
          logger.error(`All ${MAX_ATTEMPTS} attempts exhausted`);
          break;
        }

        // Try to fix the code with AI
        logger.info(`Asking Qwen to fix the code (attempt ${attempt + 1})`);

        const repairPrompt = `
The previous Manim code generation failed with this error:
DO NOT just fix the error. You MUST preserve the high-quality  style.
ERROR MESSAGE:
--------------------------
${errorData}
--------------------------

ORIGINAL PRODUCTION SCRIPT (from Director):
"${directorScript.script}"
BROKEN CODE:
\`\`\`python
${currentCode}
\`\`\`
TASK:
1. Fix the Python error (Syntax, imports, etc).

TASK:
1. Carefully analyze the error message
2. Identify the EXACT line causing the problem
3. Fix ONLY that specific issue  and any issue you might find that doesn't follow the syntax rules 
4. Common fixes:
   - Quote mixing: Change Text('It's...') to Text("It's...")
   - LaTeX escaping: Use \\\\\\\\ not \\\\
   - Missing commas
   - Unicode characters
5. Return the COMPLETE fixed code with proper structure
6. Extract the scene name 
7. 🛡️ AUDIT FOR CHOPPED TEXT (Common Issue):
   - Look for long Text() strings. 
   - IF a Text() string is longer than 50 chars, you MUST add .scale_to_fit_width(11) to it.
   - Example fix: 
     Before: text = Text("Very long string...")
     After:  text = Text("Very long string...").scale_to_fit_width(11)
8. 🛡️ AUDIT POSITIONING:
   - Ensure nothing is shifted beyond RIGHT*5 or LEFT*5.

9. 🛡️ DIAGRAM AUDIT:
   - Check Rectangle sizes. If width < 3.0, increase it to 3.5.
   - Check overlapping objects. Ensure .next_to() uses buff=1.0 or more. 
10. If the error is "AttributeError: 'Camera' object has no attribute 'frame'", you MUST update the class definition to: class {scene_name}(VoiceoverScene, MovingCameraScene):
RETURN the complete, fixed, high-quality script.
`;

        try {
          const fixResult = await generateJson(
            QWEN_MAX,
            fixSchema,
            GENERATION_PROMPT + skillContent, // Skills loaded so fixer knows correct patterns
            repairPrompt,
          );

          logger.info("Fix applied", { explanation: fixResult.explanation, fixedCode: fixResult.fixedCode });

          // Use the fixed code for next attempt
          currentCode = fixResult.fixedCode;
          currentSceneName = fixResult.scenename;
          currentTranscript = '';

          // Small delay before retry
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (fixError) {
          logger.error("Failed to generate fix", { error: String(fixError) });
          break;
        }
      }

      // If we got here, all attempts failed
      logger.error(`Video generation failed after ${MAX_ATTEMPTS} attempts`);

      await convex.mutation(api.videos.updateVideo, {
        videoId: videoId as Id<"videos">,
        status: "failed",
      });

      throw new Error(
        `Failed to generate video after ${MAX_ATTEMPTS} attempts. Last error: ${lastError?.substring(0, 200)}`
      );
    } catch (error) {
      logger.error("Unhandled error in generateVideo", { error: String(error) });

      await convex.mutation(api.videos.updateVideo, {
        videoId: videoId as Id<"videos">,
        status: "failed",
      });

      throw error;
    }
  },
});