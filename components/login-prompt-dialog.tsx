"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Video, Lock, Sparkles } from "lucide-react";
import { AuthDialog } from "./auth";

interface LoginPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle?: string;
}

export function LoginPromptDialog({
  isOpen,
  onClose,
  videoTitle,
}: LoginPromptDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Video className="h-8 w-8 text-primary" />
          </div>

          <AlertDialogTitle className="text-xl">
            Your video is generating!
          </AlertDialogTitle>

          <AlertDialogDescription className="space-y-3">
            {videoTitle && (
              <p className="font-medium text-foreground">"{videoTitle}"</p>
            )}

            <div className="bg-muted/50 border p-3 text-left space-y-2">
              <div className="flex items-start gap-2">
                <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    Sign in to save your video
                  </p>
                  <p className="text-muted-foreground">
                    Guest videos are temporary and may be deleted. Create a free
                    account to keep your videos forever.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>3 free video generations when you sign up!</span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AuthDialog>
            <Button className="w-full gap-2">
              <Video className="h-4 w-4" />
              Sign In & Save Video
            </Button>
          </AuthDialog>

          <Button variant="ghost" onClick={onClose} className="w-full">
            Continue as Guest
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
