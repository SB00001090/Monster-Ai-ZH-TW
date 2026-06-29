import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import ChatPage from "@/pages/ChatPage";
import MobileApp from "@/pages/MobileApp";
import SelfAwarenessPage from "@/pages/SelfAwarenessPage";
import CharacterManagementPage from "./pages/CharacterManagementPage";
import CharacterTemplatesPage from "./pages/CharacterTemplatesPage";
import CharacterCommunityPage from "./pages/CharacterCommunityPage";
import CharacterAnalyticsPage from "./pages/CharacterAnalyticsPage";
import CharacterChatPage from "./pages/CharacterChatPage";
import DashboardLayout from "./components/DashboardLayout";
import TutorialPage from "./pages/TutorialPage";
import AdminBugDashboard from "./pages/AdminBugDashboard";
import LoginPage from "./pages/LoginPage";
import LLMSettings from "./pages/LLMSettings";
import AgentPage from "./pages/AgentPage";
import SettingsPage from "./pages/SettingsPage";
import ForumPage from "./pages/ForumPage";
import MusicPage from "./pages/MusicPage";
import { F2FVerificationPage } from "./pages/F2FVerificationPage";
import { TextToImagePage } from "./pages/TextToImagePage";
import { VideoGenerationPage } from "./pages/VideoGenerationPage";

import LoadingScreen from "./components/LoadingScreen";
import { AgeVerification } from "./components/AgeVerification";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { GuestProvider } from "./contexts/GuestContext";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./_core/hooks/useAuth";
import { useGuest } from "./contexts/GuestContext";
import { usePushNotifications } from "./hooks/usePushNotifications";

function Router() {
  const [isMobile, setIsMobile] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { isGuest } = useGuest();
  usePushNotifications(); // Initialize push notifications

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Wait for auth to load before rendering routes
  if (authLoading) {
    return <LoadingScreen onComplete={() => {}} />;
  }

  const DefaultComponent = isMobile ? MobileApp : ChatPage;

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/chat">
        <DashboardLayout>
          <ChatPage />
        </DashboardLayout>
      </Route>
      <Route path="/characters">
        <DashboardLayout>
          <CharacterManagementPage />
        </DashboardLayout>
      </Route>
      <Route path="/characters/new">
        <DashboardLayout>
          <CharacterManagementPage />
        </DashboardLayout>
      </Route>
      <Route path="/templates">
        <DashboardLayout>
          <CharacterTemplatesPage />
        </DashboardLayout>
      </Route>
      <Route path="/community">
        <DashboardLayout>
          <CharacterCommunityPage />
        </DashboardLayout>
      </Route>
      <Route path="/analytics">
        <DashboardLayout>
          <CharacterAnalyticsPage />
        </DashboardLayout>
      </Route>
      <Route path="/character-chat">
        <DashboardLayout>
          <CharacterChatPage />
        </DashboardLayout>
      </Route>
      <Route path="/self-awareness">
        <DashboardLayout>
          <SelfAwarenessPage />
        </DashboardLayout>
      </Route>
      <Route path="/llm-settings">
        <DashboardLayout>
          <LLMSettings />
        </DashboardLayout>
      </Route>
      <Route path="/agent">
        <DashboardLayout>
          <AgentPage />
        </DashboardLayout>
      </Route>
      <Route path="/settings">
        <DashboardLayout>
          <SettingsPage />
        </DashboardLayout>
      </Route>
      <Route path="/forum">
        <DashboardLayout>
          <ForumPage />
        </DashboardLayout>
      </Route>
      <Route path="/music">
        <DashboardLayout>
          <MusicPage />
        </DashboardLayout>
      </Route>
      <Route path="/verify">
        <DashboardLayout>
          <F2FVerificationPage />
        </DashboardLayout>
      </Route>
      <Route path="/text-to-image">
        <DashboardLayout>
          <TextToImagePage />
        </DashboardLayout>
      </Route>
      <Route path="/video">
        <DashboardLayout>
          <VideoGenerationPage />
        </DashboardLayout>
      </Route>

      <Route path="/tutorials" component={TutorialPage} />
      <Route path="/admin/bugs" component={AdminBugDashboard} />
      <Route path="/404" component={NotFound} />
      <Route path={"/"} component={DefaultComponent} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showLoading, setShowLoading] = useState(true);
  const [hasShownLoading, setHasShownLoading] = useState(() => {
    // Only show loading once per session
    return sessionStorage.getItem("monsterai_loaded") === "true";
  });

  const handleLoadingComplete = useCallback(() => {
    setShowLoading(false);
    sessionStorage.setItem("monsterai_loaded", "true");
  }, []);

  if (hasShownLoading) {
    // Skip loading screen if already shown this session
    return (
      <AgeVerification>
        <ErrorBoundary>
          <GuestProvider>
            <ThemeProvider defaultTheme="dark" switchable>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </ThemeProvider>
          </GuestProvider>
        </ErrorBoundary>
      </AgeVerification>
    );
  }

  return (
    <AgeVerification>
      <ErrorBoundary>
        <GuestProvider>
          <ThemeProvider defaultTheme="dark" switchable>
            <TooltipProvider>
              {showLoading && <LoadingScreen onComplete={handleLoadingComplete} />}
              {!showLoading && (
                <>
                  <Toaster />
                  <Router />
                </>
              )}
            </TooltipProvider>
          </ThemeProvider>
        </GuestProvider>
      </ErrorBoundary>
    </AgeVerification>
  );
}

export default App;
