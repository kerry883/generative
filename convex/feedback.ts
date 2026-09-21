import { v } from "convex/values";
import { mutation, action } from "./_generated/server";
import { api } from "./_generated/api";

// 1. Save to DB
export const saveFeedback = mutation({
  args: {
    type: v.union(v.literal("bug"), v.literal("feature"), v.literal("other")),
    message: v.string(),
    pageUrl: v.string(),
    browserInfo: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    await ctx.db.insert("feedback", {
      userId: user.subject,
      ...args,
      status:"new"
    });

    // Return useful info for the notification
    return { userEmail: user.email, userName: user.name };
  },
});

// 2. The Public Action (Call this from frontend)
export const submitFeedback = action({
  args: {
    type: v.union(v.literal("bug"), v.literal("feature"), v.literal("other")),
    message: v.string(),
    pageUrl: v.string(),
    browserInfo: v.string(),
  },
  handler: async (ctx, args) => {
    // Save to DB first
    const userInfo = await ctx.runMutation(api.feedback.saveFeedback, args);

    // Send to Discord
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `🪲 **New ${args.type.toUpperCase()} Report**`,
          embeds: [
            {
              title: args.message.substring(0, 50) + "...",
              color: args.type === "bug" ? 15158332 : 3066993, // Red for bug, Green for feature
              fields: [
                { name: "User", value: userInfo?.userEmail || "Unknown", inline: true },
                { name: "Page", value: args.pageUrl, inline: true },
                { name: "Message", value: args.message },
              ],
            },
          ],
        }),
      });
    }
  },
});