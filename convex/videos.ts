import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { DatabaseReader } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export const addVideo = mutation({
  args: {
    folderId: v.optional(v.id("folders")),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    transcript: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw Error("Not authenticated");
    }
    const video = await ctx.db.insert("videos", {
      userId: user.subject,
      folderId: args.folderId,
      title: args.title,
      description: args.description,
      transcript: args.transcript,
      status: "generating",
    });

    return video;
  },
});

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


export const getvideos = query({
  args: {},
  handler: async (ctx) => {
    const videos = await ctx.db.query("videos").collect();

    return videos;
  },
});

export const getpublicvideos = query({
  handler: async (ctx) => {
    const videos = await ctx.db.query('videos').withIndex('by_public', (q) => q.eq('public', true)).collect();
    return videos;
  }
})

export const getusersvideo = query({
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) return null;
    const videos = await ctx.db.query("videos").withIndex("by_user", (q) => q.eq("userId", user.subject)).collect();
    return videos;
  }
})
export const makepublic = mutation({
  args: {
    videoId: v.id('videos')
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw Error('video not found')
    }
    const newStatus = !video.public;
    await ctx.db.patch(args.videoId, {
      public: newStatus,
    })
    return newStatus;
  }
})

export const getvideobyId = query({
  args: {
    videoId: v.id("videos"),
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);

    return video;
  },
});
export const fetchfoldervideos = query({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const videos = await ctx.db
      .query("videos")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();

    return videos;
  },
});
export const deletevideo = mutation({
  args: {
    videoId: v.id("videos"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw Error('not authenticated')
    }
    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw Error("Video not found");
    }
    if (video.status === 'failed' || video.templateId) {
      await ctx.db.delete(args.videoId);
    }
    if (video.status === 'ready') {
      await ctx.db.patch(args.videoId, {
        folderId: undefined,
        public: true
      })
    }
    const usage = await ctx.db.query('usageTracking').withIndex('by_user', (q) => q.eq('userId', user.subject)).first();
    if (!usage || !usage.totalVideosGenerated) return null;
    if (usage.totalVideosGenerated > 0) {
      const newCount = Math.max(0, usage.totalVideosGenerated - 1);
      await ctx.db.patch(usage._id, {
        totalVideosGenerated: newCount,
        updatedAt: Date.now(),
      })
    }

  },
});
export const movevideo = mutation({
  args: {
    videoId: v.id('videos'),
    folderId: v.id('folders')
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw Error('video not found')
    }
    await ctx.db.patch(args.videoId, {
      folderId: args.folderId
    })
  }
})
export const retryvideo = mutation({
  args: {
    videoId: v.id('videos')
  },
  handler: async (ctx, args) => {
    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw Error('video not found')
    }
    await ctx.db.patch(args.videoId, {
      status: 'generating'
    })
    if (!video.prompt) {
      throw Error('video prompt not found')
    }
    await ctx.scheduler.runAfter(0, api.videos.triggerVideoGeneration, {
      videoId: args.videoId,
      prompt: video.prompt,
      context: '',
      userId: video.userId || undefined
    })
  }
})

// Schema for the enhanced prompt
const enhancedPromptSchema = z.object({
  structuredPrompt: z.string().describe("The fully structured, detailed prompt for video generation"),
  estimatedDuration: z.string().describe("Estimated video duration, e.g., '2 minutes'"),
  isAlreadyStructured: z.boolean().describe("True if the original prompt was already well-structured and didn't need major changes"),
});

