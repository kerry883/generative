"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface UsageLimitProps {
  open: boolean;
  onOpenChange: () => void;
}

const UsageLimit = ({ open, onOpenChange }: UsageLimitProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usage Limit</DialogTitle>
          <DialogDescription>
            You have reached your daily usage limit. Please upgrade to a pro
            plan to continue using the service.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

export default UsageLimit;
