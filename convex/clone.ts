import { v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const cloneFolder = mutation({
  args: {
    folderId: v.id("folders"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject;

    const folder = await ctx.db.get(args.folderId);
    if (!folder) {
      throw new Error("Folder not found");
    }

    // Ideally we check if it's public or owned by the user, but for now we assume public access is allowed if they have the ID
    // or we can strictly enforce isPublic check:
    // if (!folder.isPublic && folder.userId !== userId) { throw new Error("Access denied"); }
      const authorname = identity.name||identity.givenName || 'Anonymous';
      const authorprofile = identity.profileUrl || ''; 
    await recursiveClone(ctx, args.folderId, undefined, userId,authorname,authorprofile);

    // Increment clone count on the original folder
    await ctx.db.patch(args.folderId, {
      cloneCount: (folder.cloneCount || 0) + 1,
    });
  },
});

async function recursiveClone(
  ctx: MutationCtx,
  sourceFolderId: Id<"folders">,
  targetParentId: Id<"folders"> | undefined,
  userId: string,
  authorname:string,
  authorprofile:string
) {
  const sourceFolder = await ctx.db.get(sourceFolderId);
  if (!sourceFolder) return;

  // Create the new folder
  const newFolderId = await ctx.db.insert("folders", {
    userId: userId,
    name: sourceFolder.name,
    description: sourceFolder.description,
    parentId: targetParentId,
    isPublic: false, // Cloned folders are private by default
    tags: sourceFolder.tags,
    bannerId: sourceFolder.bannerId,
    templateId:sourceFolder.templateId || sourceFolderId,
    viewCount: 0,
    savedCount:0,
    cloneCount: 0,
    authorname:authorname,
    authorprofile:authorprofile
  });

  // Clone Notes
  const notes = await ctx.db
    .query("notes")
    .withIndex("by_folder", (q) => q.eq("folderId", sourceFolderId))
    .collect();

  for (const note of notes) {
    await ctx.db.insert("notes", {
      userId: userId,
      folderId: newFolderId,
      title: note.title,
      content: note.content,
      updatedAt: Date.now(),
      templateId:note.templateId || note._id,
    });
  }

  // Clone Files
  const files = await ctx.db
    .query("files")
    .withIndex("by_folder", (q) => q.eq("folderId", sourceFolderId))
    .collect();

  for (const file of files) {
    await ctx.db.insert("files", {
      userId: userId,
      folderId: newFolderId,
      fileName: file.fileName,
      fileType: file.fileType,
      storageId: file.storageId, // Reusing the same storage ID (file content)
      templateId:file.templateId || file._id,
    });
  }

  // Clone Flashcards
  const flashcards = await ctx.db
    .query("flashcards")
    .withIndex("by_folder", (q) => q.eq("folderId", sourceFolderId))
    .collect();

  for (const card of flashcards) {
    await ctx.db.insert("flashcards", {
      userId: userId,
      folderId: newFolderId,
      question: card.question,
      answers: card.answers,
      isMultipleChoice: card.isMultipleChoice,
      explanation:card.explanation,
      updatedAt: Date.now(),
      templateId:card.templateId || card._id,
    });
  }
  // clone video 
  const videos = await ctx.db.query("videos").withIndex("by_folder", (q) => q.eq("folderId", sourceFolderId)).collect();
  for (const video of videos){
    await ctx.db.insert("videos",{
      userId:userId,
      folderId:newFolderId,
      title:video.title,
      description:video.description,
      url:video.url,
      thumbnail:video.thumbnail,
      templateId:video.templateId || video._id,
      sources:video.sources,
      status:video.status,
      filesize:video.filesize,
    })
  }

  // Recursively clone subfolders
  const subfolders = await ctx.db
    .query("folders")
    .withIndex("by_parent", (q) => q.eq("parentId", sourceFolderId))
    .collect();

  for (const subfolder of subfolders) {
    await recursiveClone(ctx, subfolder._id, newFolderId, userId,authorname,authorprofile);
  }
}
