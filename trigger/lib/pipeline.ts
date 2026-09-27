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
  buildCoderPrompt,
  buildRepairPrompt,
} from "./prompts";
import { extractTranscript, parseCodeResponse, prepareCode, type SyncStats } from "./manim-code";
import { getSkillManifest, loadSkills, formatManifestForSelector } from "../skill-loader";

// Manim render microservice (hardcoded - verified working endpoint)
export const MANIM_API_URL = "https://foldex-renderer-777822234917.us-central1.run.app";

const MAX_ATTEMPTS = 4;
const RENDER_TIMEOUT_MS = 30 * 60 * 1000;

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
  attempts: number;
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
  const trace: PipelineTrace = { sourcesCount: 0, skills: [], prepare: [], renderErrors: [], attempts: 0 };

  // ═══════════════════════════════════════
  // Step 1: Smart Search — Extract a clean, factual query from the raw prompt
  // ═══════════════════════════════════════
  const searchAnalysis = await generateJson(
    log,
    QWEN_PLUS,
    z.object({
      searchQuery: z.string().describe("Clean, factual search query focused on the educational topic"),
      reasoning: z.string().describe("Brief explanation of why this query was chosen"),
    }),
    SEARCH_QUERY_SYSTEM,
    buildSearchQueryPrompt(prompt, context),
  );
  trace.searchQuery = searchAnalysis.searchQuery;
  log.info("Smart search analysis", {
    extractedQuery: searchAnalysis.searchQuery,
    reasoning: searchAnalysis.reasoning,
  });

  const [{ content: searchContent, sources }, documentContext] = await Promise.all([
    searchTopic(log, searchAnalysis.searchQuery),
    condenseContext(log, prompt, context),
  ]);
  trace.sourcesCount = sources.length;

  // ═══════════════════════════════════════
  // Step 2: Director Agent — Digest ALL raw context into a structured script.
  // This prevents context overflow when users attach large PDFs.
  // ═══════════════════════════════════════
  const directorScript = await generateJson(
    log,
    QWEN_MAX,
    z.object({
      script: z.string().describe("The complete structured production script"),
      estimatedDuration: z.string().describe("Estimated video duration"),
      sceneCount: z.number().describe("Number of scenes in the script"),
      title: z.string().describe("Suggested video title"),
    }),
    DIRECTOR_SYSTEM,
    buildDirectorPrompt(prompt, searchContent, documentContext),
  );
  trace.directorScript = directorScript.script;
  trace.estimatedDuration = directorScript.estimatedDuration;
  trace.sceneCount = directorScript.sceneCount;
  log.info("Director script generated", {
    estimatedDuration: directorScript.estimatedDuration,
    sceneCount: directorScript.sceneCount,
    scriptLength: directorScript.script.length,
    title: directorScript.title,
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
      buildSkillSelectorPrompt(directorScript.script, formatManifestForSelector(skillManifest)),
    );
    trace.skills = skillSelection.selectedSkills;
    log.info("Skills selected", {
      skills: skillSelection.selectedSkills,
      reasoning: skillSelection.reasoning,
    });

    skillContent = loadSkills(skillSelection.selectedSkills);
  }

  // ═══════════════════════════════════════
  // Step 4: Generate Manim Code
  // The code generator sees ONLY the rules, the selected skills and the
  // Director's script — never the raw PDF context or search results.
  // The code comes back as plain text in a fenced block, not inside JSON, so it
  // needs no extra layer of escaping.
  // ═══════════════════════════════════════
  const coderPrompt = buildCoderPrompt(directorScript.script, skillContent);
  log.info("Code generation prompt size", {
    systemChars: CODER_SYSTEM.length,
    skillChars: skillContent.length,
    directorScriptChars: directorScript.script.length,
  });

  const output = await generateParsed(log, QWEN_MAX, CODER_SYSTEM, coderPrompt, parseCodeResponse);
  log.info("LLM generated code", { sceneName: output.sceneName, code: output.code });

  // ═══════════════════════════════════════
  // Step 5: Prepare, render, and repair
  // Every attempt first runs the deterministic fixes (voiceover sync, LaTeX,
  // characters). Structural problems go straight to repair without a render.
  // ═══════════════════════════════════════
  let current = { code: output.code, sceneName: output.sceneName };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    trace.attempts = attempt;
    const prepared = prepareCode(current.code, current.sceneName);
    trace.prepare.push({ fixes: prepared.fixes, warnings: prepared.warnings, errors: prepared.errors, sync: prepared.sync });
    log.info("Prepared code", { fixes: prepared.fixes, warnings: prepared.warnings, errors: prepared.errors });

    let failure: string;
    if (prepared.errors.length) {
      failure = `The file failed validation before rendering:\n- ${prepared.errors.join("\n- ")}`;
    } else {
      log.info(`Rendering attempt ${attempt}/${MAX_ATTEMPTS}`);
      const render = await renderVideo(current.sceneName, prepared.code);
      if (render.ok) {
        log.info(`Video generated successfully on attempt ${attempt}`);
        return {
          ok: true,
          videoUrl: render.data.video_url,
          fileSize: render.data.file_size,
          thumbnailUrl: render.data.thumbnail_url,
          title: output.title,
          description: output.description,
          transcript: extractTranscript(prepared.code),
          sources,
          code: prepared.code,
          trace,
        };
      }
      failure = render.error;
    }

    trace.renderErrors.push(failure);
    log.error(`Attempt ${attempt} failed`, { error: failure });

    if (attempt >= MAX_ATTEMPTS) {
      log.error(`All ${MAX_ATTEMPTS} attempts exhausted`);
      break;
    }

    // Repair from the model's own code (before our fixes) so it sees what it wrote.
    log.info(`Asking Qwen to fix the code (attempt ${attempt + 1})`);
    try {
      const fixed = await generateParsed(
        log,
        QWEN_MAX,
        CODER_SYSTEM,
        `${skillContent}\n\n${buildRepairPrompt(failure, directorScript.script, current.code)}`,
        parseCodeResponse,
      );
      current = { code: fixed.code, sceneName: fixed.sceneName };
      log.info("Fix applied", { sceneName: fixed.sceneName });
    } catch (fixError) {
      log.error("Failed to generate fix", { error: String(fixError) });
      break;
    }
  }

  const lastError = trace.renderErrors.at(-1) ?? "unknown error";
  return {
    ok: false,
    error: `Failed to generate video after ${MAX_ATTEMPTS} attempts. Last error: ${lastError.substring(0, 200)}`,
    code: current.code,
    trace,
  };
}

interface RenderData {
  video_url: string;
  file_size: number;
  thumbnail_url: string;
}

async function renderVideo(
  sceneName: string,
  code: string,
): Promise<{ ok: true; data: RenderData } | { ok: false; error: string }> {
  try {
    const response = await fetch(`${MANIM_API_URL}/generate-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenename: sceneName, code }),
      signal: AbortSignal.timeout(RENDER_TIMEOUT_MS),
    });
    if (response.ok) return { ok: true, data: (await response.json()) as RenderData };
    return { ok: false, error: await response.text() };
  } catch (e) {
    return { ok: false, error: `Render request failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
