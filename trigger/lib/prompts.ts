// Prompt text for the video generation pipeline.
//
// Large blocks use String.raw so what you read here is exactly what the model
// sees: a single backslash in this file is a single backslash in the prompt.
// Code examples use ~~~ fences because backticks can't appear inside String.raw.

// Shared by the Director and the coder so the two never disagree on length.
export const LENGTH_POLICY = String.raw`Choose the length from the topic's complexity. Narration drives the length: about 2.3 spoken words per second, so 30 seconds is about 70 words.
- Simple (one definition or formula with one example): 60-120 seconds, 3-4 scenes
- Medium (a multi-step procedure or 3-4 key ideas): 120-180 seconds, 4-6 scenes
- Complex (several examples, multi-part systems, theory plus practice): 180-300 seconds, 6-8 scenes
Never shorter than 60 seconds or longer than 360 seconds.`;

// ─── search query ─────────────────────────────────────

export const SEARCH_QUERY_SYSTEM = `You extract optimal web search queries from video generation requests.

Your job: Given a user's prompt (which might be vague like "make a video from this PDF" or specific like "explain quantum entanglement"), extract a CLEAN, FACTUAL search query that will return useful educational content.

Rules:
- Extract the CORE TOPIC, not the video request itself
- If the user says "generate a video about X", the search query should just be about X
- If context (like PDF text) is provided, use it to understand the real topic
- If the prompt mentions specific concepts, include them
- Make the query specific enough to get accurate results
- NEVER include words like "video", "generate", "create", "manim", "animation" in the search query
- Focus on the EDUCATIONAL CONTENT the video needs to teach`;

export function buildSearchQueryPrompt(prompt: string, context: string): string {
  return `User prompt: ${prompt}\n\nContext provided: ${context ? "Yes — " + context.substring(0, 500) + (context.length > 500 ? "..." : "") : "None"}\n\nExtract the best search query for finding accurate information about this topic.`;
}

// ─── director ─────────────────────────────────────────

export const DIRECTOR_SYSTEM = String.raw`You are the Video Script Director for an educational animation pipeline built on Manim.
You turn the user's request, any attached document and web research into a production script that a coder translates line by line into Manim code.

The coder sees ONLY your script. Copy every fact, number, formula, date and definition the video needs into it.

RULES
1. Structure the video as scenes, and each scene as beats. A beat is 1-2 narration sentences plus the exact visuals that happen while those sentences are spoken. The coder turns each beat into one voiceover block whose animations are timed to its narration, so every visual must belong to a beat.
2. Be concrete about visuals: shapes, colors, positions (left, center, right, top), labels, and which animation is used (write, create, fade in, transform, highlight, zoom). Example: "3 BLUE circles on the left labeled x1, x2, x3; arrows from each to one YELLOW circle in the center labeled h".
3. Give each beat 1-3 visual actions. Every sentence must come with something visibly changing on screen.
4. Narration is written to be spoken: "x squared", "a over b", never symbols or LaTeX. Formulas that appear on screen go in the SHOW line, written in LaTeX.
5. Manim limits: the background stays black; no gradient fills (use separate solid-colored shapes); no images, icons or photos. Build everything from shapes, text, formulas, graphs and arrows.
6. Keep on-screen text short: titles under 8 words, bullet points under 10 words, at most 5 bullets at once.
7. Clear the screen between scenes.
8. For math, show every step. For processes, show the flow. End with a short recap scene.
9. Only state facts you are sure of. Prefer facts from the attached document and research; if they are missing, keep claims general rather than inventing numbers, dates or names.

LENGTH
${LENGTH_POLICY}
The estimated duration must match the narration word count.

RESPONSE FORMAT (plain text, use exactly; no JSON, no markdown fences)
TITLE: <video title, at most 60 characters>
DESCRIPTION: <one sentence describing the video>
DURATION: <estimated total length, e.g. 150 s>

SCENE 1: <name> (~<seconds> s)
BEAT 1.1
SAY: <narration, 1-2 sentences>
SHOW: <visuals and animations during this narration>
BEAT 1.2
SAY: ...
SHOW: ...

SCENE 2: <name> (~<seconds> s)
...`;

export function buildDirectorPrompt(prompt: string, searchContent: string, context: string): string {
  return `## USER'S VIDEO REQUEST:
${prompt}

## WEB RESEARCH RESULTS:
${searchContent || "No search results available."}

## ATTACHED CONTEXT (PDF/document content):
${context || "No additional context provided."}

## YOUR TASK:
Transform ALL of the above into a detailed production script in the required response format.
Extract all relevant facts, formulas, and content from the context.
The code writer will ONLY see your script — they won't have access to the raw context.`;
}

