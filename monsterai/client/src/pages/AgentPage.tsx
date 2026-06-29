import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const AGENT_CAPABILITIES = [
  { id: "web_search", name: "網絡搜索", icon: "🔍", description: "搜索網絡獲取最新資訊", enabled: true },
  { id: "code_exec", name: "代碼執行", icon: "💻", description: "執行 Python/JS 代碼", enabled: true },
  { id: "api_call", name: "API 調用", icon: "🔗", description: "調用外部 API 服務", enabled: true },
  { id: "memory", name: "長期記憶", icon: "🧠", description: "記住上下文和歷史", enabled: true },
  { id: "self_heal", name: "自癒修復", icon: "🔧", description: "自動檢測和修復錯誤", enabled: true },
  { id: "image_gen", name: "圖片生成", icon: "🎨", description: "文字轉圖片", enabled: true },
  { id: "tts", name: "語音合成", icon: "🔊", description: "文字轉語音", enabled: true },
];

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
  const [goal, setGoal] = useState("");
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [capabilities, setCapabilities] = useState(AGENT_CAPABILITIES);
  const [isExecuting, setIsExecuting] = useState(false);

  const executeTaskMutation = trpc.agent.executeTask.useMutation({
    onSuccess: (data) => {
      const newTask: AgentTask = {
        id: data.taskId,
        goal: data.goal,
        status: data.status as any,
        steps: data.steps,
        result: data.result,
        createdAt: new Date(data.createdAt),
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      };

      setTasks((prev) => [newTask, ...prev]);
      setGoal("");
      setIsExecuting(false);

      if (data.status === "completed") {
        toast.success("AI Agent 任務已完成", { description: data.result });
      } else if (data.status === "failed") {
        toast.error("AI Agent 任務失敗", { description: data.result });
      }
    },
    onError: (error: any) => {
      toast.error("執行失敗", { description: error.message });
      setIsExecuting(false);
    },
  });

  const handleSubmitTask = async () => {
    if (!goal.trim()) return;

    setIsExecuting(true);
    toast.info("AI Agent 任務已提交", { description: "代理正在處理您的請求..." });

    await executeTaskMutation.mutateAsync({
      goal: goal.trim(),
      maxSteps: 5,
    });
  };

  const toggleCapability = (id: string) => {
    setCapabilities((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const enabledCapabilities = capabilities.filter((c) => c.enabled);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">AI Agent 代理</h2>
        <p className="text-muted-foreground mt-1">
          讓 AI 自主執行複雜任務。代理可以搜索、編碼、調用 API、生成內容等。
        </p>
      </div>

      {/* Task Input */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="描述您想讓 AI Agent 完成的任務..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleSubmitTask()}
              disabled={isExecuting}
            />
            <Button
              onClick={handleSubmitTask}
              disabled={!goal.trim() || isExecuting}
              className="whitespace-nowrap"
            >
              {isExecuting ? "執行中..." : "🚀 執行"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            例如：「搜索最新的 AI 新聞並總結」、「分析這段代碼的問題」、「調用天氣 API 獲取今天的天氣」
          </p>
        </CardContent>
      </Card>

      {/* Capabilities Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">代理能力</CardTitle>
          <CardDescription>
            已啟用 {enabledCapabilities.length}/{capabilities.length} 項能力
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
                    {cap.enabled ? "啟用" : "禁用"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Task History */}
      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">任務歷史</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1">
                    <span className="font-medium text-sm block">{task.goal}</span>
                    <span className="text-xs text-muted-foreground">
                      {task.steps} 步驟 • {new Date(task.createdAt).toLocaleTimeString("zh-CN")}
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
                    {task.status === "pending" && "等待中"}
                    {task.status === "executing" && "執行中..."}
                    {task.status === "completed" && "已完成"}
                    {task.status === "failed" && "失敗"}
                  </Badge>
                </div>
                <div className="mt-2 p-2 bg-muted/30 rounded text-sm text-muted-foreground">
                  <strong>結果：</strong> {task.result}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Coming Soon Features */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <h3 className="font-medium mb-2">🚧 即將推出</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>多代理協作</strong> — 多個 AI 代理同時工作，分工合作</li>
            <li>• <strong>自動化工作流</strong> — 設定觸發條件，AI 自動執行任務</li>
            <li>• <strong>插件市場</strong> — 社群共享的 Agent 插件和工具</li>
            <li>• <strong>實時學習</strong> — Agent 從每次互動中學習改進</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