// The Prompt Director system prompt - Creates detailed scripts for the Code Writer
const PROMPT_DIRECTOR_SYSTEM = `You are the Video Script Director. Your job is to transform user video requests into DETAILED PRODUCTION SCRIPTS that a code writer can directly translate into Manim code.

## YOUR ROLE
You are the "brain" that decides WHAT happens visually. The code writer only translates your script to code - they don't think, they just implement. So your script must be EXTREMELY SPECIFIC.

## CRITICAL RULES

### Rule 0: NEVER Suggest Custom Backgrounds
- The background MUST remain BLACK (default)
- Do NOT write "use gradient background" or "dark blue background"
- ❌ FORBIDDEN: "Use a gradient background transitioning from dark blue to light blue"
- ✅ CORRECT: Just don't mention backgrounds at all. Black is the default.

### Rule 0B: NEVER Suggest Gradient Colors on Shapes
- Manim does NOT support gradients reliably
- ❌ FORBIDDEN: "Use a gradient from red to blue on the rectangle"
- ❌ FORBIDDEN: "Color the magnet with a gradient"
- ✅ CORRECT: For a bar magnet, say "Draw two rectangles side by side: left one RED (North), right one BLUE (South)"

### Rule 1: Don't Over-Engineer Already Good Prompts
If the user's prompt is ALREADY well-structured with duration, numbered sections, and specific animations, set isAlreadyStructured=true and return with minimal changes.

### Rule 2: Use the Context
The context may contain web search results or PDF excerpts. Use this for factual accuracy. If the context mentions specific formulas, dates, or facts, include them in the script.

### Rule 3: Be EXTREMELY Specific in Visual Instructions
Bad: "Show a neural network"
Good: "Draw 3 circles (BLUE) on the left for input layer, 4 circles (YELLOW) in the middle for hidden layer, 2 circles (RED) on the right for output layer. Connect all nodes with gray lines. Scale the entire group to fit width 12."

### Rule 4: Text Must Never Overflow
For ANY text longer than 5 words, you MUST include: "scale this text to fit width 11" or "use scale_to_fit_width(11)"

## VIDEO LENGTH GUIDELINES (Choose based on topic complexity)

| Topic Type | Duration | Sections |
|------------|----------|----------|
| Simple concept (one idea) | 30-60 seconds | 2-3 sections |
| Medium concept (few related ideas) | 1-3 minutes | 4-5 sections |
| Complex concept (many parts, formulas) | 3-6 minutes | 6-8 sections |
| Deep dive / Tutorial | 5-10 minutes | 8-12 sections |

## CONTENT TYPE TEMPLATES

### For MATHEMATICAL concepts:
- Show the formula first, then break it down term by term
- Use color highlights on specific terms as you explain them
- Animate the calculation step by step
- Example: "Show formula Y = mx + b. Highlight 'm' in YELLOW and explain slope. Then highlight 'b' in GREEN and explain intercept."

### For SCIENTIFIC processes:
- Use diagrams with labeled parts (use Braces for labels)
- Animate the process with arrows showing flow
- Show cause-and-effect relationships
- Example: "Draw a plant cell. Use a BRACE on the left to label 'Chloroplast'. Animate yellow dots (sunlight) entering, green dots (glucose) exiting."

### For TECHNICAL systems:
- Show architecture diagrams with boxes and arrows
- Zoom into specific components to explain details
- IMPORTANT: Fade out labels BEFORE showing internal details to prevent overlap
- Example: "Draw 3 boxes: Client, Server, Database. When zooming into Server, FIRST fade out the 'Server' label, THEN show internal components."

### For ABSTRACT concepts:
- Use metaphors and visual analogies
- Animate transformations to show relationships
- Example: "To explain 'Gradient Descent', show a ball rolling down a hill toward the lowest point."

## NARRATION STYLE GUIDELINES

| Audience | Style | Pace | Vocabulary |
|----------|-------|------|------------|
| Beginners | Friendly, encouraging | Slow | Simple words, define jargon |
| Students | Educational, clear | Medium | Some technical terms, explained |
| Professionals | Concise, technical | Medium-fast | Assume familiarity |

## OUTPUT FORMAT - THE PRODUCTION SCRIPT

Create a [DURATION] video explaining "[TOPIC]".

TARGET AUDIENCE: [Who this is for]

---

SCENE 1: INTRO ([exact time, e.g., 0:00-0:20])

VISUALS:
- Create title text "[Title]" in WHITE, position at TOP CENTER
- Create subtitle "[Subtitle]" in GRAY below title, scale to fit width 10
- [Any hook visual: simple diagram, icon, etc.]

ANIMATIONS:
- Write title over 2 seconds
- Fade in subtitle over 1 second
- Wait 1 second

NARRATION: "[Exact narration text for this scene]"

TRANSITIONS:
- Fade out all elements

---

SCENE 2: [SECTION NAME] ([time range])

VISUALS:
- Draw [specific shape] at position [LEFT/CENTER/RIGHT]
- Color: [specific color like BLUE, YELLOW, not gradients]
- Size: [dimensions or "scale to fit width X"]
- Labels: Use BRACE on [side] to label "[text]"

ANIMATIONS:
- Create [element] over [X] seconds
- Transform [A] into [B]
- Move [element] to [position]
- Highlight [part] in [COLOR]

NARRATION: "[Exact narration text]"

TEXT SAFETY:
- If any text is > 5 words: "Apply scale_to_fit_width(11)"

TRANSITIONS:
- [How to exit this scene]

---

[Continue for all sections...]

---

SCENE N: CONCLUSION ([time])

VISUALS:
- Summary points as bullet list, LEFT aligned
- Each bullet scaled to fit

ANIMATIONS:
- Write each point sequentially

NARRATION: "[Closing narration]"

FINAL:
- Fade out all
- End card: "[Final message]"

---

MANIM SAFETY CHECKLIST (Include at end):
[ ] All long text has scale_to_fit_width(11)
[ ] No custom background colors (BLACK only)
[ ] Labels faded out before internal details shown
[ ] All diagrams grouped and scaled to fit
[ ] Braces used for labeling components
[ ] VGroup used for multi-line text
`;

