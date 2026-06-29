import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import MobileChatPage from "./MobileChatPage";
import MobileImagePage from "./MobileImagePage";
import MobileStatsPanel from "@/components/MobileStatsPanel";
import { Button } from "@/components/ui/button";
import { BarChart3, MessageCircle, Image as ImageIcon, LogOut } from "lucide-react";
import { Loader2 } from "lucide-react";

type MobileView = "chat" | "image" | "stats";

export default function MobileApp() {
  const { user, loading: authLoading, logout } = useAuth();
  const [currentView, setCurrentView] = useState<MobileView>("chat");

  // Get user stats
  const { data: userStats } = trpc.feedback.getUserStats.useQuery(undefined, {
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please log in to continue</p>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case "chat":
        return (
          <MobileChatPage
            onSwitchToImage={() => setCurrentView("image")}
          />
        );
      case "image":
        return (
          <MobileImagePage
            onSwitchToChat={() => setCurrentView("chat")}
          />
        );
      case "stats":
        return (
          <MobileStatsPanel
            totalFeedback={userStats?.totalFeedback || 0}
            averageRating={userStats?.averageRating || null}
            improvements={userStats?.improvements || 0}
            optimizations={userStats?.optimizations || 0}
            onBack={() => setCurrentView("chat")}
          />
        );
      default:
        return <MobileChatPage />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Main Content */}
      <div className="flex-1">{renderView()}</div>

      {/* Mobile Bottom Navigation */}
      <div className="bg-card border-t border-border px-4 py-2 flex gap-2 sticky bottom-0 z-40">
        <Button
          variant={currentView === "chat" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentView("chat")}
          className="flex-1 flex items-center justify-center gap-1 h-12"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-xs">Chat</span>
        </Button>
        <Button
          variant={currentView === "image" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentView("image")}
          className="flex-1 flex items-center justify-center gap-1 h-12"
        >
          <ImageIcon className="w-5 h-5" />
          <span className="text-xs">Generate</span>
        </Button>
        <Button
          variant={currentView === "stats" ? "default" : "ghost"}
          size="sm"
          onClick={() => setCurrentView("stats")}
          className="flex-1 flex items-center justify-center gap-1 h-12"
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-xs">Stats</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="flex-1 flex items-center justify-center gap-1 h-12 text-destructive hover:text-destructive"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-xs">Logout</span>
        </Button>
      </div>
    </div>
  );
}
