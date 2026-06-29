import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, Trash2, MessageSquare } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

export default function AdminBugDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedBug, setSelectedBug] = useState<any | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [bugs, setBugs] = useState<any[]>([]);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      setLocation("/");
    }
  }, [user, setLocation]);

  // Initialize mock bugs
  useEffect(() => {
    const mockBugs = [
      {
        id: 1,
        title: "Chat not responding",
        description: "The chat interface sometimes stops responding after a few messages",
        status: "open",
        reportedByName: "User123",
        userFeedback: "Happens when sending long messages",
        createdAt: new Date(),
      },
      {
        id: 2,
        title: "Character template loading error",
        description: "Templates fail to load on slow connections",
        status: "in_progress",
        reportedByName: "User456",
        userFeedback: null,
        createdAt: new Date(Date.now() - 86400000),
      },
      {
        id: 3,
        title: "Image generation timeout",
        description: "Image generation sometimes times out after 30 seconds",
        status: "resolved",
        reportedByName: "User789",
        userFeedback: "Fixed in latest update",
        createdAt: new Date(Date.now() - 172800000),
      },
    ];
    setBugs(mockBugs);
  }, []);

  const filteredBugs = filterStatus === "all" 
    ? bugs 
    : bugs.filter((bug: any) => bug.status === filterStatus);

  const stats = {
    total: bugs.length,
    open: bugs.filter((b: any) => b.status === "open").length,
    inProgress: bugs.filter((b: any) => b.status === "in_progress").length,
    resolved: bugs.filter((b: any) => b.status === "resolved").length,
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

  const handleUpdateStatus = (bugId: number, newStatus: string) => {
    setBugs(bugs.map((bug: any) => 
      bug.id === bugId ? { ...bug, status: newStatus } : bug
    ));
  };

  const handleDeleteBug = (bugId: number) => {
    if (confirm(t("admin.confirmDelete", "Are you sure you want to delete this bug report?"))) {
      setBugs(bugs.filter((bug: any) => bug.id !== bugId));
      setSelectedBug(null);
    }
  };

  if (user?.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t("admin.bugDashboard", "Bug Dashboard")}</h1>
          <p className="text-muted-foreground">{t("admin.manageBugs", "Manage and track bug reports")}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">{t("admin.totalBugs", "Total Bugs")}</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">{t("admin.openBugs", "Open")}</div>
            <div className="text-2xl font-bold text-red-500">{stats.open}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">{t("admin.inProgress", "In Progress")}</div>
            <div className="text-2xl font-bold text-yellow-500">{stats.inProgress}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground mb-1">{t("admin.resolved", "Resolved")}</div>
            <div className="text-2xl font-bold text-green-500">{stats.resolved}</div>
          </Card>
        </div>

        {/* Filter */}
        <div className="mb-6 flex gap-2">
          {["all", "open", "in_progress", "resolved"].map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? "default" : "outline"}
              onClick={() => setFilterStatus(status)}
              className="capitalize"
            >
              {t(`admin.status.${status}`, status)}
            </Button>
          ))}
        </div>

        {selectedBug ? (
          // Bug Detail View
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">{selectedBug.title}</h2>
                <Badge className={`${getStatusColor(selectedBug.status)}`}>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(selectedBug.status)}
                    <span className="capitalize">{selectedBug.status}</span>
                  </div>
                </Badge>
              </div>
              <Button
                variant="ghost"
                onClick={() => setSelectedBug(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </Button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <h3 className="font-semibold mb-2">{t("admin.description", "Description")}</h3>
                <p className="text-muted-foreground">{selectedBug.description}</p>
              </div>

              {selectedBug.userFeedback && (
                <div>
                  <h3 className="font-semibold mb-2">{t("admin.userFeedback", "User Feedback")}</h3>
                  <p className="text-muted-foreground">{selectedBug.userFeedback}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.reportedBy", "Reported By")}</p>
                  <p className="font-semibold">{selectedBug.reportedByName || "Anonymous"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("admin.reportedAt", "Reported At")}</p>
                  <p className="font-semibold">{new Date(selectedBug.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Status Update */}
            <div className="border-t border-border pt-6">
              <h3 className="font-semibold mb-3">{t("admin.updateStatus", "Update Status")}</h3>
              <div className="flex gap-2">
                {["open", "in_progress", "resolved"].map((status) => (
                  <Button
                    key={status}
                    variant={selectedBug.status === status ? "default" : "outline"}
                    onClick={() => {
                      handleUpdateStatus(selectedBug.id, status);
                      setSelectedBug({ ...selectedBug, status });
                    }}
                    className="capitalize"
                  >
                    {t(`admin.status.${status}`, status)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Delete */}
            <div className="border-t border-border mt-6 pt-6">
              <Button
                variant="destructive"
                onClick={() => handleDeleteBug(selectedBug.id)}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t("admin.deleteBug", "Delete Bug Report")}
              </Button>
            </div>
          </Card>
        ) : (
          // Bug List View
          <div className="space-y-4">
            {filteredBugs.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">{t("admin.noBugs", "No bug reports found")}</p>
              </Card>
            ) : (
              filteredBugs.map((bug: any) => (
                <Card
                  key={bug.id}
                  className="p-4 cursor-pointer hover:bg-accent/5 transition-colors"
                  onClick={() => setSelectedBug(bug)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{bug.title}</h3>
                        <Badge className={`${getStatusColor(bug.status)}`}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(bug.status)}
                            <span className="capitalize">{bug.status}</span>
                          </div>
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm mb-2">{bug.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{bug.reportedByName || "Anonymous"}</span>
                        <span>{new Date(bug.createdAt).toLocaleDateString()}</span>
                        {bug.userFeedback && (
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>{t("admin.hasFeedback", "Has feedback")}</span>
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
