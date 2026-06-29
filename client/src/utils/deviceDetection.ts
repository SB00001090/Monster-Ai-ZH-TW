/**
 * Device Detection Utility
 * Detects device type and screen size for optimized loading animations
 */

export type DeviceType = "mobile" | "tablet" | "desktop";

interface DeviceInfo {
  type: DeviceType;
  screenWidth: number;
  screenHeight: number;
  isTouchDevice: boolean;
  isLowEndDevice: boolean;
  networkSpeed: "slow" | "medium" | "fast";
}

/**
 * Detect device type based on screen width
 */
export function detectDeviceType(): DeviceType {
  const width = window.innerWidth;
  
  if (width < 768) {
    return "mobile";
  } else if (width < 1024) {
    return "tablet";
  } else {
    return "desktop";
  }
}

/**
 * Detect if device is touch-enabled
 */
export function isTouchDevice(): boolean {
  return (
    typeof window !== "undefined" &&
    (("ontouchstart" in window) ||
      (navigator.maxTouchPoints > 0) ||
      ((navigator as any).msMaxTouchPoints > 0))
  );
}

/**
 * Detect if device is low-end (based on memory and processor)
 */
export function isLowEndDevice(): boolean {
  // Check device memory if available
  if ("deviceMemory" in navigator) {
    const memory = (navigator as any).deviceMemory;
    if (memory && memory < 4) {
      return true;
    }
  }

  // Check processor cores if available
  if ("hardwareConcurrency" in navigator) {
    const cores = navigator.hardwareConcurrency;
    if (cores && cores < 4) {
      return true;
    }
  }

  // Check if device is mobile (typically lower-end)
  const deviceType = detectDeviceType();
  return deviceType === "mobile";
}

/**
 * Detect network speed using Connection API
 */
export function detectNetworkSpeed(): "slow" | "medium" | "fast" {
  if ("connection" in navigator) {
    const connection = (navigator as any).connection;
    if (connection) {
      const effectiveType = connection.effectiveType;
      switch (effectiveType) {
        case "4g":
          return "fast";
        case "3g":
          return "medium";
        case "2g":
        case "slow-2g":
          return "slow";
        default:
          return "medium";
      }
    }
  }

  // Default to medium if Connection API not available
  return "medium";
}

/**
 * Get comprehensive device information
 */
export function getDeviceInfo(): DeviceInfo {
  return {
    type: detectDeviceType(),
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    isTouchDevice: isTouchDevice(),
    isLowEndDevice: isLowEndDevice(),
    networkSpeed: detectNetworkSpeed(),
  };
}

/**
 * Get recommended animation based on device
 */
export function getRecommendedAnimationIndex(totalAnimations: number): number {
  const deviceInfo = getDeviceInfo();
  
  // For low-end devices, use lighter animations (first few)
  if (deviceInfo.isLowEndDevice) {
    return Math.floor(Math.random() * Math.min(3, totalAnimations));
  }

  // For slow networks, use shorter animations
  if (deviceInfo.networkSpeed === "slow") {
    return Math.floor(Math.random() * Math.min(5, totalAnimations));
  }

  // For all other cases, use any animation
  return Math.floor(Math.random() * totalAnimations);
}

/**
 * Get animation scale based on device screen size
 */
export function getAnimationScale(): number {
  const deviceInfo = getDeviceInfo();
  
  switch (deviceInfo.type) {
    case "mobile":
      return 0.8; // Slightly smaller for mobile
    case "tablet":
      return 0.9; // Medium size for tablet
    case "desktop":
      return 1; // Full size for desktop
    default:
      return 1;
  }
}

/**
 * Get animation playback rate based on device performance
 */
export function getAnimationPlaybackRate(): number {
  const deviceInfo = getDeviceInfo();
  
  // Slow down animations on low-end devices
  if (deviceInfo.isLowEndDevice) {
    return 0.8;
  }

  // Normal speed for other devices
  return 1;
}

/**
 * Get animation quality based on device
 */
export function getAnimationQuality(): "low" | "medium" | "high" {
  const deviceInfo = getDeviceInfo();
  
  if (deviceInfo.isLowEndDevice || deviceInfo.networkSpeed === "slow") {
    return "low";
  }

  if (deviceInfo.networkSpeed === "medium") {
    return "medium";
  }

  return "high";
}
