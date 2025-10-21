import { useEffect, useState } from "react";
import splashVideo from "@assets/Animate_this_logo_202510211803_1761066281193.mp4";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    console.log("Splash screen mounted!");
    const timer = setTimeout(() => {
      console.log("Splash screen timer complete");
      setFadeOut(true);
      setTimeout(onComplete, 500);
    }, 3500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center justify-center gap-6">
        <video
          autoPlay
          muted
          playsInline
          className="w-[300px] md:w-[400px] h-auto"
          onLoadedData={() => console.log("Video loaded successfully")}
          onError={(e) => console.error("Video error:", e)}
          onEnded={() => {
            console.log("Video ended");
            setFadeOut(true);
            setTimeout(onComplete, 500);
          }}
        >
          <source src={splashVideo} type="video/mp4" />
        </video>
        <h2 className="text-2xl md:text-3xl font-serif text-primary animate-pulse">
          Where Muslims Meet
        </h2>
      </div>
    </div>
  );
}
