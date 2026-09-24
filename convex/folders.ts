import { v } from "convex/values";
import { action, mutation, MutationCtx, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { api } from "./_generated/api";
import { rag } from "./rag";
import { EntryId } from "@convex-dev/rag";


export const createFolder = mutation({
    args:{
        name:v.string(),
        description:v.optional(v.string()),
        parentId:v.optional(v.string()),
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const folderId = await ctx.db.insert("folders",{
            userId:user.subject,
            name:args.name,
            description:args.description,
            parentId:args.parentId,
            isPublic:false,
            viewCount:0,
            authorname:user.name || user.nickname || 'Anonymous',
            authorprofile:user.pictureUrl,
            cloneCount:0,
            savedCount:0
        })
        return folderId;
    }
})

export const fetchFolders = query({
    args:{},
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
           return null
        }
        const folders = await ctx.db.query("folders").withIndex("by_archived",(q)=>q.eq("userId",user.subject).eq("isArchived",undefined)).collect();
        return folders;
    }
})

export const fetchArchivedFolders = query({
    args:{},
    handler:async (ctx)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
           return null
        }
        const folders = await ctx.db.query("folders").withIndex("by_archived",(q)=>q.eq("userId",user.subject).eq("isArchived",true)).collect();
        return folders;
    }
})

export const archiveFolder = mutation({
    args:{
        folderId:v.id("folders"),
    },
    handler:async (ctx, args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const folder = await ctx.db.get(args.folderId);
        if(!folder || folder.userId !== user.subject){
            throw new Error("Folder not found or access denied.");
        }
        await ctx.db.patch(args.folderId,{
            isArchived:true
        })
    }
})

export const unarchiveFolder = mutation({
    args:{
        folderId:v.id("folders"),
    },
    handler:async (ctx, args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const folder = await ctx.db.get(args.folderId);
        if(!folder || folder.userId !== user.subject){
            throw new Error("Folder not found or access denied.");
        }
        await ctx.db.patch(args.folderId,{
            isArchived:undefined
        })
    }
})

export const updateFolder = mutation({
    args:{
        folderId:v.id("folders"),
        name:v.optional(v.string()),
        description:v.optional(v.string()),
        tags:v.optional(v.array(v.string())),
        readme:v.optional(v.string())
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const folder = await ctx.db.get(args.folderId);
        if(!folder || folder.userId !== user.subject){
            throw new Error("Folder not found or access denied.");
        }
        await ctx.db.patch(args.folderId,{
            name:args.name,
            description:args.description,
        })
    }
})

export const deleteFolder = mutation({
    args:{
        folderId:v.id("folders"),
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const folder = await ctx.db.get(args.folderId);
         if(!folder || folder.userId !== user.subject){
            throw new Error("Folder not found or access denied.");
        }
        await deleteFolderRecursively(ctx, args.folderId,user.subject);
    }
})
/**
 * Helper function to recursively delete a folder and all its sub-contents
 * 
 */
