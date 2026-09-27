import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

export const schedulevideogeneration = mutation({
  args: {
    prompt: v.string(),
    context: v.string(),
    guestId: v.string(),
  },
  handler: async (ctx, args) => {
    const prompt = args.prompt + "\n\n" + args.context;

    // Create the video entry first (in "generating" state)
    const videoId = await ctx.db.insert("videos", {
      status: "generating",
      prompt: prompt, // Store original prompt for retry
      public: false,
      guestId: args.guestId,
    });

    // Schedule the action which triggers generation
    // Note: Can't use fetch in mutations, so it happens in the action
    await ctx.scheduler.runAfter(0, api.videos.triggerVideoGeneration, {
      videoId: videoId,
      prompt: args.prompt,
      context: args.context,
    });

    return videoId;
  },
});

export const getguestvideo = query({
  args: {
    guestId: v.string(),
  },
  handler: async (ctx, args) => {
    const videos = await ctx.db
      .query("videos")
      .withIndex("by_guest", (q) => q.eq("guestId", args.guestId))
      .collect();

    return videos;
  },
});

export const claimguest = mutation({
  args: {
    guestId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Not authenticated");
    }
    const videos = await ctx.db
      .query("videos")
      .withIndex("by_guest", (q) => q.eq("guestId", args.guestId))
      .collect();

    for (const video of videos) {
      await ctx.db.patch(video._id, {
        userId: user.subject,
        guestId: undefined,
        creatorname: user.name,
        creatorprofile: user.pictureUrl,
      });
    }

    return { success: true, videoCount: videos.length };
  },
});
