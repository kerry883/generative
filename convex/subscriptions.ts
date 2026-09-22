import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";


// Free tier limits
const FREE_LIMITS = {
  DAILY_TOKENS: 100000, // 100k tokens per day
  TOTAL_FILE_UPLOADS: 5, // 5 PDF uploads total
  DAILY_FLASHCARDS: 10, // 10 AI-generated flashcards per day
  TOTAL_VIDEO: 5, // 5 videos total  
  DAILY_TRANSCRIPTIONS: 1, // 1 transcription per day 
};

// Pro tier limits (generous but not truly unlimited to prevent abuse)
const PRO_LIMITS = {
  DAILY_TOKENS: 1000000, // 2M tokens per day (~100 long conversations)
  DAILY_VIDEOS: 10, // 10 videos per day
  DAILY_TRANSCRIPTIONS: 20, // 20 transcriptions per day
  // File uploads and flashcards are truly unlimited for Pro
};

// Get or create user subscription
// export const CreateSubscription = mutation({
//   args: {},
//   handler: async (ctx) => {
//     const user = await ctx.auth.getUserIdentity();
//     if (!user) {
//       throw new Error("Not authenticated");
//     }

//     let subscription = await ctx.db
//       .query("subscriptions")
//       .withIndex("by_user", (q) => q.eq("userId", user.subject))
//       .first();

//     if (!subscription) {
//       // Create default free subscription
//       const now = Date.now();
//       const subscriptionId = await ctx.db.insert("subscriptions", {
//         userId: user.subject,
//         tier: "free",
//         updatedAt: now,
//       });
//       subscription = await ctx.db.get(subscriptionId);
//     }

//     return subscription;
//   },
// });

// export const getSubscription = query({
//   args:{},
//   handler:async (ctx)=>{
//     const user = await ctx.auth.getUserIdentity();
//     if(!user){
//       throw new Error('not authenticated')
//     }
//     try{
//     const subscription = await polar.getCurrentSubscription(ctx,{userId:user.subject});

//     return {
//       ...subscription,
//       isFree:!subscription,
//       isPro:subscription?.productKey === 'foldex_pro'
//     }
//     }catch(e){
//       console.log("polar error ",e)
//       return { isFree: true, isPro: false, error: "Billing service unavailable" };
      
//     }

//   }
// })
export const getSubscription = query({
  handler:async(ctx)=>{
    const user = await ctx.auth.getUserIdentity();
    if(!user) return null;
    const subscription = await ctx.db.query('subscriptions').withIndex('by_user',(q)=>q.eq('userId',user.subject)).first();
    return subscription;
  }
})

// Get or create usage tracking
export const getOrCreateUsageTracking = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Not authenticated");
    }

    let usage = await ctx.db
      .query("usageTracking")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .first();

    if (!usage) {
      // Create default usage tracking
      const now = Date.now();
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const usageId = await ctx.db.insert("usageTracking", {
        userId: user.subject,
        dailyAiTokens: 0,
        dailyFlashcardsGenerated: 0,
        lastResetDate: today,
        totalFilesUploaded: 0,
        updatedAt: now,
      });
      usage = await ctx.db.get(usageId);
    }

    // Reset daily limits if it's a new day
    const today = new Date().toISOString().split("T")[0];
    if (usage && usage.lastResetDate !== today) {
      await ctx.db.patch(usage._id, {
        dailyAiTokens: 0,
        dailyFlashcardsGenerated: 0,
        lastResetDate: today,
        updatedAt: Date.now(),
      });
      usage = await ctx.db.get(usage._id);
    }

    return usage;
  },
});

const getNextResetTime = () => {
  const now = new Date();
  const utcNow = new Date(now.toISOString());
  
  // Set to 24:00:00.000 UTC (Which is 00:00:00 the next day)
  utcNow.setUTCHours(24, 0, 0, 0);
  
  return utcNow.getTime();
};

