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

export async function generateJson<T extends z.ZodType>(
  log: Log,
  model: string,
  schema: T,
  system: string,
  prompt: string,
): Promise<z.output<T>> {
  const schemaText = JSON.stringify(z.toJSONSchema(schema), null, 2);
  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = streamText({
        model: qwen(model),
        maxRetries: 1,
        system:
          `${system}\n\n` +
          `You MUST respond with ONLY one valid JSON object. No markdown fences, no commentary.\n` +
          `The JSON object must conform to this schema:\n${schemaText}` +
          (lastError
            ? `\n\nYour previous response was invalid: ${lastError}\nReturn the corrected JSON object.`
            : ""),
        prompt,
      });
      const text = await result.text;

      const parsed = schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.message.slice(0, 500);
    } catch (e) {
      lastError = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    }
    log.warn("Model call failed, retrying", { model, attempt, error: lastError });
  }

  throw new Error(`Model failed to produce valid JSON after 3 attempts: ${lastError}`);
}
