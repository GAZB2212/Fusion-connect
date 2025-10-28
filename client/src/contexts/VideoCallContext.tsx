import { createContext, useContext, useState, ReactNode } from 'react';

interface VideoCallContextType {
  isCallActive: boolean;
  setIsCallActive: (active: boolean) => void;
}

const VideoCallContext = createContext<VideoCallContextType | undefined>(undefined);

export function VideoCallProvider({ children }: { children: ReactNode }) {
  const [isCallActive, setIsCallActive] = useState(false);

  return (
    <VideoCallContext.Provider value={{ isCallActive, setIsCallActive }}>
      {children}
    </VideoCallContext.Provider>
  );
}

export function useVideoCall() {
  const context = useContext(VideoCallContext);
  if (context === undefined) {
    throw new Error('useVideoCall must be used within a VideoCallProvider');
  }
  return context;
}
