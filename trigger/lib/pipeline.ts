import { z } from "zod";
import { generateJson, generateParsed, QWEN_MAX, QWEN_PLUS, type Log } from "./llm";
import { condenseContext, searchTopic, type Source } from "./research";
import {
  SEARCH_QUERY_SYSTEM,
  buildSearchQueryPrompt,
  DIRECTOR_SYSTEM,
  buildDirectorPrompt,
  SKILL_SELECTOR_SYSTEM,
  buildSkillSelectorPrompt,
  CODER_SYSTEM,
  buildScenePrompt,
  buildSceneRepairPrompt,
  buildSceneVisualRepairPrompt,
} from "./prompts";
import { checkSyntax, extractTranscript, prepareCode, type SyncStats } from "./manim-code";
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
  type ScriptScene,
} from "./scenes";
import { formatTime, highIssues, reviewVideo, type VisualIssue, type VisualReview } from "./visual-qa";
import { getSkillManifest, loadSkills, formatManifestForSelector } from "../skill-loader";

// Manim render microservice (hardcoded - verified working endpoint)
export const MANIM_API_URL = "https://foldex-renderer-777822234917.us-central1.run.app";

const MAX_ATTEMPTS = 4;
const VISUAL_REPAIR_ATTEMPTS = 2;
const RENDER_TIMEOUT_MS = 30 * 60 * 1000;
// Scenes are coded in parallel; this caps concurrent requests to the model API.
const CODER_CONCURRENCY = 3;
// Thinking-token budgets for Qwen Max. Unbounded thinking made single calls
// take many minutes; these keep planning and diagnosis without the stall.
const THINKING = { director: 2000, coder: 1500, repair: 2000 };
// Frame review after rendering; set VIDEO_VISUAL_QA=off to skip it.
const VISUAL_QA = process.env.VIDEO_VISUAL_QA !== "off";

export interface PipelineInput {
  prompt: string;
  context: string;
}

// Diagnostics collected along the way; used by the task logs and the eval script.
export interface PipelineTrace {
  searchQuery?: string;
  sourcesCount: number;
  directorScript?: string;
  estimatedDuration?: string;
  sceneCount?: number;
  skills: string[];
  // Per attempt: what prepareCode fixed or flagged before rendering.
  prepare: { fixes: string[]; warnings: string[]; errors: string[]; sync: SyncStats }[];
  renderErrors: string[];
  repairs: { reason: "validation" | "syntax" | "render" | "visual"; scenes: number[] }[];
  attempts: number;
  visual?: {
    outcome: "clean" | "improved" | "kept-original" | "repair-failed" | "review-failed";
    framesChecked: number;
    issues: VisualIssue[];
    issuesAfterRepair?: VisualIssue[];
  };
}

export type PipelineResult =
  | {
      ok: true;
      videoUrl: string;
      fileSize: number;
      thumbnailUrl: string;
      title: string;
      description: string;
      transcript: string;
      sources: Source[];
      code: string;
      trace: PipelineTrace;
    }
  | { ok: false; error: string; code?: string; trace: PipelineTrace };

