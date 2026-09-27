"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { clearGuestId, getGuestId } from "@/lib/guest";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();

  const [isOpen, setIsOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"signIn" | "signUp">("signIn");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingClaim, setPendingClaim] = React.useState(false);

  const claimGuest = useMutation(api.guest.claimguest);

  // Once Convex has validated the new session, claim any guest videos
  React.useEffect(() => {
    if (!pendingClaim || !isAuthenticated) return;
    setPendingClaim(false);

    let guestId: string;
    try {
      guestId = getGuestId();
    } catch {
      return;
    }

    claimGuest({ guestId })
      .then((result) => {
        clearGuestId();
        if (result && result.videoCount > 0) {
          toast.success(
            `Welcome! ${result.videoCount} of your videos were saved to your account.`,
          );
        } else {
          toast.success("Welcome!");
        }
      })
      .catch((error) => {
        console.error("Failed to claim guest videos:", error);
        toast.success("Welcome!");
      });
  }, [pendingClaim, isAuthenticated, claimGuest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "signUp") {
        const { error } = await authClient.signUp.email({
          name: name.trim() || email,
          email,
          password,
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message);
      }

      setIsOpen(false);
      setPendingClaim(true);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Authentication failed",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setMode("signIn");
      setPassword("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className="cursor-pointer"
        render={children as React.ReactElement}
      />
      <DialogContent className="">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {mode === "signUp" ? "Create account" : "Sign in"}
          </DialogTitle>
          <DialogDescription>
            {mode === "signUp"
              ? "Create an account to save your videos"
              : "Sign in to your account"}
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 space-y-6 bg-background">
          {/* Header */}
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "signUp" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Sign in to save your videos and access them from any device.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signUp" && (
              <Input
                placeholder="Your name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11"
                disabled={isLoading}
                required
              />
            )}
            <Input
              placeholder="name@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
              disabled={isLoading}
              required
            />
            <Input
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
              disabled={isLoading}
              minLength={8}
              required
            />
            {mode === "signUp" && (
              <p className="text-xs text-muted-foreground">
                Password must be at least 8 characters.
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === "signUp" ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            {mode === "signIn" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="text-primary font-medium cursor-pointer hover:underline"
                  onClick={() => setMode("signUp")}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-primary font-medium cursor-pointer hover:underline"
                  onClick={() => setMode("signIn")}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
