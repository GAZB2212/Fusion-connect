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
import { apiRequest, queryClient, getApiUrl, clearAuthToken, getAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle2, LogOut, MapPin, Loader2, Video, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { VideoRecorder } from "@/components/video-recorder";
import { PhotoGuidelines } from "@/components/photo-guidelines";
import { isCapacitorNative } from "@/lib/platform";
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
import { Slider } from "@/components/ui/slider";

const TOTAL_STEPS = 17;

const STEP_TITLES: Record<number, { title: string; subtitle: string }> = {
  1: { title: "Add Your Photos", subtitle: "Show your best self with at least 3 clear photos" },
  2: { title: "What's your name?", subtitle: "This is how you'll appear to others" },
  3: { title: "How old are you?", subtitle: "You must be 18 or older to use Fusion" },
  4: { title: "What's your gender?", subtitle: "Select your gender" },
  5: { title: "Where are you based?", subtitle: "We'll show you people nearby" },
  6: { title: "How tall are you?", subtitle: "Optional, but it helps with matching" },
  7: { title: "What's your ethnicity?", subtitle: "Select all that apply" },
  8: { title: "Were you born Muslim?", subtitle: "This helps with compatibility matching" },
  9: { title: "What's your sect?", subtitle: "Select your Islamic sect" },
  10: { title: "How do you practise your faith?", subtitle: "Select what best describes you" },
  11: { title: "What's your profession?", subtitle: "What do you do for work?" },
  12: { title: "What's your marital status?", subtitle: "Select your current status" },
  13: { title: "Describe your personality", subtitle: "Select up to 5 traits" },
  14: { title: "What are your interests?", subtitle: "Select up to 15 interests" },
  15: { title: "Partner preferences", subtitle: "What are you looking for in a partner?" },
  16: { title: "Tell us about yourself", subtitle: "Write a short bio to introduce yourself" },
  17: { title: "Record a video intro", subtitle: "Optional: Add a personal touch" },
};

export default function ProfileSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
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
  const [showPhotoGuidelines, setShowPhotoGuidelines] = useState(true);

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
      waliInvolvement: "",
    },
  });

  useEffect(() => {
    if ((isRestart || isFastOnboardingComplete) && existingProfile) {
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
        photoVerified: false,
        phoneVerified: existingProfile.phoneVerified || false,
        faceVerified: false,
        useNickname: existingProfile.useNickname || false,
        waliInvolvement: existingProfile.waliInvolvement || "",
      });

      setSelectedInterests(existingProfile.interests || []);
      setSelectedTraits(existingProfile.personalityTraits || []);
      setSelectedEthnicities(existingProfile.ethnicities || []);
      
      if (existingProfile.partnerPreferences && typeof existingProfile.partnerPreferences === 'object') {
        const prefs = existingProfile.partnerPreferences as any;
        setPartnerSects(prefs.sects || []);
        setPartnerEthnicities(prefs.ethnicities || []);
        setAgeRange([prefs.minAge || 18, prefs.maxAge || 45]);
      }
      
      setStep(1);
      setPhotos([]);
      form.setValue("photos", []);
      
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
      setProfileSubmitted(true);
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
      clearAuthToken();
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setLocation("/");
    },
    onError: (error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (photos.length >= 6) {
      toast({
        title: "Maximum photos reached",
        description: "You can only upload up to 6 photos",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = getAuthToken();
      let photoUrl: string;

      if (isCapacitorNative()) {
        // Convert image to JPEG using canvas (handles various formats from iOS)
        const base64Data = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          const objectUrl = URL.createObjectURL(file);
          
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const maxSize = 1920; // Max dimension for upload
              let width = img.naturalWidth || img.width;
              let height = img.naturalHeight || img.height;
              
              console.log('[Photo Upload] Original image dimensions:', width, 'x', height);
              
              if (width === 0 || height === 0) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Image has invalid dimensions'));
                return;
              }
              
              // Scale down if too large
              if (width > maxSize || height > maxSize) {
                if (width > height) {
                  height = Math.round((height / width) * maxSize);
                  width = maxSize;
                } else {
                  width = Math.round((width / height) * maxSize);
                  height = maxSize;
                }
              }
              
              console.log('[Photo Upload] Canvas dimensions:', width, 'x', height);
              
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Could not get canvas context'));
                return;
              }
              
              // Fill with white background first (for transparent PNGs)
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, width, height);
              
              ctx.drawImage(img, 0, 0, width, height);
              const jpegBase64 = canvas.toDataURL('image/jpeg', 0.9);
              
              console.log('[Photo Upload] Base64 length:', jpegBase64.length);
              
              URL.revokeObjectURL(objectUrl);
              resolve(jpegBase64);
            } catch (err) {
              URL.revokeObjectURL(objectUrl);
              reject(err);
            }
          };
          
          img.onerror = (e) => {
            console.error('[Photo Upload] Image load error:', e);
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image'));
          };
          
          img.src = objectUrl;
        });

        const CapacitorHttp = (window as any).Capacitor?.Plugins?.CapacitorHttp;
        if (CapacitorHttp) {
          const response = await CapacitorHttp.post({
            url: getApiUrl('/api/photos/upload-base64'),
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            data: {
              photo: base64Data,
              photoType: 'profile',
            },
          });

          if (response.status !== 200) {
            throw new Error(response.data?.message || 'Failed to upload photo');
          }
          photoUrl = response.data.photoUrl;
        } else {
          throw new Error('Native HTTP not available');
        }
      } else {
        const formData = new FormData();
        formData.append('photos', file);

        const response = await fetch(getApiUrl('/api/photos/upload'), {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          credentials: 'include',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to upload photo');
        }

        const result = await response.json();
        photoUrl = result.photoUrls[0];
      }

      const newPhotos = [...photos, photoUrl];
      setPhotos(newPhotos);
      form.setValue("photos", newPhotos);
      
      toast({
        title: "Photo uploaded",
        description: "Your photo has been uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    form.setValue("photos", newPhotos);
  };

  const detectLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "Location not supported",
        description: "Your browser doesn't support location detection",
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
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;
      setUserCoordinates({ lat: latitude, lng: longitude });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await response.json();
      
      const city = data.address?.city || data.address?.town || data.address?.village || "";
      const country = data.address?.country || "";
      const locationStr = city && country ? `${city}, ${country}` : city || country;
      
      if (locationStr) {
        form.setValue("location", locationStr);
        toast({
          title: "Location detected",
          description: `Set to ${locationStr}`,
        });
      }
    } catch (error) {
      toast({
        title: "Location error",
        description: "Could not detect your location. Please enter it manually.",
        variant: "destructive",
      });
    } finally {
      setIsLocating(false);
    }
  };

  const toggleInterest = (interest: string) => {
    let newInterests: string[];
    if (selectedInterests.includes(interest)) {
      newInterests = selectedInterests.filter((i) => i !== interest);
    } else if (selectedInterests.length < 15) {
      newInterests = [...selectedInterests, interest];
    } else {
      toast({
        title: "Maximum reached",
        description: "You can select up to 15 interests",
      });
      return;
    }
    setSelectedInterests(newInterests);
    form.setValue("interests", newInterests);
  };

  const toggleTrait = (trait: string) => {
    let newTraits: string[];
    if (selectedTraits.includes(trait)) {
      newTraits = selectedTraits.filter((t) => t !== trait);
    } else if (selectedTraits.length < 5) {
      newTraits = [...selectedTraits, trait];
    } else {
      toast({
        title: "Maximum reached",
        description: "You can select up to 5 personality traits",
      });
      return;
    }
    setSelectedTraits(newTraits);
    form.setValue("personalityTraits", newTraits);
  };

  const toggleEthnicity = (ethnicity: string) => {
    let newEthnicities: string[];
    if (selectedEthnicities.includes(ethnicity)) {
      newEthnicities = selectedEthnicities.filter((e) => e !== ethnicity);
    } else {
      newEthnicities = [...selectedEthnicities, ethnicity];
    }
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

  const handleVideoRecorded = async (videoBlob: Blob) => {
    setIsUploadingVideo(true);

    try {
      const token = getAuthToken();
      let videoUrl: string;

      if (isCapacitorNative()) {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(videoBlob);
        });

        const CapacitorHttp = (window as any).Capacitor?.Plugins?.CapacitorHttp;
        if (CapacitorHttp) {
          const response = await CapacitorHttp.post({
            url: getApiUrl('/api/video/upload'),
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            data: {
              video: base64Data,
            },
          });

          if (response.status !== 200) {
            throw new Error(response.data?.message || 'Failed to upload video');
          }
          videoUrl = response.data.videoUrl;
        } else {
          throw new Error('Native HTTP not available');
        }
      } else {
        const formData = new FormData();
        formData.append('video', videoBlob, 'intro-video.webm');

        const response = await fetch(getApiUrl('/api/video/upload'), {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          credentials: 'include',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to upload video');
        }

        const result = await response.json();
        videoUrl = result.videoUrl;
      }

      setIntroVideoUrl(videoUrl);
      form.setValue("introVideoUrl" as any, videoUrl);
      
      toast({
        title: "Video uploaded!",
        description: "Your intro video has been saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleSkipVideo = () => {
    form.handleSubmit(onSubmit)();
  };

  const onSubmit = (data: InsertProfile) => {
    const submitData = {
      ...data,
      photos,
      interests: selectedInterests,
      personalityTraits: selectedTraits,
      ethnicities: selectedEthnicities,
      partnerPreferences: {
        ageMin: ageRange[0],
        ageMax: ageRange[1],
        sects: partnerSects,
        ethnicities: partnerEthnicities,
      },
      coordinates: userCoordinates,
      introVideoUrl: introVideoUrl || undefined,
    };
    createProfileMutation.mutate(submitData);
  };

  const nextStep = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1: return photos.length >= 3;
      case 2: return form.watch("displayName")?.trim().length > 0;
      case 3: return form.watch("age") >= 18;
      case 4: return !!form.watch("gender");
      case 5: return form.watch("location")?.trim().length > 0;
      default: return true;
    }
  };

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);

  if (profileSubmitted) {
    return (
      <div 
        className="min-h-screen bg-background flex items-center justify-center p-4"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
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

  if (step === 1 && showPhotoGuidelines) {
    return <PhotoGuidelines onContinue={() => setShowPhotoGuidelines(false)} />;
  }

  const currentStepInfo = STEP_TITLES[step] || { title: "Profile Setup", subtitle: "" };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Fixed Header with Progress */}
      <div 
        className="sticky top-0 z-50 bg-background border-b"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="container max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={step > 1 ? prevStep : undefined}
              disabled={step === 1}
              className={step === 1 ? "invisible" : ""}
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm text-muted-foreground font-medium">
              {step} of {TOTAL_STEPS}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 container max-w-lg mx-auto px-4 py-8"
        style={{ paddingBottom: 'calc(8rem + env(safe-area-inset-bottom))' }}
      >
        {/* Question Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">{currentStepInfo.title}</h1>
          <p className="text-muted-foreground">{currentStepInfo.subtitle}</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Step 1: Photos */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[...Array(6)].map((_, index) => (
                    <div key={index} className="relative aspect-square">
                      {photos[index] ? (
                        <div className="relative h-full group rounded-xl overflow-hidden border-2 border-border">
                          {index === 0 && (
                            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-primary/90 to-primary/70 text-primary-foreground text-xs font-semibold text-center py-1">
                              Main Photo
                            </div>
                          )}
                          <img
                            src={photos[index]}
                            alt={`Photo ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute bottom-2 right-2 h-7 w-7 opacity-80 hover:opacity-100"
                            onClick={() => removePhoto(index)}
                            data-testid={`button-remove-photo-${index}`}
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <label
                          htmlFor={`photo-upload-${index}`}
                          className="flex flex-col items-center justify-center h-full border-2 border-dashed border-muted-foreground/30 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                          data-testid={`label-upload-photo-${index}`}
                        >
                          <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">
                            {index === 0 ? "Main" : `Photo ${index + 1}`}
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
                  <p className="text-sm text-destructive text-center">
                    Upload at least {3 - photos.length} more photo{3 - photos.length !== 1 ? 's' : ''} to continue
                  </p>
                )}
              </div>
            )}

            {/* Step 2: Name */}
            {step === 2 && (
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Your full name" 
                        className="text-lg h-14"
                        data-testid="input-name" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Step 3: Age */}
            {step === 3 && (
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="number"
                        min={18}
                        max={99}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        className="text-lg h-14 text-center"
                        data-testid="input-age"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Step 4: Gender */}
            {step === 4 && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => form.setValue("gender", option.value as "male" | "female")}
                    className={`p-6 rounded-xl border-2 transition-all ${
                      form.watch("gender") === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid={`button-gender-${option.value}`}
                  >
                    <span className="text-lg font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Step 5: Location */}
            {step === 5 && (
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="City, Country" 
                          className="text-lg h-14 flex-1"
                          data-testid="input-location" 
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-14 w-14"
                        onClick={detectLocation}
                        disabled={isLocating}
                        data-testid="button-detect-location"
                      >
                        {isLocating ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <MapPin className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Tap the pin to auto-detect your location
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Step 6: Height */}
            {step === 6 && (
              <FormField
                control={form.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger className="h-14 text-lg" data-testid="select-height">
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
            )}

            {/* Step 7: Ethnicity */}
            {step === 7 && (
              <div className="flex flex-wrap gap-2">
                {ETHNICITY_OPTIONS.map((ethnicity) => (
                  <Badge
                    key={ethnicity}
                    variant={selectedEthnicities.includes(ethnicity) ? "default" : "outline"}
                    className="cursor-pointer hover-elevate px-4 py-2 text-sm"
                    onClick={() => toggleEthnicity(ethnicity)}
                    data-testid={`badge-ethnicity-${ethnicity}`}
                  >
                    {ethnicity}
                  </Badge>
                ))}
              </div>
            )}

            {/* Step 8: Born Muslim */}
            {step === 8 && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: true, label: "Yes" },
                  { value: false, label: "No, I reverted" },
                ].map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => form.setValue("bornMuslim", option.value)}
                    className={`p-6 rounded-xl border-2 transition-all ${
                      form.watch("bornMuslim") === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid={`button-born-muslim-${option.value}`}
                  >
                    <span className="text-lg font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Step 9: Sect */}
            {step === 9 && (
              <div className="space-y-2">
                {SECT_OPTIONS.map((sect) => (
                  <button
                    key={sect}
                    type="button"
                    onClick={() => form.setValue("sect", sect)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      form.watch("sect") === sect
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid={`button-sect-${sect}`}
                  >
                    <span className="font-medium">{sect}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Step 10: Religious Practice */}
            {step === 10 && (
              <div className="space-y-2">
                {RELIGIOUS_PRACTICE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => form.setValue("religiousPractice", option.value)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      form.watch("religiousPractice") === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid={`button-practice-${option.value}`}
                  >
                    <span className="font-medium block">{option.value}</span>
                    <span className="text-sm text-muted-foreground">{option.description}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Step 11: Profession */}
            {step === 11 && (
              <FormField
                control={form.control}
                name="profession"
                render={({ field }) => (
                  <FormItem>
                    <div className="space-y-3">
                      <Input
                        placeholder="Search professions..."
                        value={professionSearch}
                        onChange={(e) => setProfessionSearch(e.target.value)}
                        className="h-12"
                        data-testid="input-profession-search"
                      />
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {filteredProfessions.slice(0, 15).map((prof) => (
                          <button
                            key={prof}
                            type="button"
                            onClick={() => {
                              field.onChange(prof);
                              setProfessionSearch(prof);
                            }}
                            className={`w-full p-3 rounded-lg text-left transition-all ${
                              field.value === prof
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            }`}
                            data-testid={`button-profession-${prof}`}
                          >
                            {prof}
                          </button>
                        ))}
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Step 12: Marital Status */}
            {step === 12 && (
              <div className="space-y-2">
                {MARITAL_STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => form.setValue("maritalStatus", status)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      form.watch("maritalStatus") === status
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid={`button-marital-${status}`}
                  >
                    <span className="font-medium">{status}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Step 13: Personality Traits */}
            {step === 13 && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {PERSONALITY_TRAITS.map((trait) => (
                    <Badge
                      key={trait.value}
                      variant={selectedTraits.includes(trait.value) ? "default" : "outline"}
                      className="cursor-pointer hover-elevate px-4 py-2"
                      onClick={() => toggleTrait(trait.value)}
                      data-testid={`badge-trait-${trait.value}`}
                    >
                      <span className="mr-1">{trait.emoji}</span>
                      {trait.value}
                    </Badge>
                  ))}
                </div>
                {selectedTraits.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center">
                    {selectedTraits.length} of 5 selected
                  </p>
                )}
              </div>
            )}

            {/* Step 14: Interests */}
            {step === 14 && (
              <div className="space-y-6">
                {Object.entries(INTEREST_CATEGORIES).map(([category, interests]) => (
                  <div key={category}>
                    <h3 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">{category}</h3>
                    <div className="flex flex-wrap gap-2">
                      {interests.map((interest) => (
                        <Badge
                          key={interest.value}
                          variant={selectedInterests.includes(interest.value) ? "default" : "outline"}
                          className="cursor-pointer hover-elevate px-3 py-1.5"
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
                  <p className="text-sm text-muted-foreground text-center">
                    {selectedInterests.length} of 15 selected
                  </p>
                )}
              </div>
            )}

            {/* Step 15: Partner Preferences */}
            {step === 15 && (
              <div className="space-y-8">
                {/* Age Range */}
                <div className="space-y-4">
                  <Label className="text-base">Age Range</Label>
                  <div className="flex items-center justify-between text-lg font-medium">
                    <span>{ageRange[0]}</span>
                    <span className="text-muted-foreground">to</span>
                    <span>{ageRange[1]}</span>
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

                {/* Preferred Sects */}
                <div className="space-y-3">
                  <Label className="text-base">Preferred Sects (Optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {SECT_OPTIONS.map((sect) => (
                      <Badge
                        key={sect}
                        variant={partnerSects.includes(sect) ? "default" : "outline"}
                        className="cursor-pointer hover-elevate px-3 py-1.5"
                        onClick={() => togglePartnerSect(sect)}
                        data-testid={`badge-partner-sect-${sect}`}
                      >
                        {sect}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Preferred Ethnicities */}
                <div className="space-y-3">
                  <Label className="text-base">Preferred Ethnicities (Optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {ETHNICITY_OPTIONS.map((ethnicity) => (
                      <Badge
                        key={ethnicity}
                        variant={partnerEthnicities.includes(ethnicity) ? "default" : "outline"}
                        className="cursor-pointer hover-elevate px-3 py-1.5"
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

            {/* Step 16: Bio */}
            {step === 16 && (
              <div className="space-y-4">
                <Textarea
                  value={form.watch("bio") || ""}
                  onChange={(e) => form.setValue("bio", e.target.value)}
                  placeholder="Tell potential matches about yourself, your values, and what you're looking for..."
                  className="min-h-40 text-base"
                  data-testid="textarea-bio"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 hover:from-purple-600 hover:to-pink-600"
                  onClick={async () => {
                    const bio = form.watch("bio");
                    if (!bio || bio.trim().length < 10) {
                      toast({
                        title: "Write something first",
                        description: "Write at least a few words before enhancing",
                        variant: "destructive",
                      });
                      return;
                    }
                    setIsEnhancingBio(true);
                    try {
                      const response = await apiRequest("POST", "/api/enhance-bio", { bio });
                      const data = await response.json();
                      if (data.enhancedBio) {
                        form.setValue("bio", data.enhancedBio);
                        toast({ title: "Bio enhanced!", description: "Your bio has been improved" });
                      }
                    } catch (error: any) {
                      toast({ title: "Enhancement failed", description: error.message, variant: "destructive" });
                    } finally {
                      setIsEnhancingBio(false);
                    }
                  }}
                  disabled={isEnhancingBio}
                  data-testid="button-enhance-bio"
                >
                  {isEnhancingBio ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Enhance with AI
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Write a few words, then tap the button to enhance your bio with AI
                </p>
              </div>
            )}

            {/* Step 17: Video Intro */}
            {step === 17 && (
              <div className="space-y-4">
                {introVideoUrl ? (
                  <div className="space-y-3">
                    <div className="relative aspect-[9/16] max-h-[280px] mx-auto bg-black rounded-xl overflow-hidden">
                      <video
                        src={introVideoUrl}
                        className="w-full h-full object-cover"
                        controls
                        playsInline
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIntroVideoUrl(null)}
                      className="w-full"
                      data-testid="button-remove-video"
                    >
                      Record New Video
                    </Button>
                  </div>
                ) : (
                  <VideoRecorder
                    onVideoRecorded={handleVideoRecorded}
                    onCancel={handleSkipVideo}
                    isUploading={isUploadingVideo}
                  />
                )}

                <div className="bg-muted/50 rounded-lg p-3 border">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-primary flex-shrink-0" />
                    <p className="text-xs"><span className="font-medium">Profiles with videos get 3x more matches!</span> <span className="text-muted-foreground">A short intro helps others see your personality.</span></p>
                  </div>
                </div>
              </div>
            )}
          </form>
        </Form>
      </div>

      {/* Fixed Bottom Navigation */}
      <div 
        className="fixed bottom-0 left-0 right-0 bg-background border-t p-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="container max-w-lg mx-auto">
          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={!canProceed()}
              className="w-full h-12 text-base"
              data-testid="button-next"
            >
              Continue
              <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => form.handleSubmit(onSubmit)()}
              disabled={createProfileMutation.isPending || isUploadingVideo}
              className="w-full h-12 text-base"
              data-testid="button-submit-profile"
            >
              {createProfileMutation.isPending ? "Creating..." : "Complete Profile"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