// // Check if user can perform AI chat
export const canUseAiChat = query({
  args:{},
  handler: async (ctx)=>{
    const user = await ctx.auth.getUserIdentity();
    if(!user){
      return null
    } 
    const subscription = await ctx.db.query('subscriptions').withIndex('by_user',(q)=>q.eq('userId',user.subject)).first();
    const isPro = subscription?.tier === 'pro';
    
    const remaining = await ctx.db.query('usageTracking').withIndex('by_user',(q)=>q.eq('userId',user.subject)).first();
    const aiTokens = remaining?.dailyAiTokens || 0;
    
    // Check limits based on tier
    const limit = isPro ? PRO_LIMITS.DAILY_TOKENS : FREE_LIMITS.DAILY_TOKENS;
    
    if(aiTokens >= limit){
      return {
        allowed: false,
        reason: isPro ? "pro_limit_reached" : "free_limit_reached",
        aiTokens: aiTokens,
        aiTokensLimit: limit,
        nextResetTime: getNextResetTime(),
        isPro: isPro,
      }
    }
    return {
      allowed: true,
      reason: null,
      isPro: isPro,
    }  
  }
})

 // Check if user can upload files
export const canUploadFile = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if(!user){
      return null
    } 
    const status = await ctx.runQuery(api.subscriptions.getSubscription);
    // Pro users have unlimited file uploads
    if(status?.tier === 'pro'){
      return {
        allowed: true,
        reason: null
      }
    }
    const remaining = await ctx.db.query('usageTracking').withIndex('by_user',(q)=>q.eq('userId',user.subject)).first();
    const filesUploaded = remaining?.totalFilesUploaded || 0;
    if(filesUploaded >= FREE_LIMITS.TOTAL_FILE_UPLOADS){
      return {
        allowed: false,
        reason: "free_limit_reached",
        filesUploaded: filesUploaded,
        filesLimit: FREE_LIMITS.TOTAL_FILE_UPLOADS
      }
    }
    return {
      allowed: true,
      reason: null
    }   
  },
});
export const canDownloadVideo = query({
  handler:async (ctx)=>{
    const subscription = await ctx.runQuery(api.subscriptions.getSubscription);
    if(subscription?.tier === 'pro'){
      return {
        allowed:true,
        reason:null
      }
    }

    return {
      allowed: false,
      reason: "pro_only_feature",
    };
  }
})
export const canUseProModels = query({
  handler:async (ctx)=>{
    const subscription = await ctx.runQuery(api.subscriptions.getSubscription);
    if(subscription?.tier === 'pro'){
      return {
        allowed:true,
        reason:null
      }
    }

    return {
      allowed: false,
      reason: "pro_only_feature",
    };
  }
})
// // Check if user can generate flashcards
export const canGenerateFlashcard = query({
  args: {count:v.optional(v.number())},
  handler:async (ctx,args) => {
   const user = await ctx.auth.getUserIdentity();
    if (!user) return null;

    const subscription = await ctx.runQuery(api.subscriptions.getSubscription);
    
    // Pro users are unlimited for flashcards
    if (subscription?.tier === 'pro') {
      return { allowed: true, reason: null };
    }

    // Free users check
    const countNeeded = args.count || 1;
    const usage = await ctx.db
      .query("usageTracking")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .first();

    const currentUsage = usage?.dailyFlashcardsGenerated || 0;
    
    // Check if adding the new cards exceeds the limit
    if (currentUsage + countNeeded > FREE_LIMITS.DAILY_FLASHCARDS) {
      const remaining = Math.max(0, FREE_LIMITS.DAILY_FLASHCARDS - currentUsage);
      return {
        allowed: false,
        reason: `Daily limit reached. You have ${remaining} generations left today.`,
        flashcardsGenerated: currentUsage,
        flashcardsLimit: FREE_LIMITS.DAILY_FLASHCARDS,
      };
    }

    return { allowed: true, reason: null };
  
  },
});

// Check if user can use chat with PDF
export const canUseChatWithPDF = query({
  args: {},
  handler: async (ctx) => { 
    const subscription = await ctx.runQuery(api.subscriptions.getSubscription);
    if(subscription?.tier === 'pro'){
      return {
        allowed:true,
        reason:null
      }
    }

    return {
      allowed: false,
      reason: "pro_only_feature",
    };
  },
});
export const canUseAIGrading = query({
  args: {},
  handler: async (ctx) => { 
    const subscription = await ctx.runQuery(api.subscriptions.getSubscription);
    if(subscription?.tier === 'pro'){
      return {
        allowed:true,
        reason:null
      }
    }

    return {
      allowed: false,
      reason: "pro_only_feature",
    };
  },
});

