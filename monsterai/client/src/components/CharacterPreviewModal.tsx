import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface CharacterPreviewModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  character: {
    name: string;
    description: string;
    worldview: string;
    openingLine: string;
    avatarUrl?: string;
  };
}

export default function CharacterPreviewModal({
  isOpen,
  onOpenChange,
  character,
}: CharacterPreviewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            Character Preview
          </DialogTitle>
          <DialogDescription>
            Preview how your character will appear
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Avatar */}
          {character.avatarUrl && (
            <div className="flex justify-center">
              <img
                src={character.avatarUrl}
                alt={character.name}
                className="w-48 h-48 rounded-lg object-cover border-2 border-accent/20"
              />
            </div>
          )}

          {/* Character Info */}
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-bold text-foreground">{character.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{character.description}</p>
            </div>

            <div>
              <Badge variant="secondary" className="mb-2">
                Worldview
              </Badge>
              <p className="text-sm text-foreground">{character.worldview}</p>
            </div>

            <div>
              <Badge variant="secondary" className="mb-2">
                Opening Line
              </Badge>
              <p className="text-sm italic text-foreground">"{character.openingLine}"</p>
            </div>
          </div>

          {/* Animation */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              ✨ This character is ready to chat!
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
