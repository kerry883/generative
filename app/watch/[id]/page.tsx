"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
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
  ThumbsDown,
  ThumbsUp,
  X
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
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// YouTube-style sidebar video item component
interface SidebarVideoItemProps {
  video: {
    _id: Id<"videos">;
    title?: string;
    thumbnail?: string;
    status: "generating" | "ready" | "failed";
    _creationTime: number;
    creatorname?: string;
    creatorprofile?: string;
  };
  onClick: () => void;
}

// 2. The YouTube-style dense video item
const SidebarVideoItem = ({ video, onClick }: SidebarVideoItemProps) => {
  return (
    <div onClick={onClick} className="flex gap-3 cursor-pointer group p-2  hover:bg-muted transition-colors">
      {/* Thumbnail */}
      <div className="relative w-36 aspect-video bg-muted  overflow-hidden flex-shrink-0 border border-border/50">
        {video.status === "generating" ? (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <div className="relative">
              <div className="w-6 h-6 border-2 border-muted-foreground/20 border-t-primary rounded-full animate-spin" />
            </div>
          </div>
        ) : video.status === "failed" ? (
          <div className="w-full h-full flex items-center justify-center bg-destructive/10">
            <AlertCircle className="w-5 h-5 text-destructive" />
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
            <span className="text-[10px] text-muted-foreground">No thumbnail</span>
          </div>
        )}
      </div>

      {/* Video Info & Creator */}
      <div className="flex-1 min-w-0 py-0.5 flex flex-col">
        <h3 className="font-medium text-sm line-clamp-2 text-foreground group-hover:text-primary transition-colors leading-snug">
          {video.title || "Untitled Video"}
        </h3>

        <div className="mt-auto pt-2 space-y-1">
          {/* Creator Profile Pic & Name */}
          <div className="flex items-center gap-1.5">
            <Avatar className="h-4 w-4 ">
              <AvatarImage src={video.creatorprofile} className="rounded-none" />
              <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                {video.creatorname?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <p className="text-xs text-muted-foreground truncate font-medium">
              {video.creatorname || "Anonymous"}
            </p>
          </div>

          {/* Timestamp & Status Flags */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground/80">
              {formatRelativeTime(video._creationTime)}
            </p>
            {video.status === "generating" && (
              <span className="text-[10px] text-primary animate-pulse font-medium">Generating...</span>
            )}
            {video.status === "failed" && (
              <span className="text-[10px] text-destructive font-medium">Failed</span>
            )}
          </div>
        </div>
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
const DISLIKE_TAGS = [
  { id: 'text_overlapped', label: 'Text overlapped / cut off' },
  { id: 'pacing_issue', label: 'Animations too fast/slow' },
  { id: 'boring_visuals', label: 'Visuals were unhelpful' },
  { id: 'hallucination', label: 'Math/Code error' },
];
export default function WatchPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as Id<"videos">;
  const { guestId } = useGuestIdentity();
  const { isSignedIn, user } = useUser();
  const [retrying, setretrying] = useState(false)
  // Fetch video with guestId for permission check
  const video = useQuery(api.videos.getvideobyId, {
    videoId: videoId,
  });
  const retry = useMutation(api.videos.retryvideo);
  const submitFeedback = useMutation(api.videos.submitFeedback);
  const [userVote, setUserVote] = useState<'like' | 'dislike' | null>(null);
  const [showDislikeMenu, setShowDislikeMenu] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const handleRetry = async () => {
    setretrying(true);
    if (!video?.prompt) {
      toast.error("Failed to retry video generation");
      return;
    }
    try {
      await retry({ videoId: videoId });
      toast.success("Video generation started");
    } catch (error) {
      toast.error("Failed to retry video generation");
    } finally {
      setretrying(false)
    }
  };
  const handleLike = async () => {
    const newVote = userVote === 'like' ? null : 'like';
    setUserVote(newVote);
    setShowDislikeMenu(false);

    try {
      await submitFeedback({ videoId, type: 'like' });
    } catch (error) {
      console.error("Failed to submit like:", error);
      setUserVote(userVote); // Rollback on error
    }
  };

  const handleDislikeClick = async () => {
    if (userVote === 'dislike') {
      // Toggle off
      setUserVote(null);
      setShowDislikeMenu(false);
      await submitFeedback({ videoId, type: 'dislike' });
    } else {
      // Open the tag menu, but register the generic dislike immediately
      setUserVote('dislike');
      setShowDislikeMenu(true);
      setSelectedTags([]);
      await submitFeedback({ videoId, type: 'dislike' });
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const submitDislikeTags = async () => {
    setShowDislikeMenu(false);
    if (selectedTags.length > 0) {
      await submitFeedback({
        videoId,
        type: 'dislike',
        tags: selectedTags
      });
    }
  };
  // Fetch videos for sidebar based on auth state
  // Logged-in users: fetch their videos
  // Guests: fetch guest videos
  const userVideos = useQuery(
    api.videos.getusersvideo,
    isSignedIn ? {} : "skip",
  );
  const guestVideos = useQuery(
    api.guest.getguestvideo,
    !isSignedIn && guestId ? { guestId } : "skip",
  );

  // Fetch public showcase videos (only for guests)
  const publicVideos = useQuery(
    api.videos.getpublicvideos,
    !isSignedIn ? undefined : "skip",
  );

  // Filter out current video from sidebar
  const sidebarVideos = isSignedIn
    ? userVideos?.filter((v) => v._id !== videoId)
    : guestVideos?.filter((v) => v._id !== videoId);

  // Showcase only for guests
  const showcaseVideos = !isSignedIn
    ? publicVideos
      ?.filter((v) => v._id !== videoId && v.guestId !== guestId)
      ?.slice(0, 3)
    : [];

  // --- SHARED CONTAINER STYLE ---
  const playerContainerClass =
    "relative w-full aspect-video overflow-hidden  flex flex-col items-center justify-center";

  // Sidebar component (reusable across states)
  const Sidebar = () => (
    <div className="w-full lg:w-80 xl:w-96 lg:sticky lg:top-4 lg:h-[calc(100vh-100px)] flex flex-col pb-6">
      <div className="border border-border bg-card/30 flex flex-col h-full overflow-hidden shadow-sm">

        {/* Playlist Header */}
        <div className="p-4 border-b border-border bg-card/80 backdrop-blur-sm z-10">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            Suggested Videos
          </h2>
        </div>

        {/* Scrollable Playlist Area */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4 scrollbar-thin">
          {/* Loading State */}
          {guestVideos === undefined && userVideos === undefined && (
            <div className="p-2"><SidebarSkeleton /></div>
          )}

          {/* Your Videos Section */}
          {sidebarVideos && sidebarVideos.length > 0 && (
            <div className="space-y-1">
              <h3 className="px-2 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Your Videos
              </h3>
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
            <div className="text-center py-6 mx-2 border border-dashed  bg-card/50">
              <p className="text-sm text-muted-foreground">No other videos yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 cursor-pointer"
                onClick={() => router.push("/")}
              >
                Create another video
              </Button>
            </div>
          )}

          {/* Showcase Section */}
          {showcaseVideos && showcaseVideos.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-border/50">
              <h3 className="px-2 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" /> Showcase
              </h3>
              {showcaseVideos.map((v) => (
                <SidebarVideoItem
                  key={v._id}
                  video={v}
                  onClick={() => router.push(`/watch/${v._id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
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

                  <h3 className="text-xl font-medium ">Video Not Found</h3>
                  <p className="text-muted-foreground max-w-md px-4">
                    This video doesn&apos;t exist or may have been deleted.
                  </p>

                  <Button
                    variant="outline"
                    className="mt-4 cursor-pointer gap-2"
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
      <div className="min-h-screen bg-background scrollbar-hidden">
        <Header />
        <div className="w-full h-10" />
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Main Content */}
            <div className="flex-1 space-y-4">
              <div
                className={cn(
                  playerContainerClass,
                  "border-primary bg-primary/20",
                )}
              >
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
                    <h3 className="text-xl font-medium  tracking-tight">
                      Generating your video...
                    </h3>
                    <p className="text-sm text-muted-foreground">
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
      <div className="min-h-screen bg-background scrollbar-hidden">
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

                  <h3 className="text-xl font-medium ">Generation Failed</h3>
                  <p className="text-muted-foreground max-w-md px-4">
                    Sorry, we couldn&apos;t render this video.
                    <br />
                    Please try again.
                  </p>

                  <Button
                    disabled={retrying}
                    variant="outline"
                    className="mt-4  gap-2"
                    onClick={handleRetry}
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
    <div className="min-h-screen bg-background scrollbar-hidden">
      <Header />
      <div className="w-full h-10" />
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
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
              <div className="flex justify-between items-center">
                {/* Creator Section - YouTube Style */}
                {(video.creatorname || video.creatorprofile) && (
                  <div className="flex items-center gap-3 py-2">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={video.creatorprofile}
                        alt={video.creatorname || "Creator"}
                        className="rounded-none"
                      />
                      <AvatarFallback className="rounded-none">
                        {video.creatorname
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-foreground">
                        {video.creatorname || "Anonymous"}
                      </p>
                    </div>
                  </div>
                )}
                <div className="relative">
                  <div className="flex items-center gap-2 bg-muted/50 p-1  border border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`rounded-none px-4 gap-2 ${userVote === 'like' ? 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary' : ''}`}
                      onClick={handleLike}
                    >
                      <ThumbsUp className={`h-4 w-4 ${userVote === 'like' ? 'fill-current' : ''}`} />
                      <span>{video.likes || 0}</span>
                    </Button>
                    <Separator orientation="vertical" className="h-6 bg-border" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className={` px-4 gap-2 ${userVote === 'dislike' ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive' : ''}`}
                      onClick={handleDislikeClick}
                    >
                      <ThumbsDown className={`h-4 w-4 ${userVote === 'dislike' ? 'fill-current' : ''}`} />
                      <span>{video.dislikes || 0}</span>
                    </Button>
                  </div>

                  {/* Dislike Tagging Popover */}
                  {showDislikeMenu && (
                    <div className="absolute top-full right-0 mt-2 w-72 bg-popover border border-border  shadow-lg p-4 z-50 animate-in fade-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-semibold">What went wrong?</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowDislikeMenu(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {DISLIKE_TAGS.map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => toggleTag(tag.id)}
                            className={`text-xs px-3 py-1.5  border transition-colors ${selectedTags.includes(tag.id)
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-transparent text-foreground hover:bg-muted border-border'
                              }`}
                          >
                            {tag.label}
                          </button>
                        ))}
                      </div>
                      <Button className="w-full h-8 text-xs" onClick={submitDislikeTags} disabled={selectedTags.length === 0}>
                        Submit Feedback
                      </Button>
                    </div>
                  )}
                </div>
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
