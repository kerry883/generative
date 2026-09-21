import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

async function setPublicRecursiverly(ctx:MutationCtx ,folderId:Id<'folders'> ,isPublic:boolean){
    const children = await ctx.db.query('folders').withIndex('by_parent',(q)=>q.eq("parentId",folderId)).collect();
    const videos = await ctx.db.query('videos').withIndex('by_folder',(q)=>q.eq('folderId',folderId)).collect();

    for(const video of videos){
        if(video.templateId){
            await ctx.db.patch(video._id,{public:false})
        }else{
            await ctx.db.patch(video._id,{public:isPublic})
        }
    }

    for(const child of children){
        await ctx.db.patch(child._id,{isPublic:isPublic})
        await setPublicRecursiverly(ctx,child._id,isPublic)
    }
}

export const makePublic = mutation({
    args:{
        folderId:v.id('folders'),
        tags:v.optional(v.array(v.string())),
    },
    handler:async(ctx,args)=>{
        const user = await ctx.auth.getUserIdentity()
        if(!user){
            throw new Error("Unauthorized")
        }
        const folder = await ctx.db.get(args.folderId);
        if(!folder || folder.userId !== user.subject){
            throw new Error('Unauthorized')
        }
        const newStatus = !folder.isPublic;
        await ctx.db.patch(args.folderId,{
            isPublic:newStatus,
            tags:args.tags,
            viewCount:folder.viewCount || 0,
            cloneCount:folder.cloneCount || 0,
        })

        await setPublicRecursiverly(ctx,args.folderId,newStatus)
        
        if(newStatus && !folder.readme){
            await ctx.scheduler.runAfter(0,api.folders.generateReadme,{
                folderId:folder._id
            })
        }
        return newStatus;
    }
})

export const getPublicFolders = query({
    args:{
        
    },
    handler:async(ctx)=>{
        const folders = await ctx.db.query('folders').withIndex('by_public',(q)=>q.eq('isPublic',true)).collect();
        
        // Create a set of all public folder IDs for efficient lookup
        const publicFolderIds = new Set(folders.map(f => f._id));

        // Filter out folders whose parent is also in the public list
        // We want to show a folder ONLY if:
        // 1. It has no parent OR
        // 2. Its parent is NOT in the public list (meaning the parent is private or doesn't exist)
        const rootPublicFolders = folders.filter(folder => {
            if (!folder.parentId) return true;
            return !publicFolderIds.has(folder.parentId as Id<'folders'>);
        });

        return rootPublicFolders;
    }
})

export const getPublicFolderById = query({
    args:{
        folderId:v.id('folders')
    },
    handler:async(ctx,args)=>{
        const folder = await ctx.db.get(args.folderId);
        if(!folder || !folder.isPublic){
           return null
        }
        return folder;
    }
})

export const getPublicFolderNotes = query({
    args:{
        folderId:v.id('folders')
    },
    handler:async(ctx ,args)=>{
        const folder = await ctx.db.get(args.folderId);
        if(!folder || !folder.isPublic){
           return null;
        }
        const notes = await ctx.db.query('notes').withIndex('by_folder',(q)=>q.eq('folderId',args.folderId)).collect();
        return notes;
    }
})

export const getPublicFolderFiles = query({
    args:{
        folderId:v.id('folders')
    },
    handler:async(ctx,args)=>{
        const folder = await ctx.db.get(args.folderId);
        if(!folder || !folder.isPublic){
            return null
        }
        const files = await ctx.db.query('files').withIndex('by_folder',(q)=>q.eq('folderId',args.folderId)).collect();
        return files;
    }
})

export const getPublicFolderFlashcards = query({
    args:{
        folderId:v.id('folders')
    },
    handler:async(ctx,args)=>{
        const folder = await ctx.db.get(args.folderId);
        if(!folder || !folder.isPublic){
           return null
        }
        const flashcards = await ctx.db.query('flashcards').withIndex('by_folder',(q)=>q.eq('folderId',args.folderId)).collect();
        return flashcards;
    }
})

export const searchPublicFolders = query({
    args:{
        query:v.string(),
    },
    handler:async (ctx ,args)=>{
        const folders = await ctx.db.query('folders').withSearchIndex('search_folder',(q)=>q.search('name',args.query).eq('isPublic',true)).collect();
        return folders;
    }
})

export const getPublicFolderChildren = query({
    args:{
        parentId:v.id('folders')
    },
    handler:async (ctx ,args)=>{
        const children = await ctx.db.query('folders').withIndex('by_parent',(q)=>q.eq('parentId',args.parentId)).collect();

        return children.filter((child)=>child.isPublic)
    }
})