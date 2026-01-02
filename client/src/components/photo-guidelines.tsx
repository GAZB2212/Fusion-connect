import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, X, Camera } from "lucide-react";
import goodPhoto1 from "@assets/Gemini_Generated_Image_ba6nrlba6nrlba6n_1767312653464.jpeg";
import goodPhoto2 from "@assets/Gemini_Generated_Image_hw5idnhw5idnhw5i_1767312687372.jpeg";
import badPhotoFarAway from "@assets/Gemini_Generated_Image_j0c28mj0c28mj0c2_1767312327264.jpeg";
import badPhotoSunglasses from "@assets/Gemini_Generated_Image_hn1a45hn1a45hn1a_1767312327264.jpeg";
import badPhotoNotPerson from "@assets/Gemini_Generated_Image_3aycm33aycm33ayc_1767312327264.jpeg";

interface PhotoGuidelinesProps {
  onContinue: () => void;
}

export function PhotoGuidelines({ onContinue }: PhotoGuidelinesProps) {
  const goodExamples = [
    { src: goodPhoto1, label: "Clear face, natural smile" },
    { src: goodPhoto2, label: "Eyes visible, good lighting" },
  ];

  const badExamples = [
    { src: badPhotoSunglasses, label: "Eyes covered" },
    { src: badPhotoFarAway, label: "Too far away" },
    { src: badPhotoNotPerson, label: "Not a person" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Camera className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Capture Your Best Self</h1>
          <p className="text-muted-foreground">
            Great photos help you make a strong first impression
          </p>
        </div>

        <Card className="p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-3 h-3 text-emerald-600" />
              </div>
              The Fusion Standard
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {goodExamples.map((example, index) => (
                <div key={index} className="relative">
                  <div className="aspect-square rounded-xl overflow-hidden border-2 border-emerald-500/30">
                    <img
                      src={example.src}
                      alt={example.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-xs text-center mt-2 text-muted-foreground">
                    {example.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center">
                <X className="w-3 h-3 text-destructive" />
              </div>
              Please Avoid
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {badExamples.map((example, index) => (
                <div key={index} className="relative">
                  <div className="aspect-square rounded-lg overflow-hidden border-2 border-destructive/30 opacity-80">
                    <img
                      src={example.src}
                      alt={example.label}
                      className="w-full h-full object-cover grayscale-[30%]"
                    />
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full flex items-center justify-center shadow-md">
                    <X className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-[10px] text-center mt-1.5 text-muted-foreground">
                    {example.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <div className="text-center text-xs text-muted-foreground space-y-1">
            <p>Your first photo will be used for verification</p>
            <p>We need at least 3 photos to complete your profile</p>
          </div>
          
          <Button 
            onClick={onContinue} 
            className="w-full"
            size="lg"
            data-testid="button-photo-guidelines-continue"
          >
            Got it, let's upload
          </Button>
        </div>
      </div>
    </div>
  );
}
