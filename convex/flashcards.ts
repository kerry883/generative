import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";


export const createFlashcard = mutation({
    args:{
         folderId:v.id("folders"),
         question:v.string(),
            answers:v.array(v.object({
              text:v.string(),
              isCorrect:v.boolean()
            })),
            isMultipleChoice:v.boolean(),
        explanation:v.optional(v.string()),
    },
    handler:async(ctx ,args)=>{
        const identity = await ctx.auth.getUserIdentity();
        if(!identity){
            throw new Error("Not authenticated");
        }
        const flashcardId = await ctx.db.insert("flashcards",{
            userId:identity.subject,
            folderId:args.folderId,
            question:args.question,
            answers:args.answers,
            isMultipleChoice:args.isMultipleChoice,
            explanation:args.explanation,
            updatedAt:Date.now(),
        })
        return flashcardId
    }
})

export const deleteFlashcard = mutation({
    args:{
        flashcardId:v.id("flashcards")
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const flashcard = await ctx.db.get(args.flashcardId);
        if(!flashcard || flashcard.userId !== user.subject){
            throw new Error("Flashcard not found or access denied.");
        }
        const review = await ctx.db.query('flashcardReviews').withIndex('by_flashcard',(q)=>q.eq('flashcardId',args.flashcardId)).collect();
        await Promise.all(review.map((r)=>ctx.db.delete(r._id)));
        const progress = await ctx.db.query('flashcardProgress').withIndex('by_user_flashcard',(q)=>q.eq('userId',user.subject)).collect();
        await Promise.all(progress.map((p)=>ctx.db.delete(p._id)));
        await ctx.db.delete(args.flashcardId);
    }
})

export const updateFlashcard = mutation({
    args:{
        flashcardId:v.id("flashcards"),
        question:v.optional(v.string()),
        answers:v.optional(v.array(v.object({
            text:v.string(),
            isCorrect:v.boolean()
        }))),
        isMultipleChoice:v.optional(v.boolean()),
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const flashcard = await ctx.db.get(args.flashcardId);
        if(!flashcard || flashcard.userId !== user.subject){
            throw new Error("Flashcard not found or access denied.");
        }
        await ctx.db.patch(args.flashcardId, {
            question:args.question,
            answers:args.answers,
            isMultipleChoice:args.isMultipleChoice,
            updatedAt:Date.now(),
        })
    }
})

export const getFlashcard = query({
    args:{
        flashcardId:v.id("flashcards")
    },
    handler:async(ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            return null;
        }
        const flashcard = await ctx.db.get(args.flashcardId);
        if(!flashcard || flashcard.userId !== user.subject){
            return null
        }
        return flashcard
    }
})

export const fetchFlashcards = query({
    args:{
        folderId:v.id("folders")
    },
    handler:async(ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
           return null
        }
        const flashcards = await ctx.db.query("flashcards").withIndex("by_folder",(q)=>q.eq("folderId",args.folderId)).collect();
        return flashcards
    }
})

