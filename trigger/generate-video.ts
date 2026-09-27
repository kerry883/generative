import { logger, task } from "@trigger.dev/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { runVideoPipeline } from "./lib/pipeline";

// Payload type
interface GenerateVideoPayload {
  videoId: string;
  prompt: string;
  context: string;
  userId?: string;
}

export const generateVideoTask = task({
  id: "generate-video",
  maxDuration: 3000, // 50 minutes - plenty of headroom
  retry: {
    maxAttempts: 1, // We handle retries internally with AI self-healing
  },
  run: async (payload: GenerateVideoPayload) => {
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const { videoId, prompt, context, userId } = payload;

    try {
      logger.info("Starting video generation", { videoId });
      logger.info("prompt", { prompt });
      logger.info("context length", { contextLength: context?.length || 0 });
      logger.info("userId", { userId });

      const result = await runVideoPipeline(logger, { prompt, context });

      if (!result.ok) {
        logger.error(result.error, { trace: result.trace });
        await convex.mutation(api.videos.updateVideo, {
          videoId: videoId as Id<"videos">,
          status: "failed",
        });
        throw new Error(result.error);
      }

      await convex.mutation(api.videos.updateVideo, {
        videoId: videoId as Id<"videos">,
        url: result.videoUrl,
        filesize: result.fileSize,
        thumbnail: result.thumbnailUrl,
        status: "ready",
        title: result.title,
        description: result.description,
        transcript: result.transcript,
        sources: result.sources,
        public: true,
        code: result.code,
      });

      return {
        success: true,
        attempts: result.trace.attempts,
        videoUrl: result.videoUrl,
        sourcesCount: result.sources.length,
      };
    } catch (error) {
      logger.error("Unhandled error in generateVideo", { error: String(error) });

      await convex.mutation(api.videos.updateVideo, {
        videoId: videoId as Id<"videos">,
        status: "failed",
      });

      throw error;
    }
  },
});
