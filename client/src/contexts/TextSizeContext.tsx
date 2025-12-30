import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type TextSize = "small" | "medium" | "large";

interface TextSizeContextType {
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  fontSizeClass: string;
  fontSize: number;
  textSizeClass: string;
}

const TextSizeContext = createContext<TextSizeContextType | undefined>(undefined);

const TEXT_SIZE_KEY = "fusion_text_size";

const fontSizeMap: Record<TextSize, { class: string; size: number; chatClass: string }> = {
  small: { class: "text-sm", size: 14, chatClass: "chat-text-small" },
  medium: { class: "text-base", size: 16, chatClass: "chat-text-medium" },
  large: { class: "text-lg", size: 18, chatClass: "chat-text-large" },
};

export function TextSizeProvider({ children }: { children: ReactNode }) {
  const [textSize, setTextSizeState] = useState<TextSize>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(TEXT_SIZE_KEY);
      if (saved && (saved === "small" || saved === "medium" || saved === "large")) {
        return saved;
      }
    }
    return "medium";
  });

  const setTextSize = (size: TextSize) => {
    setTextSizeState(size);
    localStorage.setItem(TEXT_SIZE_KEY, size);
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-text-size", textSize);
    // Apply text size class to body for global styling
    document.body.classList.remove("text-size-small", "text-size-medium", "text-size-large");
    document.body.classList.add(`text-size-${textSize}`);
  }, [textSize]);

  return (
    <TextSizeContext.Provider
      value={{
        textSize,
        setTextSize,
        fontSizeClass: fontSizeMap[textSize].class,
        fontSize: fontSizeMap[textSize].size,
        textSizeClass: fontSizeMap[textSize].chatClass,
      }}
    >
      {children}
    </TextSizeContext.Provider>
  );
}

export function useTextSize() {
  const context = useContext(TextSizeContext);
  if (!context) {
    throw new Error("useTextSize must be used within a TextSizeProvider");
  }
  return context;
}
