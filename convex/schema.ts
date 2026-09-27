import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  videos: defineTable({
    userId: v.optional(v.string()),
    guestId: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    transcript: v.optional(v.string()),
    url: v.optional(v.string()),
    filesize: v.optional(v.number()),
    thumbnail: v.optional(v.string()),
    prompt: v.optional(v.string()), // stored for retry
    public: v.optional(v.boolean()),
    status: v.union(v.literal("generating"), v.literal("ready"), v.literal("failed")),
    sources: v.optional(v.array(v.object({
      title: v.string(),
      url: v.string(),
      snippet: v.string(),
    }))),
    creatorname: v.optional(v.string()),
    creatorprofile: v.optional(v.string()),
    code: v.optional(v.string()),
    likes: v.optional(v.number()),
    dislikes: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_public", ["public"])
    .index("by_guest", ["guestId"])
    .index("by_title", ["title"]),

  videofeedback: defineTable({
    videoId: v.id("videos"),
    userId: v.string(),
    type: v.union(v.literal("like"), v.literal("dislike")),
    tags: v.optional(v.array(v.string())),
    comment: v.optional(v.string()),
  })
    .index("by_video", ["videoId"])
    .index("by_user_and_video", ["userId", "videoId"]),
});
