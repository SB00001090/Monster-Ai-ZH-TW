import { useGuest } from "@/contexts/GuestContext";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

export default function LoginPage() {
  const { t } = useTranslation();
  const { setAsGuest } = useGuest();
  const { theme } = useTheme();
  const [, setLocation] = useLocation();

  const handleGuestMode = () => {
    setAsGuest();
    setLocation("/");
  };

  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <svg
              className="w-16 h-16"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Monster AI Logo */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill={theme === "dark" ? "#1a1a2e" : "#f5f5f5"}
                stroke={theme === "dark" ? "#7c3aed" : "#5b21b6"}
                strokeWidth="2"
              />
              <path
                d="M 35 40 Q 35 30 50 30 Q 65 30 65 40"
                stroke={theme === "dark" ? "#7c3aed" : "#5b21b6"}
                strokeWidth="3"
                fill="none"
              />
              <circle cx="40" cy="45" r="4" fill={theme === "dark" ? "#7c3aed" : "#5b21b6"} />
              <circle cx="60" cy="45" r="4" fill={theme === "dark" ? "#7c3aed" : "#5b21b6"} />
              <path
                d="M 40 55 Q 50 65 60 55"
                stroke={theme === "dark" ? "#7c3aed" : "#5b21b6"}
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </div>
          <CardTitle className="text-3xl font-bold">MonsterAi</CardTitle>
          <CardDescription className="mt-2">
            {t("common.welcome") || "Welcome to MonsterAi"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Button
              onClick={handleLogin}
              className="w-full gap-2 bg-accent hover:bg-accent/90"
              size="lg"
            >
              {t("auth.loginWithManus") || "Login with Manus"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  {t("common.or") || "Or"}
                </span>
              </div>
            </div>

            <Button
              onClick={handleGuestMode}
              variant="outline"
              className="w-full gap-2"
              size="lg"
            >
              {t("auth.continueAsGuest") || "Continue as Guest"}
            </Button>
          </div>

          <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground space-y-2">
            <p className="font-semibold">{t("auth.guestModeInfo") || "Guest Mode:"}</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>{t("auth.guestFeature1") || "Chat with AI characters"}</li>
              <li>{t("auth.guestFeature2") || "Generate images"}</li>
              <li>{t("auth.guestFeature3") || "Data stored locally only"}</li>
              <li>{t("auth.guestFeature4") || "Login anytime to save data"}</li>
            </ul>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            {t("auth.guestDisclaimer") || "Guest data will be lost if you clear your browser cache"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
