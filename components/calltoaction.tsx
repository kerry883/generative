"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useGuestIdentity } from "@/lib/fingerprinthook";

export default function CallToAction() {
  const { guestId } = useGuestIdentity();
  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden border bg-card px-6 py-16 text-center shadow-sm md:px-12 md:py-24 lg:px-20 dark:shadow-none">
          <div className="relative z-10 mx-auto max-w-3xl space-y-8">
            {/* Small Badge */}
            <div className="inline-flex items-center  border bg-muted/50 px-3 py-1 text-sm font-medium backdrop-blur-sm">
              <Sparkles className="mr-2 size-4 text-primary fill-primary/20" />
              <span>Study smarter, not harder</span>
            </div>

            {/* Main Headline */}
            <h2 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Ready to build your <br className="hidden md:block" />
              <span className="text-primary dark:text-primary">
                Second Brain?
              </span>
            </h2>

            {/* Subheading */}
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg text-balance md:text-xl">
              Join me and other students who have ditched the chaos of scattered
              tabs. Create your first folder today and turn your notes into a
              mastery engine.
            </p>

            {/* Buttons */}
            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                className="h-12 px-10 text-base transition-transform hover:scale-105 cursor-pointer "
              >
                <Link
                  href={`https://foldex.space/claim?claim_guest_id=${guestId}`}
                  className="flex items-center gap-2"
                  target="_blank"
                >
                  Get Started for Free
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>

            {/* Micro-copy for Trust */}
            <p className="pt-4 text-sm text-muted-foreground">
              No credit card required • Free plan available forever.dont worry
              your videos will be saved
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
