import { useCallback, useEffect, useState } from "react";
import { NeonPanel, NeonShell } from "@/components/NeonShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useBackend } from "@/contexts/BackendContext";
import {
  type CurriculumMode,
  useGuardianCurriculum,
} from "@/hooks/useGuardianCurriculum";
import { BookOpen, GraduationCap, RefreshCw, Shield, Square } from "lucide-react";
import { toast } from "sonner";

const MODE_LABELS: Record<CurriculumMode, string> = {
  base: "GPT/AI 36h（72 主題）",
  extended: "完整 72h（AI + 語言 + 資安）",
  cybersec: "資安反制",
  languages: "全球語言",
  after_ai: "語言 + 資安（AI 後）",
};

export default function CurriculumProgressPanel() {
  const { online } = useBackend();
  const { busy, status, success, previewTopics, refresh, loadTopics, start, stop } =
    useGuardianCurriculum();
  const [mode, setMode] = useState<CurriculumMode>("extended");

  const load = useCallback(async () => {
    try {
      await refresh();
      await loadTopics(mode);
    } catch {
      toast.error("無法載入課程狀態");
    }
  }, [refresh, loadTopics, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!status?.running) return;
    const id = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(id);
  }, [status?.running, refresh]);

  const handleModeChange = async (value: CurriculumMode) => {
    setMode(value);
    try {
      await loadTopics(value);
    } catch {
      toast.error("無法載入主題預覽");
    }
  };

  const handleStart = async () => {
    try {
      const result = await start({ mode, resume: true });
      if (result.ok) {
        toast.success(`課程已啟動：${MODE_LABELS[mode]}`);
      } else {
        toast.error(String((result as { reason?: string }).reason ?? "start_failed"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "啟動失敗");
    }
  };

  const handleStop = async () => {
    try {
      await stop();
      toast.success("課程已停止");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "停止失敗");
    }
  };

  const progress = status?.progress_pct ?? 0;
  const successRate = (success?.success_rate ?? 0) * 100;
  const targetRate = (success?.target_rate ?? 0.98) * 100;

  return (
    <NeonShell
      title="72h 自主學習課程"
      subtitle="GPT/AI · 全球語言 · 資安反制 · 連接網絡學習"
      badge="Developed by Suckbob | Guardian Ai"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <NeonPanel className="space-y-3">
          <h2 className="font-semibold text-[var(--neon-cyan)] flex items-center gap-2">
            <GraduationCap className="w-4 h-4" /> 課程進度
          </h2>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status?.running ? "default" : "secondary"}>
                {status?.running ? "執行中" : "閒置"}
              </Badge>
              {status?.mode && (
                <Badge variant="outline">{MODE_LABELS[status.mode as CurriculumMode] ?? status.mode}</Badge>
              )}
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">
              {status?.completed_topics ?? 0} / {status?.total_topics ?? 0} 主題
              {status?.current_topic_id ? ` · 目前：${status.current_topic_id}` : ""}
            </p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt>預估剩餘</dt>
              <dd>{status?.eta_hours != null ? `${status.eta_hours}h` : "—"}</dd>
              <dt>訓練樣本</dt>
              <dd>{status?.pairs_on_disk ?? 0}</dd>
              <dt>延伸主題數</dt>
              <dd>{status?.extended_topic_count ?? "—"}</dd>
              <dt>資安主題數</dt>
              <dd>{status?.cybersec_topic_count ?? "—"}</dd>
            </dl>
          </div>
        </NeonPanel>

        <NeonPanel className="space-y-3">
          <h2 className="font-semibold text-[var(--neon-cyan)] flex items-center gap-2">
            <Shield className="w-4 h-4" /> 生成成功率（98% 目標）
          </h2>
          <Progress value={Math.min(100, successRate)} className="mb-3 h-2" />
          <p className="text-sm">
            <span className="font-medium">{successRate.toFixed(1)}%</span>
            <span className="text-muted-foreground"> / 目標 {targetRate.toFixed(0)}%</span>
            {success?.on_track ? (
              <Badge className="ml-2" variant="default">
                達標軌跡
              </Badge>
            ) : (
              <Badge className="ml-2" variant="secondary">
                累積中
              </Badge>
            )}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <dt>記錄次數</dt>
            <dd>{success?.total_recorded ?? 0}</dd>
            <dt>平均品質</dt>
            <dd>
              {success?.avg_quality_score != null
                ? `${(success.avg_quality_score * 100).toFixed(1)}%`
                : "—"}
            </dd>
            <dt>平均 likeness</dt>
            <dd>
              {success?.avg_likeness_similarity != null
                ? `${(success.avg_likeness_similarity * 100).toFixed(1)}%`
                : "—"}
            </dd>
          </dl>
        </NeonPanel>

        <NeonPanel className="md:col-span-2 space-y-4">
          <h2 className="font-semibold text-[var(--neon-cyan)] flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> 啟動課程
          </h2>
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label>學習模式</Label>
              <Select value={mode} onValueChange={(v) => void handleModeChange(v as CurriculumMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODE_LABELS) as CurriculumMode[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {MODE_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {previewTopics.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  預覽主題：{previewTopics.join(" · ")}
                  {previewTopics.length >= 12 ? " …" : ""}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!online || busy} onClick={() => void load()}>
                <RefreshCw className="mr-1 h-4 w-4" />
                重新整理
              </Button>
              <Button size="sm" disabled={!online || busy || status?.running} onClick={() => void handleStart()}>
                啟動
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!online || busy || !status?.running}
                onClick={() => void handleStop()}
              >
                <Square className="mr-1 h-4 w-4" />
                停止
              </Button>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            需先於「自主網絡學習」授予同意；資安模式僅涵蓋防禦性反制技術。輸出：
            data/training/curriculum/monster_ai_train.jsonl
          </p>
        </NeonPanel>
      </div>
    </NeonShell>
  );
}