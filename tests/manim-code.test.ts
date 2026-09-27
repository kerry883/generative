import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { extractTranscript, prepareCode } from "../trigger/lib/manim-code";

const HEADER = String.raw`from manim import *
from manim_voiceover import VoiceoverScene
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from custom_google_tts import CustomGoogleService

class Demo(VoiceoverScene, MovingCameraScene):
    def construct(self):
        MovingCameraScene.setup(self)
        self.set_speech_service(CustomGoogleService(voice='en-US-Chirp3-HD-Aoede', language_code='en-US', speaking_rate=0.90))
`;

function isValidPython(code: string): boolean {
  const r = spawnSync("python", ["-c", "import ast,sys; ast.parse(sys.stdin.read())"], { input: code });
  if (r.error) return true; // python not installed: skip the syntax assertion
  if (r.status !== 0) console.error(r.stderr.toString());
  return r.status === 0;
}

describe("prepareCode sync fitting", () => {
  test("rewrites fixed run_times inside a block to fit the narration", () => {
    const code =
      HEADER +
      String.raw`
        with self.voiceover(text="""The quadratic formula solves any quadratic equation.""") as tracker:
            title = Text("Quadratic Formula")
            self.play(Write(title), run_time=2)
            self.play(title.animate.to_edge(UP))
            self.wait(1.5)
`;
    const out = prepareCode(code, "Demo");
    expect(out.errors).toEqual([]);
    expect(out.sync.fitted).toBe(1);
    expect(out.code).toContain("def _vt(");
    expect(out.code).toContain("self.play(Write(title), run_time=_vt(tracker, 2, 4.5))");
    expect(out.code).toContain("self.play(title.animate.to_edge(UP), run_time=_vt(tracker, 1, 4.5))");
    expect(out.code).toContain("self.wait(_vt(tracker, 1.5, 4.5))");
    expect(isValidPython(out.code)).toBe(true);
  });

  test("leaves blocks alone when fractions already fill the narration", () => {
    const code =
      HEADER +
      String.raw`
        with self.voiceover(text="""Here is a circle.""") as tracker:
            c = Circle()
            self.play(Create(c), run_time=tracker.duration * 0.6)
            self.play(c.animate.shift(LEFT), run_time=0.4 * tracker.duration)
`;
    const out = prepareCode(code, "Demo");
    expect(out.sync.alreadyFitted).toBe(1);
    expect(out.sync.fitted).toBe(0);
    expect(out.code).not.toContain("_vt(");
  });

  test("rescales fractions that do not add up to the narration", () => {
    const code =
      HEADER +
      String.raw`
        with self.voiceover(text="""Too much animation for one sentence.""") as tracker:
            self.play(Create(Square()), run_time=tracker.duration * 0.9)
            self.play(Create(Circle()), run_time=tracker.duration * 0.9)
`;
    const out = prepareCode(code, "Demo");
    expect(out.sync.fitted).toBe(1);
    expect(out.code).toContain("run_time=_vt(tracker, 0.9 * tracker.duration, 1.8 * tracker.duration)");
    expect(isValidPython(out.code)).toBe(true);
  });

  test("skips blocks with loops and reports them", () => {
    const code =
      HEADER +
      String.raw`
        with self.voiceover(text="""Three points.""") as tracker:
            for item in items:
                self.play(FadeIn(item), run_time=0.8)
`;
    const out = prepareCode(code, "Demo");
    expect(out.sync.skipped).toBe(1);
    expect(out.warnings.join()).toContain("contains 'for'");
    expect(out.code).toContain("run_time=0.8");
  });

  test("clamps long silent animations between narration blocks", () => {
    const code =
      HEADER +
      String.raw`
        with self.voiceover(text="""First.""") as tracker:
            self.play(Create(Square()), run_time=tracker.duration)
        self.wait(3)
        self.play(FadeOut(Square()), run_time=2)
        with self.voiceover(text="""Second.""") as tracker:
            self.play(Create(Circle()), run_time=tracker.duration)
`;
    const out = prepareCode(code, "Demo");
    expect(out.sync.gapClamps).toBe(2);
    expect(out.code).toContain("self.wait(1)");
    expect(out.code).toContain("self.play(FadeOut(Square()), run_time=1)");
    expect(isValidPython(out.code)).toBe(true);
  });

  test("reports narration with no animation", () => {
    const code =
      HEADER +
      String.raw`
        with self.voiceover(text="""Nothing moves here.""") as tracker:
            pass
`;
    const out = prepareCode(code, "Demo");
    expect(out.sync.withoutAnimation).toBe(1);
  });
});

