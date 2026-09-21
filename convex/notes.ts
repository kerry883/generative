import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const fetchNotes = query({
    args:{},
    handler:async(ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            return null;
        }
        const notes = await ctx.db.query("notes").withIndex("by_user",(q)=>q.eq("userId",user.subject)).collect();
        return notes;
    }
})

export const fetchNotesInFolder = query({
    args:{
        folderId:v.id("folders"),
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            return null;
        }
        const notes = await ctx.db.query("notes").withIndex("by_folder",(q)=>q.eq("folderId",args.folderId)).collect();
        return notes;
    }
})


export const createNote = mutation({
    args:{
        folderId:v.optional(v.id("folders")),
        title:v.string(),
        content:v.optional(v.string()),
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const noteId = await ctx.db.insert("notes",{
            userId:user.subject,
            folderId:args.folderId,
            title:args.title,
            content:args.content,
            updatedAt:Date.now(),
            }
        );
        return noteId;
    }
})

export const renameNote = mutation({
    args:{
        noteId:v.id("notes"),
        title:v.string(),
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const note = await ctx.db.get(args.noteId);
        if(!note || note.userId !== user.subject){
            throw new Error("Note not found or access denied.");
        }
        await ctx.db.patch(args.noteId,{
            title:args.title
        })
    }
})

export const deleteNote = mutation({
    args:{
        noteId:v.id("notes"),
    },
    handler:async (ctx ,args)=>{
     const user = await ctx.auth.getUserIdentity();
     if(!user){
         throw new Error("Not authenticated");
     }
        const note = await ctx.db.get(args.noteId);
        if(!note || note.userId !== user.subject){
            throw new Error("Note not found or access denied.");
        }
        await ctx.db.delete(args.noteId);
    }
})

export const getNoteId = query({
    args:{
        noteId:v.id("notes"),
    },
    handler:async (ctx ,args)=>{
        const note = await ctx.db.get(args.noteId);
        if(!note){
            return null;
        }
        return note;
    }
})

export const updateContent = mutation({
    args:{
        noteId:v.id("notes"),
        content:v.optional(v.string()),
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const note = await ctx.db.get(args.noteId);
        if(!note || note.userId !== user.subject){
            throw new Error("Note not found or access denied.");
        }
        await ctx.db.patch(args.noteId,{content:args.content, updatedAt:Date.now()});
        return args.noteId;
    }
})

export const movenote = mutation({
    args:{
        noteId:v.id("notes"),
        folderId:v.id("folders")
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error('Not authenticated ')
        }
        const note = await ctx.db.get(args.noteId);
        if(!note || note.userId !== user.subject){
            throw new Error('Note not found or access denied.')
        }
        const folder = await ctx.db.get(args.folderId);
        if(!folder || folder.userId !== user.subject){
            throw new Error('Folder not found or access denied.')
        }
        await ctx.db.patch(args.noteId,{
            folderId:args.folderId,
            updatedAt:Date.now()
        })
    }
})