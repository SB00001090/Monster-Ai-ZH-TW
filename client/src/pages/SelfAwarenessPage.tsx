import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Brain, Zap } from "lucide-react";
import { toast } from "sonner";

export default function SelfAwarenessPage() {
  const { t } = useTranslation();
  const [isRunningCycle, setIsRunningCycle] = useState(false);

  const metricsQuery = trpc.feedback.getSelfEvaluationMetrics.useQuery();
  const analysisQuery = trpc.feedback.getPerformanceAnalysis.useQuery();
  const recommendationsQuery = trpc.feedback.getImprovementRecommendations.useQuery();
  const runCycleMutation = trpc.feedback.runSelfImprovementCycle.useMutation();

  const handleRunCycle = async () => {
    try {
      setIsRunningCycle(true);
      await runCycleMutation.mutateAsync();
      toast.success(t("selfAwareness.cycleCompleted"));
      metricsQuery.refetch();
      analysisQuery.refetch();
      recommendationsQuery.refetch();
    } catch {
      toast.error(t("selfAwareness.cycleFailed"));
    } finally {
      setIsRunningCycle(false);
    }
  };

  const metrics = metricsQuery.data;
  const analysis = analysisQuery.data;
  const recommendations = recommendationsQuery.data;

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "improving":
        return "text-green-500";
      case "declining":
        return "text-red-500";
      default:
        return "text-yellow-500";
    }
  };

  const getTrendIcon = (trend: string) => {
    return trend === "improving" ? "📈" : trend === "declining" ? "📉" : "➡️";
  };

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Brain className="w-8 h-8 text-accent" />
              {t("selfAwareness.title")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("selfAwareness.subtitle")}</p>
          </div>
          <Button onClick={handleRunCycle} disabled={isRunningCycle} className="gap-2">
            {isRunningCycle && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRunningCycle ? t("selfAwareness.runningCycle") : t("selfAwareness.runCycle")}
          </Button>
        </div>

        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("selfAwareness.avgQuality")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.averageResponseQuality.toFixed(1)}/100</div>
                <p className="text-xs text-muted-foreground mt-1">{t("selfAwareness.avgQualityDesc")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("selfAwareness.consistency")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.consistencyScore}%</div>
                <p className="text-xs text-muted-foreground mt-1">{t("selfAwareness.consistencyDesc")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("selfAwareness.totalEvaluations")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalEvaluations}</div>
                <p className="text-xs text-muted-foreground mt-1">{t("selfAwareness.totalEvaluationsDesc")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("selfAwareness.trend")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getTrendColor(metrics.improvementTrend)}`}>
                  {getTrendIcon(metrics.improvementTrend)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t(`selfAwareness.trendValues.${metrics.improvementTrend}`, metrics.improvementTrend)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {analysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                {t("selfAwareness.performanceAnalysis")}
              </CardTitle>
              <CardDescription>{t("selfAwareness.performanceDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-sm mb-2">{t("selfAwareness.patterns")}</h3>
                  <div className="space-y-2">
                    {analysis.patterns.map((pattern, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Badge variant="outline" className="mt-0.5">P{idx + 1}</Badge>
                        <p className="text-sm text-foreground">{pattern}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-sm mb-2">{t("selfAwareness.strategies")}</h3>
                  <div className="space-y-2">
                    {analysis.strategies.map((strategy, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Badge variant="secondary" className="mt-0.5">S{idx + 1}</Badge>
                        <p className="text-sm text-foreground">{strategy}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {analysis.priorityAreas.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">{t("selfAwareness.priorityAreas")}</h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.priorityAreas.map((area, idx) => (
                      <Badge key={idx} variant="destructive" className="text-xs">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {recommendations && recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" />
                {t("selfAwareness.recommendations")}
              </CardTitle>
              <CardDescription>{t("selfAwareness.recommendationsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-semibold">
                      {idx + 1}
                    </div>
                    <p className="text-sm text-foreground flex-1">{rec}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {(metricsQuery.isLoading || analysisQuery.isLoading || recommendationsQuery.isLoading) && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-2" />
              <p className="text-muted-foreground">{t("selfAwareness.loading")}</p>
            </div>
          </div>
        )}

        {!metricsQuery.isLoading && metrics && metrics.totalEvaluations === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                <h3 className="font-semibold text-foreground mb-1">{t("selfAwareness.noData")}</h3>
                <p className="text-sm text-muted-foreground">{t("selfAwareness.noDataDesc")}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}