export const canGenerateVideo = query({
  args:{},
  handler:async (ctx)=>{
    const user = await ctx.auth.getUserIdentity();
    if(!user){
      return null;
    } 
    const status = await ctx.runQuery(api.subscriptions.getSubscription);
    if(status?.tier === 'pro'){
      return {
        allowed:true,
        reason:null
      }
    }
    const remaining = await ctx.db.query('usageTracking').withIndex('by_user',(q)=>q.eq('userId',user.subject)).first();
    const videosGenerated = remaining?.totalVideosGenerated || 0;
    if(videosGenerated >= FREE_LIMITS.TOTAL_VIDEO){
      return {
        allowed:false,
        reason:"free_limit_reached",
        videosGenerated:videosGenerated,
        videosLimit:FREE_LIMITS.TOTAL_VIDEO
      }
    }
    return { allowed: true, reason: null, isPro: false }   
  }
})
export const canTranscribe = query({
  handler: async (ctx): Promise<{
    allowed: boolean;
    reason: string | null;
    transcriptionsGenerated?: number;
    transcriptionsLimit?: number;
    nextResetTime?: number;
    isPro?: boolean;
  } | null> => {
    const user = await ctx.auth.getUserIdentity();
    if(!user) return null;
    
    const subscription = await ctx.db.query('subscriptions').withIndex('by_user',(q)=>q.eq('userId',user.subject)).first();
    const isPro: boolean = subscription?.tier === 'pro';
    
    const remaining = await ctx.db.query('usageTracking').withIndex('by_user',(q)=>q.eq('userId',user.subject)).first();
    const transcriptions = remaining?.dailyTranscriptionsGenerated || 0;
    
    // Check limits based on tier
    const limit = isPro ? PRO_LIMITS.DAILY_TRANSCRIPTIONS : FREE_LIMITS.DAILY_TRANSCRIPTIONS;
    
    if(transcriptions >= limit){
      return {
        allowed: false,
        reason: isPro ? "pro_limit_reached" : "free_limit_reached",
        transcriptionsGenerated: transcriptions,
        transcriptionsLimit: limit,
        nextResetTime: getNextResetTime(),
        isPro: isPro,
      }
    }
    return {
      allowed: true,
      reason: null,
      isPro: isPro,
    }
  }
})

// Track AI token usage
export const trackAiTokenUsage = mutation({
  args: { tokens: v.number() },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Not authenticated");
    }

    let usage = await ctx.db
      .query("usageTracking")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .first();

    if (!usage) {
      // Create if doesn't exist
      const now = Date.now();
      const today = new Date().toISOString().split("T")[0];
      await ctx.db.insert("usageTracking", {
        userId: user.subject,
        dailyAiTokens: args.tokens,
        dailyFlashcardsGenerated: 0,
        lastResetDate: today,
        totalFilesUploaded: 0,
        updatedAt: now,
      });
      return;
    }

    // Check if we need to reset daily limits
    const today = new Date().toISOString().split("T")[0];
    if (usage.lastResetDate !== today) {
      await ctx.db.patch(usage._id, {
        dailyAiTokens: args.tokens,
        dailyFlashcardsGenerated: 0,
        lastResetDate: today,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(usage._id, {
        dailyAiTokens: usage.dailyAiTokens + args.tokens,
        updatedAt: Date.now(),
      });
    }
  },
});

// Track file upload
export const trackFileUpload = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Not authenticated");
    }

    let usage = await ctx.db
      .query("usageTracking")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .first();

    if (!usage) {
      const now = Date.now();
      const today = new Date().toISOString().split("T")[0];
      await ctx.db.insert("usageTracking", {
        userId: user.subject,
        dailyAiTokens: 0,
        dailyFlashcardsGenerated: 0,
        lastResetDate: today,
        totalFilesUploaded: 1,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.patch(usage._id, {
      totalFilesUploaded: usage.totalFilesUploaded + 1,
      updatedAt: Date.now(),
    });
  },
});

