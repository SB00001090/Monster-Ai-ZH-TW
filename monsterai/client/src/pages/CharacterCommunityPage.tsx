import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Star, Download, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function CharacterCommunityPage() {
  const { t } = useTranslation();
  const [characters, setCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getPublicCharacters = trpc.characters.getPublic.useQuery();
  const createFromTemplate = trpc.characters.createFromTemplate.useMutation();
  const cloneCharacterMutation = trpc.characters.clone.useMutation();

  useEffect(() => {
    if (getPublicCharacters.data) {
      setCharacters(getPublicCharacters.data);
      setLoading(false);
    }
  }, [getPublicCharacters.data]);

  const handleCloneCharacter = async (characterId: number, characterName: string) => {
    try {
      toast.loading(t('community.cloningCharacter', 'Cloning character...'));
      const result = await cloneCharacterMutation.mutateAsync({
        sourceCharacterId: characterId,
      });
      
      if (result.success) {
        toast.success(
          t('community.characterClonedSuccessfully', 'Character cloned successfully! Please edit the content to avoid plagiarism.')
        );
      }
    } catch (error) {
      toast.error(t('community.failedToCloneCharacter', 'Failed to clone character'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">{t('common.loading', 'Loading...')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('community.community', 'Community Characters')}</h1>
          <p className="text-muted-foreground">
            {t('community.communityDescription', 'Discover and clone characters created by the MonsterAi community')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map((character: any) => (
            <Card key={character.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="mb-4">
                <h3 className="text-xl font-bold mb-2">{character.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t('community.by', 'by')} {character.userId === 1 ? "MonsterAi" : t('community.communityMember', 'Community Member')}
                </p>
                <p className="text-sm mb-4">{character.description}</p>
              </div>

              <div className="space-y-3 mb-4 text-sm">
                <div>
                  <p className="font-semibold text-xs text-muted-foreground mb-1">{t('character.worldview', 'Worldview')}</p>
                  <p className="italic line-clamp-2">{character.worldview}</p>
                </div>
                <div>
                  <p className="font-semibold text-xs text-muted-foreground mb-1">{t('character.openingLine', 'Opening')}</p>
                  <p className="italic line-clamp-2">"{character.openingLine}"</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4 pt-4 border-t border-border">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{character.averageRating || 0}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageCircle className="w-3 h-3" />
                  <span>{character.usageCount || 0} {t('community.chats', 'chats')}</span>
                </div>
              </div>

              <Button
                onClick={() => handleCloneCharacter(character.id, character.name)}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                {t('character.cloneCharacter', 'Clone Character')}
              </Button>
            </Card>
          ))}
        </div>

        {characters.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('community.noPublicCharacters', 'No public characters yet')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
