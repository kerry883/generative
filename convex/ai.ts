import { google } from "@ai-sdk/google";
import { components } from "./_generated/api";
import { Agent, vStreamArgs } from "@convex-dev/agent";
import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const agent = new Agent(components.agent,{
    name:'ai',
    languageModel:google('gemini-2.5-flash'),
    instructions:'You are a helpful assistant.',
    maxSteps:10,
})

export const createThread = mutation({
    args:{
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const threadId = await agent.createThread(ctx,{
            userId:user.subject,
            title:'New chat',
        })
        return threadId;
    }
})



