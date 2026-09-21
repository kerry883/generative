

import { query } from "./_generated/server";

export const getCurrentUser = query({
    args:{},
    handler: async (ctx)=>{
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }
    return {
      userId: identity.subject,
      email: identity.email,
      name: identity.name,
      emailVerified: identity.emailVerified,
      pictureUrl: identity.pictureUrl,
    };
    }
})
