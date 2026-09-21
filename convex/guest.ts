import { convexToJson, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";


export const schedulevideogeneration = mutation({
  args: {
    prompt: v.string(),
    context: v.string(),
    guestId: v.string(),
    fingerprint:v.string(),
  },
  handler: async (ctx, args) => {
    
    const limit = await ctx.db.query('guestlimits').withIndex('by_fingerprint',(q)=>q.eq("fingerprint",args.fingerprint)).first();
    const today = new Date().toISOString().split("T")[0];
    const currentCount = limit?.videoCount ?? 0;
    const MAX_DAILY_GUEST_VIDEOS = 2; 

      if (currentCount >= MAX_DAILY_GUEST_VIDEOS) {
        throw new Error("Guest limit reached. Please sign up to create more videos!");
      }

      // 2. UPDATE LIMITS
      if (limit) {
        await ctx.db.patch(limit._id, { videoCount: currentCount + 1 });
      } else {
        await ctx.db.insert("guestlimits", {
          fingerprint: args.fingerprint,
          date: today,
          videoCount: 1,
        });
      }
      console.log("fingerprint ",args.fingerprint);
      console.log("guestId",args.guestId)
    // Create the video entry first (in "generating" state)
    const videoId = await ctx.db.insert("videos", {
      status: "generating",
      prompt: args.prompt, // Store original prompt
      public: false,
      guestId:args.guestId
    });
    console.log("Created video entry:", videoId);
    
    // Schedule the action which will enhance the prompt and trigger generation
    // Note: Can't use AI (fetch) in mutations, so enhancement happens in the action
    await ctx.scheduler.runAfter(0, api.videos.triggerVideoGeneration, {
      videoId: videoId,
      prompt: args.prompt,
      context: args.context,
    });
    
    return videoId;
  },
});

export const getguestvideo = query({
  args:{
    guestId:v.string()
  },
  handler: async (ctx ,args)=>{
    const videos = await ctx.db.query("videos").withIndex("by_guest",(q)=>q.eq("guestId",args.guestId)).collect();
    
    return videos;
  }
})