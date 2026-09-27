// Scene-level structure of a video.
//
// The Director's script is split into scenes; the coder writes one scene body
// per call (short responses, generated in parallel), and the pipeline wraps the
// bodies in a fixed file header. Render errors and visual problems are mapped
// back to a scene so only that scene is repaired.

import { extractTranscript, SYNC_HELPER } from "./manim-code";

export const SCENE_CLASS = "GeneratedVideo";

// ─── Director script ──────────────────────────────────

export interface ScriptScene {
  number: number;
  heading: string; // e.g. "SCENE 2: Completing the Square (~30 s)"
  text: string; // the full scene text including the heading
}

export interface DirectorScript {
  title: string;
  description: string;
  duration: string;
  script: string; // all scenes
  scenes: ScriptScene[];
}

export function parseDirectorScript(text: string): DirectorScript {
  const field = (name: string) => text.match(new RegExp(`^\\s*${name}\\s*:\\s*(.+)$`, "mi"))?.[1].trim();
  const cleaned = text.replace(/^```\w*\s*$/gm, "");
  const starts = [...cleaned.matchAll(/^[ \t#*]*SCENE\s+(\d+)\s*[:.\-]/gim)];
  if (starts.length < 2) {
    throw new Error("The script must contain at least 2 scenes, each starting with a line like 'SCENE 1: <name> (~20 s)'.");
  }
  const scenes = starts.map((m, i) => {
    const body = cleaned.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : cleaned.length).trim();
    return { number: i + 1, heading: body.split("\n")[0].replace(/[#*]/g, "").trim(), text: body };
  });
  const withoutBeats = scenes.find((s) => !/^\s*SAY\s*:/im.test(s.text));
  if (withoutBeats) throw new Error(`${withoutBeats.heading} has no 'SAY:' lines. Every beat needs SAY and SHOW lines.`);

  return {
    title: field("TITLE") ?? scenes[0].heading,
    description: field("DESCRIPTION") ?? "",
    duration: field("DURATION") ?? "",
    script: scenes.map((s) => s.text).join("\n\n"),
    scenes,
  };
}

// ─── scene code ───────────────────────────────────────

// The model's answer for one scene: a fenced block (or bare code) holding only
// the scene body. Header pieces it may have included anyway are removed.
export function parseSceneBody(text: string): string {
  const fence = text.match(/```(?:python|py)?[ \t]*\r?\n([\s\S]*?)```/i);
  let code = (fence ? fence[1] : text).replace(/\r\n/g, "\n");

  const construct = code.match(/^[ \t]*def\s+construct\s*\(\s*self\s*\)\s*:[^\n]*\n/m);
  if (construct) code = code.slice(construct.index! + construct[0].length);

  const lines = code.split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (/^(from\s+\S+\s+import|import\s+\S+|class\s+\w+.*:$|sys\.path\.insert)/.test(t)) continue;
    if (t === "MovingCameraScene.setup(self)" || t === "self.camera.frame.save_state()") continue;
    if (t.startsWith("self.set_speech_service(")) {
      // skip the whole call, which usually spans several lines
      let depth = 0;
      for (; i < lines.length; i++) {
        depth += (lines[i].match(/\(/g) ?? []).length - (lines[i].match(/\)/g) ?? []).length;
        if (depth <= 0) break;
      }
      continue;
    }
    kept.push(line);
  }

  const body = dedent(kept.join("\n")).replace(/^\s*\n/, "").replace(/\s+$/, "");
  if (!body.includes("self.voiceover(")) {
    throw new Error("The scene code has no `with self.voiceover(...) as tracker:` blocks. Put the scene body in one ```python block.");
  }
  return body;
}

