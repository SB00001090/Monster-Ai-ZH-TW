import { Card } from "@/components/ui/card";
import { BarChart3, TrendingUp, Zap, Target } from "lucide-react";

interface ImprovementStatsProps {
  totalFeedback: number;
  averageRating: number | null;
  improvements: number;
  optimizations: number;
}

export default function ImprovementStats({
  totalFeedback,
  averageRating,
  improvements,
  optimizations,
}: ImprovementStatsProps) {
  const stats = [
    {
      icon: BarChart3,
      label: "Feedback Received",
      value: totalFeedback,
      color: "text-blue-400",
    },
    {
      icon: TrendingUp,
      label: "Average Rating",
      value: averageRating ? `${averageRating.toFixed(1)}/5` : "N/A",
      color: "text-green-400",
    },
    {
      icon: Zap,
      label: "Improvements Made",
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <Card
            key={idx}
            className="p-4 bg-card border-border hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <Icon className={`w-6 h-6 ${stat.color} opacity-70`} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
