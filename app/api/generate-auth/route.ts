import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { extractText } from "unpdf";
import mammoth from "mammoth";
import { getToken } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  const token = await getToken();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();

  const prompt = formData.get("prompt") as string;
  const file = formData.get("file") as File | null;

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  convex.setAuth(token);

  let context = "";

  try {
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

    const videoId = await convex.mutation(api.videos.scheduleauthvideo, {
      prompt: prompt,
      context: context,
    });

    return NextResponse.json({ success: true, videoId });
  } catch (error) {
    console.log("video generation failed", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
