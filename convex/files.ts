import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
 import { PDFParse } from 'pdf-parse';
import { Id } from "./_generated/dataModel";
import { rag } from "./rag";
import { EntryId } from "@convex-dev/rag";


export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
export const getUrl = mutation({
    args:{
        storageId:v.id("_storage")
    },
    handler:async (ctx ,args)=>{
      const fileurl = await ctx.storage.getUrl(args.storageId)
      if(!fileurl){
        throw new Error("File not found");
      }
      return fileurl;
    }
})
export const uploadFile = mutation({
    args:{
         folderId:v.optional(v.id("folders")),
         fileName:v.string(),
         fileType:v.string(),
         storageId:v.id("_storage")
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }

        // Check if user can upload files
        const canUpload = await ctx.runQuery(api.subscriptions.canUploadFile);
        if (canUpload && !canUpload.allowed) {
            throw new Error(`File upload limit reached`);

        } 

        const fileId = await ctx.db.insert("files",{
            userId:user.subject,
            folderId:args.folderId,
            fileName:args.fileName,
            fileType:args.fileType,
            storageId:args.storageId
        })
        
        // Track file upload
        await ctx.runMutation(api.subscriptions.trackFileUpload);

        const fileurl = await ctx.storage.getUrl(args.storageId)
        if(!fileurl){
            throw new Error("File not found");
        }
        return {
            fileId,
            fileurl
        };
    }
})

// export const uploadAndProcessFile = action({
//   args: {
//     folderId: v.optional(v.id("folders")),
//     fileName: v.string(),
//     fileType: v.string(),
//     storageId: v.id("_storage"),
//   },
//   handler: async (ctx, args) => {
//     const user = await ctx.auth.getUserIdentity();
//     if (!user) {
//       throw new Error("Not authenticated");
//     }
//     const fileId = await ctx.runMutation(api.files.uploadFile,{
//         folderId:args.folderId,
//         fileName:args.fileName,
//         fileType:args.fileType,
//         storageId:args.storageId
//     })

//     const fileurl = await ctx.storage.getUrl(args.storageId)

//     if(!fileurl){
//         throw new Error('File not found');
//     }

//     try{
//        const pdfparse = new PDFParse({url:fileurl})
//        const result = await pdfparse.getText()
//        const text = result.text

//        await ctx.runAction(api.rag.addFile,{
//         folderId:args.folderId as Id<'folders'>,
//         fileId:fileId,
//         text:text,
//         fileName:args.fileName,
//        })
       
//     }catch(error){
//        console.error("Error extracting text:", error);
//     }
// }
// });

export const fetchfiles = query({
    args:{
        folderId:v.optional(v.id("folders")),
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            return null;
        }
        const files = await ctx.db.query("files").withIndex("by_user_and_folder",(q)=>q.eq("userId",user.subject).eq("folderId",args.folderId)).collect(); ;
        return files;
    }
})

export const deleteFile = mutation({
    args:{
        fileId:v.id("files")
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const file = await ctx.db.get(args.fileId);
        if(!file){
            throw new Error("File not found");
        } 
        const fileUsageCount = await ctx.db
        .query("files")
        .withIndex("by_storage_id", (q) => q.eq("storageId", file.storageId))
        .collect();

        const usage = await ctx.db.query('usageTracking').withIndex('by_user',(q)=>q.eq('userId',user.subject)).first();
       if (usage) {
            // SAFETY CHECK: Prevent negative numbers
            const newCount = Math.max(0, usage.totalFilesUploaded - 1);
            
            await ctx.db.patch(usage._id, {
                totalFilesUploaded: newCount,
                updatedAt: Date.now(),
            });
        }
        if(fileUsageCount.length <= 1){
            await ctx.storage.delete(file.storageId)
            if(file.entriesId){
                await rag.deleteAsync(ctx,{
                    entryId:file.entriesId as EntryId,
                })
            }
        }
        await ctx.db.delete(args.fileId);

    }
})
export const updatefile = mutation({
    args:{
        fileId:v.id("files"),
        entries:v.string(),
    },
    handler:async (ctx ,args)=>{
        const file = await ctx.db.get(args.fileId);
        if(!file){
            throw new Error("File not found");
        }
        await ctx.db.patch(args.fileId,{
            entriesId:args.entries
        })
    }
})
export const getFile = query({
    args:{
        fileId:v.id("files")
    },
    handler:async (ctx ,args)=>{
       
        const file = await ctx.db.get(args.fileId);
        if(!file){
            return null;
        }
        const fileurl = await ctx.storage.getUrl(file.storageId)
        return {
            file:file,
            fileurl:fileurl
        };
    }
})

export const fetchallfiles = query({
    args:{

    },
    handler:async( ctx)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            return null;
        }

        const files = await ctx.db.query("files").withIndex("by_user",(q)=>q.eq("userId",user.subject)).collect()
        return files;
    }
})

export const deletefilefromstorage = mutation({
    args:{
        storageId:v.id("_storage")
    },
    handler:async (ctx ,args)=>{
        await ctx.storage.delete(args.storageId)
    }
})

export const movefile = mutation({
    args:{
        fileId:v.id("files"),
        folderId:v.id("folders")
    },
    handler:async (ctx ,args)=>{
        const file = await ctx.db.get(args.fileId);
        if(!file){
            throw new Error("File not found");
        }
        await ctx.db.patch(args.fileId,{
            folderId:args.folderId
        })
    }
})