export const schedulevideogeneration = mutation({
  args: {
    folderId: v.id("folders"),
    prompt: v.string(),
    context: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw Error("Not authenticated");
    }

    console.log("=== SCHEDULING VIDEO GENERATION ===");
    console.log("Original prompt:", args.prompt);
    console.log("Context length:", args.context.length);

    const prompt = args.prompt + "\n\n" + args.context;
    // Create the video entry first (in "generating" state)
    const videoId = await ctx.db.insert("videos", {
      userId: user.subject,
      folderId: args.folderId,
      status: "generating",
      prompt: prompt, // Store original prompt
      public: false,
      creatorname: user.name,
      creatorprofile: user.pictureUrl
    });
    console.log("Created video entry:", videoId);

    // Schedule the action which will enhance the prompt and trigger generation
    // Note: Can't use AI (fetch) in mutations, so enhancement happens in the action
    await ctx.scheduler.runAfter(0, api.videos.triggerVideoGeneration, {
      videoId: videoId,
      prompt: args.prompt,
      context: args.context,
      userId: user.subject
    });

    return videoId;
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
      creatorprofile: user.pictureUrl
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

// Action that enhances the prompt and triggers video generation
export const enhanceAndTriggerVideo = action({
  args: {
    videoId: v.id("videos"),
    prompt: v.string(),
    context: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("=== PROMPT ENHANCEMENT ACTION ===");

    // Enhance the prompt using AI
    let enhancedPrompt = args.prompt;

    try {
      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: enhancedPromptSchema,
        system: PROMPT_DIRECTOR_SYSTEM,
        prompt: `
## USER'S VIDEO REQUEST:
${args.prompt}

## CONTEXT (Web search results, PDF excerpts, etc.):
${args.context || "No additional context provided."}

## YOUR TASK:
Transform the above request into a detailed, structured video prompt.
If the request is already well-structured, set isAlreadyStructured=true and make minimal changes.
`,
      });

      enhancedPrompt = object.structuredPrompt;

      console.log("=== PROMPT ENHANCEMENT RESULT ===");
      console.log("Already structured:", object.isAlreadyStructured);
      console.log("Estimated duration:", object.estimatedDuration);
      console.log("Enhanced prompt preview:", enhancedPrompt.substring(0, 300) + "...");

    } catch (error) {
      // If enhancement fails, use the original prompt with context
      console.error("Prompt enhancement failed, using original:", error);
      enhancedPrompt = args.prompt + "\n\nContext:\n" + args.context;
    }

    // Now trigger the actual video generation with enhanced prompt
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
      console.log("Triggering video generation task on Trigger.dev...");

      const response = await fetch("https://api.trigger.dev/api/v1/tasks/generate-video/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${TRIGGER_SECRET_KEY}`,
        },
        body: JSON.stringify({
          payload: {
            videoId: args.videoId,
            prompt: enhancedPrompt,
            context: args.context,
            userId: args.userId
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

// Note: triggerVideoGeneration is now deprecated - use enhanceAndTriggerVideo instead
// Keeping it for backward compatibility with retry functionality

// Action to trigger the Trigger.dev task
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
      console.log("Triggering video generation task on Trigger.dev...");

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
            userId: args.userId
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



export const getRecentVideos = query({
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) return [];

    // Fetch last 5 videos created by user
    return await ctx.db
      .query("videos")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .order("desc")
      .take(5);
  },
});

export const replaceOldDomains = mutation({
  args: {},
  handler: async (ctx) => {
    const oldDomain = "https://pub-ea88a79c86c64be79203c8b58477289d.r2.dev";
    const newDomain = "https://videos.foldex.space";

    const videos = await ctx.db.query("videos").collect();

    let updatedCount = 0;

    // Loop through them and fix the URL
    for (const video of videos) {
      // Check if the video has a URL and if it contains the old domain
      if (video.url && video.url.startsWith(oldDomain)) {

        // Create the new URL by replacing the old part
        const newUrl = video.url.replace(oldDomain, newDomain);

        // Update the record in the database
        await ctx.db.patch(video._id, {
          url: newUrl,
        });

        updatedCount++;
      }
      if (video.thumbnail && video.thumbnail.startsWith(oldDomain)) {
        const newThumbnail = video.thumbnail.replace(oldDomain, newDomain);
        await ctx.db.patch(video._id, {
          thumbnail: newThumbnail,
        });
        updatedCount++;
      }
    }

    return `Success! Updated ${updatedCount} videos and thumbnails to the new domain.`;
  },
});

async function getDailyFreeVideoIds(db: DatabaseReader): Promise<Id<"videos">[]> {
  const allPublic = await db
    .query("videos")
    .withIndex("by_public", (q) => q.eq("public", true))
    .filter((q) => q.eq(q.field("status"), "ready"))
    .collect();

  if (allPublic.length <= 5) {
    return allPublic.map((v) => v._id);
  }

  // Use date as seed for consistent daily rotation
  const today = new Date();
  const seed =
    today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

  // Simple seeded shuffle
  const shuffled = [...allPublic].sort((a, b) => {
    const hashA = (seed * a._creationTime) % 1000;
    const hashB = (seed * b._creationTime) % 1000;
    return hashA - hashB;
  });

  return shuffled.slice(0, 5).map((v) => v._id);
}

export const getDailyFreeVideos = query({
  args: {},
  handler: async (ctx) => {
    return await getDailyFreeVideoIds(ctx.db);
  },
});

// 3️⃣ Check if video is free (Calls helper directly)
export const isVideoFreeToday = query({
  args: { videoId: v.id("videos") },
  handler: async (ctx, args) => {
    // FIX: Call the helper function, NOT ctx.runQuery
    const freeIds = await getDailyFreeVideoIds(ctx.db);
    return freeIds.includes(args.videoId);
  },
});

// 4️⃣ Get public videos with lock status (Calls helper directly)
export const getPublicVideosWithAccess = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();

    const videos = await ctx.db
      .query("videos")
      .withIndex("by_public", (q) => q.eq("public", true))
      .filter((q) => q.eq(q.field("status"), "ready"))
      .order("desc")
      .collect();

    // Pro users or video owners get full access
    if (user) {
      const subscription = await ctx.runQuery(api.subscriptions.getSubscription);
      if (subscription?.tier === "pro") {
        return videos.map((v) => ({ ...v, isLocked: false, isFreeToday: false }));
      }
    }

    // FIX: Call the helper function, NOT ctx.runQuery
    const freeIds = await getDailyFreeVideoIds(ctx.db);

    return videos.map((v) => ({
      ...v,
      isLocked: !freeIds.includes(v._id),
      isFreeToday: freeIds.includes(v._id),
    }));
  },
});

export const claimvideos = mutation({
  args: {
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw Error('not authenticated')
    }
    const videos = await ctx.db.query('videos').withIndex('by_user', (q) => q.eq('userId', user.subject)).filter((q) => q.eq(q.field("folderId"), undefined)).collect();

    let targetFolderId: Id<"folders">;

    // If folderId provided, verify it exists and belongs to user
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.userId !== user.subject) {
        throw new Error("Folder not found or access denied");
      }
      targetFolderId = args.folderId;
    } else {
      // Create "Your Videos" folder for new users
      const newFolderId = await ctx.runMutation(api.folders.createFolder, {
        name: "Your Videos",
      });
      targetFolderId = newFolderId;
    }

    // Claim all videos
    for (const video of videos) {
      await ctx.db.patch(video._id, {
        userId: user.subject,
        folderId: targetFolderId,
        creatorname: user.name,
        creatorprofile: user.pictureUrl
      })
    }

    return {
      success: true,
      folderId: targetFolderId,
      videoCount: videos.length
    };
  }
})

