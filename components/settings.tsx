"use client";

import * as React from "react";
import { useUser } from "@clerk/nextjs";
import {
  User,
  Lock,
  Camera,
  ShieldX,
  Loader2,
  Check,
  CreditCard,
} from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import BillingDialog from "./billing-dialog";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Navigation Items
const data = {
  nav: [
    { name: "Profile", id: "profile", icon: User },
    // { name: "Security", id: "security", icon: Lock },
  ],
};

interface AccountModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AccountModal({ isOpen, onOpenChange }: AccountModalProps) {
  const { user, isLoaded } = useUser();
  const [activeSection, setActiveSection] = React.useState("profile");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const updateauthor = useMutation(api.folders.updateauthor);
  // --- Form State ---
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [imageFile, setImageFile] = React.useState<File | null>(null);

  // Sync state when modal opens
  React.useEffect(() => {
    if (isLoaded && user && isOpen) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setImagePreview(null);
      setImageFile(null);
      setActiveSection("profile"); // Reset to profile
    }
  }, [isLoaded, user, isOpen]);

  const hasChanges =
    isLoaded && user
      ? firstName.trim() !== (user.firstName || "") ||
        lastName.trim() !== (user.lastName || "") ||
        !!imageFile
      : false;

  const authProvider =
    user?.primaryEmailAddress?.linkedTo?.[0]?.type || "email";

  // --- Handlers ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image too large (max 2MB)");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isLoaded || !user || !hasChanges) return;

    setIsLoading(true);
    try {
      const promises: Promise<any>[] = [];
      if (firstName !== user.firstName || lastName !== user.lastName) {
        promises.push(user.update({ firstName, lastName }));
      }
      if (imageFile) {
        promises.push(user.setProfileImage({ file: imageFile }));
      }
      await Promise.all(promises);

      // Reload user to get the updated image URL from Clerk
      await user.reload();

      // Now get the fresh data after reload
      const fullName = `${firstName} ${lastName}`.trim() || "Anonymous";
      const profileUrl = user.imageUrl; // This now has the updated URL

      await updateauthor({
        authorname: fullName,
        authorprofile: profileUrl,
      });

      toast.success("Profile updated");
      // Don't close modal, just update state logic if needed
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || "Error updating profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await user.delete();
      toast.success("Account deleted");
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to delete account");
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your account settings
        </DialogDescription>

        {/* <SidebarProvider className="items-start h-full">
          <Sidebar
            collapsible="none"
            className="hidden md:flex w-60 border-r bg-muted/30"
          >
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {data.nav.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={activeSection === item.id}
                          onClick={() => setActiveSection(item.id)}
                        >
                          <item.icon className="mr-2 size-4" />
                          <span>{item.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar> */}

          {/* RIGHT MAIN CONTENT */}
          <main className="flex h-[500px] flex-1 flex-col overflow-hidden bg-background">
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {!isLoaded ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-20 rounded-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  {activeSection === "profile" && (
                    <div className="space-y-6 max-w-xl">
                      <div className="flex items-center gap-6">
                        <Avatar className="h-30 w-20 ">
                          <AvatarImage
                            src={imagePreview || user?.imageUrl}
                            className="rounded-none  h-30 w-20 "
                          />
                          <AvatarFallback>User</AvatarFallback>
                        </Avatar>
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className="cursor-pointer"
                          >
                            Change Picture
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageChange}
                          />
                          <p className="text-xs text-muted-foreground">
                            Max 2MB. JPG, PNG, GIF.
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>First Name</Label>
                            <Input
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              disabled={isLoading}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Last Name</Label>
                            <Input
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              disabled={isLoading}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            value={user?.emailAddresses[0]?.emailAddress}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* {activeSection === "security" && (
                    <div className="space-y-6 max-w-xl">
                      <div>
                        <h3 className="text-lg font-medium">Security</h3>
                        <p className="text-sm text-muted-foreground">
                          Manage your account security and preferences.
                        </p>
                      </div>
                      <Separator />

                      <div className="space-y-2">
                        <Label>Authentication Provider</Label>
                        <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50 text-sm">
                          {authProvider === "email" ? (
                            <Lock className="h-4 w-4" />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                          {authProvider === "email"
                            ? "Signed in with Email & Password"
                            : `Signed in via ${authProvider.charAt(0).toUpperCase() + authProvider.slice(1)}`}
                        </div>
                      </div>

                      <div className="pt-6">
                        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                          <div className="flex items-center gap-2 mb-2 text-destructive">
                            <ShieldX className="h-5 w-5" />
                            <h4 className="font-semibold">Danger Zone</h4>
                          </div>
                          <p className="text-sm text-muted-foreground mb-4">
                            Deleting your account is permanent. All your data
                            will be lost.
                          </p>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={isLoading}
                              >
                                Delete Account
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Are you absolutely sure?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will
                                  permanently delete your account and remove
                                  your data from our servers.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={handleDeleteAccount}
                                  disabled={isDeleting}
                                >
                                  {isDeleting ? (
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                  ) : (
                                    "Delete Account"
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  )} */}
                </>
              )}
            </div>

            {/* Footer with Actions */}
            {activeSection === "profile" && (
              <div className="flex items-center justify-end gap-2 p-4 border-t bg-muted/10">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSave()}
                  disabled={isLoading || !hasChanges}
                  className="cursor-pointer"
                >
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            )}
          </main>
      </DialogContent>
    </Dialog>
  );
}
