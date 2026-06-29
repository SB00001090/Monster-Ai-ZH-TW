import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, MessageCircle, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";

interface Character {
  id: number;
  userId: number;
  name: string;
  description: string;
  worldview: string;
  openingLine: string;
  systemPrompt?: string | null;
  isPublic: number;
  averageRating: number;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export default function LatestCharactersShowcase() {
  const [, navigate] = useLocation();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { data: latestCharacters, isLoading: isQueryLoading } = trpc.characters.getLatest.useQuery(
    { limit: 8 },
    {
      staleTime: 1000 * 60 * 5, // 5 minutes
    }
  );

  useEffect(() => {
    if (latestCharacters) {
      setCharacters(latestCharacters);
      setIsLoading(false);
    }
  }, [latestCharacters]);

  if (isLoading || isQueryLoading) {
    return (
      <div className="w-full py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Latest Characters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!characters || characters.length === 0) {
    return null;
  }

  const handleStartChat = (characterId: number) => {
    navigate(`/character-chat?character=${characterId}`);
  };

  return (
    <div className="w-full py-12 px-4 bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Discover Latest Characters</h2>
          <p className="text-muted-foreground">Explore newly created AI personas from our community</p>
        </div>

        {/* Character Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {characters.map((character) => (
            <Card
              key={character.id}
              className="group overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col h-full bg-card/50 backdrop-blur border-border/50 hover:border-accent/50"
              onClick={() => handleStartChat(character.id)}
            >
              {/* Character Header */}
              <div className="p-4 pb-3 border-b border-border/30">
                <h3 className="font-semibold text-lg truncate group-hover:text-accent transition-colors">
                  {character.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">AI Character</p>
              </div>

              {/* Character Info */}
              <div className="flex-1 p-4 space-y-3">
                {/* Description */}
                <div>
                  <p className="text-sm text-foreground/80 line-clamp-2">
                    {character.description}
                  </p>
                </div>

                {/* Worldview */}
                {character.worldview && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Worldview: </span>
                    <span className="text-foreground/70 line-clamp-1">{character.worldview}</span>
                  </div>
                )}

                {/* Opening Line */}
                {character.openingLine && (
                  <div className="text-xs italic text-foreground/60 line-clamp-1">
                    "{character.openingLine}"
                  </div>
                )}
              </div>

              {/* Stats Footer */}
              <div className="p-4 pt-3 border-t border-border/30 space-y-3">
                {/* Rating and Usage */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className="font-medium">{character.averageRating || 0}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MessageCircle className="w-4 h-4" />
                    <span>{character.usageCount}</span>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground group-hover:shadow-md transition-all"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartChat(character.id);
                  }}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Start Chat
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* View All Link */}
        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => navigate("/community")}
            className="border-accent/50 hover:bg-accent/10"
          >
            View All Characters →
          </Button>
        </div>
      </div>
    </div>
  );
}
