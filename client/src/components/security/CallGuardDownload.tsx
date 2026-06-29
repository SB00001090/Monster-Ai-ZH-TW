import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, ChevronDown, ChevronUp, Smartphone, Wifi } from "lucide-react";
import type { AppManifest } from "@/hooks/useSecurityStatus";

interface Props {
  manifest: AppManifest | null;
  compact?: boolean;
}

export default function CallGuardDownload({ manifest, compact = false }: Props) {
  const [expanded, setExpanded] = useState(!compact);
  const [homeUrl, setHomeUrl] = useState("");
  const [connStatus, setConnStatus] = useState<"idle" | "ok" | "fail">("idle");

  const version = manifest?.app_version || "1.0.8";
  const apkUrl = manifest?.apk_url || "/downloads/MonsterCallGuard-v1.0.8-signed.apk";
  const sha = manifest?.apk_sha256 || "";
  const shaShort = sha ? `${sha.slice(0, 16)}…` : "—";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
    `${window.location.origin}${apkUrl}`
  )}`;

  const testConnection = async () => {
    const base = homeUrl.trim().replace(/\/$/, "");
    if (!base) return;
    setConnStatus("idle");
    try {
      const res = await fetch(`${base}/api/callguard/status`);
      setConnStatus(res.ok ? "ok" : "fail");
    } catch {
      setConnStatus("fail");
    }
  };

  if (compact) {
    return (
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-border/50 bg-muted/20 text-sm"
        >
          <span className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-400" />
            CallGuard v{version}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {expanded && (
          <div className="mt-2">
            <CallGuardDownload manifest={manifest} />
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="p-5 bg-card/60 border border-violet-500/20 shadow-[0_0_20px_rgba(59,130,246,0.08)]">
      <div className="flex flex-col sm:flex-row gap-5">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-400" />
            MonsterCallGuard
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            香港來電反制 · 收數公司自動拒接 · 設備聯繫即時網絡鎖定
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            v{version} · 已簽署 APK · 側載專用
          </p>
          <p className="text-xs font-mono text-muted-foreground mt-1 break-all">
            SHA256: {shaShort}
          </p>
          {manifest?.changelog && (
            <p className="text-xs text-muted-foreground mt-2">{manifest.changelog}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            <Button asChild className="rounded-full gap-2">
              <a href={apkUrl} download>
                <Download className="w-4 h-4" />
                下載 APK
              </a>
            </Button>
          </div>

          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-blue-400 hover:underline">
              側載安裝與安全說明
            </summary>
            <ol className="mt-2 space-y-1 text-muted-foreground text-xs list-decimal list-inside">
              <li>下載 APK 後比對 SHA256 完整性</li>
              <li>設定 → 安全性 → 允許安裝未知應用程式</li>
              <li>授予電話、通話紀錄、通知權限</li>
              <li>設為預設「來電篩選」App（Android 10+）</li>
              <li>無廣告、無通話錄音；舉報僅上傳號碼 hash</li>
            </ol>
          </details>

          <details className="mt-3 text-sm" open>
            <summary className="cursor-pointer text-blue-400 hover:underline flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              連線家中 Monster AI
            </summary>
            <div className="mt-2 space-y-2 text-xs">
              <p className="text-muted-foreground">
                區域網路例：<code className="text-foreground">http://192.168.0.4:7860</code>
              </p>
              <p className="text-muted-foreground">
                Tailscale 例：<code className="text-foreground">http://100.x.x.x:7860</code>
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={homeUrl}
                  onChange={(e) => setHomeUrl(e.target.value)}
                  placeholder="http://家中IP:7860"
                  className="flex-1 rounded-lg bg-muted/40 border border-border/50 px-2 py-1.5 text-foreground"
                />
                <Button size="sm" variant="outline" onClick={() => void testConnection()}>
                  測試
                </Button>
              </div>
              {connStatus === "ok" && (
                <span className="text-emerald-400">連線成功</span>
              )}
              {connStatus === "fail" && (
                <span className="text-red-400">連線失敗 — 確認同一 Wi-Fi 或 Tailscale</span>
              )}
            </div>
          </details>
        </div>
        <div className="shrink-0 flex flex-col items-center">
          <img
            src={qrUrl}
            alt="APK QR Code"
            width={140}
            height={140}
            loading="lazy"
            className="rounded-lg border border-border/50 bg-white p-1"
          />
          <p className="text-xs text-muted-foreground mt-2 text-center">掃描下載 APK</p>
        </div>
      </div>
    </Card>
  );
}