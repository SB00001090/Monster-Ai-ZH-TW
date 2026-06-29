import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useGuest } from "@/contexts/GuestContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Save,
  RotateCcw,
  Upload,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLocation } from "wouter";
import CharacterAvatar from "@/components/CharacterAvatar";
import { toast } from "sonner";
import { useTranslation } from 'react-i18next';
import CharacterPreview from "@/components/CharacterPreview";
import AvatarUpload from "@/components/AvatarUpload";
import CharacterPreviewModal from "@/components/CharacterPreviewModal";

interface CharacterFormData {
  name: string;
  description: string;
  worldview: string;
  openingLine: string;
  isPublic: number;
  avatarUrl?: string;
  avatarKey?: string;
}

function parseCharacterCard(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.data) {
    if (typeof obj.data === "string") {
      try {
        return JSON.parse(obj.data) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    if (typeof obj.data === "object" && obj.data !== null) {
      return obj.data as Record<string, unknown>;
    }
  }
  return obj;
}

export default function CharacterManagementPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const [, navigate] = useLocation();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CharacterFormData>({
    name: "",
    description: "",
    worldview: "",
    openingLine: "",
    isPublic: 0,
  });
  const [hasDraft, setHasDraft] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [deletedDraft, setDeletedDraft] = useState<CharacterFormData | null>(null);
  const [showUndoPrompt, setShowUndoPrompt] = useState(false);
  const [previewCharacter, setPreviewCharacter] = useState<any | null>(null);

  const charactersQuery = trpc.characters.getMyCharacters.useQuery();
  const createMutation = trpc.characters.create.useMutation();
  const updateMutation = trpc.characters.update.useMutation();
  const deleteMutation = trpc.characters.delete.useMutation();
  const importMutation = trpc.characters.importCard.useMutation();
  const importFromPythonMutation = trpc.characters.importFromPython.useMutation();
  const generatePortraitMutation = trpc.characters.generatePortrait.useMutation();
  const [generatingPortraitId, setGeneratingPortraitId] = useState<number | null>(null);

  const DRAFT_KEY = 'character_draft';
  const DELETED_DRAFT_KEY = 'character_deleted_draft';

  // Check for draft on mount
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    setHasDraft(!!draft);
  }, []);

  useEffect(() => {
    if (!isDialogOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isDialogOpen]);

  // Auto-hide undo prompt after 5 seconds
  useEffect(() => {
    if (showUndoPrompt) {
      const timer = setTimeout(() => {
        setShowUndoPrompt(false);
        setDeletedDraft(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showUndoPrompt]);

  const saveDraft = () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    toast.success(t('character.draftSaved') || '草稿已保存');
  };

  const loadDraft = () => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      setFormData(JSON.parse(draft));
      setShowDraftPrompt(false);
      toast.success(t('character.draftLoaded') || '草稿已加載');
    }
  };

  const clearDraft = () => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      setDeletedDraft(JSON.parse(draft));
      setShowUndoPrompt(true);
    }
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
    toast.success(t('character.draftCleared') || '草稿已清除');
  };

  const undoDraftDeletion = () => {
    if (deletedDraft) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(deletedDraft));
      setHasDraft(true);
      setShowUndoPrompt(false);
      setDeletedDraft(null);
      toast.success(t('character.draftRestored') || '草稿已復原');
    }
  };

  const handleOpenDialog = (character?: any) => {
    if (character) {
      setEditingId(character.id);
      setFormData({
        name: character.name,
        description: character.description,
        worldview: character.worldview,
        openingLine: character.openingLine,
        isPublic: character.isPublic,
        avatarUrl: character.avatarUrl ?? undefined,
        avatarKey: character.avatarKey ?? undefined,
      });
      setShowDraftPrompt(false);
    } else {
      setEditingId(null);
      // Check if there's a draft when creating new character
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        setShowDraftPrompt(true);
        setFormData({
          name: "",
          description: "",
          worldview: "",
          openingLine: "",
          isPublic: 0,
        });
      } else {
        setFormData({
          name: "",
          description: "",
          worldview: "",
          openingLine: "",
          isPublic: 0,
        });
      }
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setShowDraftPrompt(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all required fields
    const errors: string[] = [];
    if (!formData.name?.trim()) errors.push(t('character.characterName') || '角色名稱');
    if (!formData.description?.trim()) errors.push(t('character.description') || '角色描述');
    if (!formData.worldview?.trim()) errors.push(t('character.worldview') || '世界觀');
    if (!formData.openingLine?.trim()) errors.push(t('character.openingLine') || '開場白');

    if (errors.length > 0) {
      toast.error(`請填寫以下必填字段：${errors.join('、')}`);
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          ...formData,
        });
        toast.success(t('character.updateSuccess'));
      } else {
        await createMutation.mutateAsync(formData);
        toast.success(t('character.createSuccess'));
        // Clear draft after successful creation
        clearDraft();
      }
      handleCloseDialog();
      charactersQuery.refetch();
    } catch (error) {
      toast.error(editingId ? t('character.updateError') : t('character.createError'));
    }
  };

  const handleImportCard = async (file: File) => {
    try {
      const isPng = file.name.toLowerCase().endsWith(".png");

      if (isPng) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/roleplay/characters/upload", {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error("PNG upload failed");
        const uploaded = (await res.json()) as { id: string };
        await importFromPythonMutation.mutateAsync({ pythonId: uploaded.id });
      } else {
        const text = await file.text();
        const raw = JSON.parse(text) as unknown;
        const card = parseCharacterCard(raw);
        if (!card || (!card.name && !card.char_name)) {
          toast.error(t("character.importInvalid"));
          return;
        }
        await importMutation.mutateAsync({ card });
      }

      toast.success(t("character.importSuccess"));
      charactersQuery.refetch();
    } catch {
      toast.error(t("character.importError"));
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const handleGeneratePortrait = async (characterId: number) => {
    setGeneratingPortraitId(characterId);
    try {
      const result = await generatePortraitMutation.mutateAsync({ characterId });
      toast.success(t("character.portraitSuccess"));
      if (result.warning) {
        toast.warning(result.warning);
      }
      charactersQuery.refetch();
    } catch {
      toast.error(t("character.portraitError"));
    } finally {
      setGeneratingPortraitId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('character.deleteConfirm'))) return;

    try {
      await deleteMutation.mutateAsync({ id });
      toast.success(t('character.deleteSuccess'));
      charactersQuery.refetch();
    } catch (error) {
      toast.error(t('character.deleteError'));
    }
  };

  const characters = charactersQuery.data || [];

  return (
    <div className="flex-1 overflow-auto bg-[#0a0a0f] text-foreground min-h-full">
      <div className="p-5 sm:p-8 space-y-8 max-w-[1600px] mx-auto text-base">
        {showUndoPrompt && deletedDraft && (
          <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-violet-500/30 bg-[#16161f]/95 backdrop-blur-sm p-4 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{t("character.draftDeleted")}</p>
                <p className="text-sm text-muted-foreground mt-1">{t("character.undoPrompt")}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => {
                    setShowUndoPrompt(false);
                    setDeletedDraft(null);
                  }}
                >
                  {t("common.dismiss")}
                </Button>
                <Button size="sm" onClick={undoDraftDeletion} className="rounded-lg gap-1">
                  <RotateCcw className="w-4 h-4" />
                  {t("common.undo")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {isGuest && !user && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-muted-foreground">
            {t("character.guestHint")}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full shrink-0 mt-1"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
                <Users className="w-9 h-9 text-blue-400" />
                {t("character.management")}
              </h1>
              <p className="text-muted-foreground mt-2 text-base">{t("character.managementDesc")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,.png,application/json,image/png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportCard(file);
              }}
            />
            <Button
              size="lg"
              variant="outline"
              className="gap-2 rounded-xl border-border/60 text-base h-11"
              disabled={importMutation.isPending || importFromPythonMutation.isPending}
              onClick={() => importInputRef.current?.click()}
            >
              {importMutation.isPending || importFromPythonMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {t("character.importCard")}
            </Button>
            {hasDraft && (
              <Button
                variant="outline"
                onClick={clearDraft}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {t('character.clearDraft') || '清除草稿'}
              </Button>
            )}
            <Button
              size="lg"
              onClick={() => handleOpenDialog()}
              className="gap-2 rounded-xl text-base h-11"
            >
              <Plus className="w-5 h-5" />
              {t("character.createNew")}
            </Button>
          </div>
        </div>

        {/* Characters Grid */}
        {characters.length === 0 ? (
          <Card className="border-violet-500/15 bg-[#16161f]/60 neon-glow">
            <CardContent className="pt-16 pb-16 text-center">
              <Users className="w-12 h-12 text-blue-400/60 mx-auto mb-4" />
              <p className="text-muted-foreground mb-6">{t("character.noCharacters")}</p>
              <Button onClick={() => handleOpenDialog()} className="gap-2 rounded-xl">
                <Plus className="w-4 h-4" />
                {t("character.createFirst")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {characters.map((character: any) => (
              <Card
                key={character.id}
                className="flex flex-col border-border/50 bg-[#16161f]/70 hover:border-blue-500/35 transition-colors group p-1"
              >
                <CardHeader className="pb-4 px-5 pt-5">
                  <div className="flex items-start gap-4">
                    <CharacterAvatar
                      name={character.name}
                      avatarUrl={character.avatarUrl}
                      size="lg"
                      className="ring-2 ring-violet-500/20 !w-16 !h-16 !text-xl"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-1 text-xl">{character.name}</CardTitle>
                        {character.isPublic === 1 && (
                          <Badge
                            variant="secondary"
                            className="shrink-0 bg-blue-500/10 text-blue-300 border-blue-500/20 text-sm px-2 py-1"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            {t("character.public")}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="line-clamp-2 mt-2 text-sm leading-relaxed">
                        {character.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between pt-0 px-5 pb-5">
                  <p className="text-sm text-muted-foreground mb-5 line-clamp-3 italic border-l-2 border-violet-500/30 pl-3 leading-relaxed">
                    {character.openingLine}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setPreviewCharacter(character)}
                      className="gap-2 rounded-xl border-border/60 h-11 text-base"
                    >
                      <Eye className="w-4 h-4" />
                      {t("community.preview")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleGeneratePortrait(character.id)}
                      disabled={generatingPortraitId === character.id}
                      className="gap-2 rounded-xl border-border/60 h-11 text-base"
                    >
                      {generatingPortraitId === character.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      {t("character.generatePortrait")}
                    </Button>
                    <Button
                      onClick={() => handleOpenDialog(character)}
                      className="gap-2 rounded-xl col-span-2 bg-blue-600 hover:bg-blue-500 h-12 text-base"
                    >
                      <Edit2 className="w-5 h-5" />
                      {t("character.editCharacter")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDelete(character.id)}
                      className="gap-2 rounded-xl col-span-2 text-destructive hover:text-destructive border-destructive/30 h-11 text-base"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("common.delete")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isDialogOpen && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0f]/95 backdrop-blur-sm">
            <div className="flex items-center justify-between shrink-0 border-b border-violet-500/20 bg-[#111118] px-5 py-4 sm:px-8 sm:py-5">
              <div className="min-w-0 pr-4">
                <h2 className="text-2xl sm:text-4xl font-bold flex items-center gap-3 sm:gap-4 truncate">
                  <Sparkles className="w-8 h-8 sm:w-9 sm:h-9 text-violet-400 shrink-0" />
                  {editingId ? t("character.editCharacter") : t("character.createCharacter")}
                </h2>
                <p className="text-base sm:text-lg text-muted-foreground mt-1 sm:mt-2">
                  {editingId ? t("character.updateDesc") : t("character.defineDesc")}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCloseDialog}
                className="rounded-full shrink-0 h-11 w-11 hover:bg-violet-500/10"
                aria-label={t("common.close")}
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="max-w-[96rem] mx-auto w-full p-5 sm:p-8 lg:p-10 space-y-6">
                {showDraftPrompt && (
                  <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-lg font-medium">{t("character.draftFound")}</p>
                      <p className="text-base text-muted-foreground mt-1">
                        {t("character.draftFoundDesc")}
                      </p>
                    </div>
                    <Button size="lg" onClick={loadDraft} className="rounded-xl shrink-0 h-11 text-base">
                      {t("character.loadDraft")}
                    </Button>
                  </div>
                )}

                <div className="flex flex-col xl:flex-row gap-8 xl:gap-10 min-w-0">
                  <div className="w-full xl:max-w-md xl:w-[32rem] shrink-0 space-y-6 min-w-0">
                    <div className="rounded-2xl border border-violet-500/20 bg-[#111118]/80 p-5 sm:p-6">
                      <CharacterPreview
                        size="large"
                        formData={formData}
                        onImageSelected={(imageUrl, imageKey) => {
                          setFormData({ ...formData, avatarUrl: imageUrl, avatarKey: imageKey });
                        }}
                      />
                    </div>
                    <AvatarUpload
                      size="large"
                      currentAvatarUrl={formData.avatarUrl}
                      onAvatarSelected={(imageUrl, imageKey) => {
                        setFormData({ ...formData, avatarUrl: imageUrl, avatarKey: imageKey });
                      }}
                    />
                  </div>

                  <form onSubmit={handleSubmit} className="flex-1 space-y-6 min-w-0">
                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="name" className="text-lg font-semibold">
                          {t("character.characterName")} *
                        </Label>
                        <Input
                          id="name"
                          placeholder="例：夜間偵探、智慧導師"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="rounded-xl bg-[#0a0a0f] border-border/60 h-14 text-lg px-5 w-full"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-3 min-w-0">
                          <Label htmlFor="description" className="text-lg font-semibold">
                            {t("character.description")} *
                          </Label>
                          <Textarea
                            id="description"
                            placeholder={t("character.describeCharacter")}
                            value={formData.description}
                            onChange={(e) =>
                              setFormData({ ...formData, description: e.target.value })
                            }
                            className="rounded-xl bg-[#0a0a0f] border-border/60 min-h-[200px] text-lg px-5 py-4 leading-relaxed w-full"
                            required
                            rows={8}
                          />
                        </div>

                        <div className="space-y-3 min-w-0">
                          <Label htmlFor="worldview" className="text-lg font-semibold">
                            {t("character.worldview")} *
                          </Label>
                          <Textarea
                            id="worldview"
                            placeholder={t("character.describeWorldview")}
                            value={formData.worldview}
                            onChange={(e) =>
                              setFormData({ ...formData, worldview: e.target.value })
                            }
                            className="rounded-xl bg-[#0a0a0f] border-border/60 min-h-[200px] text-lg px-5 py-4 leading-relaxed w-full"
                            required
                            rows={8}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="openingLine" className="text-lg font-semibold">
                          {t("character.openingLine")} *
                        </Label>
                        <Textarea
                          id="openingLine"
                          placeholder={t("character.howGreetUser")}
                          value={formData.openingLine}
                          onChange={(e) =>
                            setFormData({ ...formData, openingLine: e.target.value })
                          }
                          className="rounded-xl bg-[#0a0a0f] border-border/60 min-h-[120px] text-lg px-5 py-4 w-full"
                          required
                          rows={4}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-[#0a0a0f]/60 px-6 py-5">
                        <Label htmlFor="isPublic" className="cursor-pointer text-lg font-semibold">
                          {t("character.makePublic")}
                        </Label>
                        <Switch
                          id="isPublic"
                          checked={formData.isPublic === 1}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, isPublic: checked ? 1 : 0 })
                          }
                          className="scale-125"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-4 justify-between pt-6 pb-4 border-t border-border/40">
                      <Button
                        type="button"
                        size="lg"
                        variant="outline"
                        onClick={saveDraft}
                        className="gap-2 rounded-xl h-14 text-lg px-6"
                        disabled={
                          !formData.name &&
                          !formData.description &&
                          !formData.worldview &&
                          !formData.openingLine
                        }
                      >
                        <Save className="w-4 h-4" />
                        {t("character.saveDraft")}
                      </Button>
                      <div className="flex gap-4">
                        <Button
                          type="button"
                          size="lg"
                          variant="outline"
                          onClick={handleCloseDialog}
                          className="rounded-xl h-14 text-lg px-8"
                        >
                          {t("common.cancel")}
                        </Button>
                        <Button
                          type="submit"
                          size="lg"
                          className="rounded-xl min-w-[140px] h-14 text-lg px-8"
                          disabled={createMutation.isPending || updateMutation.isPending}
                        >
                          {(createMutation.isPending || updateMutation.isPending) && (
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          )}
                          {editingId ? t("common.update") : t("common.create")}
                        </Button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {previewCharacter && (
          <CharacterPreviewModal
            isOpen
            onOpenChange={(open) => {
              if (!open) setPreviewCharacter(null);
            }}
            character={previewCharacter}
          />
        )}
      </div>
    </div>
  );
}
