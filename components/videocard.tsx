"use client";
import { Id } from "@/convex/_generated/dataModel";
import Image from "next/image";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  AlertCircle,
  Globe,
  MoreHorizontal,
  MoreVertical,
  Play,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/dateformater";

interface VideocardProps {
  videoId: Id<"videos">;
  onClick: () => void;
  allowed: boolean;
}

const Videocard = ({ videoId, onClick, allowed }: VideocardProps) => {
  const video = useQuery(api.videos.getvideobyId, { videoId: videoId });
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const deletevideo = useMutation(api.videos.deletevideo);
  const makepublic = useMutation(api.videos.makepublic);
  const [opendeleteDialog, setOpendedeleteDialog] = useState(false);
  const redo = useMutation(api.videos.retryvideo);

  // Loading State
  if (video === undefined || !video) {
    return (
      <div className="bg-card text-card-foreground shadow-sm h-full">
        <div className="space-y-3">
          <Skeleton className="w-full aspect-video " />
          <div className="space-y-2 px-4 pb-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      </div>
    );
  }
  const handleRetry = async () => {
    if (!video.prompt) {
      toast.error("Failed to retry video generation");
      return;
    }
    try {
      await redo({ videoId: videoId });
      toast.success("Video generation started");
    } catch (error) {
      toast.error("Failed to retry video generation");
    }
  };

  const handleMakePublic = async () => {
    if (video.templateId) {
      toast.info("cloned videos can't be made public");
      return;
    }
    await makepublic({ videoId: videoId });
    toast.success(video.public ? "Video made private" : "Video made public");
  };

  const handleDelete = async () => {
    await deletevideo({ videoId });
    toast.success("Video deleted successfully");
  };
  if (video.status === "failed") {
    return (
      <div className="bg-card text-card-foreground  shadow-sm h-full overflow-hidden border-2 border-destructive/50 p-2">
        {/* Thumbnail Area - Error State */}
        <div className="relative w-full aspect-video bg-destructive/5   overflow-hidden ">
          {/* Subtle pattern background */}
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 20px)",
              }}
            />
          </div>

          {/* Error icon in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="w-16 h-16 bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
            </div>
          </div>
          {allowed && (
            <DropdownMenu>
              <DropdownMenuTrigger className="absolute top-2 right-2">
                <MoreVertical className="w-5 h-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleRetry}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Retry
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Text Content */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-foreground">
              {video.title || "Video Generation Failed"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Unable to generate video
            </p>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-destructive/10 text-destructive rounded-full text-xs font-medium">
              <X className="w-3 h-3" />
              Generation failed
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (video.status === "generating") {
    return (
      <div
        className="bg-card text-card-foreground shadow-sm h-full overflow-hidden  p-2"
        onClick={onClick}
      >
        {/* Thumbnail Area with Animation */}
        <div className="relative w-full aspect-video bg-linear-to-br from-muted via-muted/50 to-muted  mb-0 overflow-hidden">
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-primary/10 to-transparent animate-shimmer" />

          {/* Loading spinner in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-muted-foreground/20 border-t-primary animate-spin" />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="p-4 space-y-2">
          {/* Title skeleton with shimmer */}
          <div className="relative h-5 w-3/4 bg-muted rounded overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-muted-foreground/10 to-transparent animate-shimmer" />
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Generating video...
            </div>
          </div>
        </div>
      </div>
    );
  }
  // Format the creation time
  const formattedDate = new Date(video._creationTime).toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  );

  return (
    <div
      onClick={onClick}
      className="bg-card text-card-foreground  shadow-sm cursor-pointer group h-full p-2"
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted ">
        {/* Show Skeleton until image is actually loaded */}
        {!isImageLoaded && (
          <Skeleton className="absolute inset-0 w-full h-full" />
        )}

        {video.thumbnail ? (
          <Image
            src={video.thumbnail}
            alt={video.title || "Video thumbnail"}
            fill
            className={cn(
              "object-cover transition-transform duration-300 group-hover:scale-105",
              !isImageLoaded && "opacity-0",
            )}
            onLoad={() => setIsImageLoaded(true)}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-muted">
            <span className="text-xs text-muted-foreground">No Thumbnail</span>
          </div>
        )}

        {/* Play Button Overlay - Shows on Hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="bg-primary p-4 transform scale-90 group-hover:scale-100 transition-transform duration-300 shadow-lg">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
      </div>

      {/* Text Content */}
      <div className="p-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold tracking-tight truncate leading-tight line-clamp-2 text-card-foreground">
            {video.title || "Untitled Video"}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatRelativeTime(video._creationTime)}
        </p>
      </div>
    </div>
  );
};

export default Videocard;