export async function runVideoPipeline(log: Log, input: PipelineInput): Promise<PipelineResult> {
  const { prompt, context } = input;
  const trace: PipelineTrace = { sourcesCount: 0, skills: [], prepare: [], renderErrors: [], repairs: [], attempts: 0 };

  // ═══════════════════════════════════════
  // Step 1: Research — a clean search query, web/Wikipedia sources, and a
  // condensed version of very large attached documents.
  // ═══════════════════════════════════════
  const searchAnalysis = await generateJson(
    log,
    QWEN_PLUS,
    z.object({
      searchQuery: z.string().describe("Clean, factual search query focused on the educational topic"),
      encyclopediaTopics: z
        .array(z.string())
        .describe("1-3 encyclopedia article titles for the core topics, 1-4 words each, e.g. ['Derivative', 'Tangent line']"),
      reasoning: z.string().describe("Brief explanation of why this query was chosen"),
    }),
    SEARCH_QUERY_SYSTEM,
    buildSearchQueryPrompt(prompt, context),
  );
  trace.searchQuery = searchAnalysis.searchQuery;
  log.info("Smart search analysis", {
    extractedQuery: searchAnalysis.searchQuery,
    encyclopediaTopics: searchAnalysis.encyclopediaTopics,
    reasoning: searchAnalysis.reasoning,
  });

  const [{ content: searchContent, sources }, documentContext] = await Promise.all([
    searchTopic(log, searchAnalysis.searchQuery, searchAnalysis.encyclopediaTopics),
    condenseContext(log, prompt, context),
  ]);
  trace.sourcesCount = sources.length;

  // ═══════════════════════════════════════
  // Step 2: Director — digest everything into a scene-by-scene script.
  // Each scene is a list of beats (SAY + SHOW).
  // ═══════════════════════════════════════
  const director = await generateParsed(
    log,
    QWEN_MAX,
    DIRECTOR_SYSTEM,
    buildDirectorPrompt(prompt, searchContent, documentContext),
    parseDirectorScript,
    { thinking: THINKING.director },
  );
  trace.directorScript = director.script;
  trace.estimatedDuration = director.duration;
  trace.sceneCount = director.scenes.length;
  log.info("Director script generated", {
    title: director.title,
    duration: director.duration,
    scenes: director.scenes.map((s) => s.heading),
    scriptLength: director.script.length,
  });

  // ═══════════════════════════════════════
  // Step 3: Skill Selection — Based on what the Director wants
  // ═══════════════════════════════════════
  const skillManifest = getSkillManifest();
  let skillContent = "";

  if (skillManifest.length > 0) {
    const skillSelection = await generateJson(
      log,
      QWEN_PLUS,
      z.object({
        selectedSkills: z.array(z.string()).describe("Skill names to load (e.g. ['text_layouts', 'graphs'])"),
        reasoning: z.string().describe("Why these skills were chosen"),
      }),
      SKILL_SELECTOR_SYSTEM,
      buildSkillSelectorPrompt(director.script, formatManifestForSelector(skillManifest)),
    );
    trace.skills = skillSelection.selectedSkills;
    log.info("Skills selected", {
      skills: skillSelection.selectedSkills,
      reasoning: skillSelection.reasoning,
    });

    skillContent = loadSkills(skillSelection.selectedSkills);
  }

  // ═══════════════════════════════════════
  // Step 4: Code each scene
  // One short model call per scene, in parallel. Short answers avoid the
  // provider cutting long streams, and each scene gets the model's full focus.
  // The coder sees ONLY the rules, the selected skills and the script.
  // ═══════════════════════════════════════
  const scenes = director.scenes;
  const bodies = await mapLimit(scenes, CODER_CONCURRENCY, async (scene) => {
    const body = await generateParsed(
      log,
      QWEN_MAX,
      CODER_SYSTEM,
      buildScenePrompt(director.script, scene.text, scene.number, scenes.length, skillContent),
      parseSceneBody,
      { thinking: THINKING.coder },
    );
    log.info(`Scene ${scene.number} coded`, { lines: body.split("\n").length });
    return body;
  });

  // ═══════════════════════════════════════
  // Step 5: Assemble, prepare, render, and repair scene by scene
  // ═══════════════════════════════════════
  const ctx: RenderContext = { log, trace, skillContent, scenes };
  const first = await renderWithRepairs(ctx, bodies, MAX_ATTEMPTS, "render");
  trace.attempts = first.attempts;

  if (!first.ok) {
    return {
      ok: false,
      error: `Failed to generate video after ${first.attempts} attempts. Last error: ${first.error.slice(-300)}`,
      code: first.code,
      trace,
    };
  }

  // ═══════════════════════════════════════
  // Step 6: Visual review
  // Sample frames, look for layout problems, and if there are serious ones
  // repair the scenes involved once. Whichever video has fewer serious
  // problems is kept, so a good first render is never lost.
  // ═══════════════════════════════════════
  const best = VISUAL_QA ? await reviewAndImprove(ctx, first) : first;

  return {
    ok: true,
    videoUrl: best.render.video_url,
    fileSize: best.render.file_size,
    thumbnailUrl: best.render.thumbnail_url,
    title: director.title,
    description: director.description,
    transcript: extractTranscript(best.code),
    sources,
    code: best.code,
    trace,
  };
}