export const reviewFlashcard = mutation({
    args:{
        flashcardId:v.id("flashcards"),
        rating:v.number(), // FSRS rating: 1=Again, 2=Hard, 3=Good, 4=Easy
        timeSpendSeconds:v.optional(v.number()),
    },
    handler: async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const flashcard = await ctx.db.get(args.flashcardId);
        if(!flashcard || flashcard.userId !== user.subject){
            throw new Error("Flashcard not found or access denied.");
        }
        
        const existingProgress = await ctx.db.query("flashcardProgress")
            .withIndex("by_user_flashcard",(q)=> q.eq("userId",user.subject).eq("flashcardId",args.flashcardId))
            .first();
        
        const rating = Math.max(1, Math.min(4, Math.round(args.rating))) as 1 | 2 | 3 | 4;
        const now = Date.now();
        const wasCorrect = rating >= 2;
        
        // FSRS Constants
        const FSRS_PARAMS = {
            w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
            requestRetention: 0.9,
            maximumInterval: 36500,
        };
        const DECAY = -0.5;
        const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
        
        // Helper functions
        const calculateRetrievability = (stability: number, elapsedDays: number): number => {
            if (stability <= 0) return 0;
            return Math.pow(1 + (FACTOR * elapsedDays) / stability, DECAY);
        };
        
        const calculateInterval = (stability: number): number => {
            if (stability <= 0) return 0;
            const interval = (stability / FACTOR) * (Math.pow(FSRS_PARAMS.requestRetention, 1 / DECAY) - 1);
            return Math.max(1, Math.min(Math.round(interval), FSRS_PARAMS.maximumInterval));
        };
        
        // Get current values or defaults
        let currentDifficulty = existingProgress?.difficulty ?? 5;
        let currentStability = existingProgress?.stability ?? 0;
        let currentState = existingProgress?.state ?? 0; // 0 = New
        let lapses = existingProgress?.lapses ?? 0;
        let reps = existingProgress?.repetitions ?? 0;
        const totalReviews = existingProgress ? existingProgress.totalReviews : 0;
        const correctReviews = existingProgress ? existingProgress.correctReviews : 0;
        
        // Calculate elapsed days since last review
        const lastReview = existingProgress?.lastReviewedAt ?? now;
        const elapsedDays = Math.max(0, (now - lastReview) / (1000 * 60 * 60 * 24));
        
        let newDifficulty: number;
        let newStability: number;
        let newState: number;
        const w = FSRS_PARAMS.w;
        
        // Handle new cards (no stability yet)
        if (currentState === 0 || currentStability === 0) {
            // Initial difficulty: D0(G) = w4 - (G-3) * w5
            newDifficulty = Math.max(1, Math.min(10, w[4] - (rating - 3) * w[5]));
            // Initial stability: S0(G) = w[G-1]
            newStability = Math.max(0.1, w[rating - 1]);
            
            if (rating === 1) {
                newState = 1; // Learning
                lapses++;
            } else {
                newState = 2; // Review
                reps++;
            }
        } else {
            // Calculate retrievability
            const retrievability = calculateRetrievability(currentStability, elapsedDays);
            
            // Update difficulty: D'(D, G) = w7 * D0(3) + (1 - w7) * (D - w6 * (G - 3))
            newDifficulty = w[7] * w[4] + (1 - w[7]) * (currentDifficulty - w[6] * (rating - 3));
            newDifficulty = Math.max(1, Math.min(10, newDifficulty));
            
            if (rating === 1) {
                // Failed - calculate new stability after failure
                newStability = w[11] * Math.pow(currentDifficulty, -w[12]) * 
                    (Math.pow(currentStability + 1, w[13]) - 1) * 
                    Math.exp(w[14] * (1 - retrievability));
                newStability = Math.max(0.1, Math.min(currentStability, newStability));
                newState = 3; // Relearning
                lapses++;
            } else {
                // Success - calculate new stability
                const hardPenalty = rating === 2 ? w[15] : 1;
                const easyBonus = rating === 4 ? w[16] : 1;
                
                newStability = currentStability * (1 + 
                    Math.exp(w[8]) * (11 - currentDifficulty) * 
                    Math.pow(currentStability, -w[9]) * 
                    (Math.exp(w[10] * (1 - retrievability)) - 1) * 
                    hardPenalty * easyBonus);
                newStability = Math.max(0.1, newStability);
                newState = 2; // Review
                reps++;
            }
        }
        
        // Calculate interval
        const interval = rating === 1 ? 0 : calculateInterval(newStability);
        
        // Calculate next review date
        const nextReviewDate = new Date(now);
        nextReviewDate.setDate(nextReviewDate.getDate() + interval);
        nextReviewDate.setHours(0, 0, 0, 0);
        
        // Keep legacy easeFactor for compatibility (approximate from FSRS difficulty)
        const legacyEaseFactor = Number((2.5 - (newDifficulty - 5) * 0.1).toFixed(2));
        
        if(existingProgress){
            await ctx.db.patch(existingProgress._id,{
                easeFactor: legacyEaseFactor,
                intervalDays: interval,
                repetitions: reps,
                nextReviewDate: nextReviewDate.getTime(),
                lastReviewedAt: now,
                totalReviews: totalReviews + 1,
                correctReviews: correctReviews + (wasCorrect ? 1 : 0),
                difficulty: Number(newDifficulty.toFixed(2)),
                stability: Number(newStability.toFixed(2)),
                state: newState,
                lapses: lapses,
            });
        } else {
            await ctx.db.insert('flashcardProgress',{
                userId: user.subject,
                flashcardId: args.flashcardId,
                folderId: flashcard.folderId,
                easeFactor: legacyEaseFactor,
                intervalDays: interval,
                repetitions: reps,
                nextReviewDate: nextReviewDate.getTime(),
                lastReviewedAt: now,
                totalReviews: 1,
                correctReviews: wasCorrect ? 1 : 0,
                difficulty: Number(newDifficulty.toFixed(2)),
                stability: Number(newStability.toFixed(2)),
                state: newState,
                lapses: lapses,
            });
        }
        
        // Record review history
        await ctx.db.insert("flashcardReviews",{
            userId: user.subject,
            flashcardId: args.flashcardId,
            folderId: flashcard.folderId,
            quality: rating,
            timeSpendSeconds: args.timeSpendSeconds,
            wasCorrect: wasCorrect,
            easeFactorAfter: legacyEaseFactor,
            intervalDaysAfter: interval,
            reviewedAt: now,
        });
        
        return {
            easeFactor: legacyEaseFactor,
            intervalDays: interval,
            repetitions: reps,
            nextReviewDate: nextReviewDate.getTime(),
            difficulty: Number(newDifficulty.toFixed(2)),
            stability: Number(newStability.toFixed(2)),
            state: newState,
        };
    }
})

