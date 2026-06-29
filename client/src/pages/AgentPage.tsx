import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const CAPABILITY_IDS = [
  "web_search",
  "code_exec",
  "api_call",
  "memory",
  "self_heal",
  "image_gen",
  "tts",
] as const;

const CAPABILITY_ICONS: Record<(typeof CAPABILITY_IDS)[number], string> = {
  web_search: "🔍",
  code_exec: "💻",
  api_call: "🔗",
  memory: "🧠",
  self_heal: "🔧",
  image_gen: "🎨",
  tts: "🔊",
};

interface AgentTask {
  id: string;
  goal: string;
  status: "pending" | "executing" | "completed" | "failed";
  steps: number;
  result: string;
  createdAt: Date;
  completedAt?: Date;
}

export default function AgentPage() {
  const { t, i18n } = useTranslation();
  const [goal, setGoal] = useState("");
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [enabledCaps, setEnabledCaps] = useState<Record<string, boolean>>(
    Object.fromEntries(CAPABILITY_IDS.map((id) => [id, true]))
  );
  const [isExecuting, setIsExecuting] = useState(false);

  const capabilities = useMemo(
    () =>
      CAPABILITY_IDS.map((id) => ({
        id,
        icon: CAPABILITY_ICONS[id],
        name: t(`agent.capabilitiesList.${id}.name`),
        description: t(`agent.capabilitiesList.${id}.description`),
        enabled: enabledCaps[id] ?? true,
      })),
    [t, enabledCaps]
  );

  const executeTaskMutation = trpc.agent.executeTask.useMutation({
    onSuccess: (data) => {
      const newTask: AgentTask = {
        id: data.taskId,
        goal: data.goal,
        status: data.status as AgentTask["status"],
        steps: data.steps,
        result: data.result,
        createdAt: new Date(data.createdAt),
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      };

      setTasks((prev) => [newTask, ...prev]);
      setGoal("");
      setIsExecuting(false);

      if (data.status === "completed") {
        toast.success(t("agent.taskCompleted"), { description: data.result });
      } else if (data.status === "failed") {
        toast.error(t("agent.taskFailed"), { description: data.result });
      }
    },
    onError: (error: { message?: string }) => {
      toast.error(t("agent.submitFailed"), { description: error.message });
      setIsExecuting(false);
    },
  });

  const handleSubmitTask = async () => {
    if (!goal.trim()) return;

    setIsExecuting(true);
    toast.info(t("agent.taskSubmitted"), { description: t("agent.taskProcessing") });

    await executeTaskMutation.mutateAsync({
      goal: goal.trim(),
      maxSteps: 5,
    });
  };

  const toggleCapability = (id: string) => {
    setEnabledCaps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const enabledCount = capabilities.filter((c) => c.enabled).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("agent.title")}</h2>
        <p className="text-muted-foreground mt-1">{t("agent.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={t("agent.placeholder")}
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleSubmitTask()}
              disabled={isExecuting}
            />
            <Button
              onClick={handleSubmitTask}
              disabled={!goal.trim() || isExecuting}
              className="whitespace-nowrap"
            >
              {isExecuting ? t("agent.executing") : `🚀 ${t("agent.execute")}`}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t("agent.hint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("agent.capabilities")}</CardTitle>
          <CardDescription>
            {t("agent.capabilitiesCount", {
              enabled: enabledCount,
              total: capabilities.length,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {capabilities.map((cap) => (
              <div
                key={cap.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  cap.enabled
                    ? "border-primary/50 bg-primary/5"
                    : "border-muted opacity-50"
                }`}
                onClick={() => toggleCapability(cap.id)}
              >
                <div className="text-center">
                  <div className="text-xl mb-1">{cap.icon}</div>
                  <div className="text-xs font-medium">{cap.name}</div>
                  <Badge
                    variant={cap.enabled ? "default" : "secondary"}
                    className="mt-1 text-[10px]"
                  >
                    {cap.enabled ? t("agent.enabled") : t("agent.disabled")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("agent.history")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <span className="font-medium text-sm block">{task.goal}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("agent.steps", { count: task.steps })} •{" "}
                      {new Date(task.createdAt).toLocaleTimeString(i18n.language)}
                    </span>
                  </div>
                  <Badge
                    variant={
                      task.status === "completed"
                        ? "default"
                        : task.status === "executing"
                          ? "secondary"
                          : task.status === "failed"
                            ? "destructive"
                            : "outline"
                    }
                  >
                    {t(`agent.status.${task.status}`)}
                  </Badge>
                </div>
                <div className="mt-2 p-2 bg-muted/30 rounded text-sm text-muted-foreground">
                  <strong>{t("agent.result")}</strong> {task.result}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <h3 className="font-medium mb-2">🚧 {t("agent.comingSoon")}</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• {t("agent.comingSoonList.multiAgent")}</li>
            <li>• {t("agent.comingSoonList.workflow")}</li>
            <li>• {t("agent.comingSoonList.marketplace")}</li>
            <li>• {t("agent.comingSoonList.learning")}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}