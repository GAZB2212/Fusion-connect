import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Eye, 
  EyeOff, 
  UserPlus, 
  LogOut, 
  KeyRound, 
  CreditCard, 
  UserX, 
  Trash2, 
  FileText,
  ExternalLink
} from "lucide-react";
import type { Profile, Chaperone } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [chaperoneName, setChaperoneName] = useState("");
  const [chaperoneEmail, setChaperoneEmail] = useState("");
  const [relationshipType, setRelationshipType] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Fetch user profile
  const { data: profile } = useQuery<Profile>({
    queryKey: ["/api/profile"],
  });

  // Fetch chaperones
  const { data: chaperones = [] } = useQuery<Chaperone[]>({
    queryKey: ["/api/chaperones"],
  });

  // Update privacy settings
  const updatePrivacyMutation = useMutation({
    mutationFn: async (settings: Partial<Profile>) => {
      return apiRequest("PATCH", "/api/profile", settings);
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Your privacy settings have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add chaperone
  const addChaperoneMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/chaperones", {
        chaperoneName,
        chaperoneEmail,
        relationshipType,
      });
    },
    onSuccess: () => {
      toast({
        title: "Chaperone Added",
        description: "Your chaperone has been added successfully.",
      });
      setChaperoneName("");
      setChaperoneEmail("");
      setRelationshipType("");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/chaperones"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove chaperone
  const removeChaperoneMutation = useMutation({
    mutationFn: async (chaperoneId: string) => {
      return apiRequest("DELETE", `/api/chaperones/${chaperoneId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Chaperone Removed",
        description: "Your chaperone has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chaperones"] });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match");
      }
      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      return apiRequest("POST", "/api/change-password", {
        currentPassword,
        newPassword,
      });
    },
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/logout", {});
    },
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/account", {});
    },
    onSuccess: () => {
      toast({
        title: "Account Deleted",
        description: "Your account and all data have been permanently deleted.",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive",
      });
    },
  });

  // Manage subscription - Opens Stripe Customer Portal
  const manageSubscription = async () => {
    try {
      const response = await apiRequest("POST", "/api/create-portal-session", {});
      if (response.url) {
        window.open(response.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to open subscription management",
        variant: "destructive",
      });
    }
  };

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your privacy and account preferences
          </p>
        </div>

        {/* Privacy Settings */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Privacy Settings
          </h2>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Photo Visibility</Label>
                <p className="text-sm text-muted-foreground">
                  Blur your photos until you match
                </p>
              </div>
              <Switch
                checked={profile.photoVisibility === 'blurred'}
                onCheckedChange={(checked) => {
                  updatePrivacyMutation.mutate({
                    photoVisibility: checked ? 'blurred' : 'visible',
                  });
                }}
                data-testid="switch-blur-photos"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Use Nickname</Label>
                <p className="text-sm text-muted-foreground">
                  Show only your first name to others
                </p>
              </div>
              <Switch
                checked={profile.useNickname ?? false}
                onCheckedChange={(checked) => {
                  updatePrivacyMutation.mutate({
                    useNickname: checked,
                  });
                }}
                data-testid="switch-nickname"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Profile Visibility</Label>
                <p className="text-sm text-muted-foreground">
                  Hide your profile from others
                </p>
              </div>
              <Switch
                checked={!profile.isActive}
                onCheckedChange={(checked) => {
                  updatePrivacyMutation.mutate({
                    isActive: !checked,
                  });
                }}
                data-testid="switch-hide-profile"
              />
            </div>
          </div>
        </Card>

        {/* Chaperone Settings */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Chaperone (Wali)
            </h2>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-add-chaperone">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Chaperone
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Chaperone</DialogTitle>
                  <DialogDescription>
                    Add a family member or guardian to view your conversations
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={chaperoneName}
                      onChange={(e) => setChaperoneName(e.target.value)}
                      placeholder="Chaperone's name"
                      data-testid="input-chaperone-name"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={chaperoneEmail}
                      onChange={(e) => setChaperoneEmail(e.target.value)}
                      placeholder="chaperone@example.com"
                      data-testid="input-chaperone-email"
                    />
                  </div>
                  <div>
                    <Label>Relationship</Label>
                    <Input
                      value={relationshipType}
                      onChange={(e) => setRelationshipType(e.target.value)}
                      placeholder="e.g., Father, Mother, Guardian"
                      data-testid="input-relationship"
                    />
                  </div>
                  <Button
                    onClick={() => addChaperoneMutation.mutate()}
                    disabled={!chaperoneName || !chaperoneEmail || addChaperoneMutation.isPending}
                    className="w-full"
                    data-testid="button-submit-chaperone"
                  >
                    Add Chaperone
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {chaperones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No chaperones added. Add a chaperone to involve family in your conversations.
            </p>
          ) : (
            <div className="space-y-3">
              {chaperones.map((chaperone) => (
                <div
                  key={chaperone.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                  data-testid={`chaperone-${chaperone.id}`}
                >
                  <div>
                    <p className="font-medium">{chaperone.chaperoneName}</p>
                    <p className="text-sm text-muted-foreground">
                      {chaperone.chaperoneEmail}
                      {chaperone.relationshipType && ` • ${chaperone.relationshipType}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeChaperoneMutation.mutate(chaperone.id)}
                    data-testid={`button-remove-${chaperone.id}`}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Security */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Security
          </h2>
          
          <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full" data-testid="button-change-password">
                <KeyRound className="h-4 w-4 mr-2" />
                Change Password
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Password</DialogTitle>
                <DialogDescription>
                  Enter your current password and choose a new one
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Current Password</Label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="pr-10"
                      data-testid="input-current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="button-toggle-current-password"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label>New Password</Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="pr-10"
                      data-testid="input-new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="button-toggle-new-password"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label>Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="pr-10"
                      data-testid="input-confirm-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="button-toggle-confirm-password"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  onClick={() => changePasswordMutation.mutate()}
                  disabled={!currentPassword || !newPassword || !confirmPassword || changePasswordMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-password"
                >
                  {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </Card>

        {/* Subscription Management */}
        {profile.isPremium && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Manage your subscription, payment method, and billing history
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={manageSubscription}
              data-testid="button-manage-subscription"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Manage Subscription
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </Card>
        )}

        {/* Legal & Support */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Legal & Support
          </h2>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setLocation("/privacy-policy")}
              data-testid="button-privacy-policy"
            >
              <FileText className="h-4 w-4 mr-2" />
              Privacy Policy
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setLocation("/terms-of-service")}
              data-testid="button-terms-of-service"
            >
              <FileText className="h-4 w-4 mr-2" />
              Terms of Service
            </Button>
          </div>
        </Card>

        {/* Account */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Account</h2>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {logoutMutation.isPending ? "Logging out..." : "Log Out"}
            </Button>

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setDeleteAccountDialogOpen(true)}
              data-testid="button-open-delete-account"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </div>
        </Card>

        {/* Delete Account Confirmation */}
        <AlertDialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
          <AlertDialogContent data-testid="dialog-delete-account">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Trash2 className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <AlertDialogTitle className="text-xl">Delete Account?</AlertDialogTitle>
                </div>
              </div>
              <AlertDialogDescription className="pt-2 space-y-3">
                <p className="font-medium">This action cannot be undone. This will permanently delete:</p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                  <li>Your profile and all photos</li>
                  <li>All matches and conversations</li>
                  <li>Your subscription (you won't be charged again)</li>
                  <li>All account data and settings</li>
                </ul>
                <p className="pt-2 text-sm">
                  Are you absolutely sure you want to delete your account? Type <strong>"DELETE"</strong> below to confirm.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                disabled={deleteAccountMutation.isPending}
                data-testid="button-cancel-delete"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteAccountMutation.mutate()}
                disabled={deleteAccountMutation.isPending}
                className="bg-destructive hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteAccountMutation.isPending ? "Deleting..." : "Delete My Account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
