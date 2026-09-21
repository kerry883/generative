import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

export const getByAuthId = internalQuery({
  args: { authId: v.string() },
  handler: async (ctx, { authId }) => {
    return await ctx.db.query('subscriptions').withIndex('by_user',(q)=>q.eq('userId',authId)).first();
  },
});

export const updateSubscriptionWebhook = internalMutation({
  args: {
    userId: v.string(),
    dodoSubscriptionId: v.string(),
    dodoCustomerId: v.string(),
    status: v.string(),
    tier: v.union(v.literal("free"), v.literal("pro")),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if subscription record already exists
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        status: args.status,
        tier: args.tier,
        dodoSubscriptionId: args.dodoSubscriptionId,
        dodoCustomerId: args.dodoCustomerId,
        currentPeriodEnd: args.currentPeriodEnd,
        updatedAt: Date.now(),
      });
    } else {
      // Create new record
      await ctx.db.insert("subscriptions", {
        userId: args.userId,
        status: args.status,
        tier: args.tier,
        dodoSubscriptionId: args.dodoSubscriptionId,
        dodoCustomerId: args.dodoCustomerId,
        currentPeriodEnd: args.currentPeriodEnd,
        updatedAt: Date.now(),
      });
    }
  },
});

export const getstatus = query({
  args:{},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if(!user){
      return null
    }
    const status = await ctx.db.query('subscriptions').withIndex('by_user',(q)=>q.eq('userId',user.subject)).first();
    return status
  }
})