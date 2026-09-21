import { createDodoWebhookHandler } from "@dodopayments/convex";
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/dodopayments-webhook",
  method: "POST",
  handler: createDodoWebhookHandler({
    onSubscriptionActive: async (ctx, payload) => {
      console.log(" Subscription Activated!");
      const userId = payload.data.metadata?.userId;
      if (!userId) {
        console.log("No user id found in metadata");
        return;
        };
      await ctx.runMutation(internal.customer.updateSubscriptionWebhook, {
        userId:userId,
        dodoSubscriptionId:payload.data.subscription_id,
        dodoCustomerId:payload.data.customer.customer_id,
        status:payload.data.status,
        tier:payload.data.status === 'active' ? 'pro' : 'free',
        currentPeriodEnd:payload.data.next_billing_date 
          ? new Date(payload.data.next_billing_date).getTime() 
          : undefined,
      });
    },
    onSubscriptionRenewed: async (ctx, payload) => {
      const userId = payload.data.metadata?.userId;
      if (!userId) return;
      await ctx.runMutation(internal.customer.updateSubscriptionWebhook, {
        userId:userId,
        dodoSubscriptionId: payload.data.subscription_id,
        dodoCustomerId: payload.data.customer.customer_id,
        status: payload.data.status,
        tier: payload.data.status === 'active' ? 'pro' : 'free',
        currentPeriodEnd:payload.data.next_billing_date 
          ? new Date(payload.data.next_billing_date).getTime() 
          : undefined,
      });
    },

    // 3. Payment Failed / Card Expired (Revoke Access Temporarily)
    onSubscriptionOnHold: async (ctx, payload) => {
      const userId = payload.data.metadata?.userId;
      if (!userId) return;
      await ctx.runMutation(internal.customer.updateSubscriptionWebhook, {
        userId:userId,
        dodoSubscriptionId: payload.data.subscription_id,
        dodoCustomerId: payload.data.customer.customer_id,
        status: payload.data.status, // "on_hold"
        tier: "free", // Downgrade them until they pay
        currentPeriodEnd: undefined,
      });
    },


    onSubscriptionCancelled: async (ctx, payload) => {
      const userId = payload.data.metadata?.userId;
      if (!userId) return;
      await ctx.runMutation(internal.customer.updateSubscriptionWebhook, {
        userId:userId,
        dodoSubscriptionId: payload.data.subscription_id,
        dodoCustomerId: payload.data.customer.customer_id,
        status: payload.data.status, // "cancelled"
        tier: "free",
        currentPeriodEnd: undefined,
      });
    },
  }),
});

export default http;