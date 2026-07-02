import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Star, Download, MessageCircle, Eye, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import CharacterAvatar from "@/components/CharacterAvatar";
import CharacterPreviewModal from "@/components/CharacterPreviewModal";

export default function CharacterCommunityPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [previewCharacter, setPreviewCharacter] = useState<any | null>(null);

  const utils = trpc.useUtils();
  const getPublicCharacters = trpc.characters.getPublic.useQuery();
  const cloneCharacterMutation = trpc.characters.clone.useMutation();
  const rateCharacterMutation = trpc.characters.rateCharacter.useMutation({
    onSuccess: () => {
      utils.characters.getPublic.invalidate();
    },
  });

  const characters = getPublicCharacters.data ?? [];
  const [ratingCharacterId, setRatingCharacterId] = useState<number | null>(null);

  const handleRateCharacter = useCallback(
    async (characterId: number, rating: number) => {
      setRatingCharacterId(characterId);
      try {
        await toast.promise(
          rateCharacterMutation.mutateAsync({ characterId, rating }),
          {
            loading: t("community.rating"),
            success: t("community.rated"),
            error: t("community.rateFailed"),
          }
        );
      } finally {
        setRatingCharacterId(null);
      }
    },
    [rateCharacterMutation, t]
  );

  const handleCloneCharacter = async (characterId: number) => {
    await toast.promise(
      cloneCharacterMutation.mutateAsync({ characterId }),
      {
        loading: t("community.cloningCharacter"),
        success: () => {
          navigate("/characters");
          return t("community.characterClonedSuccessfully");
        },
        error: t("community.failedToCloneCharacter"),
      }
    );
  };

  if (getPublicCharacters.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (getPublicCharacters.isError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-destructive">{t("community.loadError")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t("community.community")}</h1>
          <p className="text-muted-foreground">{t("community.communityDescription")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map((character: any) => (
            <Card key={character.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-3 mb-4">
                <CharacterAvatar
                  name={character.name}
                  avatarUrl={character.avatarUrl}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold mb-1 truncate">{character.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {t("community.by")}{" "}
                    {character.userId === 1 ? "Guardian Ai" : t("community.communityMember")}
                  </p>
                  <p className="text-sm line-clamp-2">{character.description}</p>
                </div>
              </div>

              <div className="space-y-3 mb-4 text-sm">
                <div>
                  <p className="font-semibold text-xs text-muted-foreground mb-1">
                    {t("character.worldview")}
                  </p>
                  <p className="italic line-clamp-2">{character.worldview}</p>
                </div>
                <div>
                  <p className="font-semibold text-xs text-muted-foreground mb-1">
                    {t("character.openingLine")}
                  </p>
                  <p className="italic line-clamp-2">&ldquo;{character.openingLine}&rdquo;</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5" role="group" aria-label={t("community.rateCharacter")}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        disabled={
                          rateCharacterMutation.isPending &&
                          ratingCharacterId === character.id
                        }
                        onClick={() => handleRateCharacter(character.id, star)}
                        className="p-0.5 rounded hover:scale-110 transition-transform disabled:opacity-50"
                        title={t("community.rateStars", { count: star })}
                      >
                        <Star
                          className={`w-4 h-4 ${
                            star <= Math.round(character.averageRating || 0)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-sm font-medium">{character.averageRating || 0}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageCircle className="w-3 h-3" />
                  <span>
                    {character.usageCount || 0} {t("community.chats")}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/character-chat?character=${character.id}`)}
                  className="w-full gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  {t("community.startChat")}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPreviewCharacter(character)}
                    className="flex-1 gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    {t("community.preview")}
                  </Button>
                  <Button
                    onClick={() => handleCloneCharacter(character.id)}
                    disabled={cloneCharacterMutation.isPending}
                    className="flex-1 gap-1"
                  >
                    <Download className="w-4 h-4" />
                    {t("character.cloneCharacter")}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {characters.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t("community.noPublicCharacters")}</p>
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