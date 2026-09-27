"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export default function CallToAction() {
  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden border bg-card px-6 py-16 text-center shadow-sm md:px-12 md:py-24 lg:px-20 dark:shadow-none">
          <div className="relative z-10 mx-auto max-w-3xl space-y-8">
            {/* Small Badge */}
            <div className="inline-flex items-center  border bg-muted/50 px-3 py-1 text-sm font-medium backdrop-blur-sm">
              <Sparkles className="mr-2 size-4 text-primary fill-primary/20" />
              <span>Learn by watching, not by reading</span>
            </div>

            {/* Main Headline */}
            <h2 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Ready to turn your ideas into{" "}
              <span className="text-primary dark:text-primary">
                animated lessons?
              </span>
            </h2>

            {/* Subheading */}
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg text-balance md:text-xl">
              Type a prompt, attach your notes, and get a narrated Manim video.
              Free, unlimited, and no sign-in required.
            </p>

            {/* Buttons */}
            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                className="h-12 px-10 text-base transition-transform hover:scale-105 cursor-pointer "
              >
                <Link href="/" className="flex items-center gap-2">
                  Create your first video
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-10 text-base cursor-pointer"
              >
                <Link href="/videovault">Browse the library</Link>
              </Button>
            </div>

            {/* Micro-copy for Trust */}
            <p className="pt-4 text-sm text-muted-foreground">
              Powered by Qwen · Videos render in the cloud while you wait
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
