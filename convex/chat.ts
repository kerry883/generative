import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { agent } from "./ai";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { api } from "./_generated/api";

export const createNewchat = mutation({
    args:{
        title:v.string()
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const chatId = await ctx.db.insert("chats",{
            userId:user.subject,
            title:args.title
        })
        return chatId;
    
    }
})

export const updateChat = mutation({
    args:{
        chatId:v.id("chats"),
        title:v.string()
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const chat = await ctx.db.get(args.chatId);
        if(!chat || chat.userId !== user.subject){
            throw new Error("Chat not found or access denied.");
        }
        await ctx.db.patch(args.chatId,{
            title:args.title
        })
    }
})

export const deleteChat = mutation({
    args:{
        chatId:v.id("chats")
    },
    handler:async (ctx, args)=> {
       const user = ctx.auth.getUserIdentity();
       if(!user){
           throw new Error("Not authenticated");
       }
       const messages = await ctx.db.query('messages').withIndex('by_chat',(q)=>q.eq('chatId',args.chatId)).collect();
       await Promise.all(messages.map((message)=>ctx.db.delete(message._id)))
       await ctx.db.delete(args.chatId) 
    },
})

export const fetchChats = query({
    args:{

    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            return null;
        }
        const chats = await ctx.db.query("chats").withIndex("by_user",(q)=>q.eq("userId",user.subject)).collect();
        return chats;
    }
})

export const getChat = query({
    args:{
        chatId:v.id("chats")
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            return null
        }
        const chat = await ctx.db.get(args.chatId);
        if(!chat || chat.userId !== user.subject){
            return null;
        }
        const messages = await ctx.db.query("messages").withIndex("by_chat",(q)=>q.eq("chatId",args.chatId)).collect();
        return messages;
    }
})

export const addmessage = mutation({
    args:{
        chatId:v.id("chats"),
        role:v.string(),
        content:v.string(),
        parts:v.any()
    },
    handler:async(ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const messageId = await ctx.db.insert("messages",{
            chatId:args.chatId,
            userId:user.subject,
            role:args.role,
            content:args.content,
            parts:args.parts
        })
        return messageId;
    }
})

export const generateChatTitle = action({
    args:{
        chatId:v.id('chats'),
        userPrompt:v.string(),
    },
    handler: async(ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }

        const { text } = await generateText({
      model: google("gemini-2.5-flash"), // Use a fast/cheap model for this
      prompt: `
        Summarize the following user prompt into a very short, concise chat title (max 5 words).
        Do not use quotes.
        User Prompt: "${args.userPrompt}"
      `,
    });

    const cleanTitle = text.trim().replace(/^"|"$/g, '');

    await ctx.runMutation(api.chat.updateChat,{
        chatId:args.chatId,
        title:cleanTitle
    })
    }
})