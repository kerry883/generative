import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const videoUrl = request.nextUrl.searchParams.get("url");
  if (!videoUrl) return new Response("Missing URL", { status: 400 });

  const response = await fetch(videoUrl);
  const blob = await response.blob();

  return new Response(blob, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="video.mp4"`,
    },
  });
}