// Track flashcard generation
export const trackFlashcardGeneration = mutation({
  args: {count:v.number()},
  handler: async (ctx,args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Not authenticated");
    }

    let usage = await ctx.db
      .query("usageTracking")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .first();

    if (!usage) {
      const now = Date.now();
      const today = new Date().toISOString().split("T")[0];
      await ctx.db.insert("usageTracking", {
        userId: user.subject,
        dailyAiTokens: 0,
        dailyFlashcardsGenerated: args.count,
        lastResetDate: today,
        totalFilesUploaded: 0,
        updatedAt: now,
      });
      return;
    }

    // Check if we need to reset daily limits
    const today = new Date().toISOString().split("T")[0];
    if (usage.lastResetDate !== today) {
      await ctx.db.patch(usage._id, {
        dailyAiTokens: 0,
        dailyFlashcardsGenerated: args.count,
        lastResetDate: today,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.patch(usage._id, {
        dailyFlashcardsGenerated: usage.dailyFlashcardsGenerated + args.count,
        updatedAt: Date.now(),
      });
    }
  },
});
export const trackVideoGeneration = mutation({
  args:{userId:v.string()},
  handler: async (ctx,args)=>{
     
    let usage = await ctx.db
      .query("usageTracking")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!usage || !usage.totalVideosGenerated) {
      const now = Date.now();
      const today = new Date().toISOString().split("T")[0];
      await ctx.db.insert("usageTracking", {
        userId: args.userId,
        dailyAiTokens: 0,
        dailyFlashcardsGenerated: 0,
        lastResetDate: today,
        totalFilesUploaded: 0,
        totalVideosGenerated:1,
        dailyTranscriptionsGenerated:0,
        updatedAt: now,
      });
      return;
    }
    await ctx.db.patch(usage._id, {
        totalVideosGenerated: usage.totalVideosGenerated + 1,
      updatedAt: Date.now(),
    });
    
  }
})
export const trackTranscriptionGeneration = mutation({
  handler:async(ctx)=>{
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error('not authenticated ')
    const usage = await ctx.db.query('usageTracking').withIndex('by_user',(q)=>q.eq('userId',user.subject)).first()
    if (!usage || !usage.dailyTranscriptionsGenerated) {
      const now = Date.now();
      const today = new Date().toISOString().split("T")[0];
      await ctx.db.insert("usageTracking", {
        userId: user.subject,
        dailyAiTokens: 0,
        dailyFlashcardsGenerated: 0,
        lastResetDate: today,
        totalFilesUploaded: 0,
        totalVideosGenerated:0,
        dailyTranscriptionsGenerated:1,
        updatedAt: now,
      });
      return;
    }
     const today = new Date().toISOString().split("T")[0];
     if(usage.lastResetDate !== today){
      await ctx.db.patch(usage._id,{
        dailyTranscriptionsGenerated:0,
        lastResetDate:today,
        updatedAt:Date.now(),
      })
     }else{
      await ctx.db.patch(usage._id, {
      dailyTranscriptionsGenerated:usage.dailyTranscriptionsGenerated +1,
      updatedAt: Date.now(),
    });
  }
  }
})
// Helper to update subscription from Polar webhook
// export const updateSubscription = internalMutation({
//   args: {
//     userId: v.string(),
//     polarSubscriptionId: v.string(),
//     polarCustomerId: v.string(),
//     polarProductId: v.string(),
//     status: v.string(),
//     currentPeriodEnd: v.optional(v.number()),
//   },
//   handler: async (ctx, args) => {
//     const subscription = await ctx.db
//       .query("subscriptions")
//       .withIndex("by_user", (q) => q.eq("userId", args.userId))
//       .first();

//     const isPro = args.status === "active" || args.status === "trialing";
//     const tier = isPro ? "pro" : "free";

//     if (subscription) {
//       await ctx.db.patch(subscription._id, {
//         tier,
//         polarSubscriptionId: args.polarSubscriptionId,
//         polarCustomerId: args.polarCustomerId,
//         polarProductId: args.polarProductId,
//         status: args.status,
//         currentPeriodEnd: args.currentPeriodEnd,
//         updatedAt: Date.now(),
//       });
//     } else {
//       const now = Date.now();
//       await ctx.db.insert("subscriptions", {
//         userId: args.userId,
//         tier,
//         polarSubscriptionId: args.polarSubscriptionId,
//         polarCustomerId: args.polarCustomerId,
//         polarProductId: args.polarProductId,
//         status: args.status,
//         currentPeriodEnd: args.currentPeriodEnd,
//         updatedAt: now,
//       });
//     }
//   },
// });
