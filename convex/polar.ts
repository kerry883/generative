import { Polar } from "@convex-dev/polar";
import { api, components } from "./_generated/api";
import { query } from "./_generated/server";

export const polar = new Polar(components.polar,{
    products:{
        foldex_pro:"72f1eb7f-a850-40a4-b024-141101ab9b1a"
    },
    getUserInfo: async (ctx)=>{
        const user:any = await ctx.runQuery(api.user.getCurrentUser);
        return {
            userId:user.userId,
            email:user.email,
        }
    },
});

export const {
  getConfiguredProducts,
  listAllProducts,//Lists all non-archived products, useful if you don't configure products by key.
  generateCheckoutLink,//Generates a checkout link for the given product IDs.
  generateCustomerPortalUrl,//Generates a customer portal URL for the current user.
  changeCurrentSubscription,//Changes the current subscription to the given product ID.
  cancelCurrentSubscription,//Cancels the current subscription.
}= polar.api();

export const getsubscriptionstatus = query({
    args:{

    },
    handler:async (ctx)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
           return null;
        }
        const subscription = await polar.getCurrentSubscription(ctx,{userId:user.subject})
        if(!subscription){
            return{
                isPro:false,
                planName:"Free",
                renewDate:null
            }
        }
        if(!subscription.currentPeriodEnd) return null;
        const renewaldate = subscription.cancelAtPeriodEnd ? new Date(parseInt(subscription.currentPeriodEnd) * 1000).toLocaleDateString():null;
        return{
            isPro: true,
            planName:subscription.product.name,
            renewDate:renewaldate,
            cancelAtPeriodEnd:subscription.cancelAtPeriodEnd
        }

    }
})