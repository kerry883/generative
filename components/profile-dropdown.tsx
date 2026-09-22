"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Crown,
  LogOut,
  Moon,
  Settings,
  Sun,
  Sparkles,
  CircleUserRound,
  CreditCard,
  Bug,
  MessageCircle,
} from "lucide-react";
import SubscriptionDialog from "./pricingdialog";
import { AccountModal } from "./settings";
import BillingDialog from "./billing-dialog";
import { BugReportDialog } from "./feedback";

export function ProfileDropdown() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { theme, setTheme } = useTheme();
  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [showBug, setShowBug] = useState(false);

  const subscription = useQuery(api.subscriptions.getSubscription);
  const isPro = subscription?.tier === "pro";

  if (!user) return null;

  const initials = user.firstName
    ? `${user.firstName.charAt(0)}${user.lastName?.charAt(0) || ""}`
    : user.emailAddresses[0]?.emailAddress.charAt(0).toUpperCase() || "U";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 outline-none cursor-pointer">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user.imageUrl}
              alt={user.fullName || "User"}
              className="rounded-none"
            />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          {isPro && (
            <Badge
              variant="secondary"
              className="bg-gradient-to-r from-amber-500 to-orange-500  border-none text-xs px-1.5"
            >
              PRO
            </Badge>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user.fullName || "User"}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.emailAddresses[0]?.emailAddress}
                </p>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />

          {!isPro && (
            <DropdownMenuItem
              onClick={() => setShowPricing(true)}
              className="cursor-pointer"
            >
              <Crown className="mr-2 h-4 w-4 text-amber-500" />
              <span>Upgrade to Pro</span>
              <Sparkles className="ml-auto h-3 w-3 text-amber-500" />
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="cursor-pointer"
          >
            {theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setShowSettings(true)}
          >
            <CircleUserRound className="mr-2 h-4 w-4" />
            <span>Account</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setShowBilling(true)}
            className="cursor-pointer"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Billing</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowBug(true)}
            className="cursor-pointer"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            <span>Feedback/Report Bug</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => signOut()}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SubscriptionDialog isOpen={showPricing} onOpenChange={setShowPricing} />
      <AccountModal isOpen={showSettings} onOpenChange={setShowSettings} />
      <BillingDialog open={showBilling} onOpenChange={setShowBilling} />
      <BugReportDialog open={showBug} onOpenChange={setShowBug} />
    </>
  );
}
