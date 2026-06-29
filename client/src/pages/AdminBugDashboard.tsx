import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, MessageSquare } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type BugReport = {
  id: number;
  userId: number;
  title: string;
  description: string;
  severity: string;
  status: string;
  url?: string | null;
  userAgent?: string | null;
  adminNotes?: string | null;
  createdAt: Date | string;
};

export default function AdminBugDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const utils = trpc.useUtils();
  const reportsQuery = trpc.bugReports.getAllReports.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const updateStatusMutation = trpc.bugReports.updateStatus.useMutation({
    onSuccess: () => {
      utils.bugReports.getAllReports.invalidate();
      toast.success(t("admin.statusUpdated"));
    },
    onError: () => toast.error(t("admin.statusUpdateFailed")),
  });

  useEffect(() => {
    if (user && user.role !== "admin") {
      setLocation("/");
    }
  }, [user, setLocation]);

  const bugs = (reportsQuery.data ?? []) as BugReport[];

  const filteredBugs =
    filterStatus === "all" ? bugs : bugs.filter((bug) => bug.status === filterStatus);

  const stats = {
    total: bugs.length,
    open: bugs.filter((b) => b.status === "open").length,
    inProgress: bugs.filter((b) => b.status === "in_progress").length,
    resolved: bugs.filter((b) => b.status === "resolved").length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-red-500/10 text-red-700 border-red-500/30";
      case "in_progress":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/30";
      case "resolved":
        return "bg-green-500/10 text-green-700 border-green-500/30";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-500/30";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <AlertCircle className="w-4 h-4" />;
      case "in_progress":
        return <Clock className="w-4 h-4" />;
      case "resolved":
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const handleUpdateStatus = async (bugId: number, newStatus: string) => {
    await updateStatusMutation.mutateAsync({
      bugReportId: bugId,
      status: newStatus as "open" | "in_progress" | "resolved" | "closed",
    });
    if (selectedBug?.id === bugId) {
      setSelectedBug({ ...selectedBug, status: newStatus });
    }
  };

  const handleCloseReport = async (bugId: number) => {
    await handleUpdateStatus(bugId, "closed");
    setSelectedBug(null);
  };

  if (user?.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t("admin.bugDashboard")}</h1>
          <p className="text-muted-foreground">{t("admin.manageBugs")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">{t("admin.totalBugs")}</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">{t("admin.openBugs")}</div>
            <div className="text-2xl font-bold text-red-500">{stats.open}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">{t("admin.inProgress")}</div>
            <div className="text-2xl font-bold text-yellow-500">{stats.inProgress}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">{t("admin.resolved")}</div>
            <div className="text-2xl font-bold text-green-500">{stats.resolved}</div>
          </Card>
        </div>

        <div className="mb-6 flex gap-2 flex-wrap">
          {["all", "open", "in_progress", "resolved", "closed"].map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? "default" : "outline"}
              onClick={() => setFilterStatus(status)}
            >
              {t(`admin.status.${status}`)}
            </Button>
          ))}
        </div>

        {selectedBug ? (
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">{selectedBug.title}</h2>
                <Badge className={getStatusColor(selectedBug.status)}>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(selectedBug.status)}
                    <span>{t(`admin.status.${selectedBug.status}`, selectedBug.status)}</span>
                  </div>
                </Badge>
              </div>
              <Button variant="ghost" onClick={() => setSelectedBug(null)} className="text-muted-foreground">
                ✕
              </Button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <h3 className="font-semibold mb-2">{t("admin.description")}</h3>
                <p className="text-muted-foreground">{selectedBug.description}</p>
              </div>

              {selectedBug.adminNotes && (
                <div>
                  <h3 className="font-semibold mb-2">{t("admin.userFeedback")}</h3>
                  <p className="text-muted-foreground">{selectedBug.adminNotes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.reportedBy")}</p>
                  <p className="font-semibold">{t("admin.anonymous", { id: selectedBug.userId })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.reportedAt")}</p>
                  <p className="font-semibold">
                    {new Date(selectedBug.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.severity")}</p>
                  <p className="font-semibold capitalize">{selectedBug.severity}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="font-semibold mb-3">{t("admin.updateStatus")}</h3>
              <div className="flex gap-2 flex-wrap">
                {["open", "in_progress", "resolved", "closed"].map((status) => (
                  <Button
                    key={status}
                    variant={selectedBug.status === status ? "default" : "outline"}
                    disabled={updateStatusMutation.isPending}
                    onClick={() => handleUpdateStatus(selectedBug.id, status)}
                  >
                    {t(`admin.status.${status}`)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="border-t border-border mt-6 pt-6">
              <Button
                variant="outline"
                onClick={() => handleCloseReport(selectedBug.id)}
                disabled={updateStatusMutation.isPending}
                className="w-full"
              >
                {t("admin.closeReport")}
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {reportsQuery.isLoading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">{t("common.loading")}</p>
              </Card>
            ) : filteredBugs.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">{t("admin.noBugs")}</p>
              </Card>
            ) : (
              filteredBugs.map((bug) => (
                <Card
                  key={bug.id}
                  className="p-4 cursor-pointer hover:bg-accent/5 transition-colors"
                  onClick={() => setSelectedBug(bug)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-lg">{bug.title}</h3>
                        <Badge className={getStatusColor(bug.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(bug.status)}
                            <span>{t(`admin.status.${bug.status}`, bug.status)}</span>
                          </div>
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {bug.severity}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm mb-2 line-clamp-2">{bug.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{t("admin.anonymous", { id: bug.userId })}</span>
                        <span>{new Date(bug.createdAt).toLocaleDateString()}</span>
                        {bug.adminNotes && (
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>{t("admin.hasFeedback")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}