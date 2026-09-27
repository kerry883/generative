// Local evaluation harness for the video pipeline.
//
// Runs a fixed set of prompts through runVideoPipeline (no Trigger.dev, no
// Convex), downloads each rendered MP4 and measures audio/visual sync with
// ffmpeg. Results land in eval-out/<label>/.
//
//   bun scripts/eval-video.ts --label baseline
//   bun scripts/eval-video.ts --label after-b1 --cases math,physics
//   bun scripts/eval-video.ts --label baseline --analyze-only
//
// Requires ffmpeg/ffprobe on PATH and the keys in .env.local (bun loads it).

import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { runVideoPipeline, type PipelineResult } from "../trigger/lib/pipeline";
import type { Log } from "../trigger/lib/llm";

interface EvalCase {
  name: string;
  prompt: string;
  context?: string;
}

const CASES: EvalCase[] = [
  {
    name: "math",
    prompt: "Explain the quadratic formula and derive it by completing the square.",
  },
  {
    name: "graphs",
    prompt: "Explain what a derivative is using the graph of a function and its tangent lines.",
  },
  {
    name: "physics",
    prompt: "Explain projectile motion and why the path of a thrown ball is a parabola.",
  },
  {
    name: "flowchart",
    prompt: "Explain how the TLS handshake establishes a secure HTTPS connection.",
  },
  {
    name: "document",
    prompt: "Make a video explaining the key ideas in these notes.",
    context:
      "Photosynthesis notes. Photosynthesis converts light energy into chemical energy. " +
      "Overall equation: 6CO2 + 6H2O + light -> C6H12O6 + 6O2. It happens in chloroplasts. " +
      "Stage 1, the light-dependent reactions, occur in the thylakoid membranes: water is split, " +
      "oxygen is released, and ATP and NADPH are produced. Stage 2, the Calvin cycle, occurs in the " +
      "stroma: the enzyme RuBisCO fixes CO2 onto RuBP, and ATP and NADPH are used to build G3P, " +
      "which is used to make glucose. Limiting factors: light intensity, CO2 concentration, temperature.",
  },
];

const args = process.argv.slice(2);
const argValue = (flag: string) => {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
};
const label = argValue("--label") ?? "run";
const selected = argValue("--cases")?.split(",");
const concurrency = Number(argValue("--concurrency") ?? 3);
const analyzeOnly = args.includes("--analyze-only");
const outDir = join("eval-out", label);

function caseLog(name: string): Log {
  const fmt = (data?: Record<string, unknown>) => {
    if (!data) return "";
    const s = JSON.stringify(data);
    return s.length > 300 ? ` ${s.slice(0, 300)}…` : ` ${s}`;
  };
  const ts = () => new Date().toTimeString().slice(0, 8);
  return {
    info: (m, d) => console.log(`${ts()} [${name}] ${m}${fmt(d)}`),
    warn: (m, d) => console.warn(`${ts()} [${name}] WARN ${m}${fmt(d)}`),
    error: (m, d) => console.error(`${ts()} [${name}] ERROR ${m}${fmt(d)}`),
  };
}

// ─── ffmpeg sync analysis ──────────────────────────────

interface Interval {
  start: number;
  end: number;
}

// ffmpeg writes filter results to stderr, so return both streams.
function run(cmd: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd[0], cmd.slice(1), { maxBuffer: 64 * 1024 * 1024 }, (_err, stdout, stderr) =>
      resolve(`${stdout}${stderr}`),
    );
  });
}

function parseIntervals(log: string, kind: "silence" | "freeze", duration: number): Interval[] {
  const startRe = kind === "silence" ? /silence_start: ([\d.]+)/ : /freeze_start: ([\d.]+)/;
  const endRe = kind === "silence" ? /silence_end: ([\d.]+)/ : /freeze_end: ([\d.]+)/;
  const intervals: Interval[] = [];
  let open: number | null = null;
  for (const line of log.split(/\r?\n/)) {
    const s = line.match(startRe);
    if (s) open = Number(s[1]);
    const e = line.match(endRe);
    if (e && open !== null) {
      intervals.push({ start: open, end: Number(e[1]) });
      open = null;
    }
  }
  if (open !== null) intervals.push({ start: open, end: duration });
  return intervals;
}