export const fetchflashcarddue = query({
    args:{
        folderId:v.id("folders"),
        limit:v.optional(v.number())
    },
    handler: async(ctx ,args)=>{
     const user = await ctx.auth.getUserIdentity();
     const limit = args.limit || 50;
     if(!user){
        return null;
     }

     const cards = await ctx.db.query('flashcards').withIndex('by_folder',(q)=>q.eq("folderId",args.folderId)).collect();

     const progressList = await ctx.db.query('flashcardProgress').withIndex('by_user_and_folder',(q)=>q.eq("userId",user?.subject).eq("folderId",args.folderId)).collect();
     
    const progressMap = new Map()
    progressList.forEach((p)=>progressMap.set(p.flashcardId,p));
    const now = Date.now();
    const dueCards = [];
    for(const card of cards){
        const progress = progressMap.get(card._id);

        if(!progress){
            dueCards.push({
                ...card,
                status:"new",
                reps:0,
                interval:0,
                ease:2.5,
            })
        }else if (progress.nextReviewDate <= now){
          dueCards.push({
            ...card,
            status:"due",
            reps:progress.repetitions,
            interval:progress.intervalDays,
            ease:progress.easeFactor,

          })
        }
    }
    return dueCards.slice(0,limit);

    }
})

export const fetchStudyStats = query({
    args:{
        folderId:v.id("folders"),
    },
    handler: async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            return null;
        }
        
        const flashcards = await ctx.db.query('flashcardProgress').withIndex("by_user_and_folder",(q)=>q.eq("userId",user.subject).eq("folderId",args.folderId)).collect()

        
        
        const now = new Date();
        const weekFromnow = new Date();
        weekFromnow.setDate(weekFromnow.getDate()+7);

        const  totalCards = flashcards.length;
        const dueToday = flashcards.filter(f=> new Date(f.nextReviewDate)<= now).length;
        const duethisweek = flashcards.filter(f=> new Date(f.nextReviewDate)<= weekFromnow).length;
        const masteredCards = flashcards.filter(f=>f.repetitions >= 3 && f.easeFactor >= 2.5).length;
        const newcards = flashcards.filter(f=>f.totalReviews === 0).length;
        const averageEase = flashcards.reduce((sum,f)=>sum + (f.easeFactor || 2.5),0)/flashcards.length;
        const totalReviews = flashcards.reduce((sum,f)=>sum + (f.totalReviews || 0),0);
        const successRate = flashcards.reduce((sum,f)=>sum + (f.totalReviews || 0),0)>0
        ? (flashcards.reduce((sum,f)=>sum + (f.correctReviews||0 ),0))/ flashcards.reduce((sum,f)=>sum + (f.totalReviews || 0),0)*100
        :0;
        return {
            totalCards,
            dueToday,
            duethisweek,
            masteredCards,
            newcards,
            averageEase,
            totalReviews,
            successRate,
        }
    }
})

