"use client";
import {
  BrainCircuit,
  FileText,
  Globe,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    iconClass: "text-purple-500",
    title: "Prompt to Video",
    description:
      "Describe any concept and watch it become an animated Manim video with professional narration, in minutes.",
  },
  {
    icon: FileText,
    iconClass: "text-blue-500",
    title: "Grounded in Your Materials",
    description:
      "Attach PDFs or docs and we combine them with live web research, so every formula and fact is accurate and sources are cited.",
  },
  {
    icon: BrainCircuit,
    iconClass: "text-green-500",
    title: "Self-Healing Pipeline",
    description:
      "Qwen directs the script, writes the animation code, and automatically repairs it against the renderer until the video is pixel-perfect.",
  },
  {
    icon: Globe,
    iconClass: "text-indigo-500",
    title: "Community Library",
    description:
      "Every finished video joins a public library you can browse, search, and learn from. No sign-in required to start creating.",
  },
];

export default function Features() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-6 space-y-12">
        {/* Section heading */}
        <div className="relative z-10 mx-auto max-w-2xl space-y-4 text-center">
          <h2 className="text-balance text-3xl font-semibold md:text-4xl lg:text-5xl">
            Change the way you learn
          </h2>
          <p className="text-muted-foreground">
            Generative turns anything you can write down into an animated
            lesson. No animation skills, no software, no waiting.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="border bg-card p-6 shadow-sm space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`size-5 ${feature.iconClass}`} />
                  <h3 className="text-base font-semibold">{feature.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