async function deleteFolderRecursively(
  ctx: MutationCtx, 
  folderId: Id<"folders">, 
  userId: string
) {
  // 1. RECURSION: Find and delete all Subfolders first
  const subfolders = await ctx.db
    .query("folders")
    .withIndex("by_parent", (q) => q.eq("parentId", folderId))
    .collect();

  for (const subfolder of subfolders) {
    await deleteFolderRecursively(ctx, subfolder._id, userId);
  }

  // 2. Fetch Items in this current folder
  const notes = await ctx.db
    .query("notes")
    .withIndex("by_folder", (q) => q.eq("folderId", folderId))
    .collect();

  const files = await ctx.db
    .query("files")
    .withIndex("by_folder", (q) => q.eq("folderId", folderId))
    .collect();

  const flashcards = await ctx.db
    .query("flashcards")
    .withIndex("by_folder", (q) => q.eq("folderId", folderId))
    .collect();

  const videos = await ctx.db.query("videos").withIndex("by_folder",(q)=>q.eq("folderId",folderId)).collect();

  // 3. Delete NOTES
  await Promise.all(notes.map((note) => ctx.db.delete(note._id)));

  // 4. Delete FILES (Safe Delete / Reference Counting)
  await Promise.all(
    files.map(async (file) => {
      // Check if any OTHER file record uses this same storageId
      const fileUsageCount = await ctx.db
        .query("files")
        .withIndex("by_storage_id", (q) => q.eq("storageId", file.storageId))
        .collect();

      // If this is the LAST reference (length is 1), delete the actual file
      if (fileUsageCount.length <= 1 && file.storageId) {
        await ctx.storage.delete(file.storageId);
        if(file.entriesId){
                        await rag.deleteAsync(ctx,{
                            entryId:file.entriesId as EntryId,
                        })
                    }
      }

      // Always delete the database record
      return ctx.db.delete(file._id);
    })
  );

  // 5. Delete FLASHCARDS + REVIEWS
  // We process flashcards one by one to find their specific reviews
  await Promise.all(
    flashcards.map(async (card) => {
      // A. Find all reviews for this specific card
      const reviews = await ctx.db
        .query("flashcardReviews")
        .withIndex("by_flashcard", (q) => q.eq("flashcardId", card._id))
        .collect();
      
      // B. Delete all reviews for this card
      await Promise.all(reviews.map((r) => ctx.db.delete(r._id)));

      // C. Finally, delete the flashcard itself
      return ctx.db.delete(card._id);
    })
  );

  await Promise.all(
     videos.map(async (video)=>{
        if(video.templateId || video.status === 'failed'){
         await ctx.db.delete(video._id)
        }else{
        await ctx.db.patch(video._id,{folderId:undefined,public:true})}
     }
    ))
  const progressItems = await ctx.db
    .query("flashcardProgress")
    .withIndex("by_user_and_folder", (q) => 
      q.eq("userId", userId).eq("folderId", folderId)
    )
    .collect();

  await Promise.all(progressItems.map((p) => ctx.db.delete(p._id)));

  // Delete the FOLDER itself
  await ctx.db.delete(folderId);
}
export const getFolderById = query({
    args:{
        folderId:v.id("folders"),
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            return null;
        }
        const folder = await ctx.db.get(args.folderId);
        if(!folder || folder.userId !== user.subject){
            return null;
        }
        return folder;
    }
})

export const addbanner = mutation({
    args:{
        storageId:v.id("_storage"),
        folderId:v.id('folders')
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const folder = await ctx.db.get(args.folderId);
        if(!folder || folder.userId !== user.subject){
            throw new Error("Folder not found or access denied.");
        }
        await ctx.db.patch(args.folderId,{
            bannerId:args.storageId
        })
    }
})

//getting any url 
export const getUrl = query({
    args:{
        storageId:v.id("_storage")
    },
    handler:async (ctx ,args)=>{
        const url = await ctx.storage.getUrl(args.storageId)
        return url;
    }
})

export const removebanner = mutation({
  args: {
    folderId: v.id("folders"),
    storageId:v.id("_storage")
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Not authenticated");

    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== user.subject) {
      throw new Error("Not authorized");
    }
    await ctx.storage.delete(args.storageId);
    await ctx.db.patch(args.folderId, {
      bannerId: undefined,
    });
  },
});

export const movefolder = mutation({
    args:{
        folderId:v.id('folders'),
        parentId:v.id('folders')
    },
    handler: async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const folder = await ctx.db.get(args.folderId);
        if(!folder || folder.userId !== user.subject){
            throw new Error("Folder not found or access denied.");
        }
        await ctx.db.patch(args.folderId,{
            parentId:args.parentId
        })
    }
})

export const makeroot = mutation({
    args:{
        folderId:v.id('folders')
    },
    handler: async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        const folder = await ctx.db.get(args.folderId);
        if(!folder || folder.userId !== user.subject){
            throw new Error("Folder not found or access denied.");
        }
        await ctx.db.patch(args.folderId,{
            parentId:undefined
        })
    }
})

