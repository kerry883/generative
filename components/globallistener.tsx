"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useGuestIdentity } from "@/lib/fingerprinthook";
import { Id } from "@/convex/_generated/dataModel";

export function GlobalVideoListener() {
  const router = useRouter();
  const { guestId } = useGuestIdentity();

  // 1. Listen to the GUEST'S videos (not global recent videos)
  const guestVideos = useQuery(
    api.guest.getguestvideo,
    guestId ? { guestId } : "skip",
  );

  // Store statuses to detect changes
  const previousStatuses = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!guestVideos) return;

    guestVideos.forEach((video) => {
      const videoId = video._id; // <--- The ID is right here
      const prevStatus = previousStatuses.current[videoId];
      const currentStatus = video.status;

      // SKIP if status hasn't changed
      if (prevStatus === currentStatus) return;

      // DETECT TRANSITION: "generating" -> "ready"
      if (prevStatus === "generating" && currentStatus === "ready") {
        toast.success("Video Ready!", {
          description: `"${video.title || "Your video"}" is now available.`,
          action: {
            label: "Watch Now",
            onClick: () => {
              // 2. Use the ID securely to navigate
              router.push(`/watch/${videoId}`);
            },
          },
          duration: 8000, // Give them time to see it
        });
      }

      // DETECT TRANSITION: "generating" -> "failed"
      if (prevStatus === "generating" && currentStatus === "failed") {
        toast.error("Generation Failed", {
          description: "We couldn't generate the video. Please try again.",
        });
      }

      // Update ref
      previousStatuses.current[videoId] = currentStatus;
    });
  }, [guestVideos, router]);

  return null; // This component renders nothing visually
}
