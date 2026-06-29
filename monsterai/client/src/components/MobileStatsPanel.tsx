import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Zap, Target, ChevronLeft } from "lucide-react";

interface MobileStatsPanelProps {
  totalFeedback: number;
  averageRating: number | null;
  improvements: number;
  optimizations: number;
  onBack?: () => void;
}

export default function MobileStatsPanel({
  totalFeedback,
  averageRating,
  improvements,
  optimizations,
  onBack,
}: MobileStatsPanelProps) {
  const stats = [
    {
      icon: BarChart3,
      label: "Feedback",
      value: totalFeedback,
      color: "text-blue-400",
    },
    {
      icon: TrendingUp,
      label: "Rating",
      value: averageRating ? `${averageRating.toFixed(1)}/5` : "N/A",
      color: "text-green-400",
    },
    {
      icon: Zap,
      label: "Improvements",
      value: improvements,
      color: "text-purple-400",
    },
    {
      icon: Target,
      label: "Optimizations",
      value: optimizations,
      color: "text-orange-400",
    },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-2 sticky top-0 z-40">
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="p-0 h-auto"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
        )}
        <h1 className="font-bold text-base">MonsterAi Stats</h1>
      </div>

      {/* Stats Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <Card
                key={idx}
                className="p-4 bg-card border-border hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {stat.label}
                    </p>
                    <p className="text-xl font-bold">{stat.value}</p>
                  </div>
                  <Icon className={`w-8 h-8 ${stat.color} opacity-70`} />
                </div>
              </Card>
            );
          })}
        </div>

        {/* Performance Summary */}
        <Card className="mt-6 p-4 bg-card border-border">
          <h2 className="font-semibold mb-3">Performance Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Interactions</span>
              <span className="font-medium">{totalFeedback}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quality Score</span>
              <span className="font-medium">
                {averageRating ? `${(averageRating * 20).toFixed(0)}%` : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AI Improvements</span>
              <span className="font-medium">{improvements}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prompt Optimizations</span>
              <span className="font-medium">{optimizations}</span>
            </div>
          </div>
        </Card>

        {/* Insights */}
        <Card className="mt-4 p-4 bg-card border-border">
          <h2 className="font-semibold mb-2">Insights</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {averageRating && averageRating >= 4
              ? "✨ Great! MonsterAi is performing well. Keep providing feedback to help it improve further."
              : averageRating && averageRating >= 3
                ? "📈 Good progress! Your feedback is helping MonsterAi learn and improve."
                : "🚀 MonsterAi is learning from your feedback. More interactions will help optimize responses."}
          </p>
        </Card>
      </div>
    </div>
  );
}
