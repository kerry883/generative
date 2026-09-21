"use client";

import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Video, AlertTriangle } from "lucide-react";

interface ClaimVideoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  guestId: string | null;
  videoTitle?: string;
}

export function ClaimVideoDialog({
  isOpen,
  onClose,
  guestId,
  videoTitle,
}: ClaimVideoDialogProps) {
  const handleSignup = () => {
    // Pass the guestId in the URL so the main app can claim the videos
    const signupUrl = guestId
      ? `https://foldex.space/signup?claim_guest_id=${encodeURIComponent(guestId)}`
      : "https://foldex.space/signup";
    window.open(signupUrl, "_blank");
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 h-12 w-12 bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Your Video is Being Generated! 🎉
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-3">
            <p>
              {videoTitle ? (
                <>
                  <span className="font-medium text-foreground">
                    "{videoTitle}"
                  </span>{" "}
                  is now being created.
                </>
              ) : (
                "Your video is now being created."
              )}
            </p>

            <div className="bg-amber-500/10 border border-amber-500/20 p-3 text-left space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    Guest videos are temporary
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Sign up for Foldex to save your videos permanently and
                    unlock unlimited generations.
                  </p>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleSignup} className="w-full gap-2">
            <Video className="h-4 w-4" />
            Join Foldex & Save My Videos
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Continue as Guest
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
