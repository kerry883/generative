import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { title } from "process";


export default defineSchema({
  folders:defineTable({
    userId: v.string(),
    name:v.string(),
    description:v.optional(v.string()),
    readme:v.optional(v.string()),
    bannerId:v.optional(v.id("_storage")),
    parentId:v.optional(v.string()),
    isPublic:v.optional(v.boolean()),
    tags:v.optional(v.array(v.string())),
    cloneCount:v.optional(v.number()),
    viewCount:v.optional(v.number()),
    savedCount:v.optional(v.number()),
    templateId:v.optional(v.id("folders")),
    authorname:v.optional(v.string()),
    authorprofile:v.optional(v.string())
  })
  .index("by_user",["userId"])
  .index("by_parent",["parentId"])
  .index("by_public",['isPublic'])
  .searchIndex("search_folder",{
    searchField:'name',
    filterFields:['isPublic']
  }),

  savedFolders:defineTable({
    userId:v.string(),
    folderId:v.id('folders')
  })
  .index("by_user",["userId"])
  .index("by_folder",["folderId"]),

  folderShares:defineTable({
    folderId:v.id('folders'),
    ownerId:v.string(),
    sharedWithEmail:v.string(),
    role:v.union(v.literal("editor"),v.literal("viewer"))
  })
  .index("by_folder",["folderId"])
  .index('by_email',['sharedWithEmail']),

  notes:defineTable({
    userId:v.string(),
    folderId:v.optional(v.id("folders")),
    title:v.string(),
    content:v.optional(v.string()),
    updatedAt:v.number(),
    templateId:v.optional(v.id('notes')),
  })
  .index("by_user",["userId"])
  .index("by_user_and_folder",["userId","folderId"])
  .index("by_folder",["folderId"]),

  files:defineTable({
    userId:v.string(),
    folderId:v.optional(v.id("folders")),
    fileName:v.string(),
    fileType:v.string(),
    storageId:v.id("_storage"),
    templateId:v.optional(v.id('files')),
    entriesId:v.optional(v.string()),
  })
   .index("by_user",["userId"])
   .index("by_user_and_folder",["userId","folderId"])
    .index("by_folder",["folderId"])
    .index("by_storage_id", ["storageId"]),
  
   // flashceards
   flashcards:defineTable({
    userId:v.string(),
    folderId:v.id("folders"),
    question:v.string(),
    answers:v.array(v.object({
      text:v.string(),
      isCorrect:v.boolean()
    })),
    isMultipleChoice:v.boolean(),
    updatedAt:v.number(),
    explanation:v.optional(v.string()),
    templateId:v.optional(v.id('flashcards')),
   }) 
   .index("by_folder",["folderId"]),

   flashcardProgress:defineTable({
    userId:v.string(),
    folderId:v.id("folders"),
    flashcardId:v.id("flashcards"),
    easeFactor:v.number(), // Legacy SM-2 (kept for compatibility)
    intervalDays:v.number(), // Days until next review
    repetitions:v.number(), // Legacy: consecutive correct answers
    nextReviewDate:v.number(), // Next review timestamp
    lastReviewedAt:v.optional(v.number()), // Last review timestamp
    totalReviews:v.number(), // Total reviews count
    correctReviews:v.number(),
    // FSRS Parameters
    difficulty:v.optional(v.number()), // D: 1-10 scale (how hard for this user)
    stability:v.optional(v.number()),  // S: Days until target retention drops
    state:v.optional(v.number()),      // CardState: 0=New, 1=Learning, 2=Review, 3=Relearning
    lapses:v.optional(v.number()),     // Number of "Again" ratings
   })
   .index("by_user_and_folder",["userId","folderId"])
   .index("by_user_flashcard",["userId","flashcardId"]),
   //flashcard reviews
   flashcardReviews:defineTable({
    userId:v.string(),
    flashcardId:v.id("flashcards"),
    folderId:v.id("folders"),
    quality:v.number(), // 0-5rating
    wasCorrect:v.boolean(),
    timeSpendSeconds:v.optional(v.number()),
    easeFactorAfter:v.number(),
    intervalDaysAfter:v.number(),
    reviewedAt:v.number(),
   })
   .index("by_user",["userId"])
   .index("by_flashcard",["flashcardId"]),

   //chat table
   chats:defineTable({
    userId:v.string(),
    title:v.string()
   })
   .index("by_user",["userId"])
   .index("by_title",["title"]),
   
   //messages table
   messages:defineTable({
    chatId:v.id("chats"),
    userId:v.string(),
    role:v.string(),
    content:v.string(),
    parts:v.any()
   })
   .index("by_chat",["chatId"]),

   // Subscriptions table
   subscriptions: defineTable({
    userId: v.string(), // Clerk ID
    status: v.string(), // active, past_due, etc.
    tier: v.union(v.literal("free"), v.literal("pro")),
    dodoSubscriptionId: v.optional(v.string()),
    dodoCustomerId: v.optional(v.string()),
    dodoProductId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
    updatedAt: v.number(),
  })
  .index("by_user", ["userId"])
  .index("by_dodo_subscription", ["dodoSubscriptionId"]),

   // Usage tracking table
   usageTracking:defineTable({
     userId:v.string(),
     // Daily limits (reset at midnight UTC)
     dailyAiTokens:v.number(), // tokens used today
     dailyFlashcardsGenerated:v.number(), // flashcards created today
     lastResetDate:v.string(), // date in YYYY-MM-DD format for daily reset
     totalVideosGenerated:v.optional(v.number()),
     dailyTranscriptionsGenerated:v.optional(v.number()),
     totalFilesUploaded:v.number(), // total PDF uploads
     updatedAt:v.number(),
   })
   .index("by_user",["userId"]),

   videos:defineTable({
    userId:v.optional(v.string()),
    guestId:v.optional(v.string()),
    folderId:v.optional(v.id("folders")),
    title:v.optional(v.string()),
    description:v.optional(v.string()),
    transcript:v.optional(v.string()),
    url:v.optional(v.string()),
    templateId:v.optional(v.id("videos")),
    filesize:v.optional(v.number()),
    thumbnail:v.optional(v.string()),
    prompt:v.optional(v.string()),//for retry 
    public:v.optional(v.boolean()),
    status:v.union(v.literal("generating"),v.literal("ready"),v.literal("failed")),
    sources:v.optional(v.array(v.object({
      title:v.string(),
      url:v.string(),
      snippet:v.string(),
    }))),
   })
   .index("by_user",["userId"])
   .index("by_folder",["folderId"])
   .index("by_public",["public"])
   .index("by_guest",["guestId"]) 
   .index("by_title",["title"]),

   guestlimits:defineTable({
    fingerprint:v.string(),
    date:v.string(),
    videoCount:v.number()
   })
  .index("by_fingerprint",["fingerprint"]),

   feedback: defineTable({
    userId: v.string(),
    type: v.union(v.literal("bug"), v.literal("feature"), v.literal("other")),
    message: v.string(),
    pageUrl: v.optional(v.string()), // Which page were they on?
    browserInfo: v.optional(v.string()), // Chrome/Safari?
    status: v.union(v.literal("new"), v.literal("in-progress"), v.literal("fixed")),
  })
  .index("by_type",["type"]) 
  .index("by_status",["status"]),

  // User preferences for onboarding and settings
  userPreferences: defineTable({
    userId: v.string(),
    hasCompletedOnboarding: v.boolean(),
    onboardingCompletedAt: v.optional(v.number()),
    lastOnboardingStep: v.optional(v.number()), // For resume capability
    lastSeenChangelogVersion: v.optional(v.number()), // Track what's new modal version
    updatedAt: v.number(),
  })
  .index("by_user", ["userId"]),

})
