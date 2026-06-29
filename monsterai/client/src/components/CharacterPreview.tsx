import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Wand2, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";

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
}

export default function CharacterPreview({
  formData,
  currentImageUrl,
  onImageSelected,
}: CharacterPreviewProps) {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(currentImageUrl || null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState("");

  // Generate a prompt from character data
  const generatePromptFromCharacter = () => {
    if (!formData.name || !formData.description) {
      return "A mysterious AI character";
    }

    return `A portrait of ${formData.name}. ${formData.description}. Worldview: ${formData.worldview}. Style: digital art, character design, professional illustration, high quality`;
  };

  useEffect(() => {
    setGenerationPrompt(generatePromptFromCharacter());
  }, [formData.name, formData.description, formData.worldview]);

  const handleGenerateImages = async () => {
    if (!formData.name || !formData.description) {
      toast.error("Please fill in character name and description first");
      return;
    }

    setIsGenerating(true);
    try {
      const prompt = generationPrompt || generatePromptFromCharacter();
      const imageUrls: string[] = [];

      // Generate 5 images in parallel
      const generatePromises = Array(5)
        .fill(null)
        .map(async (_, index) => {
          try {
            const response = await fetch("/api/trpc/image.generateCharacterImage", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                json: { prompt: `${prompt} (variation ${index + 1})` },
              }),
            });

            if (!response.ok) {
              throw new Error(`Failed to generate image ${index + 1}`);
            }

            const data = await response.json();
            const generatedUrl = data.result?.data?.url;

            if (generatedUrl) {
              imageUrls[index] = generatedUrl;
            }
          } catch (error) {
            console.error(`Error generating image ${index + 1}:`, error);
          }
        });

      await Promise.all(generatePromises);

      const validImages = imageUrls.filter(Boolean);
      if (validImages.length > 0) {
        setGeneratedImages(validImages);
        setSelectedImageUrl(validImages[0]);
        // Extract image key from URL (format: /manus-storage/{key})
        const imageKey = validImages[0].split('/manus-storage/')[1] || '';
        onImageSelected?.(validImages[0], imageKey);
        toast.success(`Generated ${validImages.length} character images!`);
      } else {
        throw new Error("No images were generated successfully");
      }
    } catch (error) {
      console.error("Image generation error:", error);
      toast.error("Failed to generate character images. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Main Preview */}
      <Card className="flex-1 flex flex-col bg-card/50 backdrop-blur border-border/50 overflow-hidden">
        {/* Image Container */}
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/30 p-4 min-h-[300px]">
          {selectedImageUrl ? (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={selectedImageUrl}
                alt={formData.name || "Character preview"}
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          ) : (
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <Wand2 className="w-12 h-12 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">
                {formData.name ? "Ready to generate images" : "Fill in character details"}
              </p>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="p-4 border-t border-border/30 space-y-2">
          <div className="text-sm">
            <p className="font-semibold text-foreground truncate">
              {formData.name || "Unnamed Character"}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {formData.description || "No description"}
            </p>
          </div>
        </div>
      </Card>

      {/* Generated Images Grid */}
      {generatedImages.length > 0 && (
        <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/30">
          <p className="text-xs font-medium text-muted-foreground mb-2">Select an image:</p>
          <div className="grid grid-cols-5 gap-2">
            {generatedImages.map((imageUrl, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedImageUrl(imageUrl);
                  const imageKey = imageUrl.split('/manus-storage/')[1] || '';
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
                  alt={`Variation ${index + 1}`}
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

      {/* Action Buttons */}
      <div className="mt-4 space-y-2">
        <Button
          onClick={handleGenerateImages}
          disabled={isGenerating || !formData.name || !formData.description}
          className="w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating 5 Images...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Generate 5 Images
            </>
          )}
        </Button>

        {generatedImages.length > 0 && (
          <Button
            onClick={handleGenerateImages}
            disabled={isGenerating}
            variant="outline"
            className="w-full gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Generate Again
              </>
            )}
          </Button>
        )}
      </div>

      {/* Prompt Info */}
      <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/30">
        <p className="text-xs text-muted-foreground font-medium mb-2">Generation Prompt:</p>
        <p className="text-xs text-foreground/70 line-clamp-3">
          {generationPrompt || "Character details will appear here"}
        </p>
      </div>
    </div>
  );
}
