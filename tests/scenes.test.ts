import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { prepareCode } from "../trigger/lib/manim-code";
import {
  assembleFile,
  errorLine,
  estimateSceneTimes,
  markLine,
  parseDirectorScript,
  parseSceneBody,
  SCENE_CLASS,
  sceneForIssue,
  sceneForLine,
  sceneForText,
} from "../trigger/lib/scenes";

const SCRIPT = `TITLE: The Quadratic Formula
DESCRIPTION: Deriving the quadratic formula by completing the square.
DURATION: 120 s

SCENE 1: Introduction (~20 s)
BEAT 1.1
SAY: Welcome. Today we derive the quadratic formula.
SHOW: Title "The Quadratic Formula" written at the top in BLUE.

SCENE 2: Completing the Square (~40 s)
BEAT 2.1
SAY: We start from a x squared plus b x plus c equals zero.
SHOW: MathTex ax^2 + bx + c = 0 in the center.
`;

const isValidPython = (code: string) => {
  const r = spawnSync("python", ["-c", "import ast,sys; ast.parse(sys.stdin.read())"], { input: code });
  if (r.error) return true; // python not installed: skip
  if (r.status !== 0) console.error(r.stderr.toString());
  return r.status === 0;
};

const BODY_1 = String.raw`with self.voiceover(text="""Welcome. Today we derive the quadratic formula.""") as tracker:
    title = Text("The Quadratic Formula", font_size=48, color=BLUE).to_edge(UP)
    self.play(Write(title), run_time=2)`;

const BODY_2 = String.raw`with self.voiceover(text="""We start from a x squared plus b x plus c equals zero.""") as tracker:
    eq = MathTex("x = \frac{-b}{2a}")
    self.play(Write(eq), run_time=tracker.duration)
    self.play(eq.animate.not_a_method(), run_time=tracker.duration * 0)`;

describe("parseDirectorScript", () => {
  test("reads metadata and splits scenes", () => {
    const d = parseDirectorScript(SCRIPT);
    expect(d.title).toBe("The Quadratic Formula");
    expect(d.description).toContain("completing the square");
    expect(d.duration).toBe("120 s");
    expect(d.scenes.map((s) => s.heading)).toEqual(["SCENE 1: Introduction (~20 s)", "SCENE 2: Completing the Square (~40 s)"]);
    expect(d.scenes[1].text).toContain("BEAT 2.1");
  });

  test("accepts markdown headings for scenes", () => {
    const d = parseDirectorScript(SCRIPT.replace("SCENE 1:", "## SCENE 1:").replace("SCENE 2:", "**SCENE 2:"));
    expect(d.scenes.length).toBe(2);
  });

  test("rejects scripts without scenes or beats", () => {
    expect(() => parseDirectorScript("TITLE: x\nJust some prose.")).toThrow();
    expect(() => parseDirectorScript("SCENE 1: A\nSHOW: x\nSCENE 2: B\nSAY: y")).toThrow(/SAY/);
  });
});

describe("parseSceneBody", () => {
  test("takes the fenced body", () => {
    expect(parseSceneBody("Here you go:\n```python\n" + BODY_1 + "\n```\nDone.")).toBe(BODY_1);
  });

  test("strips a full file the model wrote anyway and dedents", () => {
    const full = [
      "```python",
      "from manim import *",
      "from custom_google_tts import CustomGoogleService",
      "class Foo(VoiceoverScene, MovingCameraScene):",
      "    def construct(self):",
      "        MovingCameraScene.setup(self)",
      "        self.set_speech_service(",
      "            CustomGoogleService(",
      '                voice="x",',
      "            )",
      "        )",
      ...BODY_1.split("\n").map((l) => "        " + l),
      "```",
    ].join("\n");
    expect(parseSceneBody(full)).toBe(BODY_1);
  });

  test("rejects code without voiceover blocks", () => {
    expect(() => parseSceneBody("```python\nself.play(Write(x))\n```")).toThrow(/voiceover/);
  });
});

describe("assembleFile and error mapping", () => {
  const scenes = parseDirectorScript(SCRIPT).scenes;

  test("builds a valid file whose line ranges survive prepareCode", () => {
    const file = assembleFile(scenes, [BODY_1, BODY_2]);
    expect(isValidPython(file.code)).toBe(true);
    const prepared = prepareCode(file.code, SCENE_CLASS);
    expect(prepared.errors).toEqual([]);
    expect(isValidPython(prepared.code)).toBe(true);
    // fixes must not change the number of lines, so error lines still map
    expect(prepared.code.split("\n").length).toBe(file.code.split("\n").length);

    const badLine = prepared.code.split("\n").findIndex((l) => l.includes("not_a_method")) + 1;
    expect(sceneForLine(file.ranges, badLine)).toBe(2);
    const lineInBody = badLine - file.ranges[1].firstLine + 1;
    expect(markLine(BODY_2, lineInBody)).toContain("not_a_method(), run_time=tracker.duration * 0)  # <-- ERROR HERE");
    // the LaTeX string got the raw prefix and scene 1's fixed timing was fitted
    expect(prepared.code).toContain(String.raw`MathTex(r"x = \frac{-b}{2a}")`);
    expect(prepared.code).toContain("run_time=_vt(tracker, 2, 2)");
  });

  test("header lines map to no scene", () => {
    const file = assembleFile(scenes, [BODY_1, BODY_2]);
    expect(sceneForLine(file.ranges, 3)).toBeUndefined();
  });
});

describe("errorLine", () => {
  test("plain traceback: last frame in the generated file", () => {
    const tb = `Traceback (most recent call last):
  File "/usr/local/lib/python3.11/site-packages/manim/scene/scene.py", line 229, in render
    self.construct()
  File "/tmp/job123/GeneratedVideo.py", line 57, in construct
    self.play(eq.animate.not_a_method())
  File "/usr/local/lib/python3.11/site-packages/manim/mobject/mobject.py", line 120, in __getattr__
AttributeError: MathTex object has no attribute not_a_method`;
    expect(errorLine(tb)).toBe(57);
  });

  test("rich traceback format", () => {
    const tb = `│ /tmp/job123/GeneratedVideo.py:88 in construct                     │
│ /usr/local/lib/python3.11/site-packages/manim/animation/transform.py:201 in begin │
TypeError: unsupported operand`;
    expect(errorLine(tb)).toBe(88);
  });

  test("no line information", () => {
    expect(errorLine("LaTeX Error: Undefined control sequence")).toBeUndefined();
  });
});

describe("scene lookup by text and time", () => {
  test("quoted on-screen text picks the scene that contains it", () => {
    expect(sceneForText([BODY_1, BODY_2], 'The title "The Quadratic Formula" is cut off at the top')).toBe(1);
    expect(sceneForText([BODY_1, BODY_2], "Something overlaps")).toBeUndefined();
  });

  test("falls back to estimated scene times, scaled to the real duration", () => {
    const times = estimateSceneTimes([BODY_1, BODY_2]);
    expect(times[0].start).toBe(0);
    expect(times[1].start).toBeCloseTo(times[0].end);
    const total = times[1].end;
    // halfway into scene 2 on a video twice as long as estimated
    const at = ((times[1].start + times[1].end) / 2) * 2;
    expect(sceneForIssue([BODY_1, BODY_2], times, "an arrow overlaps a label", at, total * 2)).toBe(2);
  });
});
