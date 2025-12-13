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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ExternalLink,
  MessageSquare,
  Copy,
  Link,
  User,
  Edit3,
  MapPin,
  Calendar,
  Ruler,
  Upload,
  X
} from "lucide-react";
import type { Profile, Chaperone } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  HEIGHT_OPTIONS_CM,
  SECT_OPTIONS,
  RELIGIOUS_PRACTICE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  ETHNICITY_OPTIONS,
  EDUCATION_OPTIONS,
} from "@shared/constants";
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
  const [accessType, setAccessType] = useState<"live" | "report">("live");
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
  
  // Profile editing state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Partial<Profile>>({});
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [selectedEthnicities, setSelectedEthnicities] = useState<string[]>([]);

  // Fetch user profile
  const { data: profile } = useQuery<Profile>({
    queryKey: ["/api/profile"],
  });

  // Fetch chaperones
  const { data: chaperones = [] } = useQuery<Chaperone[]>({
    queryKey: ["/api/chaperones"],
  });

  // Fetch subscription status
  const { data: subscriptionStatus } = useQuery<{
    hasActiveSubscription: boolean;
    status?: string;
  }>({
    queryKey: ["/api/subscription-status"],
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
        accessType,
      });
    },
    onSuccess: () => {
      toast({
        title: "Chaperone Added",
        description: accessType === 'live' 
          ? "Your chaperone has been added and can now access conversations."
          : "Your chaperone has been added and will receive conversation reports.",
      });
      setChaperoneName("");
      setChaperoneEmail("");
      setRelationshipType("");
      setAccessType("live");
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

  // Reset matches mutation (testing only)
  const resetMatchesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/dev/reset-matches", {});
    },
    onSuccess: () => {
      toast({
        title: "Matches Reset",
        description: "All matches and swipes have been cleared.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset matches",
        variant: "destructive",
      });
    },
  });

  // Update full profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      return apiRequest("PATCH", "/api/profile", updates);
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setProfileDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // Open edit profile dialog
  const openEditProfile = () => {
    if (profile) {
      setEditingProfile({
        displayName: profile.displayName,
        bio: profile.bio || "",
        location: profile.location,
        age: profile.age,
        height: profile.height,
        occupation: profile.occupation || "",
        education: profile.education || "",
        sect: profile.sect || "",
        religiousPractice: profile.religiousPractice || "",
        maritalStatus: profile.maritalStatus || "",
        wantsChildren: profile.wantsChildren || "",
      });
      setEditPhotos(profile.photos || []);
      setSelectedEthnicities(profile.ethnicities || []);
      setProfileDialogOpen(true);
    }
  };

  // Photo upload handler for profile edit
  const handleEditPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesToUpload = Array.from(files).slice(0, 6 - editPhotos.length);
    if (filesToUpload.length === 0) return;

    try {
      toast({
        title: "Uploading photos...",
        description: `Uploading ${filesToUpload.length} photo(s)`,
      });

      const formData = new FormData();
      filesToUpload.forEach((file) => {
        formData.append('photos', file);
      });

      const response = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Upload failed');
      }

      const data = await response.json();

      if (data.photoUrls) {
        setEditPhotos([...editPhotos, ...data.photoUrls]);
        toast({
          title: "Upload successful",
          description: `${data.photoUrls.length} photo(s) uploaded`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photos",
        variant: "destructive",
      });
    }
  };

  const removeEditPhoto = (index: number) => {
    setEditPhotos(editPhotos.filter((_, i) => i !== index));
  };

  const toggleEditEthnicity = (ethnicity: string) => {
    if (selectedEthnicities.includes(ethnicity)) {
      setSelectedEthnicities(selectedEthnicities.filter(e => e !== ethnicity));
    } else {
      setSelectedEthnicities([...selectedEthnicities, ethnicity]);
    }
  };

  const saveProfile = () => {
    updateProfileMutation.mutate({
      ...editingProfile,
      photos: editPhotos,
      ethnicities: selectedEthnicities,
    });
  };

  // Helper to get height display
  const getHeightDisplay = (heightCm: number | null | undefined) => {
    if (!heightCm) return null;
    const option = HEIGHT_OPTIONS_CM.find(h => h.cm === heightCm);
    return option ? `${option.cm}cm (${option.ft})` : `${heightCm}cm`;
  };

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

        {/* My Profile Section */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              My Profile
            </h2>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={openEditProfile}
              data-testid="button-edit-profile"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </div>

          {/* Profile Preview */}
          <div className="flex gap-4">
            {/* Main Photo */}
            <div className="flex-shrink-0">
              <Avatar className="h-24 w-24 rounded-lg">
                <AvatarImage 
                  src={profile?.photos?.[0]} 
                  alt={profile?.displayName}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-lg text-2xl">
                  {profile?.displayName?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <h3 className="text-lg font-semibold" data-testid="text-profile-name">
                  {profile?.displayName}
                </h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {profile?.age} years old
                  {profile?.height && (
                    <>
                      <span className="mx-1">-</span>
                      <Ruler className="h-3 w-3" />
                      {getHeightDisplay(profile.height)}
                    </>
                  )}
                </p>
              </div>
              
              {profile?.location && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {profile.location}
                </p>
              )}

              {profile?.bio && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {profile.bio}
                </p>
              )}

              {/* Quick Info Badges */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {profile?.religiousPractice && (
                  <Badge variant="secondary" className="text-xs">
                    {profile.religiousPractice}
                  </Badge>
                )}
                {profile?.maritalStatus && (
                  <Badge variant="secondary" className="text-xs">
                    {profile.maritalStatus}
                  </Badge>
                )}
                {profile?.occupation && (
                  <Badge variant="outline" className="text-xs">
                    {profile.occupation}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Photo Gallery Preview */}
          {profile?.photos && profile.photos.length > 1 && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Your Photos ({profile.photos.length}/6)</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {profile.photos.map((photo, index) => (
                  <div 
                    key={index} 
                    className="relative flex-shrink-0 h-16 w-16 rounded-md overflow-hidden"
                  >
                    <img 
                      src={photo} 
                      alt={`Photo ${index + 1}`} 
                      className="h-full w-full object-cover"
                    />
                    {index === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-primary/80 text-primary-foreground text-[10px] text-center py-0.5">
                        Main
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Edit Profile Dialog */}
        <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>
                Update your profile information
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="photos">Photos</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div>
                  <Label>Display Name</Label>
                  <Input
                    value={editingProfile.displayName || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, displayName: e.target.value })}
                    placeholder="Your name"
                    data-testid="input-edit-name"
                  />
                </div>

                <div>
                  <Label>Bio</Label>
                  <Textarea
                    value={editingProfile.bio || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, bio: e.target.value })}
                    placeholder="Tell others about yourself..."
                    rows={3}
                    data-testid="input-edit-bio"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Age</Label>
                    <Input
                      type="number"
                      value={editingProfile.age || ""}
                      onChange={(e) => setEditingProfile({ ...editingProfile, age: parseInt(e.target.value) || 0 })}
                      data-testid="input-edit-age"
                    />
                  </div>
                  <div>
                    <Label>Height</Label>
                    <Select
                      value={editingProfile.height?.toString() || ""}
                      onValueChange={(value) => setEditingProfile({ ...editingProfile, height: parseInt(value) })}
                    >
                      <SelectTrigger data-testid="select-edit-height">
                        <SelectValue placeholder="Select height" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[40vh]">
                        {HEIGHT_OPTIONS_CM.map((option) => (
                          <SelectItem key={option.cm} value={option.cm.toString()}>
                            {option.cm}cm - {option.ft}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Location</Label>
                  <Input
                    value={editingProfile.location || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, location: e.target.value })}
                    placeholder="City, Country"
                    data-testid="input-edit-location"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Occupation</Label>
                    <Input
                      value={editingProfile.occupation || ""}
                      onChange={(e) => setEditingProfile({ ...editingProfile, occupation: e.target.value })}
                      placeholder="Your occupation"
                      data-testid="input-edit-occupation"
                    />
                  </div>
                  <div>
                    <Label>Education</Label>
                    <Select
                      value={editingProfile.education || ""}
                      onValueChange={(value) => setEditingProfile({ ...editingProfile, education: value })}
                    >
                      <SelectTrigger data-testid="select-edit-education">
                        <SelectValue placeholder="Select education" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[40vh]">
                        {EDUCATION_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="photos" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Upload 3-6 clear photos. Your first photo will be your main profile photo.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[...Array(6)].map((_, index) => (
                    <div key={index} className="relative aspect-square">
                      {editPhotos[index] ? (
                        <div className="relative h-full group">
                          <img
                            src={editPhotos[index]}
                            alt={`Photo ${index + 1}`}
                            className="h-full w-full object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeEditPhoto(index)}
                            data-testid={`button-remove-edit-photo-${index}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          {index === 0 && (
                            <Badge className="absolute bottom-1 left-1 text-xs">
                              Main
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <label
                          htmlFor={`edit-photo-upload-${index}`}
                          className="flex flex-col items-center justify-center h-full border-2 border-dashed rounded-lg cursor-pointer hover-elevate"
                        >
                          <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleEditPhotoUpload}
                            className="hidden"
                            id={`edit-photo-upload-${index}`}
                          />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
                {editPhotos.length < 3 && (
                  <p className="text-sm text-destructive">
                    Please have at least 3 photos
                  </p>
                )}
              </TabsContent>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Sect</Label>
                    <Select
                      value={editingProfile.sect || ""}
                      onValueChange={(value) => setEditingProfile({ ...editingProfile, sect: value })}
                    >
                      <SelectTrigger data-testid="select-edit-sect">
                        <SelectValue placeholder="Select sect" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[40vh]">
                        {SECT_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Religious Practice</Label>
                    <Select
                      value={editingProfile.religiousPractice || ""}
                      onValueChange={(value) => setEditingProfile({ ...editingProfile, religiousPractice: value })}
                    >
                      <SelectTrigger data-testid="select-edit-practice">
                        <SelectValue placeholder="Select practice level" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[40vh]">
                        {RELIGIOUS_PRACTICE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Marital Status</Label>
                    <Select
                      value={editingProfile.maritalStatus || ""}
                      onValueChange={(value) => setEditingProfile({ ...editingProfile, maritalStatus: value })}
                    >
                      <SelectTrigger data-testid="select-edit-marital">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[40vh]">
                        {MARITAL_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Want Children?</Label>
                    <Select
                      value={editingProfile.wantsChildren || ""}
                      onValueChange={(value) => setEditingProfile({ ...editingProfile, wantsChildren: value })}
                    >
                      <SelectTrigger data-testid="select-edit-children">
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                        <SelectItem value="Maybe">Maybe</SelectItem>
                        <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block">Ethnicity</Label>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                    {ETHNICITY_OPTIONS.map((ethnicity) => (
                      <Badge
                        key={ethnicity}
                        variant={selectedEthnicities.includes(ethnicity) ? "default" : "outline"}
                        className="cursor-pointer hover-elevate"
                        onClick={() => toggleEditEthnicity(ethnicity)}
                        data-testid={`badge-edit-ethnicity-${ethnicity}`}
                      >
                        {ethnicity}
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setProfileDialogOpen(false)}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={saveProfile}
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
                  <div className="space-y-3">
                    <Label>Access Type</Label>
                    <div className="space-y-2">
                      <label 
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${accessType === 'live' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                        data-testid="radio-live-access"
                      >
                        <input
                          type="radio"
                          name="accessType"
                          value="live"
                          checked={accessType === 'live'}
                          onChange={() => setAccessType('live')}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-medium">Live Access</p>
                          <p className="text-sm text-muted-foreground">
                            Chaperone joins conversations and can see and send messages in real-time
                          </p>
                        </div>
                      </label>
                      <label 
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${accessType === 'report' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                        data-testid="radio-report-access"
                      >
                        <input
                          type="radio"
                          name="accessType"
                          value="report"
                          checked={accessType === 'report'}
                          onChange={() => setAccessType('report')}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-medium">Report Only</p>
                          <p className="text-sm text-muted-foreground">
                            Chaperone receives periodic email summaries of your conversations
                          </p>
                        </div>
                      </label>
                    </div>
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
              {chaperones.map((chaperone) => {
                const isLiveAccess = chaperone.accessType === 'live';
                const chaperoneAccessLink = isLiveAccess && chaperone.accessToken 
                  ? `${window.location.origin}/chaperone?token=${chaperone.accessToken}`
                  : null;
                
                const copyAccessLink = () => {
                  if (chaperoneAccessLink) {
                    navigator.clipboard.writeText(chaperoneAccessLink);
                    toast({
                      title: "Link Copied",
                      description: "Share this link with your chaperone so they can access conversations.",
                    });
                  }
                };
                
                return (
                  <div
                    key={chaperone.id}
                    className="p-4 rounded-lg border space-y-3"
                    data-testid={`chaperone-${chaperone.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{chaperone.chaperoneName}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${isLiveAccess ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'}`}>
                            {isLiveAccess ? 'Live Access' : 'Report Only'}
                          </span>
                        </div>
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
                    
                    {chaperoneAccessLink && (
                      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <Link className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-1">Chaperone Access Link</p>
                          <p className="text-xs font-mono truncate">{chaperoneAccessLink}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyAccessLink}
                          data-testid={`button-copy-link-${chaperone.id}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    
                    {!isLiveAccess && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          {chaperone.chaperoneName} will receive email summaries of your conversations.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
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
        {subscriptionStatus?.hasActiveSubscription && (
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
              onClick={() => setLocation("/feedback")}
              data-testid="button-feedback"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Share Feedback
            </Button>
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

        {/* Testing Tools (Development) */}
        <Card className="p-6 mb-6 border-primary/20">
          <h2 className="text-xl font-semibold mb-2 text-primary">Testing Tools</h2>
          <p className="text-sm text-muted-foreground mb-4">Development and testing utilities</p>
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => resetMatchesMutation.mutate()}
              disabled={resetMatchesMutation.isPending}
              data-testid="button-reset-matches"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {resetMatchesMutation.isPending ? "Resetting..." : "Reset All Matches"}
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
