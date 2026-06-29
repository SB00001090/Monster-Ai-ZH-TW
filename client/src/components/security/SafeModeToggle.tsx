import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import type { PromptAnalysis } from "@/hooks/useSecurityStatus";

const SAFE_MODE_KEY = "monster_safe_mode";

interface Props {
  draft: string;
  onAnalyze: (message: string) => Promise<PromptAnalysis | null>;
  onTriggerProtection: () => void;
  onProceed: () => void;
  disabled?: boolean;
}

export default function SafeModeToggle({
  draft,
  onAnalyze,
  onTriggerProtection,
  onProceed,
  disabled,
}: Props) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(SAFE_MODE_KEY) === "1");
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    localStorage.setItem(SAFE_MODE_KEY, enabled ? "1" : "0");
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !draft.trim()) {
      setAnalysis(null);
      return;
    }
    const t = setTimeout(() => {
      setChecking(true);
      void onAnalyze(draft).then((r) => {
        setAnalysis(r);
        setChecking(false);
      });
    }, 400);
    return () => clearTimeout(t);
  }, [draft, enabled, onAnalyze]);

  const showBanner =
    enabled && analysis && (analysis.score >= 70 || analysis.lock_trigger);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Switch
          id="safe-mode"
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={disabled}
        />
        <Label htmlFor="safe-mode" className="text-sm text-muted-foreground cursor-pointer">
          安全模式
        </Label>
        {checking && <span className="text-xs text-muted-foreground">掃描中…</span>}
      </div>

      {showBanner && analysis && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-amber-200 font-medium">
                偵測到高風險內容（{analysis.categories[0] || "crime_intent"} · {analysis.score}）
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{analysis.summary}</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="destructive"
              className="rounded-lg"
              onClick={onTriggerProtection}
            >
              立即保護
            </Button>
            <Button size="sm" variant="outline" className="rounded-lg" onClick={onProceed}>
              仍要發送
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}