const outputschema = z.object({
    description:z.string().describe("A concise 1-2 sentence description of what this folder contains and who it's for (50-150 words). Should be SEO-friendly and mention key topics"),
    readme:z.string().describe("A comprehensive Markdown README (400-600 words) formatted with ## headings for Overview, What You'll Learn, Contents, and How to Use This Folder"),
    tags:z.array(z.string()).describe("5-8 relevant tags for discovery (e.g., 'web-development', 'react', 'algorithms', 'machine-learning'). Use lowercase with hyphens.")
})

export const generateReadme = action({
    args:{
      folderId:v.id('folders')
    },
    handler:async (ctx ,args)=>{

        const context = await ctx.runMutation(api.folders.gatherinfo,{
            folderId:args.folderId
        })
      const prompt = `You are creating metadata for a public educational folder on Foldex, a learning platform where students share knowledge.

FOLDER INFORMATION:
Name: "${context.folderName}"
${context.existingDescription ? `Current Description: "${context.existingDescription}"` : "No description yet"}
${context.existingTags.length > 0 ? `Current Tags: ${context.existingTags.join(", ")}` : "No tags yet"}

FOLDER CONTENTS:
- ${context.counts.notes} Notes with titles: ${context.noteTitles.slice(0, 10).join(", ")}${context.noteTitles.length > 10 ? "..." : ""}
- ${context.counts.flashcards} Flashcard questions including: ${context.flashcardQuestions.slice(0, 5).join("; ")}${context.flashcardQuestions.length > 5 ? "..." : ""}
- ${context.counts.videos} AI-generated educational videos: ${context.videoTitles.slice(0, 8).join(", ")}${context.videoTitles.length > 8 ? "..." : ""}
${context.videoDescriptions.length > 0 ? `  Video topics covered: ${context.videoDescriptions.join("; ")}` : ""}
- ${context.counts.files} Files: ${context.fileNames.slice(0, 5).join(", ")}${context.fileNames.length > 5 ? "..." : ""}
${context.counts.subfolders > 0 ? `- ${context.counts.subfolders} Subfolders: ${context.subfolderNames.join(", ")}` : ""}

YOUR TASK:

1. DESCRIPTION:
${context.existingDescription ? `- The current description exists but may need improvement` : `- Create a new description from scratch`}
- Write a compelling 50-150 word description that:
  * Explains what students will learn
  * Mentions key topics/subjects covered (be specific based on content)
  * States who this is for (e.g., "computer science students", "beginners learning calculus")
  * Is SEO-friendly (uses searchable terms)
${context.existingDescription ? `- IMPROVE the existing description by making it more specific and SEO-friendly` : `- CREATE a description that makes students want to clone this folder`}

2. TAGS:
${context.existingTags.length > 0 ? `- Current tags: ${context.existingTags.join(", ")}` : `- No tags exist yet`}
- Generate 5-8 relevant tags based on:
  * The folder name and contents
  * Specific subjects/topics covered (e.g., "algorithms", "calculus", "web-development")
  * Academic level if apparent (e.g., "beginner", "advanced", "university")
  * Programming languages or tools if relevant
- Format: lowercase with hyphens (e.g., "machine-learning", "data-structures")
${context.existingTags.length > 0 ? `- KEEP good existing tags and ADD missing relevant ones` : ``}

3. README:
- Write a comprehensive 400-600 word README in Markdown format
- Required sections with ## headings:
  
  ## Overview
  - What is this folder about?
  - Who is it for?
  - Why should someone clone it?
  
  ## What You'll Learn
  - List 4-6 specific learning outcomes based on the actual content
  - Be concrete: "Master X algorithm", "Understand Y concept", "Build Z project"
  - Reference actual topics from notes/videos/flashcards
  
  ## Contents
  - Highlight the types of resources:
    * "${context.counts.notes} comprehensive notes covering [specific topics]"
    * "${context.counts.videos} AI-generated animated videos explaining [key concepts]"
    * "${context.counts.flashcards} flashcards for spaced repetition practice"
  - Mention notable items by name if impressive
  
  ## How to Use This Folder
  - Suggest a learning path (e.g., "Start with videos → Review notes → Test with flashcards")
  - Mention any prerequisites if the content suggests them
  - Encourage active learning

IMPORTANT GUIDELINES:
- Be SPECIFIC about topics - don't be generic
- Use natural, educational language (not marketing speak)
- Make it SEO-friendly by using searchable terms students would use
- The README should make someone excited to learn from this folder
- Reference actual content titles and topics from the folder
- If the folder has impressive breadth or depth, highlight that
- Don't make claims not supported by the content

Generate all three fields (description, tags, readme) based on the folder's actual contents.`;

    const results = await generateObject({
        model:google('gemini-2.5-flash'),
        prompt:prompt,
        schema:outputschema,
        temperature:0.7
    })
    
    await ctx.runMutation(api.folders.updateforpublic,{
        folderId:args.folderId,
        description:results.object.description,
        tags:results.object.tags,
        readme:results.object.readme
    })
}
})