export const haveunclaimedvideos = query({
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity()
    if (!user) {
      return null;
    }

    const videos = await ctx.db.query('videos')
      .withIndex('by_user_and_folder', (q) =>
        q.eq('userId', user.subject).eq("folderId", undefined)
      )
      .collect();
    return {
      hasUnclaimed: videos.length > 0,
      count: videos.length
    }
  }
})

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
        // THE FIX: Are they just adding/updating tags to an existing vote?
        if (args.tags) {
          await ctx.db.patch(existingFeedback._id, {
            tags: args.tags,
            comment: args.comment,
          });
          // Note: Deltas stay 0 because the vote type didn't change!
        } else {
          // SCENARIO 3: Real Toggle off (clicking the button again without tags)
          await ctx.db.delete(existingFeedback._id);
          if (args.type === "like") likesDelta = -1;
          if (args.type === "dislike") dislikesDelta = -1;
        }
      } else {
        // SCENARIO 2: Switching vote (Like -> Dislike)
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
      // SCENARIO 1: Voting for the first time
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

    // Update the counters
    if (likesDelta !== 0 || dislikesDelta !== 0) {
      await ctx.db.patch(args.videoId, {
        likes: (video.likes || 0) + likesDelta,
        dislikes: (video.dislikes || 0) + dislikesDelta,
      });
    }

    return { success: true };
  },
});
