import { useState, useEffect } from "react";
import { APP_LOGO_SRC } from "@/const";

const AGE_VERIFIED_KEY = "monsterai_age_verified";

export function AgeVerification({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(AGE_VERIFIED_KEY);
    setVerified(stored === "true");
  }, []);

  const handleVerify = () => {
    localStorage.setItem(AGE_VERIFIED_KEY, "true");
    setVerified(true);
  };

  const handleDeny = () => {
    window.location.href = "https://www.google.com";
  };

  // Loading state
  if (verified === null) return null;

  // Already verified
  if (verified) return <>{children}</>;

  // Show age gate
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4 p-8 rounded-2xl bg-card border border-border shadow-2xl text-center">
        {/* Logo */}
        <div className="mb-6">
          <img
            src={APP_LOGO_SRC}
            alt="MonsterAi"
            className="w-16 h-16 mx-auto rounded-xl"
          />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2">MonsterAi</h1>
        <p className="text-zinc-400 mb-6">Free AI Community Platform</p>

        {/* Warning */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <p className="text-yellow-400 text-sm font-medium mb-1">⚠️ Age Restriction / 年齡限制</p>
          <p className="text-zinc-300 text-sm">
            This platform is restricted to users aged 18 and above.
          </p>
          <p className="text-zinc-300 text-sm mt-1">
            本平台僅限 18 歲以上用戶使用。
          </p>
        </div>

        {/* Confirmation */}
        <p className="text-white text-sm mb-6">
          By clicking "I am 18+" you confirm that you are at least 18 years old.
          <br />
          <span className="text-zinc-400">
            點擊「我已滿 18 歲」即確認您已年滿 18 歲。
          </span>
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleDeny}
            className="flex-1 px-4 py-3 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors font-medium"
          >
            I am under 18
            <br />
            <span className="text-xs">我未滿 18 歲</span>
          </button>
          <button
            onClick={handleVerify}
            className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 transition-colors font-medium"
          >
            I am 18+
            <br />
            <span className="text-xs">我已滿 18 歲</span>
          </button>
        </div>

        {/* Legal notice */}
        <p className="text-zinc-600 text-xs mt-4">
          Misrepresenting your age may violate local laws.
          <br />
          虛報年齡可能違反當地法律。
        </p>
      </div>
    </div>
  );
}
