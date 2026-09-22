"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bug, Lightbulb, MessageSquare, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface BugReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BugReportDialog({ open, onOpenChange }: BugReportDialogProps) {
  const [type, setType] = useState<"bug" | "feature" | "other">("bug");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitFeedback = useAction(api.feedback.submitFeedback);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);

    try {
      await submitFeedback({
        type,
        message,
        pageUrl: window.location.href, // Auto-capture URL
        browserInfo: navigator.userAgent, // Auto-capture Browser/Device
      });

      toast.success("Feedback sent!", {
        description: "Thanks for helping us make Foldex better.",
      });

      onOpenChange(false);
      setMessage(""); // Reset form
      setType("bug");
    } catch (error) {
      console.error(error);
      toast.error("Failed to send feedback", {
        description: "Please try again later or email us directly.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Found a bug or have a feature idea? Let us know directly.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Feedback Type Selector */}
          <div className="space-y-2">
            <Label>What is this about?</Label>
            <Select
              value={type}
              onValueChange={(val: any) => setType(val)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">
                  <div className="flex items-center gap-2">
                    <Bug className="h-4 w-4 text-red-500" />
                    <span>Bug Report</span>
                  </div>
                </SelectItem>
                <SelectItem value="feature">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    <span>Feature Request</span>
                  </div>
                </SelectItem>
                <SelectItem value="other">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    <span>General Feedback</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Message Area */}
          <div className="space-y-2">
            <Label>Details</Label>
            <Textarea
              placeholder={
                type === "bug"
                  ? "Describe what happened and what you expected..."
                  : "Tell us about your idea..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px] max-h-[120px] overflow-y-auto scrollbar-hidden"
              disabled={isSubmitting}
              required
            />
          </div>

          <DialogFooter>
            {/* Cancel Button (Optional) */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            {/* Submit Button */}
            <Button type="submit" disabled={isSubmitting || !message.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Report
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
