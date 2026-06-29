import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Edit2, Trash2, Eye, Save, RotateCcw } from "lucide-react";
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

export default function CharacterManagementPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
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
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Fetch user's characters
  const charactersQuery = trpc.characters.getMyCharacters.useQuery();
  const createMutation = trpc.characters.create.useMutation();
  const updateMutation = trpc.characters.update.useMutation();
  const deleteMutation = trpc.characters.delete.useMutation();

  const DRAFT_KEY = 'character_draft';
  const DELETED_DRAFT_KEY = 'character_deleted_draft';

  // Check for draft on mount
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    setHasDraft(!!draft);
  }, []);

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
    <div className="flex-1 overflow-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Undo Draft Notification */}
        {showUndoPrompt && deletedDraft && (
          <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50 max-w-sm dark:bg-gray-900 dark:border-gray-700">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">{t('character.draftDeleted') || '草稿已刪除'}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('character.undoPrompt') || '要復原嗎？'}</p>
              </div>
              <div className="flex gap-2 ml-4 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowUndoPrompt(false);
                    setDeletedDraft(null);
                  }}
                >
                  {t('common.dismiss') || '關閉'}
                </Button>
                <Button
                  size="sm"
                  onClick={undoDraftDeletion}
                  className="bg-blue-500 hover:bg-blue-600 text-white gap-1"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('common.undo') || '復原'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('character.management')}</h1>
            <p className="text-muted-foreground mt-1">{t('character.managementDesc')}</p>
          </div>
          <div className="flex gap-2">
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
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()} className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t('character.createNew')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                {/* Draft Prompt */}
                {showDraftPrompt && (
                  <div className="mb-4 p-3 bg-accent/10 border border-accent rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t('character.draftFound') || '找到已保存的草稿'}</p>
                      <p className="text-xs text-muted-foreground">{t('character.draftFoundDesc') || '要恢復編輯嗎？'}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={loadDraft}
                      className="gap-1"
                    >
                      {t('character.loadDraft') || '加載草稿'}
                    </Button>
                  </div>
                )}

                <DialogHeader>
                  <DialogTitle>{editingId ? t('character.editCharacter') : t('character.createCharacter')}</DialogTitle>
                  <DialogDescription>
                    {editingId ? t('character.updateDesc') : t('character.defineDesc')}
                  </DialogDescription>
                </DialogHeader>

                <div className="flex gap-6">
                  {/* Preview Panel */}
                  <div className="w-80 flex-shrink-0 space-y-4">
                    <CharacterPreview 
                      formData={formData} 
                      onImageSelected={(imageUrl, imageKey) => {
                        setFormData({ ...formData, avatarUrl: imageUrl, avatarKey: imageKey });
                      }}
                    />
                    <AvatarUpload 
                      currentAvatarUrl={formData.avatarUrl}
                      onAvatarSelected={(imageUrl, imageKey) => {
                        setFormData({ ...formData, avatarUrl: imageUrl, avatarKey: imageKey });
                      }}
                    />
                  </div>

                  {/* Form Panel */}
                  <form onSubmit={handleSubmit} className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('character.characterName')} *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Detective Noir, Wise Mentor"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">{t('character.description')} *</Label>
                    <Textarea
                      id="description"
                      placeholder={t('character.describeCharacter')}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="worldview">{t('character.worldview')} *</Label>
                    <Textarea
                      id="worldview"
                      placeholder={t('character.describeWorldview')}
                      value={formData.worldview}
                      onChange={(e) => setFormData({ ...formData, worldview: e.target.value })}
                      required
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="openingLine">{t('character.openingLine')} *</Label>
                    <Input
                      id="openingLine"
                      placeholder={t('character.howGreetUser')}
                      value={formData.openingLine}
                      onChange={(e) => setFormData({ ...formData, openingLine: e.target.value })}
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={formData.isPublic === 1}
                      onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked ? 1 : 0 })}
                      className="rounded border-border"
                    />
                    <Label htmlFor="isPublic" className="cursor-pointer">{t('character.makePublic')}</Label>
                  </div>

                  <div className="flex gap-2 justify-between pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={saveDraft}
                      className="gap-2"
                      disabled={!formData.name && !formData.description && !formData.worldview && !formData.openingLine}
                    >
                      <Save className="w-4 h-4" />
                      {t('character.saveDraft') || '保存草稿'}
                    </Button>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={handleCloseDialog}>
                        {t('common.cancel')}
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                        {(createMutation.isPending || updateMutation.isPending) && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        {editingId ? t('common.update') : t('common.create')}
                      </Button>
                    </div>
                  </div>
                  </form>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Characters Grid */}
        {characters.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <p className="text-muted-foreground mb-4">{t('character.noCharacters')}</p>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleOpenDialog()} className="gap-2">
                    <Plus className="w-4 h-4" />
                    {t('character.createFirst')}
                  </Button>
                </DialogTrigger>
              </Dialog>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {characters.map((character: any) => (
              <Card key={character.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="line-clamp-2">{character.name}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        {character.description}
                      </CardDescription>
                    </div>
                    {character.isPublic === 1 && (
                      <Badge variant="secondary" className="ml-2 flex-shrink-0">
                        <Eye className="w-3 h-3 mr-1" />
                        {t('character.public')}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div className="text-sm text-muted-foreground mb-4">
                    <p className="line-clamp-3">{character.worldview}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowPreviewModal(true)}
                      className="flex-1 gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDialog(character)}
                      className="flex-1 gap-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      {t('common.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(character.id)}
                      className="flex-1 gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('common.delete')}
                    </Button>
                  </div>
                  <CharacterPreviewModal
                    isOpen={showPreviewModal}
                    onOpenChange={setShowPreviewModal}
                    character={character}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
