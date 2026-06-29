import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2, RefreshCw, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";

interface CharacterPreviewProps {
  formData: {
    name: string;
    description: string;
    worldview: string;
    openingLine: string;
    avatarUrl?: string;
    avatarKey?: string;
  };
  currentImageUrl?: string;
  onImageSelected?: (imageUrl: string, imageKey?: string) => void;
  size?: "default" | "large";
}

export default function CharacterPreview({
  formData,
  currentImageUrl,
  onImageSelected,
  size = "default",
}: CharacterPreviewProps) {
  const { t } = useTranslation();
  const isLarge = size === "large";
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(
    currentImageUrl || formData.avatarUrl || null
  );
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [promptEdited, setPromptEdited] = useState(false);

  const generateMutation = trpc.image.generateCharacterImage.useMutation({
    onError: (error) => toast.error(error.message),
  });

  const generatePromptFromCharacter = () => {
    if (!formData.name || !formData.description) {
      return "A mysterious AI character portrait";
    }
    return `Portrait of ${formData.name}. ${formData.description}. Setting: ${formData.worldview}. Digital art, character design, high quality illustration`;
  };

  useEffect(() => {
    if (promptEdited) return;
    const next = generatePromptFromCharacter();
    setGenerationPrompt((prev) => (prev === next ? prev : next));
  }, [formData.name, formData.description, formData.worldview, promptEdited]);

  useEffect(() => {
    if (formData.avatarUrl) {
      setSelectedImageUrl(formData.avatarUrl);
    }
  }, [formData.avatarUrl]);

  const handleGenerateImages = async () => {
    if (!formData.name || !formData.description) {
      toast.error(t("character.preview.fillNameDescFirst"));
      return;
    }

    try {
      const prompt = generationPrompt || generatePromptFromCharacter();
      const result = await generateMutation.mutateAsync({
        prompt,
        width: 512,
        height: 768,
        count: 3,
      });

      if (result.warning) toast.warning(result.warning);

      const images = result.images ?? (result.url ? [result.url] : []);
      if (images.length === 0) {
        throw new Error("No images were generated");
      }

      setGeneratedImages(images);
      setSelectedImageUrl(images[0]);
      const imageKey = images[0].split("/").pop() ?? "";
      onImageSelected?.(images[0], imageKey);
      toast.success(t("character.preview.generatedCount", { count: images.length }));
    } catch (error) {
      console.error("Image generation error:", error);
      toast.error(t("character.preview.generateError"));
    }
  };

  return (
    <div className="flex flex-col h-full min-w-0">
      <Card className="flex-1 flex flex-col bg-card/50 backdrop-blur border-border/50 overflow-hidden">
        <div
          className={`flex-1 flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/30 p-4 ${
            isLarge ? "min-h-[480px]" : "min-h-[300px]"
          }`}
        >
          {selectedImageUrl ? (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={selectedImageUrl}
                alt={formData.name || t("character.preview.unnamed")}
                className="w-full h-full max-h-[520px] object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className="text-center">
              <div
                className={`mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center ${
                  isLarge ? "w-28 h-28" : "w-24 h-24"
                }`}
              >
                <Wand2
                  className={`text-muted-foreground/50 ${isLarge ? "w-14 h-14" : "w-12 h-12"}`}
                />
              </div>
              <p className={`text-muted-foreground ${isLarge ? "text-base" : "text-sm"}`}>
                {formData.name
                  ? t("character.preview.readyToGenerate")
                  : t("character.preview.fillDetails")}
              </p>
            </div>
          )}
        </div>

        <div className={`border-t border-border/30 space-y-2 ${isLarge ? "p-5" : "p-4"}`}>
          <div className={isLarge ? "text-base" : "text-sm"}>
            <p className="font-semibold text-foreground truncate text-lg">
              {formData.name || t("character.preview.unnamed")}
            </p>
            <p className={`text-muted-foreground line-clamp-3 ${isLarge ? "text-sm mt-1" : "text-xs"}`}>
              {formData.description || t("character.preview.noDescription")}
            </p>
          </div>
        </div>
      </Card>

      {generatedImages.length > 0 && (
        <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/30">
          <p className="text-sm font-medium text-muted-foreground mb-2">
            {t("character.preview.selectImage")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {generatedImages.map((imageUrl, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  setSelectedImageUrl(imageUrl);
                  const imageKey = imageUrl.split("/").pop() ?? "";
                  onImageSelected?.(imageUrl, imageKey);
                }}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                  selectedImageUrl === imageUrl
                    ? "border-accent ring-2 ring-accent/50"
                    : "border-border/50 hover:border-accent/50"
                }`}
              >
                <img
                  src={imageUrl}
                  alt={t("character.preview.variation", { index: index + 1 })}
                  className="w-full h-full object-cover"
                />
                {selectedImageUrl === imageUrl && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Check className="w-5 h-5 text-accent" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <Button
          type="button"
          onClick={handleGenerateImages}
          disabled={generateMutation.isPending || !formData.name || !formData.description}
          className={`w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground ${
            isLarge ? "h-12 text-base" : ""
          }`}
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className={`animate-spin ${isLarge ? "w-5 h-5" : "w-4 h-4"}`} />
              {t("character.preview.generating")}
            </>
          ) : (
            <>
              <Wand2 className={isLarge ? "w-5 h-5" : "w-4 h-4"} />
              {t("character.preview.generateAvatar")}
            </>
          )}
        </Button>

        {generatedImages.length > 0 && (
          <Button
            type="button"
            onClick={handleGenerateImages}
            disabled={generateMutation.isPending}
            variant="outline"
            className={`w-full gap-2 ${isLarge ? "h-11 text-base" : ""}`}
          >
            <RefreshCw className={isLarge ? "w-5 h-5" : "w-4 h-4"} />
            {t("character.preview.generateAgain")}
          </Button>
        )}
      </div>

      <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/30 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground font-medium">
            {t("character.preview.generationPrompt")}
          </p>
          {promptEdited && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 shrink-0"
              onClick={() => {
                setGenerationPrompt(generatePromptFromCharacter());
                setPromptEdited(false);
              }}
            >
              <RotateCcw className="w-3 h-3" />
              {t("character.preview.resetPrompt")}
            </Button>
          )}
        </div>
        <Textarea
          value={generationPrompt}
          onChange={(e) => {
            setGenerationPrompt(e.target.value);
            setPromptEdited(true);
          }}
          placeholder={t("character.preview.promptPlaceholder")}
          rows={isLarge ? 5 : 4}
          className={`resize-y bg-[#0a0a0f] border-border/60 text-sm leading-relaxed ${
            isLarge ? "min-h-[120px] text-base" : "min-h-[96px]"
          }`}
        />
      </div>
    </div>
  );
}