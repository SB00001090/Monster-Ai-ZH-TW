import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Lock, Shield, Phone, Wifi, Usb, Loader2 } from "lucide-react";
import type { AnonymousReport, AppManifest, SecuritySnapshot } from "@/hooks/useSecurityStatus";
import CallGuardDownload from "./CallGuardDownload";

interface Props {
  snapshot: SecuritySnapshot | null;
  manifest: AppManifest | null;
  reports: AnonymousReport[];
  threatCount: number;
  locking: boolean;
  onLock: () => void;
  onRecover: (token: string) => void;
  onBack: () => void;
}

function StatusCard({
  title,
  icon: Icon,
  status,
  statusColor,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  status: string;
  statusColor: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4 border-border/60 bg-card/70 hover:border-blue-500/30 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <span className={`text-xs font-medium ${statusColor}`}>{status}</span>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">{children}</div>
    </Card>
  );
}

export default function SecurityCenter({
  snapshot,
  manifest,
  reports,
  threatCount,
  locking,
  onLock,
  onRecover,
  onBack,
}: Props) {
  const [recoverToken, setRecoverToken] = useState("");
  const ml = snapshot?.monsterlock;
  const cg = snapshot?.crimeguard;
  const call = snapshot?.callguard;

  const formatTs = (ts: number) =>
    ts ? new Date(ts * 1000).toLocaleString("zh-HK") : "—";

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-400" />
            安全中心
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            MonsterShield · CrimeGuard · MonsterCallGuard 即時狀態
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={onBack}>
          返回聊天
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "今日威脅", value: threatCount },
          { label: "拒接來電", value: call?.rejects_today ?? 0 },
          { label: "匿名舉報", value: call?.reports_today ?? 0 },
          { label: "鎖定觸發", value: cg?.locks_triggered ?? 0 },
        ].map((s) => (
          <Card key={s.label} className="p-3 text-center border-violet-500/15 bg-muted/20">
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatusCard
          title="MonsterShield"
          icon={Shield}
          status={ml?.green_dot ? "保護中" : "待機"}
          statusColor={ml?.green_dot ? "text-emerald-400" : "text-amber-400"}
        >
          <p>強度：{ml?.strength || "—"}</p>
          <p>憑證輪替：{ml?.rapid_credential_shield?.generation ?? "—"} 代</p>
          <p>阻擋：{ml?.blocks ?? 0}</p>
        </StatusCard>

        <StatusCard
          title="CrimeGuard"
          icon={Lock}
          status={cg?.network_locked ? "已鎖定" : "監控中"}
          statusColor={cg?.network_locked ? "text-red-400" : "text-emerald-400"}
        >
          <p>規則：{cg?.rules_version || "hk-2026.06"}</p>
          <p>今日阻擋：{cg?.blocks ?? 0}</p>
          <p>模式：{cg?.lock_mode || "localhost_only"}</p>
        </StatusCard>

        <StatusCard
          title="設備聯繫監控"
          icon={Usb}
          status={cg?.device_contact_detected ? "偵測中" : "正常"}
          statusColor={cg?.device_contact_detected ? "text-amber-400" : "text-emerald-400"}
        >
          <p>類型：{cg?.device_contact_type || "無"}</p>
          <p>設備鎖定：{cg?.device_locked ? "是" : "否"}</p>
        </StatusCard>

        <StatusCard
          title="網絡鎖定"
          icon={Wifi}
          status={cg?.network_locked ? "ACTIVE" : "待命"}
          statusColor={cg?.network_locked ? "text-red-400" : "text-muted-foreground"}
        >
          <p>VPN 偵測：{cg?.vpn_detected ? cg.vpn_type || "是" : "否"}</p>
          <p>即使 VPN 亦有效（block_vpn_ports）</p>
        </StatusCard>

        <StatusCard
          title="香港收數防護"
          icon={Phone}
          status={call?.red_dot ? "警示" : "正常"}
          statusColor={call?.red_dot ? "text-amber-400" : "text-emerald-400"}
        >
          <p>威脅庫：{call?.threat_db_version || "—"}</p>
          <p>熱線：{call?.hk_hotline || "18222"}</p>
        </StatusCard>
      </div>

      <div className="flex flex-wrap gap-3 py-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="rounded-full gap-2"
              disabled={locking || cg?.network_locked}
            >
              {locking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              立即網絡鎖定
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確認立即網絡鎖定？</AlertDialogTitle>
              <AlertDialogDescription>
                將封鎖外網連線（含 VPN 端口），僅保留本機服務。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={onLock}>確認鎖定</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex gap-2 items-center flex-1 min-w-[200px]">
          <Input
            placeholder="Recovery token 解除鎖定"
            value={recoverToken}
            onChange={(e) => setRecoverToken(e.target.value)}
            className="rounded-xl text-sm"
          />
          <Button
            variant="outline"
            className="rounded-xl shrink-0"
            onClick={() => onRecover(recoverToken)}
            disabled={!recoverToken.trim()}
          >
            解除
          </Button>
        </div>
      </div>

      <Card className="p-4 border-border/60">
        <h3 className="font-semibold mb-3 text-sm">最近匿名舉報</h3>
        {reports.length === 0 ? (
          <p className="text-xs text-muted-foreground">尚無舉報記錄</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/50">
                  <th className="text-left py-2 pr-2">時間</th>
                  <th className="text-left py-2 pr-2">類別</th>
                  <th className="text-left py-2 pr-2">Hash</th>
                  <th className="text-right py-2">分數</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr key={`${r.number_hash}-${i}`} className="border-b border-border/30">
                    <td className="py-2 pr-2">{formatTs(r.ts)}</td>
                    <td className="py-2 pr-2">{r.category}</td>
                    <td className="py-2 pr-2 font-mono">{r.number_hash.slice(0, 8)}…</td>
                    <td className="py-2 text-right">{r.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Tabs defaultValue="crimeguard">
        <TabsList className="rounded-xl">
          <TabsTrigger value="monsterlock">MonsterLock</TabsTrigger>
          <TabsTrigger value="crimeguard">CrimeGuard</TabsTrigger>
          <TabsTrigger value="callguard">CallGuard</TabsTrigger>
        </TabsList>
        {(["monsterlock", "crimeguard", "callguard"] as const).map((key) => {
          const events =
            key === "monsterlock"
              ? ml?.events
              : key === "crimeguard"
                ? cg?.events
                : call?.events;
          return (
            <TabsContent key={key} value={key}>
              <ul className="text-xs space-y-1 max-h-48 overflow-y-auto">
                {(events || []).map((ev, i) => (
                  <li key={i} className="text-muted-foreground font-mono">
                    [{formatTs(ev.ts)}] {ev.message}
                  </li>
                ))}
                {(!events || events.length === 0) && (
                  <li className="text-muted-foreground">尚無事件</li>
                )}
              </ul>
            </TabsContent>
          );
        })}
      </Tabs>

      <CallGuardDownload manifest={manifest} />
    </div>
  );
}