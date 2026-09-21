import { v } from "convex/values";
import { mutation, query } from "./_generated/server";


export const savefolder = mutation({
    args:{
        folderId:v.id('folders')
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user ){
            throw new Error('not authenticated ')
        }
        const alreadysaved = await ctx.db.query('savedFolders').withIndex('by_user',(q)=>q.eq('userId',user.subject)).filter((f)=>f.eq(f.field('folderId'),args.folderId)).first();
        const folder = await ctx.db.get(args.folderId)
        if(!folder || !folder.isPublic) {
            throw new Error ('folder not found or not public')
        }
        if(alreadysaved){
          const remove=  await ctx.db.delete(alreadysaved._id)
            await ctx.db.patch(folder._id,{
            savedCount:(folder.savedCount || 0) - 1,
            })
          return { saved: false };
        }else{
        const save = await ctx.db.insert('savedFolders',{
            folderId:args.folderId,
            userId:user.subject,
        })
        await ctx.db.patch(folder._id,{
            savedCount:(folder.savedCount || 0) + 1,
        })
        return { saved: true };
    }
    }
})

export const fetchsaved = query({
    args:{},
    handler: async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user ){
            throw new Error('not authenticated ')
        }
        const saved = await ctx.db.query('savedFolders').withIndex('by_user',(q)=>q.eq('userId',user.subject)).collect();
        return saved;
    }
})

export const getSavedFolderDetails = query({
    args: {},
    handler: async (ctx) => {
        const user = await ctx.auth.getUserIdentity();
        if (!user) {
            throw new Error('not authenticated');
        }
        
        const savedFolders = await ctx.db
            .query('savedFolders')
            .withIndex('by_user', (q) => q.eq('userId', user.subject))
            .collect();
        
        // Fetch the actual folder details for each saved folder
        const folderDetails = await Promise.all(
            savedFolders.map(async (saved) => {
                const folder = await ctx.db.get(saved.folderId);
                if (!folder || !folder.isPublic) {
                    return null;
                }
                return folder;
            })
        );
        
        // Filter out null values (deleted or private folders)
        return folderDetails.filter(folder => folder !== null);
    }
})

export const getFolderById = query({
    args: {
        folderId: v.id('folders')
    },
    handler: async (ctx, args) => {
        const folder = await ctx.db.get(args.folderId);
        if (!folder || !folder.isPublic) {
            throw new Error('Folder not found or not public');
        }
        return folder;
    }
})

export const checkIfSaved = query({
    args: {
        folderId: v.id('folders')
    },
    handler: async (ctx, args) => {
        const user = await ctx.auth.getUserIdentity();
        if (!user) {
            return false;
        }
        
        const saved = await ctx.db
            .query('savedFolders')
            .withIndex('by_user', (q) => q.eq('userId', user.subject))
            .filter((f) => f.eq(f.field('folderId'), args.folderId))
            .first();
        
        return !!saved;
    }
})

export const getFolderNotes = query({
    args: {
        folderId: v.id('folders')
    },
    handler: async (ctx, args) => {
        const folder = await ctx.db.get(args.folderId);
        if (!folder || !folder.isPublic) {
            throw new Error('Folder not found or not public');
        }
        const notes = await ctx.db.query('notes').withIndex('by_folder', (q) => q.eq('folderId', args.folderId)).collect();
        return notes;
    }
})

export const getFolderFiles = query({
    args: {
        folderId: v.id('folders')
    },
    handler: async (ctx, args) => {
        const folder = await ctx.db.get(args.folderId);
        if (!folder || !folder.isPublic) {
            throw new Error('Folder not found or not public');
        }
        const files = await ctx.db.query('files').withIndex('by_folder', (q) => q.eq('folderId', args.folderId)).collect();
        return files;
    }
})

export const getFolderFlashcards = query({
    args: {
        folderId: v.id('folders')
    },
    handler: async (ctx, args) => {
        const folder = await ctx.db.get(args.folderId);
        if (!folder || !folder.isPublic) {
            throw new Error('Folder not found or not public');
        }
        const flashcards = await ctx.db.query('flashcards').withIndex('by_folder', (q) => q.eq('folderId', args.folderId)).collect();
        return flashcards;
    }
})

export const getFolderChildren = query({
    args: {
        parentId: v.id('folders')
    },
    handler: async (ctx, args) => {
        const children = await ctx.db.query('folders').withIndex('by_parent', (q) => q.eq('parentId', args.parentId)).collect();
        return children.filter((child) => child.isPublic);
    }
})

export const getNote = query({
    args: {
        noteId: v.id('notes'),
        folderId: v.id('folders')
    },
    handler: async (ctx, args) => {
        const folder = await ctx.db.get(args.folderId);
        if (!folder || !folder.isPublic) {
            throw new Error('Folder not found or not public');
        }
        const note = await ctx.db.get(args.noteId);
        if (!note || note.folderId !== args.folderId) {
            throw new Error('Note not found in this folder');
        }
        return note;
    }
})

export const getFile = query({
    args: {
        fileId: v.id('files'),
        folderId: v.id('folders')
    },
    handler: async (ctx, args) => {
        const folder = await ctx.db.get(args.folderId);
        if (!folder || !folder.isPublic) {
            throw new Error('Folder not found or not public');
        }
        const file = await ctx.db.get(args.fileId);
        if (!file || file.folderId !== args.folderId) {
            throw new Error('File not found in this folder');
        }
        // Get the URL for the file
        const url = await ctx.storage.getUrl(file.storageId);
        if (!url) {
            throw new Error("File not found in storage");
        }
        return { ...file, url };
    }
})
