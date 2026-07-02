import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  bindDiscordWebhook,
  getGuardianAccountStatus,
  getStoredGuardianAccountId,
  linkGuardianAccount,
  registerGuardianAccount,
  reportGuardianError,
  setStoredGuardianAccountId,
} from "@/lib/guardianApi";
import { resolveOAuthProvider } from "@/lib/guardianOAuth";
import { toast } from "sonner";

export default function GuardianAccountPanel() {
  const { user } = useAuth();
  const [accountId, setAccountId] = useState<string | null>(() => getStoredGuardianAccountId());
  const [webhookUrl, setWebhookUrl] = useState("");
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(async (id: string) => {
    try {
      const s = await getGuardianAccountStatus(id);
      setStatus(s);
      const wh = s.discord_webhook_bound;
      if (wh) setWebhookUrl("");
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    if (accountId) void refreshStatus(accountId);
  }, [accountId, refreshStatus]);

  const handleRegister = async () => {
    const username = user?.name?.replace(/\s+/g, "_").toLowerCase() || `user_${Date.now()}`;
    setBusy(true);
    try {
      const r = await registerGuardianAccount(username, user?.name ?? undefined);
      const id = String(r.account_id ?? "");
      setStoredGuardianAccountId(id);
      setAccountId(id);
      toast.success("Guardian 帳戶已建立");
      await refreshStatus(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "註冊失敗");
    } finally {
      setBusy(false);
    }
  };

  const handleLinkOAuth = async () => {
    if (!accountId || !user?.openId) {
      toast.error("請先建立 Guardian 帳戶並登入 OAuth");
      return;
    }
    const provider = resolveOAuthProvider(user.loginMethod);
    if (!provider) {
      toast.error("僅支援 Google / GitHub / Discord 綁定");
      return;
    }
    setBusy(true);
    try {
      await linkGuardianAccount({
        accountId,
        provider,
        providerSub: user.openId,
        displayName: user.name ?? undefined,
        email: user.email ?? undefined,
      });
      toast.success("OAuth 已綁定至 Guardian 帳戶");
      await refreshStatus(accountId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "綁定失敗");
    } finally {
      setBusy(false);
    }
  };

  const handleBindWebhook = async () => {
    if (!accountId || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
      toast.error("請輸入有效的 Discord Webhook URL");
      return;
    }
    setBusy(true);
    try {
      await bindDiscordWebhook(accountId, webhookUrl);
      toast.success("Discord Webhook 已綁定");
      setWebhookUrl("");
      await refreshStatus(accountId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "綁定失敗");
    } finally {
      setBusy(false);
    }
  };

  const handleTestReport = async () => {
    if (!accountId) {
      toast.error("請先建立 Guardian 帳戶");
      return;
    }
    setBusy(true);
    try {
      await reportGuardianError({
        errorType: "user_test",
        message: "Guardian Ai 測試錯誤回報",
        source: "settings",
        accountId,
        discordNotify: true,
      });
      toast.success("錯誤回報已送出（若已綁定 Webhook 將收到 Discord 通知）");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "回報失敗");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-medium">Guardian 帳戶 & Discord 回報</h4>
        {status?.discord_webhook_bound ? (
          <Badge variant="default">Webhook 已綁定</Badge>
        ) : (
          <Badge variant="secondary">Webhook 未綁定</Badge>
        )}
      </div>

      {!accountId ? (
        <Button disabled={busy} onClick={() => void handleRegister()}>
          建立 Guardian 帳戶
        </Button>
      ) : (
        <>
          <p className="text-xs font-mono text-muted-foreground">帳戶 ID: {accountId}</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void handleLinkOAuth()}>
            綁定目前 OAuth 登入
          </Button>
          <div className="space-y-2">
            <Label htmlFor="discord-webhook">Discord Webhook URL</Label>
            <Input
              id="discord-webhook"
              placeholder="https://discord.com/api/webhooks/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <Button size="sm" disabled={busy} onClick={() => void handleBindWebhook()}>
              儲存 Webhook
            </Button>
          </div>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void handleTestReport()}>
            一鍵測試錯誤回報（Discord）
          </Button>
        </>
      )}
    </div>
  );
}