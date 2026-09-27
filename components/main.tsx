"use client";
import { useRef, useState } from "react";
import {
  FileText,
  SendHorizonal,
  Upload,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Label } from "./ui/label";
import { TextLoop } from "./ui/text-loop";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useGuestId } from "@/lib/guest";
import { Textarea } from "./ui/textarea";
import { useConvexAuth } from "convex/react";

const Main = () => {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [selectedfile, setselectedfile] = useState<File | null>(null);
  const fileinputref = useRef<HTMLInputElement>(null);
  const [isGenerating, setisGenerating] = useState(false);
  const guestId = useGuestId();

  const { isAuthenticated } = useConvexAuth();

  const suggestions = [
    "Explain Neural Networks",
    "Explain Machine Learning",
    "Explain Pythagorean theorem",
  ];

  const handlesend = async () => {
    if (!prompt.trim()) return;

    setisGenerating(true);
    try {
      const formdata = new FormData();
      formdata.append("prompt", prompt);
      if (selectedfile) formdata.append("file", selectedfile);

      let response: Response;
      if (isAuthenticated) {
        response = await fetch("/api/generate-auth", {
          method: "POST",
          body: formdata,
        });
      } else {
        if (!guestId) {
          toast.error("Please wait, initializing...");
          return;
        }
        formdata.append("guestId", guestId);
        response = await fetch("/api/generate", {
          method: "POST",
          body: formdata,
        });
      }

      const data = await response.json();

      if (!response.ok) {
        const rawError = data.error || data.message || "Video generation failed";
        const errorMessage =
          typeof rawError === "string" ? rawError : JSON.stringify(rawError);
        throw new Error(errorMessage);
      }

      setPrompt("");
      toast.success("Video submitted! We'll notify you when it's ready.");
      router.replace(`/watch/${data.videoId}`);
    } catch (error) {
      console.error("video generation error", error);
      const message =
        error instanceof Error
          ? error.message
          : "Video generation failed. Please try again.";
      toast.error(message);
    } finally {
      setisGenerating(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6 max-w-4xl mx-auto space-y-8">
      <div className="w-full h-14" />
      {/* Header Section */}
      <div className="text-4xl font-bold tracking-tight text-center">
        Turn Any{" "}
        <TextLoop
          className="overflow-y-clip text-primary"
          transition={{
            type: "spring",
            stiffness: 900,
            damping: 80,
            mass: 10,
          }}
          variants={{
            initial: {
              y: 20,
              rotateX: 90,
              opacity: 0,
              filter: "blur(4px)",
            },
            animate: {
              y: 0,
              rotateX: 0,
              opacity: 1,
              filter: "blur(0px)",
            },
            exit: {
              y: -20,
              rotateX: -90,
              opacity: 0,
              filter: "blur(4px)",
            },
          }}
        >
          <span>Prompts</span>
          <span>Pdfs</span>
          <span>Docs</span>
        </TextLoop>
        <div className="mt-2 text-foreground/80">into manim videos</div>
      </div>

      <div className="w-full space-y-4">
        {/* Suggestions Section */}
        <div className="flex flex-wrap justify-center gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setPrompt(suggestion)}
              className="px-3 py-1.5 text-xs font-medium border bg-background hover:bg-muted transition-colors flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Sparkles className="h-3 w-3" />
              {suggestion}
            </button>
          ))}
        </div>

        {/* AI Input Container */}
        <div className="relative group border bg-card shadow-sm hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handlesend();
              }
            }}
            placeholder="Describe the video you want to create..."
            className="min-h-[120px] max-h-[120px] overflow-y-auto scrollbar-hidden border-none bg-transparent px-4 pr-14 text-base focus-visible:ring-0"
          />
          <div className="absolute right-2 bottom-2">
            <Button
              size="icon"
              disabled={!prompt || isGenerating}
              onClick={handlesend}
              className={cn(
                "transition-all",
                prompt ? "opacity-100 scale-100" : "opacity-0 scale-90",
              )}
            >
              {isGenerating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <SendHorizonal className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Reference Material Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <Label className="text-sm font-semibold text-muted-foreground">
              Reference Material{" "}
              <span className="font-normal opacity-70">(optional)</span>
            </Label>
          </div>

          <div
            className={cn(
              "relative group cursor-pointer border-dashed border-2 transition-all duration-200",
              selectedfile
                ? "border-primary/30 bg-primary/5 p-3"
                : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30 p-6",
            )}
            onClick={() => !selectedfile && fileinputref.current?.click()}
          >
            <input
              type="file"
              ref={fileinputref}
              className="hidden"
              accept=".pdf,.docx"
              onChange={(e) => setselectedfile(e.target.files?.[0] || null)}
            />

            {selectedfile ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-background border flex items-center justify-center shadow-sm">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[200px]">
                      {selectedfile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedfile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setselectedfile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop a Pdf/Doc or{" "}
                  <span className="text-primary font-medium">browse</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Main;
