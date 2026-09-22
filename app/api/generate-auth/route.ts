import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { extractText } from "unpdf";
import mammoth from "mammoth";
import { auth } from "@clerk/nextjs/server";

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();

  const prompt = formData.get("prompt") as string;
  const file = formData.get("file") as File | null;

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  // Get auth token for authenticated Convex calls
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");

  if (token) {
    convex.setAuth(token);
  }

  let context = "";

  try {
    // Extract text from file if provided
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (file.type === "application/pdf") {
        const { text, totalPages } = await extractText(
          new Uint8Array(arrayBuffer)
        );
        context = text.map((t) => t).join(" ");
        console.log(`Extracted ${totalPages} pages from PDF`);
      }

      if (
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.endsWith(".docx")
      ) {
        const result = await mammoth.extractRawText({ buffer: buffer });
        context = result.value;
        console.log(`Extracted DOCX: ${context.length} chars`);
      }
    }

    // Call the authenticated video generation mutation
    const videoId = await convex.mutation(api.videos.scheduleauthvideo, {
      prompt: prompt,
      context: context,
    });

    return NextResponse.json({ success: true, videoId });
  } catch (error: any) {
    console.log("video generation failed", error);
    const message = error?.message || "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
