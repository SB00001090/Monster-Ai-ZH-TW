import { useCallback, useEffect, useState } from "react";
import { NeonPanel, NeonShell } from "@/components/NeonShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBackend } from "@/contexts/BackendContext";
import {
  appendDiary,
  createCharacterShare,
  getManuscriptDiff,
  getManuscriptVersions,
  importCharacterShare,
  listDiaryDates,
  readDiary,
  restoreManuscriptVersion,
  summarizeDiary,
  GUARDIAN_DIARY_VAULT_KEY,
} from "@/lib/guardianApi";
import { BookMarked, FileText, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";

type VersionRow = { version: number; saved_at?: string; label?: string };

export default function GuardianCharacterHubPage() {
  const { online } = useBackend();
  const [characterId, setCharacterId] = useState("luna-1");
  const [vaultKey, setVaultKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(GUARDIAN_DIARY_VAULT_KEY) || "";
  });
  const [busy, setBusy] = useState(false);

  // Diary
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [diaryContent, setDiaryContent] = useState("");
  const [diarySummary, setDiarySummary] = useState("");
  const [sessionId, setSessionId] = useState(`sess-${Date.now()}`);
  const [appendText, setAppendText] = useState("");

  // Manuscript
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [diffV1, setDiffV1] = useState("1");
  const [diffV2, setDiffV2] = useState("2");
  const [diffResult, setDiffResult] = useState("");

  // Share
  const [shareCardJson, setShareCardJson] = useState(
    JSON.stringify({ id: "luna-1", name: "Luna", description: "moon pilot" }, null, 2),
  );
  const [sharePassphrase, setSharePassphrase] = useState("");
  const [shareToken, setShareToken] = useState("");
  const [importToken, setImportToken] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [importedCard, setImportedCard] = useState("");

  const persistVaultKey = useCallback((key: string) => {
    setVaultKey(key);
    if (key.length >= 8) {
      localStorage.setItem(GUARDIAN_DIARY_VAULT_KEY, key);
    }
  }, []);

  const loadDiary = useCallback(async () => {
    if (!characterId) return;
    const r = await listDiaryDates(characterId);
    const d = r.dates ?? [];
    setDates(d);
    if (d.length && !selectedDate) setSelectedDate(d[d.length - 1]);
  }, [characterId, selectedDate]);

  const loadManuscript = useCallback(async () => {
    if (!characterId) return;
    const r = await getManuscriptVersions(characterId);
    const v = (r.versions as VersionRow[]) ?? [];
    setVersions(v);
    if (v.length >= 2) {
      setDiffV1(String(v[v.length - 2].version));
      setDiffV2(String(v[v.length - 1].version));
    }
  }, [characterId]);

  const refreshAll = useCallback(async () => {
    if (!online) {
      toast.error("Guardian 後端離線");
      return;
    }
    setBusy(true);
    try {
      await Promise.all([loadDiary(), loadManuscript()]);
      toast.success("已重新載入");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setBusy(false);
    }
  }, [online, loadDiary, loadManuscript]);

  useEffect(() => {
    void refreshAll();
  }, [characterId]);

  useEffect(() => {
    if (!selectedDate || vaultKey.length < 8 || !characterId) return;
    void readDiary(characterId, selectedDate, vaultKey)
      .then((r) => setDiaryContent(JSON.stringify(r, null, 2)))
      .catch(() => setDiaryContent(""));
  }, [selectedDate, vaultKey, characterId]);

  const handleAppendDiary = async () => {
    if (vaultKey.length < 8) {
      toast.error("日記金鑰至少 8 字元");
      return;
    }
    if (!appendText.trim()) return;
    setBusy(true);
    try {
      await appendDiary(characterId, {
        sessionId,
        vaultKey,
        messages: [{ role: "user", content: appendText.trim() }],
        mood: "neutral",
      });
      setAppendText("");
      setSessionId(`sess-${Date.now()}`);
      await loadDiary();
      toast.success("已寫入對話日記");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "寫入失敗");
    } finally {
      setBusy(false);
    }
  };

  const handleDiarySummary = async () => {
    if (!selectedDate || vaultKey.length < 8) return;
    setBusy(true);
    try {
      const r = await summarizeDiary(characterId, selectedDate, vaultKey);
      setDiarySummary(String(r.summary ?? ""));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "摘要失敗");
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (version: number) => {
    setBusy(true);
    try {
      await restoreManuscriptVersion(characterId, version);
      await loadManuscript();
      toast.success(`已還原至版本 ${version}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "還原失敗");
    } finally {
      setBusy(false);
    }
  };

  const handleDiff = async () => {
    setBusy(true);
    try {
      const r = await getManuscriptDiff(characterId, Number(diffV1), Number(diffV2));
      setDiffResult(JSON.stringify(r, null, 2));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "比對失敗");
    } finally {
      setBusy(false);
    }
  };

  const handleShareCreate = async () => {
    if (sharePassphrase.length < 8) {
      toast.error("分享密語至少 8 字元");
      return;
    }
    setBusy(true);
    try {
      const card = JSON.parse(shareCardJson) as Record<string, unknown>;
      const r = await createCharacterShare({
        ocId: characterId,
        card,
        ownerId: "local",
        mode: "link",
        ttlHours: 72,
        passphrase: sharePassphrase,
      });
      const token = String(r.share_token ?? "");
      setShareToken(token);
      toast.success("分享連結已建立");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "建立分享失敗");
    } finally {
      setBusy(false);
    }
  };

  const handleShareImport = async () => {
    if (importToken.length < 16 || importPassphrase.length < 8) {
      toast.error("請輸入有效 token 與密語");
      return;
    }
    setBusy(true);
    try {
      const r = await importCharacterShare(importToken, importPassphrase);
      setImportedCard(JSON.stringify(r.card ?? r, null, 2));
      toast.success("角色已匯入");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "匯入失敗");
    } finally {
      setBusy(false);
    }
  };

  return (
    <NeonShell
      title="角色生命週期"
      subtitle="對話日記 · 文稿回溯 · 加密分享 — OC 原創保護"
      badge="Developed by Suckbob | Guardian Ai"
    >
      <NeonPanel className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1 flex-1 min-w-[160px]">
          <Label>角色 / OC ID</Label>
          <Input value={characterId} onChange={(e) => setCharacterId(e.target.value)} />
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label>日記金鑰（≥8 字元，本機儲存）</Label>
          <Input
            type="password"
            value={vaultKey}
            onChange={(e) => persistVaultKey(e.target.value)}
            placeholder="diary-secret-12"
          />
        </div>
        <Button variant="outline" disabled={busy} onClick={() => void refreshAll()}>
          <RefreshCw className={`w-4 h-4 mr-2 ${busy ? "animate-spin" : ""}`} />
          重新載入
        </Button>
        <Badge variant={online ? "default" : "destructive"}>
          {online ? "Guardian 就緒" : "離線"}
        </Badge>
      </NeonPanel>

      <Tabs defaultValue="diary" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="diary" className="gap-2">
            <BookMarked className="w-4 h-4" /> 日記
          </TabsTrigger>
          <TabsTrigger value="manuscript" className="gap-2">
            <FileText className="w-4 h-4" /> 文稿
          </TabsTrigger>
          <TabsTrigger value="share" className="gap-2">
            <Share2 className="w-4 h-4" /> 分享
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diary">
          <NeonPanel className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {dates.length === 0 ? (
                <p className="text-sm text-[var(--neon-muted)]">尚無日記紀錄</p>
              ) : (
                dates.map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant={selectedDate === d ? "default" : "outline"}
                    onClick={() => setSelectedDate(d)}
                  >
                    {d}
                  </Button>
                ))
              )}
            </div>
            <Textarea
              placeholder="新增今日對話片段…"
              value={appendText}
              onChange={(e) => setAppendText(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => void handleAppendDiary()}>
                寫入日記
              </Button>
              <Button variant="outline" disabled={busy || !selectedDate} onClick={() => void handleDiarySummary()}>
                產生摘要
              </Button>
            </div>
            {diarySummary ? (
              <p className="text-sm whitespace-pre-wrap border rounded-lg p-3 bg-black/20">{diarySummary}</p>
            ) : null}
            {diaryContent ? (
              <pre className="text-xs overflow-auto max-h-48 p-3 rounded-lg bg-black/30">{diaryContent}</pre>
            ) : null}
          </NeonPanel>
        </TabsContent>

        <TabsContent value="manuscript">
          <NeonPanel className="space-y-4">
            {versions.length === 0 ? (
              <p className="text-sm text-[var(--neon-muted)]">
                尚無文稿版本。請先對角色執行 OC 保護（/api/guardian/oc/protect）。
              </p>
            ) : (
              <ul className="space-y-2">
                {versions.map((v) => (
                  <li key={v.version} className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2">
                    <span>
                      v{v.version}
                      {v.saved_at ? ` · ${v.saved_at}` : ""}
                    </span>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleRestore(v.version)}>
                      還原
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <Label>版本 A</Label>
                <Input className="w-20" value={diffV1} onChange={(e) => setDiffV1(e.target.value)} />
              </div>
              <div>
                <Label>版本 B</Label>
                <Input className="w-20" value={diffV2} onChange={(e) => setDiffV2(e.target.value)} />
              </div>
              <Button variant="outline" disabled={busy} onClick={() => void handleDiff()}>
                比對差異
              </Button>
            </div>
            {diffResult ? (
              <pre className="text-xs overflow-auto max-h-40 p-3 rounded-lg bg-black/30">{diffResult}</pre>
            ) : null}
          </NeonPanel>
        </TabsContent>

        <TabsContent value="share">
          <div className="grid lg:grid-cols-2 gap-4">
            <NeonPanel className="space-y-3">
              <h3 className="font-semibold text-[var(--neon-cyan)]">建立分享</h3>
              <Textarea
                rows={6}
                value={shareCardJson}
                onChange={(e) => setShareCardJson(e.target.value)}
              />
              <Input
                type="password"
                placeholder="分享密語（≥8 字元）"
                value={sharePassphrase}
                onChange={(e) => setSharePassphrase(e.target.value)}
              />
              <Button disabled={busy} onClick={() => void handleShareCreate()}>
                建立加密分享
              </Button>
              {shareToken ? (
                <p className="text-xs break-all font-mono p-2 bg-black/30 rounded">
                  Token: {shareToken}
                </p>
              ) : null}
            </NeonPanel>
            <NeonPanel className="space-y-3">
              <h3 className="font-semibold text-[var(--neon-cyan)]">匯入角色</h3>
              <Input
                placeholder="分享 token"
                value={importToken}
                onChange={(e) => setImportToken(e.target.value)}
              />
              <Input
                type="password"
                placeholder="分享密語"
                value={importPassphrase}
                onChange={(e) => setImportPassphrase(e.target.value)}
              />
              <Button variant="outline" disabled={busy} onClick={() => void handleShareImport()}>
                匯入
              </Button>
              {importedCard ? (
                <pre className="text-xs overflow-auto max-h-48 p-3 rounded-lg bg-black/30">{importedCard}</pre>
              ) : null}
            </NeonPanel>
          </div>
        </TabsContent>
      </Tabs>
    </NeonShell>
  );
}