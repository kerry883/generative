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
import Link from "next/link";

export function ProfileDropdown() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { theme, setTheme } = useTheme();
  const [showPricing, setShowPricing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [showBug, setShowBug] = useState(false);

  const { resolvedTheme } = useTheme();

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
          <DropdownMenuItem className="cursor-pointer">
            <Link
              href="https://discord.gg/bMHfCXz6bv"
              target="_blank"
              className="flex items-center gap-2"
            >
              <svg
                width="800px"
                height="800px"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M20.317 4.4921C18.7873 3.80147 17.147 3.29265 15.4319 3.00122C15.4007 2.9956 15.3695 3.00965 15.3534 3.03777C15.1424 3.40697 14.9087 3.88862 14.7451 4.26719C12.9004 3.99545 11.0652 3.99545 9.25832 4.26719C9.09465 3.8802 8.85248 3.40697 8.64057 3.03777C8.62449 3.01059 8.59328 2.99654 8.56205 3.00122C6.84791 3.29172 5.20756 3.80054 3.67693 4.4921C3.66368 4.49772 3.65233 4.5071 3.64479 4.51928C0.533392 9.09311 -0.31895 13.5545 0.0991801 17.9606C0.101072 17.9822 0.11337 18.0028 0.130398 18.0159C2.18321 19.4993 4.17171 20.3998 6.12328 20.9967C6.15451 21.0061 6.18761 20.9949 6.20748 20.9695C6.66913 20.3492 7.08064 19.6952 7.43348 19.0073C7.4543 18.967 7.43442 18.9192 7.39186 18.9033C6.73913 18.6597 6.1176 18.3626 5.51973 18.0253C5.47244 17.9981 5.46865 17.9316 5.51216 17.8997C5.63797 17.8069 5.76382 17.7104 5.88396 17.613C5.90569 17.5952 5.93598 17.5914 5.96153 17.6026C9.88928 19.3672 14.1415 19.3672 18.023 17.6026C18.0485 17.5905 18.0788 17.5942 18.1015 17.612C18.2216 17.7095 18.3475 17.8069 18.4742 17.8997C18.5177 17.9316 18.5149 17.9981 18.4676 18.0253C17.8697 18.3692 17.2482 18.6597 16.5945 18.9024C16.552 18.9183 16.533 18.967 16.5538 19.0073C16.9143 19.6942 17.3258 20.3483 17.7789 20.9686C17.7978 20.9949 17.8319 21.0061 17.8631 20.9967C19.8241 20.3998 21.8126 19.4993 23.8654 18.0159C23.8834 18.0028 23.8948 17.9831 23.8967 17.9616C24.3971 12.8676 23.0585 8.4428 20.3482 4.52021C20.3416 4.5071 20.3303 4.49772 20.317 4.4921ZM8.02002 15.2778C6.8375 15.2778 5.86313 14.2095 5.86313 12.8976C5.86313 11.5857 6.8186 10.5175 8.02002 10.5175C9.23087 10.5175 10.1958 11.5951 10.1769 12.8976C10.1769 14.2095 9.22141 15.2778 8.02002 15.2778ZM15.9947 15.2778C14.8123 15.2778 13.8379 14.2095 13.8379 12.8976C13.8379 11.5857 14.7933 10.5175 15.9947 10.5175C17.2056 10.5175 18.1705 11.5951 18.1516 12.8976C18.1516 14.2095 17.2056 15.2778 15.9947 15.2778Z"
                  fill={resolvedTheme === "dark" ? "#fff" : "#000"}
                />
              </svg>
              Join Discord
            </Link>
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
