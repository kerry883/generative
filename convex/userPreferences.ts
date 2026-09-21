import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get user's onboarding status
export const getOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) return null;

    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .first();

    if (!preferences) {
      // New user - hasn't completed onboarding
      return {
        hasCompletedOnboarding: false,
        lastOnboardingStep: 0,
      };
    }

    return {
      hasCompletedOnboarding: preferences.hasCompletedOnboarding,
      lastOnboardingStep: preferences.lastOnboardingStep ?? 0,
      onboardingCompletedAt: preferences.onboardingCompletedAt,
    };
  },
});

// Update the current onboarding step (for resume capability)
export const updateOnboardingStep = mutation({
  args: { step: v.number() },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .first();

    if (preferences) {
      await ctx.db.patch(preferences._id, {
        lastOnboardingStep: args.step,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("userPreferences", {
        userId: user.subject,
        hasCompletedOnboarding: false,
        lastOnboardingStep: args.step,
        updatedAt: Date.now(),
      });
    }
  },
});

// Mark onboarding as complete
export const markOnboardingComplete = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .first();

    const now = Date.now();

    if (preferences) {
      await ctx.db.patch(preferences._id, {
        hasCompletedOnboarding: true,
        onboardingCompletedAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userPreferences", {
        userId: user.subject,
        hasCompletedOnboarding: true,
        onboardingCompletedAt: now,
        updatedAt: now,
      });
    }
  },
});

// Reset onboarding (to allow re-watching the tour)
export const resetOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .first();

    if (preferences) {
      await ctx.db.patch(preferences._id, {
        hasCompletedOnboarding: false,
        lastOnboardingStep: 0,
        updatedAt: Date.now(),
      });
    }
  },
});

// ============================================
// CHANGELOG / WHAT'S NEW
// ============================================

// Get user's changelog status (what version have they seen?)
export const getChangelogStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) return null;

    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .first();

    return {
      lastSeenVersion: preferences?.lastSeenChangelogVersion ?? 0,
    };
  },
});

// Mark changelog as seen (update to current version)
export const markChangelogSeen = mutation({
  args: { version: v.number() },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user.subject))
      .first();

    const now = Date.now();

    if (preferences) {
      await ctx.db.patch(preferences._id, {
        lastSeenChangelogVersion: args.version,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userPreferences", {
        userId: user.subject,
        hasCompletedOnboarding: false,
        lastSeenChangelogVersion: args.version,
        updatedAt: now,
      });
    }
  },
});