// ─── rendering ────────────────────────────────────────

interface RenderContext {
  log: Log;
  trace: PipelineTrace;
  skillContent: string;
  scenes: ScriptScene[];
}

interface RenderData {
  video_url: string;
  file_size: number;
  thumbnail_url: string;
}

type Rendered = { ok: true; render: RenderData; bodies: string[]; code: string; attempts: number };
type RenderFailure = { ok: false; error: string; code: string; attempts: number };

async function renderWithRepairs(
  ctx: RenderContext,
  startBodies: string[],
  maxAttempts: number,
  firstReason: "render" | "visual",
): Promise<Rendered | RenderFailure> {
  const { log, trace, scenes } = ctx;
  let bodies = [...startBodies];
  let failure = "unknown error";
  let code = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const file = assembleFile(scenes, bodies);
    const prepared = prepareCode(file.code, SCENE_CLASS);
    code = prepared.code;
    trace.prepare.push({ fixes: prepared.fixes, warnings: prepared.warnings, errors: prepared.errors, sync: prepared.sync });
    log.info("Prepared code", { fixes: prepared.fixes, warnings: prepared.warnings, errors: prepared.errors });

    let line: number | undefined;
    let reason: "validation" | "syntax" | "render";
    const syntax = prepared.errors.length ? null : await checkSyntax(prepared.code);
    if (prepared.errors.length) {
      reason = "validation";
      failure = `The file failed validation before rendering:\n- ${prepared.errors.join("\n- ")}`;
    } else if (syntax && !syntax.ok) {
      reason = "syntax";
      failure = syntax.message;
      line = syntax.line;
    } else {
      reason = "render";
      log.info(`Rendering attempt ${attempt}/${maxAttempts}`);
      const render = await renderVideo(log, SCENE_CLASS, prepared.code);
      if (render.ok) {
        log.info(`Video rendered on attempt ${attempt}`, { url: render.data.video_url });
        return { ok: true, render: render.data, bodies, code: prepared.code, attempts: attempt };
      }
      failure = render.error;
      if (render.transient) {
        // The service stayed unavailable through every backoff: not a code problem.
        trace.renderErrors.push(failure);
        log.error("Render service unavailable", { error: failure.slice(0, 300) });
        return { ok: false, error: `Render service unavailable: ${failure.slice(0, 300)}`, code, attempts: attempt };
      }
      line = errorLine(failure);
    }

    trace.renderErrors.push(failure);
    log.error(`Attempt ${attempt} failed`, { reason, line, error: failure.slice(-1500) });
    if (attempt >= maxAttempts) break;

    // Repair only the scene the error points at; if it can't be located,
    // let every scene check itself against the error.
    const culprit = (line !== undefined ? sceneForLine(file.ranges, line) : undefined) ?? sceneForText(bodies, failure);
    const targets = culprit ? [culprit] : scenes.map((s) => s.number);
    trace.repairs.push({ reason, scenes: targets });
    log.info("Repairing scenes", { scenes: targets, line });

    try {
      const error = failure.slice(-3000); // tracebacks end with the useful part
      const repaired = await mapLimit(targets, CODER_CONCURRENCY, (n) => {
        const range = file.ranges[n - 1];
        const lineInBody = culprit === n && line !== undefined ? line - range.firstLine + 1 : undefined;
        const shown = lineInBody ? markLine(bodies[n - 1], lineInBody) : bodies[n - 1];
        return generateParsed(
          log,
          QWEN_MAX,
          CODER_SYSTEM,
          buildSceneRepairPrompt(error, scenes[n - 1].text, shown, ctx.skillContent),
          (text) => parseSceneBody(text).replace(/\s*# <-- ERROR HERE/g, ""),
          { thinking: THINKING.repair },
        );
      });
      targets.forEach((n, i) => (bodies[n - 1] = repaired[i]));
    } catch (e) {
      log.error("Scene repair failed", { error: String(e) });
      break;
    }
  }

  log.error(`Rendering gave up after ${maxAttempts} attempts (${firstReason})`);
  return { ok: false, error: failure, code, attempts: maxAttempts };
}

