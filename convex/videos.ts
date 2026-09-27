import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

export const updateVideo = mutation({
  args: {
    videoId: v.id("videos"),
    url: v.optional(v.string()),
    filesize: v.optional(v.number()),
    thumbnail: v.optional(v.string()),
    status: v.union(v.literal("ready"), v.literal("failed")),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    transcript: v.optional(v.string()),
    sources: v.optional(v.array(v.object({
      title: v.string(),
      url: v.string(),
      snippet: v.string(),
    }))),
    public: v.optional(v.boolean()),
    code: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw Error("Video not found");
    }
    await ctx.db.patch(args.videoId, {
      url: args.url,
      filesize: args.filesize,
      thumbnail: args.thumbnail,
      status: args.status,
      title: args.title,
      description: args.description,
      transcript: args.transcript,
      sources: args.sources,
      public: args.public,
      code: args.code
    });
  },
});

export const getpublicvideos = query({
  handler: async (ctx) => {
    const videos = await ctx.db
      .query("videos")
      .withIndex("by_public", (q) => q.eq("public", true))
      .filter((q) => q.eq(q.field("status"), "ready"))
      .collect();
    return videos;
  },
});

export const getusersvideo = query({
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) return null;
    const videos = await ctx.db
      .query("videos")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .collect();
    return videos;
  },
});

export const makepublic = mutation({
  args: {
    videoId: v.id("videos"),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw Error("video not found");
    }
    const newStatus = !video.public;
    await ctx.db.patch(args.videoId, {
      public: newStatus,
    });
    return newStatus;
  },
});

export const getvideobyId = query({
  args: {
    videoId: v.id("videos"),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    return video;
  },
});

export const deletevideo = mutation({
  args: {
    videoId: v.id("videos"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw Error("not authenticated");
    }
    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw Error("Video not found");
    }
    if (video.userId !== user.subject) {
      throw Error("Not allowed to delete this video");
    }
    await ctx.db.delete(args.videoId);
  },
});

export const retryvideo = mutation({
  args: {
    videoId: v.id("videos"),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw Error("video not found");
    }
    if (!video.prompt) {
      throw Error("video prompt not found");
    }
    await ctx.db.patch(args.videoId, {
      status: "generating",
    });
    await ctx.scheduler.runAfter(0, api.videos.triggerVideoGeneration, {
      videoId: args.videoId,
      prompt: video.prompt,
      context: "",
      userId: video.userId || undefined,
    });
  },
});

export const scheduleauthvideo = mutation({
  args: {
    prompt: v.string(),
    context: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw Error("Not authenticated");

    const prompt = args.prompt + "\n\n" + args.context;

    const videoId = await ctx.db.insert("videos", {
      userId: user.subject,
      status: "generating",
      prompt: prompt,
      public: false,
      creatorname: user.name,
      creatorprofile: user.pictureUrl,
    });

    await ctx.scheduler.runAfter(0, api.videos.triggerVideoGeneration, {
      videoId,
      prompt: args.prompt,
      context: args.context,
      userId: user.subject,
    });

    return videoId;
  },
});

// Action that triggers the Trigger.dev generate-video task
export const triggerVideoGeneration = action({
  args: {
    videoId: v.id("videos"),
    prompt: v.string(),
    context: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const TRIGGER_SECRET_KEY = process.env.TRIGGER_SECRET_KEY;

    if (!TRIGGER_SECRET_KEY) {
      console.error("TRIGGER_SECRET_KEY is not set");
      await ctx.runMutation(api.videos.updateVideo, {
        videoId: args.videoId,
        status: "failed",
      });
      throw new Error("TRIGGER_SECRET_KEY is not configured");
    }

    try {
      const response = await fetch("https://api.trigger.dev/api/v1/tasks/generate-video/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TRIGGER_SECRET_KEY}`,
        },
        body: JSON.stringify({
          payload: {
            videoId: args.videoId,
            prompt: args.prompt,
            context: args.context,
            userId: args.userId,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to trigger task:", errorText);
        await ctx.runMutation(api.videos.updateVideo, {
          videoId: args.videoId,
          status: "failed",
        });
        throw new Error(`Failed to trigger task: ${errorText}`);
      }

      const result = await response.json();
      console.log("Task triggered successfully:", result);

      return { success: true, runId: result.id };
    } catch (error) {
      console.error("Error triggering video generation:", error);
      await ctx.runMutation(api.videos.updateVideo, {
        videoId: args.videoId,
        status: "failed",
      });
      throw error;
    }
  },
});

export const submitFeedback = mutation({
  args: {
    videoId: v.id("videos"),
    type: v.union(v.literal("like"), v.literal("dislike")),
    tags: v.optional(v.array(v.string())),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("You must be logged in to submit feedback.");
    }

    const userId = identity.subject;

    const video = await ctx.db.get(args.videoId);
    if (!video) throw new Error("Video not found.");

    const existingFeedback = await ctx.db
      .query("videofeedback")
      .withIndex("by_user_and_video", (q) =>
        q.eq("userId", userId).eq("videoId", args.videoId)
      )
      .unique();

    let likesDelta = 0;
    let dislikesDelta = 0;

    if (existingFeedback) {
      if (existingFeedback.type === args.type) {
        if (args.tags) {
          await ctx.db.patch(existingFeedback._id, {
            tags: args.tags,
            comment: args.comment,
          });
        } else {
          // Toggle off
          await ctx.db.delete(existingFeedback._id);
          if (args.type === "like") likesDelta = -1;
          if (args.type === "dislike") dislikesDelta = -1;
        }
      } else {
        // Switching vote
        await ctx.db.patch(existingFeedback._id, {
          type: args.type,
          tags: args.tags,
          comment: args.comment,
        });

        if (args.type === "like") {
          likesDelta = 1;
          dislikesDelta = -1;
        } else {
          likesDelta = -1;
          dislikesDelta = 1;
        }
      }
    } else {
      await ctx.db.insert("videofeedback", {
        videoId: args.videoId,
        userId: userId,
        type: args.type,
        tags: args.tags,
        comment: args.comment,
      });

      if (args.type === "like") likesDelta = 1;
      if (args.type === "dislike") dislikesDelta = 1;
    }

    if (likesDelta !== 0 || dislikesDelta !== 0) {
      await ctx.db.patch(args.videoId, {
        likes: (video.likes || 0) + likesDelta,
        dislikes: (video.dislikes || 0) + dislikesDelta,
      });
    }

    return { success: true };
  },
});