function dedent(code: string): string {
  const indents = code
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => l.match(/^[ ]*/)![0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return code
    .split("\n")
    .map((l) => l.slice(Math.min(min, l.match(/^[ ]*/)![0].length)))
    .join("\n");
}

// ─── file assembly ────────────────────────────────────

const HEADER = `from manim import *
from manim_voiceover import VoiceoverScene
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from custom_google_tts import CustomGoogleService

# Added by the pipeline: color names models often use that Manim does not define.
for _name, _hex in {
    "MAGENTA": "#FF00FF", "CYAN": "#00FFFF", "LIME": "#32CD32", "NAVY": "#000080",
    "BROWN": "#8B4513", "VIOLET": "#8F00FF", "INDIGO": "#4B0082", "SILVER": "#C0C0C0",
    "LIGHT_BLUE": "#ADD8E6", "DARK_GREEN": "#006400", "DARK_RED": "#8B0000", "BEIGE": "#F5F5DC",
}.items():
    globals().setdefault(_name, _hex)
${SYNC_HELPER}

class ${SCENE_CLASS}(VoiceoverScene, MovingCameraScene):
    def _clear_scene(self):
        # Added by the pipeline: fade out what is left of a scene and reset the camera.
        if self.mobjects:
            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)
        self.camera.frame.restore()

    def construct(self):
        MovingCameraScene.setup(self)
        self.set_speech_service(
            CustomGoogleService(
                voice="en-US-Chirp3-HD-Aoede",
                language_code="en-US",
                speaking_rate=0.90,
            )
        )
        self.camera.frame.save_state()
`;

export interface SceneRange {
  scene: number; // 1-based
  firstLine: number; // 1-based, inclusive, lines of the scene body in the file
  lastLine: number;
}

export interface AssembledFile {
  code: string;
  ranges: SceneRange[];
}

export function assembleFile(scenes: ScriptScene[], bodies: string[]): AssembledFile {
  const lines = HEADER.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const ranges: SceneRange[] = [];

  bodies.forEach((body, i) => {
    lines.push("", `        # ===== ${scenes[i].heading.replace(/[\r\n]/g, " ")} =====`);
    const firstLine = lines.length + 1;
    for (const l of body.split("\n")) lines.push(l.trim() ? "        " + l : "");
    ranges.push({ scene: i + 1, firstLine, lastLine: lines.length });
    lines.push("        self._clear_scene()");
  });

  return { code: lines.join("\n") + "\n", ranges };
}

// ─── mapping problems to scenes ───────────────────────

// Line in the generated file that a Python traceback points at. Tracebacks can
// be plain ("File "x.py", line 57") or rich-formatted ("x.py:57 in construct").
export function errorLine(error: string): number | undefined {
  const frames = [...error.matchAll(/([^\s"'│|()]+\.py)"?(?:,\s*line\s+|:)(\d+)/g)].filter(
    (m) => !/site-packages|dist-packages|[\\/]lib[\\/]python|[\\/]manim[\\/]|[\\/]manim_voiceover[\\/]|custom_google_tts/.test(m[1]),
  );
  const syntax = error.match(/line (\d+)/);
  if (frames.length) return Number(frames[frames.length - 1][2]);
  return syntax ? Number(syntax[1]) : undefined;
}

export function sceneForLine(ranges: SceneRange[], line: number): number | undefined {
  return ranges.find((r) => line >= r.firstLine && line <= r.lastLine)?.scene;
}

// Quoted text in a message ("...", '...', or curly quotes) at least 4 chars long.
function quotedTexts(message: string): string[] {
  return [...message.matchAll(/["'“‘]([^"'”’]{4,80})["'”’]/g)].map((m) => m[1].toLowerCase());
}

// Scene whose code contains text quoted in the message, if exactly one does.
export function sceneForText(bodies: string[], message: string): number | undefined {
  for (const q of quotedTexts(message)) {
    const hits = bodies.map((b, i) => (b.toLowerCase().includes(q) ? i + 1 : 0)).filter(Boolean);
    if (hits.length === 1) return hits[0];
  }
  return undefined;
}

// Rough start/end time of each scene from its narration length.
export function estimateSceneTimes(bodies: string[]): { start: number; end: number }[] {
  const WORDS_PER_SECOND = 2.3;
  let t = 0;
  return bodies.map((body) => {
    const words = extractTranscript(body).split(/\s+/).filter(Boolean).length;
    const blocks = (body.match(/self\.voiceover\(/g) ?? []).length;
    const duration = words / WORDS_PER_SECOND + blocks * 0.3 + 0.6;
    const span = { start: t, end: t + duration };
    t += duration;
    return span;
  });
}

// Scene for a visual problem: by quoted on-screen text first, then by time.
export function sceneForIssue(bodies: string[], times: { start: number; end: number }[], problem: string, at: number, videoDuration?: number): number {
  const byText = sceneForText(bodies, problem);
  if (byText) return byText;
  // Stretch the estimate to the real video length when we know it.
  const estimatedTotal = times[times.length - 1]?.end ?? 0;
  const t = videoDuration && estimatedTotal ? (at * estimatedTotal) / videoDuration : at;
  const idx = times.findIndex((s) => t >= s.start && t < s.end);
  return idx === -1 ? times.length : idx + 1;
}

// Scene body with the failing line marked, for the repair prompt.
export function markLine(body: string, lineInBody: number): string {
  return body
    .split("\n")
    .map((l, i) => (i + 1 === lineInBody ? `${l}  # <-- ERROR HERE` : l))
    .join("\n");
}
