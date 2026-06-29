import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  getAnimationScale,
  getAnimationPlaybackRate,
  getRecommendedAnimationIndex,
  getDeviceInfo,
} from "@/utils/deviceDetection";

// Prefer /monster-storage/ (proxied to Node) then /animations/ (local public/)
const LOADING_ANIMATIONS = [
  "/monster-storage/animation-1_a70e292a.mp4",
  "/monster-storage/animation-2_0c09d96b.mp4",
  "/monster-storage/animation-3_9dad3b62.mp4",
  "/monster-storage/animation-4_837f6212.mp4",
  "/monster-storage/animation-5_d88d6117.mp4",
  "/monster-storage/animation-6_4c65ce3e.mp4",
  "/monster-storage/animation-7_4ce840ab.mp4",
  "/monster-storage/animation-8_89e6d059.mp4",
  "/monster-storage/animation-9_39851772.mp4",
  "/monster-storage/animation-10_0f7719bf.mp4",
];

const FALLBACK_DELAY_MS = 2200;

function SpinnerFallback({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, FALLBACK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0f] gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-2 border-accent/30 animate-pulse" />
        <Loader2 className="absolute inset-0 m-auto w-10 h-10 animate-spin text-accent" />
      </div>
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Monster AI</h1>
        <p className="text-sm text-muted-foreground">Local-first · Self-healing · Open source</p>
      </div>
    </div>
  );
}

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [selectedAnimation] = useState(() => {
    const animationIndex = getRecommendedAnimationIndex(LOADING_ANIMATIONS.length);
    return LOADING_ANIMATIONS[animationIndex];
  });
  const [useFallback, setUseFallback] = useState(false);
  const [deviceInfo] = useState(() => getDeviceInfo());
  const [animationScale] = useState(() => getAnimationScale());
  const [playbackRate] = useState(() => getAnimationPlaybackRate());

  useEffect(() => {
    const timer = window.setTimeout(() => setUseFallback(true), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("LoadingScreen device:", {
        type: deviceInfo.type,
        networkSpeed: deviceInfo.networkSpeed,
        animationScale,
        playbackRate,
      });
    }
  }, [deviceInfo, animationScale, playbackRate]);

  if (useFallback) {
    return <SpinnerFallback onComplete={onComplete} />;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0f] overflow-hidden">
      <video
        key={selectedAnimation}
        autoPlay
        muted
        playsInline
        playbackRate={playbackRate}
        onEnded={onComplete}
        onError={() => setUseFallback(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${animationScale})`,
          transformOrigin: "center",
        }}
      >
        <source src={selectedAnimation} type="video/mp4" />
      </video>
    </div>
  );
}