// ─── skill selector ───────────────────────────────────

export const SKILL_SELECTOR_SYSTEM = `You are a skill selector for a Manim video generation system. Given a video production script, you choose which coding skills (pattern libraries) the code generator needs.

Rules:
- Select 1-3 skills that are most relevant to the visual elements in the script
- ALWAYS include "text_layouts" — every video needs proper text handling
- For math equations/formulas: include "math_formulas"
- For function plots/graphs: include "graphs"
- For force diagrams/waves/motion: include "physics"
- For box-and-arrow/architecture/flowcharts: include "flowcharts"
- For bar charts/pie charts/tables/data: include "data_viz"
- Fewer but relevant skills is better than loading everything`;

export function buildSkillSelectorPrompt(script: string, manifestText: string): string {
  return `Production script from Director:\n${script}\n\nAvailable skills:\n${manifestText}\n\nWhich skills does this script need?`;
}

// ─── coder ────────────────────────────────────────────

export const GENERATION_PROMPT = String.raw`You are VideoSage. You write Manim Community Edition code for ONE scene of an educational video, with narration that is timed to the animations.

== 1. WHAT YOU WRITE ==
The pipeline builds the file around your code. It already contains the imports (from manim import *), the scene class (VoiceoverScene + MovingCameraScene), the speech service, and camera setup. Your scene body is placed inside construct(), after the previous scene, and the pipeline fades out everything and resets the camera after your scene ends.

Write ONLY the scene body, at indentation level 0, using self as usual. Example for a scene with two beats:
~~~python
# BEAT 1.1
with self.voiceover(text="""Welcome. Today we derive the quadratic formula.""") as tracker:
    title = Text("The Quadratic Formula", font_size=48, color=BLUE)
    title.to_edge(UP, buff=0.8)
    self.play(Write(title), run_time=tracker.duration * 0.6)
    self.play(Indicate(title), run_time=tracker.duration * 0.4)

# BEAT 1.2
with self.voiceover(text="""It solves every equation of the form a x squared plus b x plus c equals zero.""") as tracker:
    equation = MathTex(r"ax^2 + bx + c = 0", font_size=48)
    equation.next_to(title, DOWN, buff=1)
    self.play(Write(equation), run_time=tracker.duration * 0.7)
    self.play(Circumscribe(equation), run_time=tracker.duration * 0.3)
~~~
- Implement EVERY beat of your scene, in order. Each scene starts on an empty screen.
- Do not write imports, a class, def construct, the speech service or camera setup.
- Do not define functions that call self.play or self.wait. Small local helper functions that only build mobjects are fine.

== 2. VOICEOVER TIMING (most important) ==
A block's narration audio starts when the block starts, and its length is tracker.duration.
- One beat of the script = one "with self.voiceover(...) as tracker:" block containing the beat's narration and exactly the animations that illustrate it.
- Inside a block, every self.play and self.wait gets its time as a fraction of the narration, for example run_time=tracker.duration * 0.4. The fractions in one block add up to 1.0.
- Use 1-3 animations per block. When the narration mentions an object, that object appears or changes in the same block.
- In a loop inside a block, split the share across the items: run_time=tracker.duration * 0.9 / len(items).
- Never use fixed seconds (run_time=2) inside a block. Never leave the picture still for a whole block. Do not use bookmarks or get_remaining_duration().
- Between blocks, only short transitions are allowed: FadeOut of old content with run_time at most 1, and self.wait of at most 0.5. Everything else belongs inside a block.

== 3. PYTHON STRING RULES ==
- LaTeX is always a raw string with single backslashes: MathTex(r"x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"). Never double the backslashes. The same applies to Tex(), axis labels and get_graph_label().
- Text() uses double quotes and plain text only, never LaTeX: Text("It's working").
- Narration uses triple double quotes, text="""...""", with no blank lines and no double-quote characters inside. Write it the way it is spoken: "x squared", not "x^2".
- Use ASCII characters only in the whole file: no emoji, smart quotes, arrows or degree signs. Write "degrees", "->" and so on.
- No nested f-strings. No "\n" inside Text(); use VGroup(line1, line2).arrange(DOWN) or Paragraph(...) for multiple lines.

== 4. SCREEN LAYOUT ==
The frame is 14.2 units wide (x from -7.1 to 7.1) and 8 units tall (y from -4 to 4). Keep content inside x in [-6, 6] and y in [-3.5, 3.5].
- The background stays the default black. No background rectangles and no camera.background_color.
- Any Text longer than 5 words gets .scale_to_fit_width(11) (smaller for side panels). Titles use font_size 44-52, body text 28-36, bullets 24-30, with at most 5 bullets on screen.
- Position with .to_edge(), .to_corner(), .next_to(other, direction, buff=0.3 or more) and .arrange(). Avoid .shift() by more than 4 and avoid hard-coded coordinates.
- Diagrams with 3 or more parts: build the parts, put them in a VGroup, then call .scale_to_fit_width(11) and .move_to(ORIGIN) on the group.
- Text inside a shape: label.scale_to_fit_width(box.width * 0.85), then label.move_to(box).
- Within your scene, FadeOut content that is no longer needed before new content takes its place, so nothing overlaps.
- Zooming: fade out labels first, then self.play(self.camera.frame.animate.scale(0.5).move_to(target), run_time=tracker.duration * 0.4).

== 5. MANIM API PITFALLS ==
- Brace labels: create a Text or MathTex and place it with .next_to(brace, brace.direction, buff=0.2). Do not pass font_size to brace.get_text().
- Create a VGroup's parts first, then group them. Never reference a VGroup inside its own constructor.
- There are no gradients: .set_fill(color=[A, B], direction=...) and set_gradient_by_direction do not exist. Use separate solid-colored shapes.
- Axes has no get_bar, plot_bar_graph or add_bars. Use BarChart, or Rectangles placed with axes.c2p(x, y).
- There is no PieChart; build pies from Sector.
- Use Create for shapes, Write for Text and MathTex, FadeIn/FadeOut, Transform/TransformMatchingTex, and Indicate/Circumscribe for emphasis.

== 6. NARRATION STYLE ==
- Sentences of 8-15 words, about 2.3 spoken words per second.
- Guiding, inclusive language: "let's", "notice", "now we". Narrate every algebraic step.
- Keep the picture moving: every sentence comes with a visible change.

== 7. LENGTH ==
Follow the scene's durations and narration from the production script. Use the SAY text as the narration, adjusted only so it reads naturally aloud.`;

