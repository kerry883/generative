//@ts-nocheck
"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BrainCircuit, FolderGit2, Globe, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

type FeatureKey = "item-1" | "item-2" | "item-3" | "item-4";

interface FeatureMedia {
  video: string;
  poster: string;
  alt: string;
}

const featureMedia: Record<FeatureKey, FeatureMedia> = {
  "item-1": {
    video: "https://videos.foldex.space/creatingfolder1.mp4",
    poster: "/createfolder.png",
    alt: "Create folder demonstration",
  },
  "item-2": {
    video: "https://videos.foldex.space/videogeneration1.mp4",
    poster: "/videogenerationthumbnail.png",
    alt: "Video generation demonstration",
  },
  "item-3": {
    video: "https://videos.foldex.space/chatwithdocuments.mp4",
    poster: "/chatwiththumbnail.png",
    alt: "Grounded intelligence with citations",
  },
  "item-4": {
    video: "https://videos.foldex.space/explore1.mp4",
    poster: "/explorethumbnail.png",
    alt: "Explore page demonstration",
  },
};

export default function Features() {
  const [activeItem, setActiveItem] = useState<FeatureKey>("item-1");
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset and play video when feature changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {
        // Autoplay may be blocked, that's ok
      });
    }
  }, [activeItem]);

  return (
    <section className="py-16 md:py-24">
      <div className="bg-linear-to-b absolute inset-0 -z-10 sm:inset-6 sm:rounded-b-3xl dark:block dark:to-[color-mix(in_oklab,var(--color-zinc-900)_75%,var(--color-background))]"></div>
      <div className="space-y-8 px-6 md:space-y-12 lg:space-y-16 dark:[--color-border:color-mix(in_oklab,var(--color-white)_10%,transparent)]">
        {/* Section heading - moved to top for better video height */}
        <div className="relative z-10 mx-auto max-w-2xl space-y-4 text-center">
          <h2 className="text-balance text-3xl font-semibold md:text-4xl lg:text-5xl">
            Join Foldex and change the way you learn
          </h2>
          <p className="text-muted-foreground">
            A complete operating system for your learning. Foldex isn&apos;t
            just for storage. It&apos;s an interactive workspace that grows with
            your knowledge.
          </p>
        </div>

        {/* 30/70 layout: Accordion (30%) | Video (70%) */}
        <div className="mx-auto max-w-7xl grid gap-8 md:grid-cols-[1fr_2fr] lg:gap-12 items-start">
          {/* Accordion - 30% */}
          <Accordion
            type="single"
            value={activeItem}
            onValueChange={(value) =>
              setActiveItem(value as unknown as FeatureKey)
            }
            className="w-full"
          >
            {/* FEATURE 1: ORGANIZATION */}
            <AccordionItem value="item-1">
              <AccordionTrigger>
                <div className="flex items-center gap-2 text-base">
                  <FolderGit2 className="size-4 text-blue-500" />
                  Smart Organization
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Escape tab fatigue. Manage your notes, PDFs, flashcards, and
                media in one synchronized, nested file system designed for deep
                work.
              </AccordionContent>
            </AccordionItem>

            {/* FEATURE 2: VIDEO GENERATION */}
            <AccordionItem value="item-2">
              <AccordionTrigger>
                <div className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-purple-500" />
                  Generative Video Tutors
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Don&apos;t just read it—see it. Turn complex text into
                mathematically accurate, animated videos instantly to visualize
                the &quot;why&quot; behind the logic.
              </AccordionContent>
            </AccordionItem>

            {/* FEATURE 3: AI CITATIONS */}
            <AccordionItem value="item-3">
              <AccordionTrigger>
                <div className="flex items-center gap-2 text-base">
                  <BrainCircuit className="size-4 text-green-500" />
                  Grounded Intelligence
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Chat with your files, not a generic bot. Every AI answer
                includes{" "}
                <span className="text-foreground font-medium">
                  inline citations
                </span>{" "}
                that jump directly to the source paragraph in your lectures.
              </AccordionContent>
            </AccordionItem>

            {/* FEATURE 4: COMMUNITY/MARKETPLACE */}
            <AccordionItem value="item-4">
              <AccordionTrigger>
                <div className="flex items-center gap-2 text-base">
                  <Globe className="size-4 text-indigo-500" />
                  Community Knowledge Base
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Don&apos;t start from scratch. Discover and clone public folders
                from top students. Why write notes if someone else has already
                aced the class?
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Video Player - 70% */}
          <div className="bg-background relative flex overflow-hidden  border shadow-lg">
            <div className="aspect-auto bg-background relative w-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activeItem}-video`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="size-full overflow-hidden"
                >
                  <video
                    ref={videoRef}
                    src={featureMedia[activeItem].video}
                    poster={featureMedia[activeItem].poster}
                    className="size-full object-cover"
                    playsInline
                    muted
                    loop
                    autoPlay
                    preload="metadata"
                  >
                    Your browser does not support the video tag.
                  </video>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
