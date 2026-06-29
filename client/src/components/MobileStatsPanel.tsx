import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  const stats = [
    { icon: BarChart3, label: t("mobileStats.feedback"), value: totalFeedback, color: "text-blue-400" },
    {
      icon: TrendingUp,
      label: t("mobileStats.rating"),
      value: averageRating ? `${averageRating.toFixed(1)}/5` : t("mobileStats.na"),
      color: "text-green-400",
    },
    { icon: Zap, label: t("mobileStats.improvements"), value: improvements, color: "text-purple-400" },
    { icon: Target, label: t("mobileStats.optimizations"), value: optimizations, color: "text-orange-400" },
  ];

  const insightText =
    averageRating && averageRating >= 4
      ? t("mobileStats.insightGood")
      : averageRating && averageRating >= 3
        ? t("mobileStats.insightProgress")
        : t("mobileStats.learning");

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-2 sticky top-0 z-40">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="p-0 h-auto">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        )}
        <h1 className="font-bold text-base">{t("mobileStats.title")}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <Card key={idx} className="p-4 bg-card border-border hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                    <p className="text-xl font-bold">{stat.value}</p>
                  </div>
                  <Icon className={`w-8 h-8 ${stat.color} opacity-70`} />
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="mt-6 p-4 bg-card border-border">
          <h2 className="font-semibold mb-3">{t("mobileStats.performanceSummary")}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("mobileStats.totalInteractions")}</span>
              <span className="font-medium">{totalFeedback}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("mobileStats.qualityScore")}</span>
              <span className="font-medium">
                {averageRating ? `${(averageRating * 20).toFixed(0)}%` : t("mobileStats.na")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("mobileStats.aiImprovements")}</span>
              <span className="font-medium">{improvements}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("mobileStats.promptOptimizations")}</span>
              <span className="font-medium">{optimizations}</span>
            </div>
          </div>
        </Card>

        <Card className="mt-4 p-4 bg-card border-border">
          <h2 className="font-semibold mb-2">{t("mobileStats.insights")}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">{insightText}</p>
        </Card>
      </div>
    </div>
  );
}