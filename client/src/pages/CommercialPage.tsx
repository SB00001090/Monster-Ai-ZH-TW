import { useCallback, useEffect, useState } from "react";
import { NeonPanel, NeonShell } from "@/components/NeonShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBackend } from "@/contexts/BackendContext";
import { monsterApi } from "@/lib/monsterApi";
import { CreditCard, Gift, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type PlanRow = {
  currency: string;
  lifetime: number;
  label: string;
};

type TrialStatus = {
  active?: boolean;
  mode?: string;
  trial_days?: number;
  remaining_days?: number;
};

export default function CommercialPage() {
  const { online } = useBackend();
  const [busy, setBusy] = useState(false);
  const [trial, setTrial] = useState<TrialStatus | null>(null);
  const [plans, setPlans] = useState<Record<string, PlanRow>>({});
  const [developer, setDeveloper] = useState("Developed by Suckbob | Guardian Ai");

  const load = useCallback(async () => {
    if (!online) return;
    setBusy(true);
    try {
      const [t, all] = await Promise.all([
        monsterApi.commercialTrial(),
        monsterApi.commercialPricingAll(),
      ]);
      setTrial(t as TrialStatus);
      setPlans((all.plans as Record<string, PlanRow>) ?? {});
      if (typeof all.developer === "string") setDeveloper(all.developer);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "載入定價失敗");
    } finally {
      setBusy(false);
    }
  }, [online]);

  useEffect(() => {
    void load();
  }, [load]);

  const startTrial = async () => {
    setBusy(true);
    try {
      const r = await monsterApi.commercialTrialStart();
      setTrial(r as TrialStatus);
      toast.success("7 日免費試用已啟動");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "啟動失敗");
    } finally {
      setBusy(false);
    }
  };

  const modeLabel = () => {
    if (!trial) return "載入中…";
    if (trial.mode === "lifetime") return "已永久解鎖";
    if (trial.mode === "not_started") return "尚未開始試用";
    if (trial.mode === "trial") return `試用中 · 剩餘 ${trial.remaining_days ?? 0} 天`;
    return trial.mode ?? "未知";
  };

  return (
    <NeonShell
      title="Guardian Ai 授權"
      subtitle="7 日免費試用 · 一次性付費 · 區域定價 · 數碼產品恕不退款"
      badge={developer}
    >
      <NeonPanel className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Gift className="w-8 h-8 text-[var(--neon-cyan)]" />
          <div>
            <p className="font-semibold">試用狀態</p>
            <p className="text-sm text-[var(--neon-muted)]">{modeLabel()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void load()}>
            <RefreshCw className={`w-4 h-4 mr-1 ${busy ? "animate-spin" : ""}`} />
            重新整理
          </Button>
          {trial?.mode === "not_started" ? (
            <Button size="sm" disabled={busy || !online} onClick={() => void startTrial()}>
              開始 7 日試用
            </Button>
          ) : null}
        </div>
        <Badge variant={online ? "default" : "destructive"}>{online ? "API 就緒" : "離線"}</Badge>
      </NeonPanel>

      <NeonPanel>
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-5 h-5 text-[var(--neon-cyan)]" />
          <h3 className="font-semibold">區域一次性定價（終身授權）</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(plans).map(([region, plan]) => (
            <div
              key={region}
              className="rounded-lg border border-[var(--neon-border)] p-4 space-y-1"
            >
              <p className="text-xs text-[var(--neon-muted)]">{region}</p>
              <p className="font-bold text-lg text-[var(--neon-cyan)]">
                {plan.currency} {plan.lifetime}
              </p>
              <p className="text-sm">{plan.label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--neon-muted)] mt-4 leading-relaxed">
          本應用程式為數碼產品，一經啟用或付費解鎖，即視為完成交易，無論任何原因均不接受退款。
          生產環境請透過 Stripe / PayPal webhook 驗證後呼叫 /api/commercial/unlock。
        </p>
      </NeonPanel>
    </NeonShell>
  );
}