describe("prepareCode LaTeX and characters", () => {
  test("makes single-backslash LaTeX raw and un-doubles raw strings", () => {
    const code =
      HEADER +
      String.raw`
        with self.voiceover(text="""Formulas.""") as tracker:
            a = MathTex("\frac{a}{b} \times c")
            b = MathTex(r"\\sqrt{x} + \\pi")
            c = MathTex("\\int_0^1 x \\, dx")
            self.play(Write(a), Write(b), Write(c), run_time=tracker.duration)
`;
    const out = prepareCode(code, "Demo");
    expect(out.code).toContain(String.raw`MathTex(r"\frac{a}{b} \times c")`);
    expect(out.code).toContain(String.raw`MathTex(r"\sqrt{x} + \pi")`);
    // already-escaped normal string is correct Python: unchanged
    expect(out.code).toContain(String.raw`MathTex("\\int_0^1 x \\, dx")`);
    expect(isValidPython(out.code)).toBe(true);
  });

  test("replaces smart punctuation and drops emoji", () => {
    const code = HEADER + `        t = Text("It’s “fast” — really \u{1F680}")\n        with self.voiceover(text="""Hi.""") as tracker:\n            self.play(Write(t), run_time=tracker.duration)\n`;
    const out = prepareCode(code, "Demo");
    expect(out.code).toContain(`Text("It's "fast" - really ")`);
    expect(out.fixes.join()).toContain("non-ASCII");
  });

  test("flags MathTex strings that are not complete LaTeX, with their line", () => {
    const code =
      HEADER +
      String.raw`
        with self.voiceover(text="""The formula.""") as tracker:
            ok = MathTex(r"x = ", r"\frac{-b \pm \sqrt{b^2-4ac}}{2a}", r"\{a, b\}")
            bad = MathTex(r"x = \frac{-b \pm \sqrt{", r"b^2-4ac", r"}}{2a}")
            paren = MathTex(r"\left( a + b", r"\right)")
            self.play(Write(ok), run_time=tracker.duration)
`;
    const out = prepareCode(code, "Demo");
    const lines = code.split("\n");
    const badLine = lines.findIndex((l) => l.includes("bad = MathTex")) + 1;
    const parenLine = lines.findIndex((l) => l.includes("paren = MathTex")) + 1;
    expect(out.errors.length).toBe(4); // 2 unbalanced pieces of bad + both halves of paren
    expect(out.errors[0]).toContain("unbalanced braces");
    expect(out.errors.at(-1)).toContain("\\left without matching \\right");
    expect(new Set(out.errorLines)).toEqual(new Set([badLine, parenLine]));
  });

  test("flags a missing scene class and missing narration", () => {
    const out = prepareCode("from manim import *\nclass Other(Scene):\n    def construct(self):\n        pass\n", "Demo");
    expect(out.errors.length).toBe(3);
  });
});

describe("extractTranscript", () => {
  test("joins narration text in order and strips bookmarks", () => {
    const code =
      HEADER +
      String.raw`
        with self.voiceover(text="""Welcome to the lesson.
        Today we learn <bookmark mark='A'/>derivatives.""") as tracker:
            self.wait(tracker.duration)
        with self.voiceover(text="It's simple.") as tracker:
            self.wait(tracker.duration)
`;
    expect(extractTranscript(code)).toBe("Welcome to the lesson. Today we learn derivatives.\n\nIt's simple.");
  });
});
