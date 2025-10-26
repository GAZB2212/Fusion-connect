import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Upload, CheckCircle2, LogOut } from "lucide-react";
import {
  INTEREST_CATEGORIES,
  PROFESSIONS,
  HEIGHT_OPTIONS_CM,
  SECT_OPTIONS,
  RELIGIOUS_PRACTICE_OPTIONS,
  MARITAL_STATUS_OPTIONS,
} from "@shared/constants";
import { Badge } from "@/components/ui/badge";

export default function ProfileSetup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [professionSearch, setProfessionSearch] = useState("");

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
      photoVisibility: "visible",
      photoVerified: false,
      useNickname: false,
    },
  });

  const createProfileMutation = useMutation({
    mutationFn: async (data: InsertProfile) => {
      return apiRequest("POST", "/api/profile", data);
    },
    onSuccess: () => {
      toast({
        title: "Profile Created!",
        description: "Welcome to Fusion. Start discovering matches!",
      });
      setLocation("/");
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
      isComplete: true,
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        form.setValue("photos", [result]);
      };
      reader.readAsDataURL(file);
    }
  };

  const nextStep = () => {
    if (step < 5) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const toggleInterest = (interest: string) => {
    const newInterests = selectedInterests.includes(interest)
      ? selectedInterests.filter((i) => i !== interest)
      : [...selectedInterests, interest];
    setSelectedInterests(newInterests);
    form.setValue("interests", newInterests);
  };

  const filteredProfessions = PROFESSIONS.filter((prof) =>
    prof.toLowerCase().includes(professionSearch.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold mb-2">Create Your Profile</h1>
          <p className="text-muted-foreground">
            Let's help you find your perfect match
          </p>
          
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-2 w-12 rounded-full ${
                  s <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        <Card className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Step 1: Basic Info */}
              {step === 1 && (
                <div className="space-y-6">
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
                        <FormControl>
                          <Input {...field} placeholder="City, Country" data-testid="input-location" />
                        </FormControl>
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

                  {/* Photo Upload */}
                  <div>
                    <Label>Profile Photo</Label>
                    <div className="mt-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        id="photo-upload"
                      />
                      <label
                        htmlFor="photo-upload"
                        className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover-elevate"
                        data-testid="label-upload-photo"
                      >
                        {photoPreview ? (
                          <img
                            src={photoPreview}
                            alt="Preview"
                            className="h-full w-full object-cover rounded-lg"
                          />
                        ) : (
                          <>
                            <Upload className="h-12 w-12 text-muted-foreground mb-2" />
                            <span className="text-sm text-muted-foreground">
                              Click to upload a photo
                            </span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
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

              {/* Step 3: Profession & Marital Status */}
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
                        <FormLabel>Education (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="e.g., Bachelor's in Computer Science" data-testid="input-education" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 4: Interests */}
              {step === 4 && (
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

              {/* Step 5: Bio & Final Details */}
              {step === 5 && (
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

                  <div className="bg-muted/50 rounded-lg p-6 border">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-2">Profile Complete!</h3>
                        <p className="text-sm text-muted-foreground">
                          Your profile is ready. Click submit to start discovering matches.
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

                {step < 5 ? (
                  <Button type="button" onClick={nextStep} data-testid="button-next">
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={createProfileMutation.isPending}
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
