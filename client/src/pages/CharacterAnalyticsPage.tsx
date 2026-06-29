import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { Star, MessageCircle, Clock, TrendingUp, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function CharacterAnalyticsPage() {
  const { t } = useTranslation();
  const getAnalytics = trpc.characters.getMyAnalytics.useQuery();
  const analytics = getAnalytics.data ?? [];

  if (getAnalytics.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (getAnalytics.isError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-destructive">{t("analytics.loadError")}</p>
      </div>
    );
  }

  const totalConversations = analytics.reduce((sum, a) => sum + a.conversationCount, 0);
  const totalMessages = analytics.reduce((sum, a) => sum + a.messageCount, 0);
  const averageRating =
    analytics.length > 0
      ? Math.round(
          analytics.reduce((sum, a) => sum + a.averageRating, 0) / analytics.length
        )
      : 0;

  const chartData = analytics.map((a) => ({
    name: a.characterName,
    conversations: a.conversationCount,
    messages: a.messageCount,
    rating: a.averageRating,
  }));

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t("analytics.analytics")}</h1>
          <p className="text-muted-foreground">{t("analytics.analyticsDescription")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t("analytics.totalConversations")}
                </p>
                <p className="text-3xl font-bold">{totalConversations}</p>
              </div>
              <MessageCircle className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t("analytics.totalMessages")}
                </p>
                <p className="text-3xl font-bold">{totalMessages}</p>
              </div>
              <Clock className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t("analytics.averageRating")}
                </p>
                <p className="text-3xl font-bold">{averageRating}/100</p>
              </div>
              <Star className="w-8 h-8 text-yellow-500 opacity-50" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t("analytics.activeCharacters")}
                </p>
                <p className="text-3xl font-bold">{analytics.length}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
          </Card>
        </div>

        {chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-4">
                {t("analytics.conversationsAndMessages")}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="conversations" fill="#3b82f6" name={t("analytics.conversations")} />
                  <Bar dataKey="messages" fill="#10b981" name={t("analytics.messages")} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-bold mb-4">{t("analytics.characterRatings")}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name={t("analytics.rating")}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {analytics.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">{t("analytics.noAnalyticsData")}</p>
          </Card>
        )}
      </div>
    </div>
  );
}