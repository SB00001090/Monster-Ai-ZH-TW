import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2, TrendingUp, Brain, Zap, Target } from "lucide-react";
import { toast } from "sonner";

export default function SelfAwarenessPage() {
  const { user } = useAuth();
  const [isRunningCycle, setIsRunningCycle] = useState(false);

  // Fetch self-awareness data
  const metricsQuery = trpc.feedback.getSelfEvaluationMetrics.useQuery();
  const analysisQuery = trpc.feedback.getPerformanceAnalysis.useQuery();
  const recommendationsQuery = trpc.feedback.getImprovementRecommendations.useQuery();
  const runCycleMutation = trpc.feedback.runSelfImprovementCycle.useMutation();

  const handleRunCycle = async () => {
    try {
      setIsRunningCycle(true);
      const result = await runCycleMutation.mutateAsync();
      toast.success("Self-improvement cycle completed!");
      // Refetch data
      metricsQuery.refetch();
      analysisQuery.refetch();
      recommendationsQuery.refetch();
    } catch (error) {
      toast.error("Failed to run self-improvement cycle");
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Brain className="w-8 h-8 text-accent" />
              AI Self-Awareness Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Monitor and improve AI performance through self-reflection</p>
          </div>
          <Button
            onClick={handleRunCycle}
            disabled={isRunningCycle}
            className="gap-2"
          >
            {isRunningCycle && <Loader2 className="w-4 h-4 animate-spin" />}
            {isRunningCycle ? "Running Cycle..." : "Run Self-Improvement Cycle"}
          </Button>
        </div>

        {/* Metrics Overview */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Average Quality</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.averageResponseQuality.toFixed(1)}/100</div>
                <p className="text-xs text-muted-foreground mt-1">Response quality score</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Consistency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.consistencyScore}%</div>
                <p className="text-xs text-muted-foreground mt-1">Response consistency</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Evaluations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalEvaluations}</div>
                <p className="text-xs text-muted-foreground mt-1">Feedback entries analyzed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getTrendColor(metrics.improvementTrend)}`}>
                  {getTrendIcon(metrics.improvementTrend)}
                </div>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{metrics.improvementTrend}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Performance Analysis */}
        {analysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                Performance Analysis
              </CardTitle>
              <CardDescription>Identified patterns and strategies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-sm mb-2">Identified Patterns</h3>
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
                  <h3 className="font-semibold text-sm mb-2">Improvement Strategies</h3>
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
                  <h3 className="font-semibold text-sm mb-2">Priority Improvement Areas</h3>
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

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" />
                Improvement Recommendations
              </CardTitle>
              <CardDescription>Actionable steps to enhance AI performance</CardDescription>
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

        {/* Loading States */}
        {(metricsQuery.isLoading || analysisQuery.isLoading || recommendationsQuery.isLoading) && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-2" />
              <p className="text-muted-foreground">Loading self-awareness data...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!metricsQuery.isLoading && metrics && metrics.totalEvaluations === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                <h3 className="font-semibold text-foreground mb-1">No Data Yet</h3>
                <p className="text-sm text-muted-foreground">
                  Start conversations and provide feedback to enable self-awareness analysis.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
