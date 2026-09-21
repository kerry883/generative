"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  AlertCircle,
  Loader2,
  RefreshCcw,
  ExternalLink,
  FileText,
  VideoOff,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGuestIdentity } from "@/lib/fingerprinthook";
import { VideoPlayer } from "@/components/videoplayer";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/header";
import { formatRelativeTime } from "@/lib/dateformater";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";

// YouTube-style sidebar video item component
interface SidebarVideoItemProps {
  video: {
    _id: Id<"videos">;
    title?: string;
    thumbnail?: string;
    status: "generating" | "ready" | "failed";
    _creationTime: number;
  };
  onClick: () => void;
}

const SidebarVideoItem = ({ video, onClick }: SidebarVideoItemProps) => {
  return (
    <div onClick={onClick} className="flex gap-3 cursor-pointer group">
      {/* Thumbnail */}
      <div className="relative w-40 aspect-video bg-muted overflow-hidden flex-shrink-0">
        {video.status === "generating" ? (
          // Generating state thumbnail
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <div className="relative">
              <div className="w-8 h-8 border-2 border-muted-foreground/20 border-t-primary rounded-full animate-spin" />
            </div>
          </div>
        ) : video.status === "failed" ? (
          // Failed state thumbnail
          <div className="w-full h-full flex items-center justify-center bg-destructive/10">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
        ) : video.thumbnail ? (
          <Image
            src={video.thumbnail}
            alt={video.title || "Video thumbnail"}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <span className="text-xs text-muted-foreground">No thumbnail</span>
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm line-clamp-2 text-foreground group-hover:text-primary transition-colors">
          {video.title || "Untitled Video"}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(video._creationTime)}
        </p>
        {video.status === "generating" && (
          <span className="inline-flex items-center gap-1 text-xs text-primary mt-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Generating...
          </span>
        )}
        {video.status === "failed" && (
          <span className="text-xs text-destructive mt-1">Failed</span>
        )}
      </div>
    </div>
  );
};

// Sidebar skeleton loader
const SidebarSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="flex gap-3">
        <Skeleton className="w-40 aspect-video flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as Id<"videos">;
  const { guestId } = useGuestIdentity();

  // Fetch video with guestId for permission check
  const video = useQuery(api.videos.getvideobyId, {
    videoId: videoId,
  });

  // Fetch guest's other videos for sidebar
  const guestVideos = useQuery(
    api.guest.getguestvideo,
    guestId ? { guestId } : "skip",
  );

  // Fetch public showcase videos
  const publicVideos = useQuery(api.videos.getpublicvideos);

  // Filter out current video from sidebar and get showcase videos
  const sidebarVideos = guestVideos?.filter((v) => v._id !== videoId);
  const showcaseVideos = publicVideos
    ?.filter((v) => v._id !== videoId && v.guestId !== guestId)
    ?.slice(0, 3);

  // --- SHARED CONTAINER STYLE ---
  const playerContainerClass =
    "relative w-full aspect-video overflow-hidden bg-black shadow-2xl border border-white/10 flex flex-col items-center justify-center";

  // Sidebar component (reusable across states)
  const Sidebar = () => (
    <div className="w-full lg:w-80 xl:w-96 space-y-6">
      {/* Your Videos Section */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Your Videos
        </h3>

        {/* Loading State */}
        {guestVideos === undefined && <SidebarSkeleton />}

        {/* Videos List */}
        {sidebarVideos && sidebarVideos.length > 0 && (
          <div className="space-y-3">
            {sidebarVideos.map((v) => (
              <SidebarVideoItem
                key={v._id}
                video={v}
                onClick={() => router.push(`/watch/${v._id}`)}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {sidebarVideos && sidebarVideos.length === 0 && (
          <div className="text-center py-6 border bg-card">
            <p className="text-sm text-muted-foreground">No other videos yet</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => router.push("/")}
            >
              Create another video
            </Button>
          </div>
        )}
      </div>

      {/* Showcase Section */}
      {showcaseVideos && showcaseVideos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Showcase
            </h3>
          </div>
          <div className="space-y-3">
            {showcaseVideos.map((v) => (
              <SidebarVideoItem
                key={v._id}
                video={v}
                onClick={() => router.push(`/watch/${v._id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // --- STATE 0: LOADING (video === undefined) ---
  if (video === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="w-full h-10" />
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content Skeleton */}
            <div className="flex-1 space-y-4">
              <Skeleton className="w-full aspect-video" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-px w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>

            {/* Sidebar */}
            <Sidebar />
          </div>
        </div>
      </div>
    );
  }

  // --- STATE 1: VIDEO NOT FOUND (video === null) ---
  if (video === null) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="w-full h-10" />
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content */}
            <div className="flex-1">
              <div
                className={cn(
                  playerContainerClass,
                  "border-muted-foreground/20",
                )}
              >
                <div className="z-10 flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 bg-muted flex items-center justify-center mb-2">
                    <VideoOff className="w-8 h-8 text-muted-foreground" />
                  </div>

                  <h3 className="text-xl font-medium text-white">
                    Video Not Found
                  </h3>
                  <p className="text-white/60 max-w-md px-4">
                    This video doesn&apos;t exist or may have been deleted.
                  </p>

                  <Button
                    variant="outline"
                    className="mt-4 border-white/10 bg-white/5 hover:bg-white/10 text-white gap-2"
                    onClick={() => router.push("/")}
                  >
                    Go Home
                  </Button>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <Sidebar />
          </div>
        </div>
      </div>
    );
  }

  // --- STATE 2: GENERATING ---
  if (video.status === "generating") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="w-full h-10" />
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content */}
            <div className="flex-1 space-y-4">
              <div className={playerContainerClass}>
                {/* Animated Background Mesh */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent animate-pulse" />

                {/* Central Spinner */}
                <div className="z-10 flex flex-col items-center gap-6 p-6 text-center">
                  <div className="relative">
                    <div className="absolute inset-0 animate-ping bg-primary/20" />
                    <div className="relative bg-background/10 backdrop-blur-md border border-white/10 p-4 shadow-xl">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  </div>

                  <div className="space-y-2 max-w-sm">
                    <h3 className="text-xl font-medium text-white tracking-tight">
                      Crafting your Scene
                    </h3>
                    <p className="text-sm text-white/60">
                      AI is generating the animations, syncing audio, and
                      rendering frames...
                    </p>
                  </div>
                </div>

                {/* Fake "Progress Bar" at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                  <div
                    className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                    style={{
                      width: "60%",
                      animation: "progress-indeterminate 2s infinite linear",
                    }}
                  />
                </div>
              </div>

              {/* Video Details */}
              <div className="space-y-3">
                <h1 className="text-2xl font-bold text-foreground">
                  {video.title || "Generating Video..."}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {formatRelativeTime(video._creationTime)}
                </p>
                {video.prompt && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h2 className="text-lg font-semibold text-foreground">
                        Prompt
                      </h2>
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {video.prompt}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <Sidebar />
          </div>
        </div>
      </div>
    );
  }

  // --- STATE 3: FAILED ---
  if (video.status === "failed") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="w-full h-10" />
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content */}
            <div className="flex-1 space-y-4">
              <div
                className={cn(
                  playerContainerClass,
                  "border-destructive/30 bg-destructive/5",
                )}
              >
                {/* Background Pattern */}
                <div
                  className="absolute inset-0 opacity-[0.03]"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                  }}
                />

                <div className="z-10 flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 bg-destructive/10 flex items-center justify-center mb-2">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                  </div>

                  <h3 className="text-xl font-medium text-white">
                    Generation Failed
                  </h3>
                  <p className="text-white/60 max-w-md px-4">
                    We couldn&apos;t render this video. This usually happens if
                    the prompt was too complex for the current model.
                  </p>

                  <Button
                    variant="outline"
                    className="mt-4 border-white/10 bg-white/5 hover:bg-white/10 text-white gap-2"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCcw className="w-4 h-4" />
                    Try Again
                  </Button>
                </div>
              </div>

              {/* Video Details */}
              <div className="space-y-3">
                <h1 className="text-2xl font-bold text-foreground">
                  {video.title || "Video Generation Failed"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {formatRelativeTime(video._creationTime)}
                </p>
              </div>
            </div>

            {/* Sidebar */}
            <Sidebar />
          </div>
        </div>
      </div>
    );
  }

  // --- STATE 4: SUCCESS (ACTUAL PLAYER) ---
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        <div className="w-full h-10" />

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content - Video + Details */}
          <div className="flex-1 space-y-6">
            {/* Video Player */}
            <VideoPlayer
              src={video.url!}
              title={video.title || video.prompt}
              transcript={video.transcript}
              className="shadow-2xl border border-white/10"
            />

            {/* Video Details Section */}
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  {video.title || "Untitled Video"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {formatRelativeTime(video._creationTime)}
                </p>
              </div>

              <Separator />

              {/* Description Section */}
              {video.description && (
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    Description
                  </h2>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {video.description}
                  </p>
                </div>
              )}

              {/* Sources Section */}
              {video.sources && video.sources.length > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Sources
                  </h3>
                  <div className="space-y-2">
                    {video.sources.map((source, index) => (
                      <a
                        key={index}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-3 border bg-card hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                            {source.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {source.snippet}
                          </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <Sidebar />
        </div>
      </div>
    </div>
  );
}
