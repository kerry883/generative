import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";

// Minimal logger shape so the pipeline runs both inside a Trigger.dev task
// (pass `logger`) and in local scripts (pass a console-backed logger).
export interface Log {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

// Qwen via the OpenAI-compatible ModelScope inference API
export const qwen = createOpenAICompatible({
  name: "qwen",
  baseURL: process.env.QWEN_BASE_URL ?? "https://api-inference.modelscope.ai/v1",
  apiKey: process.env.MODELSCOPE_API_KEY!,
});

// Heavy reasoning model: director script, code generation, code repair
export const QWEN_MAX = process.env.QWEN_MAX_MODEL ?? "Qwen-Ambassador/Qwen3.8-Max";
// Fast model: search query extraction, skill selection
export const QWEN_PLUS = process.env.QWEN_PLUS_MODEL ?? "Qwen-Ambassador/Qwen3.7-Plus";

// Some OpenAI-compatible endpoints (like ModelScope) don't reliably support
// tool-calling / structured-output modes, so we ask for plain JSON text and
// validate it with zod, retrying with feedback when parsing fails.
// We also STREAM the response: long non-streaming generations (e.g. the full
// Manim code call) hit the gateway's idle timeout and fail with 504s.
export function extractJson(text: string): unknown {
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

// Vision-capable model: frame review of rendered videos
export const QWEN_VISION = process.env.QWEN_VISION_MODEL ?? "Qwen/Qwen3.5-122B-A10B";

// A user message: plain text, or text and images.
export type PromptContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "file"; data: Uint8Array; mediaType: string }>;

// Error message including nested causes (e.g. the network error behind an
// "Failed to process successful response" stream failure).
function describeError(e: unknown): string {
  const parts: string[] = [];
  for (let cur: unknown = e, depth = 0; cur && depth < 4; depth++) {
    parts.push(cur instanceof Error ? cur.message : String(cur));
    cur = cur instanceof Error ? cur.cause : undefined;
  }
  return parts.join(" <- ");
}

// Streams a plain-text response and parses it, retrying up to 3 times with the
// parse error fed back to the model.
export async function generateParsed<T>(
  log: Log,
  model: string,
  system: string,
  prompt: PromptContent,
  parse: (text: string) => T,
  invalidHint = "Follow the required response format exactly.",
): Promise<T> {
  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = streamText({
        model: qwen(model),
        maxRetries: 1,
        system: lastError
          ? `${system}\n\nYour previous response was invalid: ${lastError}\n${invalidHint}`
          : system,
        messages: [{ role: "user", content: prompt }],
      });
      return parse(await result.text);
    } catch (e) {
      lastError = describeError(e).slice(0, 500);
    }
    log.warn("Model call failed, retrying", { model, attempt, error: lastError });
  }

  throw new Error(`Model failed to produce a valid response after 3 attempts: ${lastError}`);
}

export async function generateJson<T extends z.ZodType>(
  log: Log,
  model: string,
  schema: T,
  system: string,
  prompt: PromptContent,
): Promise<z.output<T>> {
  const schemaText = JSON.stringify(z.toJSONSchema(schema), null, 2);
  return generateParsed(
    log,
    model,
    `${system}\n\n` +
      `You MUST respond with ONLY one valid JSON object. No markdown fences, no commentary.\n` +
      `The JSON object must conform to this schema:\n${schemaText}`,
    prompt,
    (text) => {
      const parsed = schema.safeParse(extractJson(text));
      if (!parsed.success) throw new Error(parsed.error.message);
      return parsed.data;
    },
    "Return the corrected JSON object.",
  );
}
