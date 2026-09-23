"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Loader2,
  Subtitles,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  title?: string;
  transcript?: string;
}

export function VideoPlayer({
  src,
  poster,
  className,
  title,
  transcript,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const canDownload = useQuery(api.subscriptions.canDownloadVideo);
  const canDownloadAllowed = canDownload?.allowed ?? false;

  // Format time (e.g., 65s -> 1:05)
  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Show controls and reset hide timeout
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    if (isPlaying) {
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  // Simple subtitle generation from transcript
  const generateSubtitles = (transcript: string, dur: number) => {
    if (!transcript || !dur || !isFinite(dur)) return [];

    const sentences = transcript
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0)
      .map((s) => s.trim());

    const timePerSentence = dur / sentences.length;

    return sentences.map((text, index) => ({
      start: index * timePerSentence,
      end: (index + 1) * timePerSentence,
      text: text,
    }));
  };

  // Update current subtitle based on video time
  useEffect(() => {
    if (!showSubtitles || !transcript || !duration || !isFinite(duration)) {
      setCurrentSubtitle("");
      return;
    }

    const subtitles = generateSubtitles(transcript, duration);
    const current = subtitles.find(
      (sub) => currentTime >= sub.start && currentTime < sub.end,
    );

    setCurrentSubtitle(current?.text || "");
  }, [currentTime, showSubtitles, transcript, duration]);

  // --- Handlers ---

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
    showControlsTemporarily();
  }, [isPlaying, showControlsTemporarily]);

  const handleTimeUpdate = () => {
    if (videoRef.current && isFinite(videoRef.current.currentTime)) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && isFinite(videoRef.current.duration)) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleSeek = (value: number | readonly number[]) => {
    if (!videoRef.current) return;
    const seekTime = Array.isArray(value) ? value[0] : value;
    if (typeof seekTime === "number" && isFinite(seekTime)) {
      videoRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const handleVolumeChange = (value: number | readonly number[]) => {
    if (!videoRef.current) return;
    const newVolume = Array.isArray(value) ? value[0] : value;
    if (typeof newVolume === "number" && isFinite(newVolume)) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (!newMuted && volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleDownload = async () => {
    if (!canDownloadAllowed) {
      toast.error("Pro feature", {
        description: "Upgrade to Pro to download videos.",
      });
      return;
    }
    try {
      const downloadUrl = `/api/download?url=${encodeURIComponent(src)}`;
      window.location.href = downloadUrl;
    } catch (e) {
      console.error("Download failed", e);
      window.open(src, "_blank");
    }
  };

  // Prevent right-click context menu on video
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!canDownloadAllowed) {
      toast.error("Downloads are for Pro users only");
    }
  };

  // Handle mouse move to show controls
  const handleMouseMove = () => {
    showControlsTemporarily();
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 1000);
    }
  };

  // Block Ctrl+S save shortcut
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!canDownloadAllowed) {
          toast.error("Downloads are for Pro users only");
        }
      }
    };

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [canDownloadAllowed]);

  // Keyboard controls (spacebar to play/pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        const activeElement = document.activeElement;
        const isInputFocused =
          activeElement?.tagName === "INPUT" ||
          activeElement?.tagName === "TEXTAREA" ||
          activeElement?.hasAttribute("contenteditable");

        if (!isInputFocused) {
          e.preventDefault();
          togglePlay();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, []);

  // Calculate safe slider max value
  const sliderMax = isFinite(duration) && duration > 0 ? duration : 100;
  const sliderValue = isFinite(currentTime) ? currentTime : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative group overflow-hidden bg-black aspect-video shadow-lg border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50",
        className,
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      tabIndex={0}
    >
      {/* 1. The Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onEnded={() => {
          setIsPlaying(false);
          setShowControls(true);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
        onContextMenu={handleContextMenu}
        controlsList="nodownload"
      />

      {/* 2. Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>
      )}

      {/* 3. Big Play Button (Centered) - Only shows when paused */}
      {!isPlaying && !isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePlay}
        >
          <div className="w-16 h-16 bg-primary backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-all hover:scale-110">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* 4. Subtitles Display */}
      {showSubtitles && currentSubtitle && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center px-4">
          <div className="bg-black/80 text-white px-4 py-2 rounded-lg text-center max-w-3xl">
            <p className="text-sm md:text-base leading-relaxed">
              {currentSubtitle}
            </p>
          </div>
        </div>
      )}

      {/* 5. Controls Overlay */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        {/* Progress Bar */}
        <div className="mb-4">
          <Slider
            value={[sliderValue]}
            max={sliderMax}
            step={0.1}
            onValueChange={handleSeek}
            className="w-full cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-purple-400 transition-colors"
            >
              {isPlaying ? (
                <Pause className="fill-current w-5 h-5" />
              ) : (
                <Play className="fill-current w-5 h-5" />
              )}
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group/volume">
              <button
                onClick={toggleMute}
                className="text-white hover:text-purple-400 transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              <div className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-300">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  className="w-20"
                />
              </div>
            </div>

            {/* Time */}
            <div className="text-xs text-white/90 font-medium font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Subtitles Toggle - Only show if transcript exists */}
            {transcript && (
              <button
                onClick={() => setShowSubtitles(!showSubtitles)}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  showSubtitles
                    ? "text-purple-400 bg-white/10"
                    : "text-white/70 hover:text-white hover:bg-white/10",
                )}
                title="Toggle Subtitles"
              >
                <Subtitles className="w-4 h-4" />
              </button>
            )}

            {/* Download */}
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-md cursor-pointer transition-all relative text-white"
              title={
                canDownloadAllowed
                  ? "Download Video"
                  : "Pro feature - Upgrade to download"
              }
            >
              <Download className="w-4 h-4" />
              {!canDownloadAllowed && (
                <Lock className="w-2 h-2 absolute -top-0.5 -right-0.5 text-amber-400" />
              )}
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-purple-400 transition-colors cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
