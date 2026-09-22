"use client";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  VideoIcon,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Lock,
  Crown,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Videocard from "@/components/videocard";
import { Header } from "@/components/header";
import { useUser } from "@clerk/nextjs";
import SubscriptionDialog from "@/components/pricingdialog";
import { AuthDialog } from "@/components/auth";

const VIDEOS_PER_PAGE = 12;

const WatchList = () => {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const videos = useQuery(api.videos.getPublicVideosWithAccess);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showPricing, setShowPricing] = useState(false);

  // Separate free and locked videos
  const { freeVideos, lockedVideos, filteredVideos } = useMemo(() => {
    if (!videos)
      return { freeVideos: [], lockedVideos: [], filteredVideos: [] };

    const searchLower = search.toLowerCase();
    const filtered = search.trim()
      ? videos.filter((video) =>
          video.title?.toLowerCase().includes(searchLower),
        )
      : videos;

    const free = filtered.filter((v) => v.isFreeToday || !v.isLocked);
    const locked = filtered.filter((v) => v.isLocked && !v.isFreeToday);

    return { freeVideos: free, lockedVideos: locked, filteredVideos: filtered };
  }, [videos, search]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredVideos.length / VIDEOS_PER_PAGE);
  const startIndex = (currentPage - 1) * VIDEOS_PER_PAGE;
  const endIndex = startIndex + VIDEOS_PER_PAGE;
  const paginatedVideos = filteredVideos.slice(startIndex, endIndex);

  // Check if any videos are locked (user needs to upgrade)
  const hasLockedVideos = lockedVideos.length > 0;

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  // Loading state with skeleton matching the component layout
  if (videos === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto py-6 px-4">
          {/* Header Skeleton */}
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-10 w-10" />
          </div>

          {/* Search Skeleton */}
          <Skeleton className="h-12 w-full mb-6 " />

          {/* Stats Skeleton */}
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-32" />
          </div>

          {/* Video Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="bg-card text-card-foreground shadow-sm h-full overflow-hidden p-2"
              >
                <Skeleton className="w-full aspect-video " />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="py-4 px-4">
        {/* Header */}
        <div className="h-16" />
        <div className="flex mb-6 justify-center gap-2">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-center">Video Library</h1>
            <p className="text-sm text-muted-foreground text-center">
              Watch thousands of videos from the community to help you learn
            </p>
          </div>
        </div>

        {/* Upgrade Banner for non-Pro users */}
        {hasLockedVideos && (
          <div className="mb-6 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20">
                  <Crown className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium">
                    Unlock all {lockedVideos.length} locked videos
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Upgrade to Pro for unlimited access to the entire library
                  </p>
                </div>
              </div>
              {isSignedIn ? (
                <Button
                  onClick={() => setShowPricing(true)}
                  className=" cursor-pointer"
                >
                  Upgrade to Pro
                </Button>
              ) : (
                <AuthDialog>
                  <Button className=" cursor-pointer">Sign In</Button>
                </AuthDialog>
              )}
            </div>
          </div>
        )}

        {/* Free Today Section */}
        {freeVideos.filter((v) => v.isFreeToday).length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h2 className="text-xl font-bold">Free Today</h2>
              <span className="text-sm text-muted-foreground">
                • Refreshes daily
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-2">
              {freeVideos
                .filter((v) => v.isFreeToday)
                .map((video) => (
                  <Videocard
                    key={video._id}
                    videoId={video._id}
                    onClick={() => router.push(`/watch/${video._id}`)}
                    allowed={false}
                    isLocked={false}
                    isFreeToday={true}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search videos"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-12 h-12 w-full text-base bg-muted/50 border-border/50 "
            />
          </div>
          <div className="flex items-center justify-between">
            {search && (
              <p className="text-sm text-muted-foreground mt-2">
                Found {filteredVideos.length} video
                {filteredVideos.length !== 1 ? "s" : ""}
              </p>
            )}
            <p className="text-center text-sm text-muted-foreground">
              Showing {startIndex + 1}-
              {Math.min(endIndex, filteredVideos.length)} of{" "}
              {filteredVideos.length} videos
            </p>
          </div>
        </div>

        {/* Content */}
        <div>
          {filteredVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="w-16 h-16 bg-muted flex items-center justify-center">
                <VideoIcon className="w-8 h-8 text-muted-foreground" />
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">
                  {search ? "No Videos Found" : "No Videos Available"}
                </h2>
                <p className="text-muted-foreground max-w-md">
                  {search
                    ? `No videos match "${search}". Try a different search term.`
                    : "No videos have been added to video vault yet."}
                </p>
              </div>

              {search && (
                <Button variant="outline" onClick={() => setSearch("")}>
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Video Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedVideos.map((video) => (
                  <Videocard
                    key={video._id}
                    videoId={video._id}
                    onClick={() => {
                      if (!video.isLocked) {
                        router.push(`/watch/${video._id}`);
                      }
                    }}
                    allowed={false}
                    isLocked={video.isLocked}
                    isFreeToday={video.isFreeToday}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        return (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        );
                      })
                      .map((page, idx, arr) => {
                        const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                        return (
                          <React.Fragment key={page}>
                            {showEllipsis && (
                              <span className="px-2 text-muted-foreground">
                                ...
                              </span>
                            )}
                            <Button
                              variant={
                                currentPage === page ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className="min-w-[40px]"
                            >
                              {page}
                            </Button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="cursor-pointer"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pricing Dialog */}
      <SubscriptionDialog isOpen={showPricing} onOpenChange={setShowPricing} />
    </>
  );
};

export default WatchList;
