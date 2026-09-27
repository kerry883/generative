import { defineConfig } from "@trigger.dev/sdk";
import { aptGet, ffmpeg } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  build: {
    extensions: [
      // ffmpeg samples frames from rendered videos for the visual review step.
      ffmpeg(),
      // python3 syntax-checks generated Manim code before it is sent to the renderer.
      aptGet({ packages: ["python3"] }),
    ],
  },
  // Your Trigger.dev project ref (proj_xxx) — from the Trigger.dev dashboard
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_REPLACE_ME",
  dirs: ["./trigger"],
  maxDuration: 3600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 10_000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  },
});
