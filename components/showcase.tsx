"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useGuestIdentity } from "@/lib/fingerprinthook";
import Videocard from "./videocard";
import { useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "./ui/skeleton";
import { Video, Sparkles, Divide } from "lucide-react";

export const Showcase = () => {
  const router = useRouter();
  const { guestId } = useGuestIdentity();

  // Fetch guest's own videos
  const guestVideos = useQuery(
    api.guest.getguestvideo,
    guestId ? { guestId } : "skip",
  );

  // Fetch public showcase videos
  const publicVideos = useQuery(api.videos.getpublicvideos);

  // Filter showcase videos to exclude guest's own videos
  const showcaseVideos = publicVideos
    ?.filter((video) => video.guestId !== guestId)
    ?.slice(0, 6);

  const handleVideoClick = (videoId: Id<"videos">) => {
    router.push(`/watch/${videoId}`);
  };

  // Loading skeleton for video cards
  const VideoSkeleton = () => (
    <div className="space-y-3">
      <Skeleton className="w-full aspect-video" />
      <div className="space-y-2 px-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );

  return (
    <div className="w-full border-t bg-background py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Your Videos Section */}
        {guestId && guestVideos && guestVideos.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold tracking-tight">Your Videos</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {guestVideos.map((video) => (
                <Videocard
                  key={video._id}
                  videoId={video._id}
                  onClick={() => handleVideoClick(video._id)}
                  allowed={true}
                />
              ))}
            </div>
          </section>
        )}

        {/* Loading State for Guest Videos */}
        {guestId && guestVideos === undefined && (
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold tracking-tight">Your Videos</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <VideoSkeleton key={i} />
              ))}
            </div>
          </section>
        )}

        {/* Showcase Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Showcase</h2>
            <span className="text-sm text-muted-foreground ml-2">
              Videos created by the community
            </span>
          </div>

          {/* Loading State */}
          {publicVideos === undefined && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <VideoSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Showcase Videos Grid */}
          {showcaseVideos && showcaseVideos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {showcaseVideos.map((video) => (
                <Videocard
                  key={video._id}
                  videoId={video._id}
                  onClick={() => handleVideoClick(video._id)}
                  allowed={false}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {showcaseVideos && showcaseVideos.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No showcase videos yet. Be the first to create one!</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
