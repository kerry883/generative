import { z } from "zod";
import { generateJson, QWEN_MAX, QWEN_PLUS, type Log } from "./llm";
import { searchTopic, type Source } from "./research";
import {
  GENERATION_PROMPT,
  SEARCH_QUERY_SYSTEM,
  buildSearchQueryPrompt,
  DIRECTOR_SYSTEM,
  buildDirectorPrompt,
  SKILL_SELECTOR_SYSTEM,
  buildSkillSelectorPrompt,
  CODER_SYSTEM,
  buildRepairPrompt,
} from "./prompts";
import { getSkillManifest, loadSkills, formatManifestForSelector } from "../skill-loader";

// Manim render microservice (hardcoded - verified working endpoint)
export const MANIM_API_URL = "https://foldex-renderer-777822234917.us-central1.run.app";

const MAX_ATTEMPTS = 4;

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
  const trace: PipelineTrace = { sourcesCount: 0, skills: [], renderErrors: [], attempts: 0 };

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

  const { content: searchContent, sources } = await searchTopic(log, searchAnalysis.searchQuery);
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
    buildDirectorPrompt(prompt, searchContent, context),
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
  // ═══════════════════════════════════════
  const codeGenPrompt = `
PRODUCTION SCRIPT (from Director — implement this exactly):
${directorScript.script}
`;
  const fullPrompt = GENERATION_PROMPT + skillContent + "\n\n" + codeGenPrompt;
  log.info("Code generation prompt size", {
    totalChars: fullPrompt.length,
    generationPromptChars: GENERATION_PROMPT.length,
    skillChars: skillContent.length,
    directorScriptChars: directorScript.script.length,
  });

  const output = await generateJson(log, QWEN_MAX, videoSchema, CODER_SYSTEM, fullPrompt);
  log.info("LLM generated code", { scenename: output.scenename, code: output.code });

  // ═══════════════════════════════════════
  // Step 5: Render with self-healing retry loop
  // ═══════════════════════════════════════
  let currentCode = output.code;
  let currentSceneName = output.scenename;
  const currentTranscript = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    trace.attempts = attempt;
    log.info(`Rendering attempt ${attempt}/${MAX_ATTEMPTS}`);

    const response = await fetch(`${MANIM_API_URL}/generate-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenename: currentSceneName, code: currentCode }),
    });

    if (response.ok) {
      const data = await response.json();
      log.info(`Video generated successfully on attempt ${attempt}`);
      return {
        ok: true,
        videoUrl: data.video_url,
        fileSize: data.file_size,
        thumbnailUrl: data.thumbnail_url,
        title: output.title,
        description: output.description,
        transcript: currentTranscript,
        sources,
        code: currentCode,
        trace,
      };
    }

    const errorData = await response.text();
    trace.renderErrors.push(errorData);
    log.error(`Attempt ${attempt} failed`, { error: errorData });

    if (attempt >= MAX_ATTEMPTS) {
      log.error(`All ${MAX_ATTEMPTS} attempts exhausted`);
      break;
    }

    // Try to fix the code with AI
    log.info(`Asking Qwen to fix the code (attempt ${attempt + 1})`);
    try {
      const fixResult = await generateJson(
        log,
        QWEN_MAX,
        fixSchema,
        GENERATION_PROMPT + skillContent, // Skills loaded so fixer knows correct patterns
        buildRepairPrompt(errorData, directorScript.script, currentCode),
      );
      log.info("Fix applied", { explanation: fixResult.explanation, fixedCode: fixResult.fixedCode });

      currentCode = fixResult.fixedCode;
      currentSceneName = fixResult.scenename;

      // Small delay before retry
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (fixError) {
      log.error("Failed to generate fix", { error: String(fixError) });
      break;
    }
  }

  const lastError = trace.renderErrors.at(-1) ?? "unknown error";
  return {
    ok: false,
    error: `Failed to generate video after ${MAX_ATTEMPTS} attempts. Last error: ${lastError.substring(0, 200)}`,
    code: currentCode,
    trace,
  };
}