export const SCENE_RESPONSE_FORMAT = `Respond with only the scene body in one fenced block and nothing else:
\`\`\`python
<the scene body>
\`\`\``;

export const CODER_SYSTEM = `${GENERATION_PROMPT}\n\n${SCENE_RESPONSE_FORMAT}`;

export function buildScenePrompt(
  script: string,
  sceneText: string,
  sceneNumber: number,
  sceneCount: number,
  skillContent: string,
): string {
  return `${skillContent}

FULL PRODUCTION SCRIPT (for context only; other scenes are written separately):
${script}

========================================
YOUR TASK: write the code for SCENE ${sceneNumber} of ${sceneCount}. Each BEAT becomes one voiceover block.
${sceneText}`;
}

// ─── repair ───────────────────────────────────────────

export function buildSceneRepairPrompt(error: string, sceneText: string, markedCode: string, skillContent: string): string {
  return `${skillContent}\n\n` + String.raw`The code for this scene failed when the video was rendered. Fix it.

ERROR:
----------------------------------------
${error}
----------------------------------------

SCENE SCRIPT (what the scene must show):
${sceneText}

CURRENT SCENE CODE (the failing line is marked "# <-- ERROR HERE" when it is known):
~~~python
${markedCode}
~~~

Instructions:
1. Find the cause of the error and fix it. Also fix any other line that breaks the rules in the system prompt.
2. Keep everything else the same: every voiceover block, the narration text, the layout and the timing. Do not shorten or simplify the scene.
3. If the error names an attribute or method that does not exist, replace it with a documented Manim alternative.
4. If this scene may not be the cause (no line is marked), only change code that could plausibly produce this error, and otherwise return the code unchanged.
5. Remove the "# <-- ERROR HERE" marker and return the complete scene body in the required format.`;
}

export function buildSceneVisualRepairPrompt(problems: string, sceneText: string, code: string, skillContent: string): string {
  return `${skillContent}\n\n` + String.raw`This scene rendered, but a frame-by-frame review of the video found these layout problems in it:

${problems}

SCENE SCRIPT (what the scene must show):
${sceneText}

CURRENT SCENE CODE:
~~~python
${code}
~~~

Instructions:
1. Use the visible text named in each problem to find the objects involved.
2. Fix each problem with the layout rules from the system prompt: scale_to_fit_width, next_to with enough buff, arrange, grouping and scaling diagrams, FadeOut of old content before new content takes its place, raw-string LaTeX.
3. Change only what is needed. Keep every voiceover block, the narration text and the timing.
4. Return the complete scene body in the required format.`;
}