export const gatherinfo = mutation({
    args:{
        folderId:v.id('folders')
    },
    handler:async(ctx,args)=>{
        const folder = await ctx.db.get(args.folderId);
        if(!folder){
            throw new Error ('folder not found ')
        }
      const notes = await ctx.db.query('notes').withIndex('by_folder',(q)=>q.eq('folderId',args.folderId)).collect();
      const flashcards = await ctx.db.query('flashcards').withIndex('by_folder',(q)=>q.eq('folderId',args.folderId)).collect()
      const files = await ctx.db.query('files').withIndex('by_folder',(q)=>q.eq('folderId',args.folderId)).collect()
      const subfolders = await ctx.db.query('folders').withIndex('by_parent',(q)=>q.eq('parentId',args.folderId)).collect();
      const videos = await ctx.db.query('videos').withIndex('by_folder',(q)=>q.eq('folderId',args.folderId)).collect();
    
     const context = {
      folderName: folder.name,
      existingDescription: folder.description || null,
      existingTags: folder.tags || [],
      noteTitles: notes.map((n) => n.title).slice(0, 20),
      flashcardQuestions: flashcards.map((f) => f.question).slice(0, 15),
      videoTitles: videos.map((v) => v.title || "Untitled Video").slice(0, 15),
      videoDescriptions: videos
        .filter((v) => v.description)
        .map((v) => v.description)
        .slice(0, 5), // Use video descriptions for context
      fileNames: files.map((f) => f.fileName).slice(0, 10),
      subfolderNames: subfolders.map((sf) => sf.name),
      counts: {
        notes: notes.length,
        flashcards: flashcards.length,
        videos: videos.length,
        files: files.length,
        subfolders: subfolders.length,
      },
    };
    return context
}
})

export const updateforpublic = mutation({
    args:{
        folderId:v.id("folders"),
        description:v.optional(v.string()),
        tags:v.optional(v.array(v.string())),
        readme:v.optional(v.string())
    },
    handler:async (ctx ,args)=>{
        const folder = await ctx.db.get(args.folderId);
        if(!folder){
            throw new Error("Folder not found");
        }
        await ctx.db.patch(args.folderId,{
            description:args.description,
            tags:args.tags,
            readme:args.readme
        })
    }
})

export const updateauthor = mutation({
    args:{
        authorname:v.optional(v.string()),
        authorprofile:v.optional(v.string())
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        if(!user){
            throw new Error("Not authenticated");
        }
        // Get all folders belonging to this user
        const folders = await ctx.db
            .query("folders")
            .withIndex("by_user", (q) => q.eq("userId", user.subject))
            .collect();
        const videos = await ctx.db.query("videos").withIndex("by_user",(q)=>q.eq("userId",user.subject)).collect();
        
        // Update all folders with new author info
        await Promise.all(
            folders.map((folder) =>
                ctx.db.patch(folder._id, {
                    authorname: args.authorname,
                    authorprofile: args.authorprofile,
                })
            )
        );
        await Promise.all(
            videos.map((video)=>
                ctx.db.patch(video._id,{
                    creatorname:args.authorname,
                    creatorprofile:args.authorprofile,
                })
            )
        );
    }
})