// Rate limits and gateway errors say nothing about the code: wait and send the
// same code again instead of asking the model to "fix" it.
const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);
const TRANSIENT_TEXT = /rate exceeded|too many requests|temporarily unavailable|service unavailable|upstream|timed? ?out/i;
const RENDER_BACKOFF_MS = [30_000, 60_000, 120_000, 240_000];

async function renderVideo(
  log: Log,
  sceneName: string,
  code: string,
): Promise<{ ok: true; data: RenderData } | { ok: false; error: string; transient: boolean }> {
  for (let retry = 0; ; retry++) {
    let error: string;
    let transient: boolean;
    try {
      const response = await fetch(`${MANIM_API_URL}/generate-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenename: sceneName, code }),
        signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
      });
      if (response.ok) return { ok: true, data: (await response.json()) as RenderData };
      error = await response.text();
      transient = TRANSIENT_STATUS.has(response.status) || (error.length < 300 && TRANSIENT_TEXT.test(error));
    } catch (e) {
      error = `Render request failed: ${e instanceof Error ? e.message : String(e)}`;
      transient = true;
    }
    if (!transient || retry >= RENDER_BACKOFF_MS.length) return { ok: false, error, transient };
    const wait = RENDER_BACKOFF_MS[retry] + Math.round(Math.random() * 5000);
    log.warn("Render service busy or unreachable; retrying the same code", { error: error.slice(0, 200), waitSeconds: Math.round(wait / 1000) });
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

// ─── visual review ────────────────────────────────────

async function safeReview(log: Log, url: string): Promise<VisualReview | null> {
  try {
    return await reviewVideo(log, url);
  } catch (e) {
    log.warn("Visual review failed; keeping the video as rendered", { error: String(e) });
    return null;
  }
}

async function reviewAndImprove(ctx: RenderContext, first: Rendered): Promise<Rendered> {
  const { log, trace, scenes } = ctx;
  const review = await safeReview(log, first.render.video_url);
  if (!review) {
    trace.visual = { outcome: "review-failed", framesChecked: 0, issues: [] };
    return first;
  }
  trace.visual = { outcome: "clean", framesChecked: review.framesChecked, issues: review.issues };
  const serious = highIssues(review);
  if (!serious.length) return first;

  // Group the problems by scene.
  const times = estimateSceneTimes(first.bodies);
  const byScene = new Map<number, VisualIssue[]>();
  for (const issue of serious) {
    const n = sceneForIssue(first.bodies, times, issue.problem, issue.time, review.duration);
    byScene.set(n, [...(byScene.get(n) ?? []), issue]);
  }
  const targets = [...byScene.keys()].sort((a, b) => a - b);
  trace.repairs.push({ reason: "visual", scenes: targets });
  log.info("Repairing visual problems", { count: serious.length, scenes: targets });

  let second: Rendered | RenderFailure;
  try {
    const repaired = await mapLimit(targets, CODER_CONCURRENCY, (n) => {
      const problems = byScene
        .get(n)!
        .map((i) => `- at ${formatTime(i.time)}: ${i.problem}`)
        .join("\n");
      return generateParsed(
        log,
        QWEN_MAX,
        CODER_SYSTEM,
        buildSceneVisualRepairPrompt(problems, scenes[n - 1].text, first.bodies[n - 1], ctx.skillContent),
        parseSceneBody,
        { thinking: THINKING.repair },
      );
    });
    const bodies = [...first.bodies];
    targets.forEach((n, i) => (bodies[n - 1] = repaired[i]));
    second = await renderWithRepairs(ctx, bodies, VISUAL_REPAIR_ATTEMPTS, "visual");
  } catch (e) {
    log.warn("Visual repair failed", { error: String(e) });
    trace.visual.outcome = "repair-failed";
    return first;
  }
  if (!second.ok) {
    trace.visual.outcome = "repair-failed";
    return first;
  }

  const secondReview = await safeReview(log, second.render.video_url);
  trace.visual.issuesAfterRepair = secondReview?.issues;
  if (secondReview && highIssues(secondReview).length < serious.length) {
    trace.visual.outcome = "improved";
    return second;
  }
  trace.visual.outcome = "kept-original";
  return first;
}

// ─── utils ────────────────────────────────────────────

// Promise.all with at most `limit` tasks running at once; keeps result order.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}