export const fetchFlashcardProgress = query({
    args:{
        flashcardId:v.id("flashcards"),
    },
    handler: async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            return null;
        }
        const progress = await ctx.db.query('flashcardProgress').withIndex("by_user_flashcard",(q)=>q.eq("userId",user.subject).eq("flashcardId",args.flashcardId)).first();
        return progress;
    }
})


export const saveAiFlashcards = mutation({
  args: {
    folderId: v.id("folders"),
    flashcards: v.array(
      v.object({
        question: v.string(),
        answers: v.array(
          v.object({ text: v.string(), isCorrect: v.boolean() })
        ),
        explanation: v.string(),
      })
    ),
    isMultipleChoice: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");
    const count = args.flashcards.length;
    // 1. Final Limit Check (Security)
    // We check "canGenerate" again to prevent someone manually calling this mutation to bypass limits
    const canGen = await ctx.runQuery(api.subscriptions.canGenerateFlashcard,{count:count});
    if (canGen && !canGen.allowed) {
      throw new Error(canGen.reason || "Limit reached");
    }

    // 2. Batch Insert Flashcards
    const promises = args.flashcards.map((card) =>
      ctx.db.insert("flashcards", {
        userId: user.subject,
        folderId: args.folderId,
        question: card.question,
        answers: card.answers,
        isMultipleChoice: args.isMultipleChoice,
        explanation: card.explanation, // Store the AI explanation!
        updatedAt: Date.now(),
      })
    );

    await Promise.all(promises);

   await ctx.runMutation(api.subscriptions.trackFlashcardGeneration,{count:count})
  },
});

// Get folders with overdue flashcards (for sidebar indicators)
export const getOverdueFolders = query({
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) return {};
    
    const now = Date.now();
    
    // Get all progress records for this user where nextReviewDate is past
    const allProgress = await ctx.db
      .query("flashcardProgress")
      .withIndex("by_user_and_folder", (q) => q.eq("userId", user.subject))
      .collect();
    
    // Count overdue cards per folder
    const overdueMap: Record<string, number> = {};
    
    for (const progress of allProgress) {
      if (progress.nextReviewDate <= now) {
        const folderId = progress.folderId;
        overdueMap[folderId] = (overdueMap[folderId] || 0) + 1;
      }
    }
    
    return overdueMap;
  },
});

// Get overdue flashcards for a specific folder (for expanded sidebar view)
export const getOverdueFlashcards = query({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) return [];
    
    const now = Date.now();
    
    // Get all flashcards in this folder
    const flashcards = await ctx.db
      .query("flashcards")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
      .collect();
    
    // Get progress for each flashcard
    const progressList = await ctx.db
      .query("flashcardProgress")
      .withIndex("by_user_and_folder", (q) => 
        q.eq("userId", user.subject).eq("folderId", args.folderId)
      )
      .collect();
    
    const progressMap = new Map();
    progressList.forEach((p) => progressMap.set(p.flashcardId, p));
    
    // Return flashcards that are overdue or new (never reviewed)
    const overdueFlashcards: string[] = [];
    
    for (const card of flashcards) {
      const progress = progressMap.get(card._id);
      
      if (!progress) {
        // New card - considered "due"
        overdueFlashcards.push(card._id);
      } else if (progress.nextReviewDate <= now) {
        // Overdue card
        overdueFlashcards.push(card._id);
      }
    }
    
    return overdueFlashcards;
  },
});