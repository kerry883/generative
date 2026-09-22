"use client";

import * as React from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

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
import { Separator } from "@/components/ui/separator";
import { EmailCodeFactor } from "@clerk/types";

// Steps for our multi-stage form
type AuthStep = "email" | "code" | "details";

export function AuthDialog({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoaded: isSignInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp } = useSignUp();

  const [isOpen, setIsOpen] = React.useState(false);
  const [step, setStep] = React.useState<AuthStep>("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  // Track if we are in "Sign Up" or "Sign In" mode internally
  const [flow, setFlow] = React.useState<"signIn" | "signUp">("signIn");

  // 1. Handle Google Login (One Click)
  const handleGoogleLogin = async () => {
    if (!isSignInLoaded) return;
    try {
      setIsLoading(true);
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err) {
      console.log(err);
      toast.error("Google login failed");
      setIsLoading(false);
    }
  };

  // 2. Handle Email Submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignInLoaded || !isSignUpLoaded) return;
    setIsLoading(true);

    try {
      // 1. Start the Sign In process
      const signInAttempt = await signIn.create({ identifier: email });

      // 2. Find the 'email_code' strategy in the supported factors
      const emailFactor = signInAttempt.supportedFirstFactors?.find(
        (factor) => factor.strategy === "email_code",
      ) as EmailCodeFactor;

      if (!emailFactor || !emailFactor.emailAddressId) {
        // Should not happen for valid email users, but good safety
        throw new Error("No email code factor found");
      }

      // 3. Prepare the factor using the specific ID we found
      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: emailFactor.emailAddressId, // <--- This fixes the red error
      });

      setFlow("signIn");
      setStep("code");
      toast.success("Verification code sent to your email");
    } catch (signInError: any) {
      console.log("signInError", signInError);

      // IF USER NOT FOUND -> SWITCH TO SIGN UP
      if (signInError.errors?.[0]?.code === "form_identifier_not_found") {
        try {
          await signUp.create({ emailAddress: email });
          await signUp.prepareEmailAddressVerification({
            strategy: "email_code",
          });
          setFlow("signUp");
          setStep("code");
          toast.success("Account created! Code sent to your email");
        } catch (signUpError) {
          console.log("signUpError", signUpError);
          toast.error("Error creating account");
        }
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Handle Code Verification
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignInLoaded || !isSignUpLoaded) return;
    setIsLoading(true);

    try {
      if (flow === "signIn") {
        const result = await signIn.attemptFirstFactor({
          strategy: "email_code",
          code,
        });

        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
          finishAuth();
        } else {
          console.log(result);
          toast.error("Verification incomplete");
        }
      } else {
        // Sign Up Flow
        const result = await signUp.attemptEmailAddressVerification({ code });
        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
          finishAuth();
        } else {
          toast.error("Verification failed");
        }
      }
    } catch (err) {
      toast.error("Invalid code");
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Finalize & Sync with Convex - Claim guest videos
  const claimGuest = useMutation(api.guest.claimguest);

  const finishAuth = async () => {
    try {
      // Check if user has guest videos to claim
      const guestId = localStorage.getItem("foldex_guest_id");
      if (guestId) {
        try {
          await claimGuest({ guestId });
          localStorage.removeItem("foldex_guest_id");
          toast.success("Welcome! Your videos have been saved.");
        } catch (claimError) {
          console.error("Failed to claim guest videos:", claimError);
          toast.success("Welcome! 3 Free Credits added.");
        }
      } else {
        toast.success("Welcome! 3 Free Credits added.");
      }

      setIsOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        className="cursor-pointer"
        render={children as React.ReactElement}
      />
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <div className="p-6 space-y-6 bg-background">
          {/* Header */}
          <div className="space-y-2 text-center">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {step === "code" ? "Check your inbox" : "Unlock your credits"}
            </DialogTitle>
            <DialogDescription>
              {step === "code"
                ? `We sent a code to ${email}`
                : "Sign in to save your videos and get 3 free generations."}
            </DialogDescription>
          </div>

          {/* Step 1: Email & Google */}
          {step === "email" && (
            <div className="space-y-4">
              <Button
                variant="outline"
                className="w-full h-11 relative font-medium"
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                {!isLoading && (
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Continue with Google"
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <Input
                  placeholder="name@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  disabled={isLoading}
                  required
                />
                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Continue"
                  )}
                </Button>
              </form>
            </div>
          )}

          {/* Step 2: Code Verification */}
          {step === "code" && (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  className="text-center text-2xl tracking-[1em] h-14 font-mono font-bold"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} // Only numbers
                  placeholder="000000"
                  autoFocus
                  disabled={isLoading}
                />
                <p className="text-xs text-center text-muted-foreground">
                  Enter the 6-digit code sent to your email.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full h-11"
                disabled={isLoading || code.length !== 6}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Verify & Sign In"
                )}
              </Button>

              <Button
                variant="ghost"
                type="button"
                className="w-full text-xs"
                onClick={() => setStep("email")}
              >
                Change email
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
