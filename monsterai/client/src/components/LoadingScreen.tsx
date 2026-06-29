import { useEffect, useState } from "react";
import {
  detectDeviceType,
  getAnimationScale,
  getAnimationPlaybackRate,
  getRecommendedAnimationIndex,
  getDeviceInfo,
} from "@/utils/deviceDetection";

// 23 random loading animations - each startup shows a different one
const LOADING_ANIMATIONS = [
  "/manus-storage/animation-1_a70e292a.mp4",
  "/manus-storage/animation-2_0c09d96b.mp4",
  "/manus-storage/animation-3_9dad3b62.mp4",
  "/manus-storage/animation-4_837f6212.mp4",
  "/manus-storage/animation-5_d88d6117.mp4",
  "/manus-storage/animation-6_4c65ce3e.mp4",
  "/manus-storage/animation-7_4ce840ab.mp4",
  "/manus-storage/animation-8_89e6d059.mp4",
  "/manus-storage/animation-9_39851772.mp4",
  "/manus-storage/animation-10_0f7719bf.mp4",
  "/manus-storage/1000022160_4a3c515b.mp4",
  "/manus-storage/1000022161_4fc53396.mp4",
  "/manus-storage/1000022162_056aa31f.mp4",
  "/manus-storage/1000022163_fcc91699.mp4",
  "/manus-storage/1000022164_b1b97364.mp4",
  "/manus-storage/1000022166_3b67fc33.mp4",
  "/manus-storage/1000022167_fa125d43.mp4",
  "/manus-storage/1000022168_a96fe7d2.mp4",
  "/manus-storage/1000022169_7c41d903.mp4",
  "/manus-storage/1000022170_8ec7cfd9.mp4",
  "/manus-storage/1000022187_ecb2493b.mp4",
  "/manus-storage/1000022188_a4ec0959.mp4",
  "/manus-storage/1000022189_880094e7.mp4",
  "/manus-storage/1000022190_e70fffec.mp4",
  "/manus-storage/1000022195_ce56ba6f.mp4",
];

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [selectedAnimation] = useState(() => {
    const animationIndex = getRecommendedAnimationIndex(LOADING_ANIMATIONS.length);
    return LOADING_ANIMATIONS[animationIndex];
  });

  const [deviceInfo] = useState(() => getDeviceInfo());
  const [animationScale] = useState(() => getAnimationScale());
  const [playbackRate] = useState(() => getAnimationPlaybackRate());

  const handleVideoEnd = () => {
    onComplete();
  };

  // Log device info for debugging
  useEffect(() => {
    console.log("Device Info:", {
      type: deviceInfo.type,
      screenWidth: deviceInfo.screenWidth,
      screenHeight: deviceInfo.screenHeight,
      isTouchDevice: deviceInfo.isTouchDevice,
      isLowEndDevice: deviceInfo.isLowEndDevice,
      networkSpeed: deviceInfo.networkSpeed,
      animationScale,
      playbackRate,
    });
  }, [deviceInfo, animationScale, playbackRate]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0f] overflow-hidden">
      {/* Device-Specific Loading Animation Video */}
      <video
        key={selectedAnimation}
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnd}
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

      {/* Device Type Indicator (for debugging - remove in production) */}
      {process.env.NODE_ENV === "development" && (
        <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-black/50 px-2 py-1 rounded">
          {deviceInfo.type} • {deviceInfo.networkSpeed}
        </div>
      )}
    </div>
  );
}
