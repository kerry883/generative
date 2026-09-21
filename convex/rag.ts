
import { api, components } from "./_generated/api";
import { RAG } from "@convex-dev/rag";
import { google } from '@ai-sdk/google';
import { action } from "./_generated/server";
import { v } from "convex/values";
import { embed, embedMany } from 'ai';

// Create a v2-compatible embedding model wrapper
function createV2EmbeddingModel() {
  const baseModel = google.textEmbeddingModel("text-embedding-004");
  
  return {
    specificationVersion: "v2" as const,
    modelId: baseModel.modelId,
    provider: baseModel.provider,
    maxEmbeddingsPerCall: baseModel.maxEmbeddingsPerCall,
    supportsParallelCalls: baseModel.supportsParallelCalls,
    
    async doEmbed(params: { values: string[] }) {
      const result = await embedMany({
        model: google.textEmbeddingModel("text-embedding-004"),
        values: params.values,
      });
      
      return {
        embeddings: result.embeddings,
        usage: result.usage,
      };
    },
  };
}
type FilterTypes = {
  folderId: string;
  fileId:string;
};
export const rag = new RAG<FilterTypes>(components.rag, {
  textEmbeddingModel: createV2EmbeddingModel() as any, // Type assertion needed
  embeddingDimension: 768, 
  filterNames: ["folderId", "fileId"],
});

const namespace ="knowledge_base_v1"
export const addFile = action({
    args:{
        folderId:v.id("folders"),
        fileId:v.id("files"),
        text:v.string(),
        fileName:v.string(),
    },
    handler:async (ctx ,args)=>{
        const user = await ctx.auth.getUserIdentity();
        
       const result = await rag.add(ctx,{
            namespace: namespace,
            text:args.text,
            title:args.fileName,
            filterValues:[
                {name:'folderId',value:args.folderId},
                {name:'fileId',value:args.fileId},
            ],
            
        })
        console.log("entries",result.entryId)
        await ctx.runMutation(api.files.updatefile,{
            fileId:args.fileId,
            entries:result.entryId
        })
    }
})
export const search = action({
    args:{
        query:v.string(),
        fileId:v.id("files"),  
    },
    handler:async (ctx ,args)=>{
        const file = await ctx.runQuery(api.files.getFile,{
            fileId:args.fileId
        })
        if(!file){
            throw new Error("File not found");
        }
        let searchfileId = args.fileId;
        if(file.file.templateId){
            searchfileId = file.file.templateId;
        }
         const results = await rag.search(ctx,{
             namespace: namespace,
             query:args.query,
             filters:[
                {name:'fileId',value:searchfileId},
             ]
         })
        return results;
    }
})

