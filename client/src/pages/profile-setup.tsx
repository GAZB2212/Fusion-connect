import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Profile } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { insertProfileSchema, type InsertProfile } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle2, LogOut, MapPin, Loader2, Video, Sparkles } from "lucide-react";
import { VideoRecorder } from "@/components/video-recorder";
import {
  INTEREST_CATEGORIES,
  PROFESSIONS,
  HEIGHT_OPTIONS_CM,
  SECT_OPTIONS,
  RELIGIOUS_PRACTICE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  PERSONALITY_TRAITS,
  ETHNICITY_OPTIONS,
  EDUCATION_OPTIONS,
} from "@shared/constants";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

export default function ProfileSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Check URL parameters
  const searchParams = new URLSearchParams(window.location.search);
  const isRestart = searchParams.get('restart') === 'true';
  const isFastOnboardingComplete = searchParams.get('fastOnboardingComplete') === 'true';
  
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [selectedEthnicities, setSelectedEthnicities] = useState<string[]>([]);
  const [partnerSects, setPartnerSects] = useState<string[]>([]);
  const [partnerEthnicities, setPartnerEthnicities] = useState<string[]>([]);
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 45]);
  const [professionSearch, setProfessionSearch] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [userCoordinates, setUserCoordinates] = useState<{lat: number, lng: number} | null>(null);
  const [profileSubmitted, setProfileSubmitted] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [introVideoUrl, setIntroVideoUrl] = useState<string | null>(null);
  const [isEnhancingBio, setIsEnhancingBio] = useState(false);
  const [fastBio, setFastBio] = useState("");

  // Fetch existing profile if restarting or fast onboarding complete
  const { data: existingProfile } = useQuery<Profile>({
    queryKey: ["/api/profile"],
    enabled: isRestart || isFastOnboardingComplete,
  });

  const form = useForm<InsertProfile>({
    resolver: zodResolver(insertProfileSchema),
    defaultValues: {
      displayName: "",
      age: 25,
      gender: "male",
      location: "",
      bio: "",
      height: undefined,
      heightUnit: "cm",
      photos: [],
      mainPhotoIndex: 0,
      lookingFor: "Marriage",
      bornMuslim: undefined,
      sect: "",
      prayerFrequency: "",
      halalImportance: "",
      religiosity: "",
      religiousPractice: "",
      maritalStatus: "",
      hasChildren: false,
      wantsChildren: "",
      education: "",
      occupation: "",
      profession: "",
      languages: [],
      interests: [],
      personalityTraits: [],
      ethnicities: [],
      partnerPreferences: undefined,
      photoVisibility: "visible",
      photoVerified: false,
      phoneVerified: false,
      faceVerified: false,
      useNickname: false,
    },
  });

  // Load existing profile data when restarting or from fast onboarding
  useEffect(() => {
    if ((isRestart || isFastOnboardingComplete) && existingProfile) {
      // Pre-fill form with existing data
      form.reset({
        displayName: existingProfile.displayName,
        age: existingProfile.age,
        gender: existingProfile.gender as "male" | "female",
        location: existingProfile.location,
        bio: existingProfile.bio || "",
        height: existingProfile.height || undefined,
        heightUnit: existingProfile.heightUnit || "cm",
        photos: existingProfile.photos,
        mainPhotoIndex: existingProfile.mainPhotoIndex || 0,
        lookingFor: existingProfile.lookingFor as "Marriage" | "Friendship" | "Networking",
        bornMuslim: existingProfile.bornMuslim || undefined,
        sect: existingProfile.sect || "",
        prayerFrequency: existingProfile.prayerFrequency || "",
        halalImportance: existingProfile.halalImportance || "",
        religiosity: existingProfile.religiosity || "",
        religiousPractice: existingProfile.religiousPractice || "",
        maritalStatus: existingProfile.maritalStatus || "",
        hasChildren: existingProfile.hasChildren || false,
        wantsChildren: existingProfile.wantsChildren || "",
        education: existingProfile.education || "",
        occupation: existingProfile.occupation || "",
        profession: existingProfile.profession || "",
        languages: existingProfile.languages || [],
        interests: existingProfile.interests || [],
        personalityTraits: existingProfile.personalityTraits || [],
        ethnicities: existingProfile.ethnicities || [],
        partnerPreferences: existingProfile.partnerPreferences || undefined,
        photoVisibility: existingProfile.photoVisibility || "visible",
        photoVerified: false, // Reset verification
        phoneVerified: existingProfile.phoneVerified || false,
        faceVerified: false, // Reset face verification
        useNickname: existingProfile.useNickname || false,
      });

      // Set state variables
      setSelectedInterests(existingProfile.interests || []);
      setSelectedTraits(existingProfile.personalityTraits || []);
      setSelectedEthnicities(existingProfile.ethnicities || []);
      
      // For fast onboarding, also set the bio field
      if (isFastOnboardingComplete && existingProfile.bio) {
        setFastBio(existingProfile.bio);
      }
      
      if (existingProfile.partnerPreferences && typeof existingProfile.partnerPreferences === 'object') {
        const prefs = existingProfile.partnerPreferences as any;
        setPartnerSects(prefs.sects || []);
        setPartnerEthnicities(prefs.ethnicities || []);
        setAgeRange([
          prefs.minAge || 18,
          prefs.maxAge || 45
        ]);
      }
      
      // Stay on step 1 where photos are uploaded
      setStep(1);
      
      // Clear photos for new uploads (both restart and fast onboarding need fresh photos)
      setPhotos([]);
      form.setValue("photos", []);
      
      // Only show toast for restart users, not fast onboarding
      if (isRestart) {
        toast({
          title: "Upload New Photos",
          description: "Please upload new photos and complete the form to retry verification.",
        });
      }
    }
  }, [isRestart, isFastOnboardingComplete, existingProfile, form, toast]);

  const createProfileMutation = useMutation({
    mutationFn: async (data: InsertProfile) => {
      return apiRequest("POST", "/api/profile", data);
    },
    onSuccess: async () => {
      // Show success screen first
      setProfileSubmitted(true);
      
      // Wait 2 seconds to show the success message, then invalidate and redirect
      setTimeout(async () => {
        await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
        setLocation("/");
      }, 2000);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/logout", {});
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.clear();
      setLocation("/");
    },
    onError: (error) => {
      toast({
        title: "Logout Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertProfile) => {
    createProfileMutation.mutate({
      ...data,
      latitude: userCoordinates?.lat,
      longitude: userCoordinates?.lng,
      isComplete: true,
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesToUpload = Array.from(files).slice(0, 6 - photos.length);
    if (filesToUpload.length === 0) return;

    try {
      // Show loading toast
      toast({
        title: "Uploading photos...",
        description: `Uploading ${filesToUpload.length} photo(s) to cloud storage`,
      });

      // Create FormData
      const formData = new FormData();
      filesToUpload.forEach((file) => {
        formData.append('photos', file);
      });

      // Upload to R2 using fetch (FormData requires multipart/form-data)
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
        const updatedPhotos = [...photos, ...data.photoUrls];
        setPhotos(updatedPhotos);
        form.setValue("photos", updatedPhotos);

        toast({
          title: "Upload successful",
          description: `${data.photoUrls.length} photo(s) uploaded successfully`,
        });
      }
    } catch (error: any) {
      console.error('Photo upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photos. Please try again.",
        variant: "destructive",
      });
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    form.setValue("photos", newPhotos);
  };

  const nextStep = () => {
    // For fast onboarding users, skip from step 1 directly to step 8 (verification)
    if (isFastOnboardingComplete && step === 1) {
      setStep(8);
    } else if (step < 8) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleVideoRecorded = async (videoBlob: Blob) => {
    setIsUploadingVideo(true);
    
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(videoBlob);
      const base64Video = await base64Promise;

      const response = await apiRequest("POST", "/api/video/upload", {
        video: base64Video,
      });
      
      const data = await response.json();
      
      if (data.videoUrl) {
        setIntroVideoUrl(data.videoUrl);
        toast({
          title: "Video uploaded!",
          description: "Your intro video has been saved.",
        });
      }
    } catch (error: any) {
      console.error("Video upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload video. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.length >= 15 && !selectedInterests.includes(interest)) {
      return;
    }
    const newInterests = selectedInterests.includes(interest)
      ? selectedInterests.filter((i) => i !== interest)
      : [...selectedInterests, interest];
    setSelectedInterests(newInterests);
    form.setValue("interests", newInterests);
  };

  const toggleTrait = (trait: string) => {
    if (selectedTraits.length >= 5 && !selectedTraits.includes(trait)) {
      return;
    }
    const newTraits = selectedTraits.includes(trait)
      ? selectedTraits.filter((t) => t !== trait)
      : [...selectedTraits, trait];
    setSelectedTraits(newTraits);
    form.setValue("personalityTraits", newTraits);
  };

  // Get user's location using browser geolocation
  const detectLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Location not supported",
        description: "Your browser doesn't support location detection. Please enter your location manually.",
        variant: "destructive",
      });
      return;
    }

    setIsLocating(true);
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      setUserCoordinates({ lat: latitude, lng: longitude });

      // Reverse geocode to get city name using OpenStreetMap Nominatim
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
        { headers: { 'Accept-Language': 'en' } }
      );
      
      if (response.ok) {
        const data = await response.json();
        const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || '';
        const country = data.address?.country || '';
        const locationString = city && country ? `${city}, ${country}` : city || country || 'Unknown location';
        
        form.setValue("location", locationString);
        toast({
          title: "Location detected",
          description: locationString,
        });
      }
    } catch (error: any) {
      console.error('Location detection error:', error);
      let message = "Could not detect your location. Please enter it manually.";
      if (error.code === 1) {
        message = "Location access denied. Please enable location permissions or enter manually.";
      } else if (error.code === 2) {
        message = "Location unavailable. Please enter your location manually.";
      } else if (error.code === 3) {
        message = "Location request timed out. Please try again or enter manually.";
      }
      toast({
        title: "Location detection failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLocating(false);
    }
  };

  const toggleEthnicity = (ethnicity: string) => {
    const newEthnicities = selectedEthnicities.includes(ethnicity)
      ? selectedEthnicities.filter((e) => e !== ethnicity)
      : [...selectedEthnicities, ethnicity];
    setSelectedEthnicities(newEthnicities);
    form.setValue("ethnicities", newEthnicities);
  };

  const togglePartnerSect = (sect: string) => {
    const newSects = partnerSects.includes(sect)
      ? partnerSects.filter((s) => s !== sect)
      : [...partnerSects, sect];
    setPartnerSects(newSects);
    form.setValue("partnerPreferences", {
      ageMin: ageRange[0],
      ageMax: ageRange[1],
      sects: newSects,
      ethnicities: partnerEthnicities,
    });
  };

  const togglePartnerEthnicity = (ethnicity: string) => {
    const newEthnicities = partnerEthnicities.includes(ethnicity)
      ? partnerEthnicities.filter((e) => e !== ethnicity)
      : [...partnerEthnicities, ethnicity];
    setPartnerEthnicities(newEthnicities);
    form.setValue("partnerPreferences", {
      ageMin: ageRange[0],
      ageMax: ageRange[1],
      sects: partnerSects,
      ethnicities: newEthnicities,
    });
  };

  const updateAgeRange = (values: number[]) => {
    const newRange: [number, number] = [values[0], values[1]];
    setAgeRange(newRange);
    form.setValue("partnerPreferences", {
      ageMin: newRange[0],
      ageMax: newRange[1],
      sects: partnerSects,
      ethnicities: partnerEthnicities,
    });
  };

  const filteredProfessions = PROFESSIONS.filter((prof) =>
    prof.toLowerCase().includes(professionSearch.toLowerCase())
  );

  // Show success screen after profile submission
  if (profileSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8">
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Profile Complete!</h2>
              <p className="text-muted-foreground">
                Now let's verify your identity with a quick selfie...
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Logout */}
      <div className="border-b bg-card">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg hidden md:block">Fusion</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
            className="md:ml-auto"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {logoutMutation.isPending ? "Logging out..." : "Logout"}
          </Button>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">
            {isFastOnboardingComplete ? "Complete Your Profile" : "Create Your Profile"}
          </h1>
          <p className="text-muted-foreground">
            {isFastOnboardingComplete 
              ? "Just add photos and a bio, then verify your identity" 
              : "Let's help you find your perfect match"
            }
          </p>
          
          {/* Progress - simplified for fast onboarding */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {isFastOnboardingComplete ? (
              // Fast onboarding: 2 steps (Photos+Bio, Verification)
              <>
                <div className={`h-2 w-16 rounded-full ${step === 1 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`h-2 w-16 rounded-full ${step === 8 ? 'bg-primary' : 'bg-muted'}`} />
              </>
            ) : (
              // Standard: 8 steps
              [1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <div
                  key={s}
                  className={`h-2 w-10 rounded-full ${
                    s <= step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))
            )}
          </div>
        </div>

        <Card className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Step 1: Basic Info (or just photos for fast onboarding) */}
              {step === 1 && (
                <div className="space-y-6">
                  {isFastOnboardingComplete ? (
                    <>
                      <div className="text-center mb-6">
                        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                        <h2 className="text-xl font-semibold">Almost Done!</h2>
                        <p className="text-muted-foreground">
                          Your profile info is saved. Now add some photos to complete your profile.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold">Basic Information</h2>

                      <FormField
                        control={form.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Your full name" data-testid="input-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              data-testid="input-age"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-gender">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[40vh] overflow-y-auto">
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input {...field} placeholder="City, Country" data-testid="input-location" className="flex-1" />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={detectLocation}
                            disabled={isLocating}
                            data-testid="button-detect-location"
                          >
                            {isLocating ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MapPin className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Click the pin icon to auto-detect your location
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="height"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Height</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-height">
                              <SelectValue placeholder="Select your height" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[40vh] overflow-y-auto">
                            {HEIGHT_OPTIONS_CM.map((option) => (
                              <SelectItem key={option.cm} value={option.cm.toString()}>
                                {option.cm}cm • {option.ft}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Ethnicity Multi-select */}
                  <div>
                    <Label className="mb-3 block">Ethnicity (Optional)</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Select all that apply
                    </p>
                    <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                      {ETHNICITY_OPTIONS.map((ethnicity) => (
                        <Badge
                          key={ethnicity}
                          variant={selectedEthnicities.includes(ethnicity) ? "default" : "outline"}
                          className="cursor-pointer hover-elevate px-3 py-1"
                          onClick={() => toggleEthnicity(ethnicity)}
                          data-testid={`badge-ethnicity-${ethnicity}`}
                        >
                          {ethnicity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                    </>
                  )}

                  {/* Photo Upload - Min 3 photos required */}
                  <div>
                    <Label>Profile Photos (Minimum 3 required)</Label>
                    <p className="text-sm text-muted-foreground mt-1 mb-3">
                      Upload 3-6 clear photos showing your face
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                      {[...Array(6)].map((_, index) => (
                        <div key={index} className="relative aspect-square">
                          {photos[index] ? (
                            <div className="relative h-full group">
                              <img
                                src={photos[index]}
                                alt={`Photo ${index + 1}`}
                                className="h-full w-full object-cover rounded-lg"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removePhoto(index)}
                                data-testid={`button-remove-photo-${index}`}
                              >
                                ×
                              </Button>
                              {index === 0 && (
                                <Badge className="absolute bottom-2 left-2 text-xs">
                                  Main
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <label
                              htmlFor={`photo-upload-${index}`}
                              className="flex flex-col items-center justify-center h-full border-2 border-dashed rounded-lg cursor-pointer hover-elevate"
                              data-testid={`label-upload-photo-${index}`}
                            >
                              <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                              <span className="text-xs text-muted-foreground">
                                Upload
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                className="hidden"
                                id={`photo-upload-${index}`}
                              />
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                    {photos.length < 3 && (
                      <p className="text-sm text-destructive mt-2">
                        Please upload at least 3 photos to continue
                      </p>
                    )}
                  </div>

                  {/* Bio with AI Enhancement - Only for fast onboarding */}
                  {isFastOnboardingComplete && (
                    <div className="space-y-3">
                      <Label>About Me</Label>
                      <p className="text-sm text-muted-foreground">
                        Write a short bio about yourself. Use the AI button to enhance it!
                      </p>
                      <div className="relative">
                        <Textarea
                          value={fastBio}
                          onChange={(e) => {
                            setFastBio(e.target.value);
                            form.setValue("bio", e.target.value);
                          }}
                          placeholder="I'm a kind-hearted person who loves..."
                          className="min-h-32 pr-12"
                          data-testid="textarea-fast-bio"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                          onClick={async () => {
                            if (!fastBio || fastBio.trim().length < 10) {
                              toast({
                                title: "Write something first",
                                description: "Please write at least a few words about yourself before enhancing",
                                variant: "destructive",
                              });
                              return;
                            }
                            setIsEnhancingBio(true);
                            try {
                              const response = await apiRequest("POST", "/api/enhance-bio", {
                                bio: fastBio,
                              });
                              const data = await response.json();
                              if (data.enhancedBio) {
                                setFastBio(data.enhancedBio);
                                form.setValue("bio", data.enhancedBio);
                                toast({
                                  title: "Bio enhanced!",
                                  description: "Your bio has been improved by AI",
                                });
                              }
                            } catch (error: any) {
                              toast({
                                title: "Enhancement failed",
                                description: error.message || "Could not enhance bio",
                                variant: "destructive",
                              });
                            } finally {
                              setIsEnhancingBio(false);
                            }
                          }}
                          disabled={isEnhancingBio}
                          data-testid="button-enhance-bio"
                        >
                          {isEnhancingBio ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Tip: Write a few sentences, then tap the sparkle button to let AI make it shine!
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Islamic Values */}
              {step === 2 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">Islamic Values</h2>

                  <FormField
                    control={form.control}
                    name="bornMuslim"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Were you born a Muslim?</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "yes")}
                          value={field.value === undefined ? "" : field.value ? "yes" : "no"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-born-muslim">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[40vh] overflow-y-auto">
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sect"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sect</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-sect">
                              <SelectValue placeholder="Select sect" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[40vh] overflow-y-auto">
                            {SECT_OPTIONS.map((sect) => (
                              <SelectItem key={sect} value={sect}>
                                {sect}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="religiousPractice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>How do you practise your religion?</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-religious-practice">
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[40vh] overflow-y-auto">
                            {RELIGIOUS_PRACTICE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <div>
                                  <div className="font-medium">{option.value}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {option.description}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 3: Profession & Personal */}
              {step === 3 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">About You</h2>

                  <FormField
                    control={form.control}
                    name="profession"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>What's your profession?</FormLabel>
                        <div className="space-y-2">
                          <Input
                            placeholder="Search jobs"
                            value={professionSearch}
                            onChange={(e) => setProfessionSearch(e.target.value)}
                            data-testid="input-profession-search"
                          />
                          <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                            <FormControl>
                              <SelectTrigger data-testid="select-profession">
                                <SelectValue placeholder="Select profession" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="max-h-[40vh] overflow-y-auto">
                              {filteredProfessions.slice(0, 20).map((prof) => (
                                <SelectItem key={prof} value={prof}>
                                  {prof}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maritalStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>What's your marital status?</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-marital">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[40vh] overflow-y-auto">
                            {MARITAL_STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="education"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Education Level (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-education">
                              <SelectValue placeholder="Select education level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[40vh] overflow-y-auto">
                            {EDUCATION_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 4: Personality Traits */}
              {step === 4 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">How would you describe your personality?</h2>
                  <p className="text-sm text-muted-foreground">
                    Select up to 5 traits to show off your personality!
                  </p>

                  <div className="flex flex-wrap gap-2 max-h-96 overflow-y-auto border rounded-lg p-4">
                    {PERSONALITY_TRAITS.map((trait) => (
                      <Badge
                        key={trait.value}
                        variant={selectedTraits.includes(trait.value) ? "default" : "outline"}
                        className="cursor-pointer hover-elevate px-3 py-2"
                        onClick={() => toggleTrait(trait.value)}
                        data-testid={`badge-trait-${trait.value}`}
                      >
                        <span className="mr-1">{trait.emoji}</span>
                        {trait.value}
                      </Badge>
                    ))}
                  </div>

                  {selectedTraits.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-4 border">
                      <p className="text-sm text-muted-foreground">
                        {selectedTraits.length} / 5 traits selected
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Interests */}
              {step === 5 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">What are your interests?</h2>
                  <p className="text-sm text-muted-foreground">
                    Select up to 15 interests to make your profile stand out!
                  </p>

                  {Object.entries(INTEREST_CATEGORIES).map(([category, interests]) => (
                    <div key={category}>
                      <h3 className="font-semibold mb-3">{category}</h3>
                      <div className="flex flex-wrap gap-2">
                        {interests.map((interest) => (
                          <Badge
                            key={interest.value}
                            variant={selectedInterests.includes(interest.value) ? "default" : "outline"}
                            className="cursor-pointer hover-elevate px-3 py-2"
                            onClick={() => toggleInterest(interest.value)}
                            data-testid={`badge-interest-${interest.value}`}
                          >
                            <span className="mr-1">{interest.emoji}</span>
                            {interest.value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}

                  {selectedInterests.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-4 border">
                      <p className="text-sm text-muted-foreground">
                        {selectedInterests.length} / 15 interests selected
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 6: Partner Preferences */}
              {step === 6 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">Partner Preferences</h2>
                  <p className="text-sm text-muted-foreground">
                    Tell us about your ideal partner to help us find better matches
                  </p>

                  {/* Age Range */}
                  <div className="space-y-4">
                    <Label>Age Range</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{ageRange[0]} years</span>
                        <span>{ageRange[1]} years</span>
                      </div>
                      <Slider
                        min={18}
                        max={70}
                        step={1}
                        value={ageRange}
                        onValueChange={updateAgeRange}
                        className="w-full"
                        data-testid="slider-age-range"
                      />
                    </div>
                  </div>

                  {/* Sect Preference */}
                  <div>
                    <Label className="mb-3 block">Preferred Sects (Optional)</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Select all that apply
                    </p>
                    <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                      {SECT_OPTIONS.map((sect) => (
                        <Badge
                          key={sect}
                          variant={partnerSects.includes(sect) ? "default" : "outline"}
                          className="cursor-pointer hover-elevate px-3 py-1"
                          onClick={() => togglePartnerSect(sect)}
                          data-testid={`badge-partner-sect-${sect}`}
                        >
                          {sect}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Ethnicity Preference */}
                  <div>
                    <Label className="mb-3 block">Preferred Ethnicities (Optional)</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Select all that apply
                    </p>
                    <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                      {ETHNICITY_OPTIONS.map((ethnicity) => (
                        <Badge
                          key={ethnicity}
                          variant={partnerEthnicities.includes(ethnicity) ? "default" : "outline"}
                          className="cursor-pointer hover-elevate px-3 py-1"
                          onClick={() => togglePartnerEthnicity(ethnicity)}
                          data-testid={`badge-partner-ethnicity-${ethnicity}`}
                        >
                          {ethnicity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 7: Bio & Final Details */}
              {step === 7 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">Final Details</h2>

                  <FormField
                    control={form.control}
                    name="lookingFor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>What are you looking for?</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-looking-for">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[40vh] overflow-y-auto">
                            <SelectItem value="Marriage">Marriage</SelectItem>
                            <SelectItem value="Friendship">Friendship</SelectItem>
                            <SelectItem value="Networking">Networking</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>About Me</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Tell potential matches about yourself..."
                            className="min-h-24"
                            data-testid="textarea-bio"
                          />
                        </FormControl>
                        <FormDescription>
                          Share your interests, values, and what you're looking for
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>
              )}

              {/* Step 8: Video Intro */}
              {step === 8 && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold">Record Your Intro Video</h2>
                  <p className="text-muted-foreground">
                    Help potential matches get to know you with a short 20-second video introduction. This is optional but highly recommended!
                  </p>

                  {introVideoUrl ? (
                    <div className="space-y-4">
                      <div className="relative aspect-[9/16] max-h-[400px] mx-auto bg-black rounded-lg overflow-hidden">
                        <video
                          src={introVideoUrl}
                          className="w-full h-full object-cover"
                          controls
                          playsInline
                        />
                      </div>
                      <div className="flex justify-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIntroVideoUrl(null)}
                          data-testid="button-remove-video"
                        >
                          Record New Video
                        </Button>
                      </div>
                      <div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/20">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Video saved! Click Complete Profile to continue.</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <VideoRecorder
                      onVideoRecorded={handleVideoRecorded}
                      onCancel={() => nextStep()}
                      isUploading={isUploadingVideo}
                    />
                  )}

                  <div className="bg-muted/50 rounded-lg p-6 border">
                    <div className="flex items-start gap-3">
                      <Video className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-2">Why add a video?</h3>
                        <p className="text-sm text-muted-foreground">
                          Profiles with videos get 3x more matches! It helps others see your personality and feel more confident about connecting with you.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-6">
                {step > 1 ? (
                  <Button type="button" variant="outline" onClick={prevStep}>
                    Back
                  </Button>
                ) : (
                  <div />
                )}

                {step < 8 ? (
                  <Button 
                    type="button" 
                    onClick={nextStep} 
                    data-testid="button-next"
                    disabled={step === 1 && photos.length < 3}
                  >
                    {step === 7 ? "Next: Add Video" : "Next"}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={createProfileMutation.isPending || isUploadingVideo}
                    data-testid="button-submit-profile"
                  >
                    {createProfileMutation.isPending ? "Creating..." : "Complete Profile"}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