// Runs of frames whose max pixel change stays below `threshold` (0-255) for at
// least `minSeconds`.
function staticIntervals(log: string, duration: number, minSeconds: number, threshold = 12): Interval[] {
  const samples: { t: number; ymax: number }[] = [];
  let t: number | null = null;
  for (const line of log.split(/\r?\n/)) {
    const time = line.match(/pts_time:([\d.]+)/);
    if (time) t = Number(time[1]);
    const y = line.match(/lavfi\.signalstats\.YMAX=([\d.]+)/);
    if (y && t !== null) samples.push({ t, ymax: Number(y[1]) });
  }
  const out: Interval[] = [];
  let start: number | null = null;
  for (const s of samples) {
    if (s.ymax < threshold) start ??= s.t;
    else if (start !== null) {
      if (s.t - start >= minSeconds) out.push({ start, end: s.t });
      start = null;
    }
  }
  if (start !== null && duration - start >= minSeconds) out.push({ start, end: duration });
  return out;
}

const total = (xs: Interval[]) => xs.reduce((a, i) => a + (i.end - i.start), 0);

// Length of `a` that does NOT overlap any interval in `b`.
function outside(a: Interval[], b: Interval[]): Interval[] {
  const res: Interval[] = [];
  for (const iv of a) {
    let pieces: Interval[] = [iv];
    for (const cut of b) {
      pieces = pieces.flatMap((p) => {
        if (cut.end <= p.start || cut.start >= p.end) return [p];
        const out: Interval[] = [];
        if (cut.start > p.start) out.push({ start: p.start, end: cut.start });
        if (cut.end < p.end) out.push({ start: cut.end, end: p.end });
        return out;
      });
    }
    res.push(...pieces);
  }
  return res;
}

export interface SyncReport {
  duration: number;
  hasAudio: boolean;
  // Narration missing while the picture keeps moving: animations outrun the voice.
  silentWhileMoving: number;
  longestSilentWhileMoving: number;
  // Picture frozen while the voice keeps talking: voice outruns the animations.
  frozenWhileSpeaking: number;
  longestFrozenWhileSpeaking: number;
}

async function analyzeSync(file: string): Promise<SyncReport> {
  const probe = await run([
    "ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", file,
  ]);
  const info = JSON.parse(probe.slice(probe.indexOf("{")));
  const duration = Number(info.format.duration);
  const hasAudio = (info.streams ?? []).some((s: { codec_type: string }) => s.codec_type === "audio");

  // Silence > 2s (the prompts ask for 1-2s pauses between sections, so shorter gaps are intended).
  const silenceLog = hasAudio
    ? await run(["ffmpeg", "-hide_banner", "-i", file, "-af", "silencedetect=noise=-40dB:d=2", "-f", "null", "-"])
    : "";
  const silences = hasAudio ? parseIntervals(silenceLog, "silence", duration) : [{ start: 0, end: duration }];

  // Static picture > 4s (matches the prompt's "no static yapping > 4 seconds" rule).
  // freezedetect averages over the whole frame and calls small changes (a label
  // being written) frozen, so instead: a frame is static when NO pixel changed
  // visibly since the previous one (max per-pixel difference, sampled at 4 fps).
  const motionLog = await run([
    "ffmpeg", "-hide_banner", "-i", file, "-map", "0:v:0", "-vf",
    "fps=4,scale=640:-2,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YMAX",
    "-f", "null", "-",
  ]);
  const freezes = staticIntervals(motionLog, duration, 4);

  const silentMoving = outside(silences, freezes);
  const frozenSpeaking = outside(freezes, silences);
  const longest = (xs: Interval[]) => xs.reduce((m, i) => Math.max(m, i.end - i.start), 0);

  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    duration: r(duration),
    hasAudio,
    silentWhileMoving: r(total(silentMoving)),
    longestSilentWhileMoving: r(longest(silentMoving)),
    frozenWhileSpeaking: r(total(frozenSpeaking)),
    longestFrozenWhileSpeaking: r(longest(frozenSpeaking)),
  };
}

