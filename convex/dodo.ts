import { DodoPayments, DodoPaymentsClientConfig } from "@dodopayments/convex";
import { components } from "./_generated/api";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { v } from "convex/values";

export const dodo = new DodoPayments(components.dodopayments, {
identify: async (ctx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null; 
  }
  
  const customer = await ctx.runQuery(internal.customer.getByAuthId, {
    authId: identity.subject,
  });
  
  if (!customer) {
    return null;
  }
  
  return {
    dodoCustomerId: customer.dodoCustomerId,
  };
},
apiKey: process.env.DODO_PAYMENTS_API_KEY!,
environment: process.env.DODO_PAYMENTS_ENVIRONMENT as "test_mode" | "live_mode",
} as DodoPaymentsClientConfig);

export const { checkout, customerPortal } = dodo.api();

export const createCheckout = action({
  args: { 
    product_cart: v.array(v.object({
      product_id: v.string(),
      quantity: v.number(),
    })),
    returnUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const user = await ctx.auth.getUserIdentity();
      if (!user) {
        throw new Error("Not authenticated");
      }
      const session = await checkout(ctx, {
        payload: {
          product_cart: args.product_cart,
          return_url: args.returnUrl,
          billing_currency: "USD",
          feature_flags: {
            allow_discount_code: true,
          },
          metadata: { 
            userId: user.subject 
          }
        },
      });
      if (!session?.checkout_url) {
        throw new Error("Checkout session did not return a checkout_url");
      }
      return session;
    } catch (error) {
      console.error("Failed to create checkout session", error);
      throw new Error("Unable to create checkout session. Please try again.");
    }
  },
});

export const getCustomerPortal = action({
  args: {
    send_email: v.optional(v.boolean()),
  },
    handler: async (ctx, args) => {
      try {
        const portal = await customerPortal(ctx, args);
        if (!portal?.portal_url) {
          throw new Error("Customer portal did not return a portal_url");
        }
        return portal;
      } catch (error) {
        console.error("Failed to generate customer portal link", error);
        throw new Error("Unable to generate customer portal link. Please try again.");
      }
    },
});