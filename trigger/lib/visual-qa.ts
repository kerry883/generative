// Visual review of a rendered video: sample frames with ffmpeg and ask a
// vision model for layout problems (overlaps, text cut off, broken LaTeX).

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { generateJson, QWEN_VISION, type Log } from "./llm";

// Set by the Trigger.dev ffmpeg build extension; locally ffmpeg is on PATH.
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH ?? "ffprobe";

const FRAMES_PER_CALL = 8;
const MIN_FRAMES = 6;
const MAX_FRAMES = 24;
const SECONDS_PER_FRAME = 6;

export interface VisualIssue {
  time: number; // seconds into the video
  problem: string;
  severity: "high" | "low";
}

export interface VisualReview {
  duration: number; // video length in seconds
  framesChecked: number;
  issues: VisualIssue[];
}

function exec(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) =>
      err ? reject(new Error(`${cmd} failed: ${stderr || err.message}`)) : resolve(stdout),
    );
  });
}

const reviewSchema = z.object({
  issues: z.array(
    z.object({
      frame: z.number().describe("The frame number as labeled"),
      problem: z.string().describe("What is wrong and where on screen, naming the visible text or object"),
      severity: z.enum(["high", "low"]),
    }),
  ),
});

const REVIEW_SYSTEM = `You review frames from an educational animation (Manim, black background) for layout defects a viewer would notice.

Report only these problems:
- text or formulas overlapping other text, formulas or shapes
- text, formulas or shapes cut off at the edge of the frame or partly off-screen
- text too small to read at normal viewing size
- broken formulas: visible LaTeX commands, backslashes or words like "frac" or "sqrt" shown as plain text
- labels far away from the thing they label

Do NOT report: empty or nearly empty frames (transitions), animations caught mid-way (partly drawn shapes, fading objects), style choices, or content you would have explained differently.

severity "high": clearly visible and distracting. severity "low": minor.
If a frame has no problems, do not list it. If no frame has problems, return {"issues": []}.`;

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export async function reviewVideo(log: Log, videoUrl: string): Promise<VisualReview> {
  const dir = await mkdtemp(join(tmpdir(), "video-qa-"));
  try {
    const video = join(dir, "video.mp4");
    const res = await fetch(videoUrl, { signal: AbortSignal.timeout(5 * 60 * 1000) });
    if (!res.ok) throw new Error(`Could not download video (${res.status})`);
    await writeFile(video, Buffer.from(await res.arrayBuffer()));

    const duration = Number(
      (await exec(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video])).trim(),
    );
    const count = Math.min(MAX_FRAMES, Math.max(MIN_FRAMES, Math.round(duration / SECONDS_PER_FRAME)));
    const times = Array.from({ length: count }, (_, i) => ((i + 0.5) * duration) / count);

    const frames: { time: number; data: Uint8Array }[] = [];
    for (const [i, t] of times.entries()) {
      const file = join(dir, `frame_${i}.jpg`);
      await exec(FFMPEG, ["-v", "error", "-ss", t.toFixed(2), "-i", video, "-frames:v", "1", "-vf", "scale=960:-2", "-q:v", "4", "-y", file]);
      frames.push({ time: t, data: new Uint8Array(await readFile(file)) });
    }

    const batches: { time: number; data: Uint8Array }[][] = [];
    for (let i = 0; i < frames.length; i += FRAMES_PER_CALL) batches.push(frames.slice(i, i + FRAMES_PER_CALL));

    const results = await Promise.all(
      batches.map(async (batch) => {
        const content = batch.flatMap((f, i) => [
          { type: "text" as const, text: `Frame ${i + 1} (at ${formatTime(f.time)}):` },
          { type: "file" as const, data: f.data, mediaType: "image/jpeg" },
        ]);
        content.unshift({ type: "text", text: `Review these ${batch.length} frames.` });
        try {
          const review = await generateJson(log, QWEN_VISION, reviewSchema, REVIEW_SYSTEM, content);
          return review.issues
            .filter((issue) => issue.frame >= 1 && issue.frame <= batch.length)
            .map((issue) => ({ time: batch[issue.frame - 1].time, problem: issue.problem, severity: issue.severity }));
        } catch (e) {
          log.warn("Frame review batch failed", { error: String(e) });
          return [];
        }
      }),
    );

    const issues = results.flat().sort((a, b) => a.time - b.time);
    log.info("Visual review", { framesChecked: frames.length, high: issues.filter((i) => i.severity === "high").length, issues });
    return { duration, framesChecked: frames.length, issues };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export const highIssues = (review: VisualReview) => review.issues.filter((i) => i.severity === "high");