// ─── runner ────────────────────────────────────────────

interface CaseOutcome {
  name: string;
  ok: boolean;
  seconds: number;
  attempts: number;
  error?: string;
  videoUrl?: string;
  estimatedDuration?: string;
  sync?: SyncReport;
  visual?: string;
  repairs?: string;
}

function traceSummary(result: PipelineResult) {
  const t = result.trace;
  const high = t.visual?.issues.filter((i) => i.severity === "high").length;
  return {
    visual: t.visual ? `${t.visual.outcome} (${high ?? 0} high)` : undefined,
    repairs: t.repairs?.map((r) => `${r.reason}:${r.scenes.join("+")}`).join(" ") || undefined,
  };
}

async function runCase(c: EvalCase): Promise<CaseOutcome> {
  const log = caseLog(c.name);
  const started = Date.now();
  let result: PipelineResult;
  try {
    result = await runVideoPipeline(log, { prompt: c.prompt, context: c.context ?? "" });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    log.error("Pipeline threw", { error });
    return { name: c.name, ok: false, seconds: (Date.now() - started) / 1000, attempts: 0, error };
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  await writeFile(join(outDir, `${c.name}.json`), JSON.stringify(result, null, 2));
  if (result.code) await writeFile(join(outDir, `${c.name}.py`), result.code);

  const outcome: CaseOutcome = {
    name: c.name,
    ok: result.ok,
    seconds,
    attempts: result.trace.attempts,
    estimatedDuration: result.trace.estimatedDuration,
    ...traceSummary(result),
  };
  if (!result.ok) return { ...outcome, error: result.error };

  outcome.videoUrl = result.videoUrl;
  const mp4 = join(outDir, `${c.name}.mp4`);
  const res = await fetch(result.videoUrl);
  await writeFile(mp4, Buffer.from(await res.arrayBuffer()));
  outcome.sync = await analyzeSync(mp4);
  return outcome;
}

async function analyzeExisting(): Promise<CaseOutcome[]> {
  const files = (await readdir(outDir)).filter((f) => f.endsWith(".mp4"));
  const outcomes: CaseOutcome[] = [];
  for (const f of files) {
    const name = f.replace(/\.mp4$/, "");
    const jsonPath = join(outDir, `${name}.json`);
    const result = existsSync(jsonPath) ? (JSON.parse(await readFile(jsonPath, "utf8")) as PipelineResult) : null;
    outcomes.push({
      name,
      ok: true,
      seconds: 0,
      attempts: result?.trace.attempts ?? 0,
      estimatedDuration: result?.trace.estimatedDuration,
      sync: await analyzeSync(join(outDir, f)),
    });
  }
  return outcomes;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  let outcomes: CaseOutcome[];

  if (analyzeOnly) {
    outcomes = await analyzeExisting();
  } else {
    const cases = CASES.filter((c) => !selected || selected.includes(c.name));
    outcomes = [];
    const queue = [...cases];
    await Promise.all(
      Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
        for (let c = queue.shift(); c; c = queue.shift()) outcomes.push(await runCase(c));
      }),
    );
  }

  outcomes.sort((a, b) => a.name.localeCompare(b.name));
  await writeFile(join(outDir, "summary.json"), JSON.stringify(outcomes, null, 2));

  console.log(`\n=== ${label} ===`);
  console.table(
    outcomes.map((o) => ({
      case: o.name,
      ok: o.ok,
      attempts: o.attempts,
      mins: Math.round(o.seconds / 6) / 10,
      "len(s)": o.sync?.duration,
      "est.": o.estimatedDuration,
      "silent+moving(s)": o.sync?.silentWhileMoving,
      "max silent": o.sync?.longestSilentWhileMoving,
      "frozen+speaking(s)": o.sync?.frozenWhileSpeaking,
      "max frozen": o.sync?.longestFrozenWhileSpeaking,
      visual: o.visual,
      repairs: o.repairs,
    })),
  );
  const failed = outcomes.filter((o) => !o.ok);
  for (const f of failed) console.log(`${f.name}: ${f.error?.slice(0, 300)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
