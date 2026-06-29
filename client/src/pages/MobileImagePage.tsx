import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useGuest } from "@/contexts/GuestContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { STABLE_EMPTY_ARRAY } from "@/lib/queryDefaults";
import {
  Loader2,
  Send,
  Download,
  ChevronLeft,
  MoreVertical,
  Image as ImageIcon,
  MessageCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type GeneratedImage = {
  id: number;
  prompt: string;
  imageUrl: string;
  createdAt: Date;
};

type Conversation = {
  id: number;
  title: string;
  mode: "chat" | "image";
  createdAt: Date;
};

interface MobileImagePageProps {
  onBack?: () => void;
  onSwitchToChat?: () => void;
}

export default function MobileImagePage({
  onBack,
  onSwitchToChat,
}: MobileImagePageProps) {
  const { user, loading: authLoading } = useAuth();
  const { isGuest } = useGuest();
  const canUse = Boolean(user) || isGuest;
  const [currentConversationId, setCurrentConversationId] = useState<
    number | null
  >(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // tRPC queries and mutations
  const { data: conversationsData } = trpc.chat.getConversations.useQuery(
    undefined,
    {
      enabled: canUse,
    }
  );
  const conversations = conversationsData ?? STABLE_EMPTY_ARRAY;

  const { data: galleryImagesData } = trpc.image.getGallery.useQuery(
    { conversationId: currentConversationId! },
    { enabled: !!currentConversationId }
  );

  const createConversationMutation = trpc.chat.createConversation.useMutation();
  const generateImageMutation = trpc.image.generateImage.useMutation();

  // Update images when fetched
  useEffect(() => {
    if (!galleryImagesData?.length) return;
    setImages(
      galleryImagesData.map((img: any) => ({
        id: img.id,
        prompt: img.prompt,
        imageUrl: img.imageUrl,
        createdAt: new Date(img.createdAt),
      }))
    );
  }, [galleryImagesData]);

  // Initialize first conversation or create new one
  useEffect(() => {
    if (!currentConversationId) {
      if (conversations.length > 0) {
        const imageConv = conversations.find((c) => c.mode === "image");
        if (imageConv) {
          setCurrentConversationId(imageConv.id);
        } else {
          handleNewConversation();
        }
      }
    }
  }, [conversationsData, currentConversationId]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const handleNewConversation = async () => {
    try {
      const result = await createConversationMutation.mutateAsync({
        title: `Image - ${new Date().toLocaleString()}`,
        mode: "image",
      });
      setCurrentConversationId((result as any).insertId || Date.now());
      setImages([]);
      setShowMenu(false);
      toast.success("New image session created");
    } catch (error) {
      toast.error("Failed to create session");
    }
  };

  const handleGenerateImage = async () => {
    if (!prompt.trim() || !currentConversationId) return;

    setIsLoading(true);
    try {
      const response = await generateImageMutation.mutateAsync({
        conversationId: currentConversationId,
        prompt,
      });

      setImages((prev) => [
        {
          id: Date.now(),
          prompt,
          imageUrl: response.imageUrl,
          createdAt: new Date(),
        },
        ...prev,
      ]);

      setPrompt("");
      toast.success("Image generated successfully!");
    } catch (error) {
      toast.error("Failed to generate image");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadImage = (imageUrl: string, prompt: string) => {
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `monsterai-${Date.now()}.png`;
    a.click();
    toast.success("Image downloaded");
  };

  const handleDeleteImage = (imageId: number) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    toast.success("Image removed from gallery");
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Mobile Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-0 h-auto"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
          <div>
            <h1 className="font-bold text-base">MonsterAi Generate</h1>
            <p className="text-xs text-muted-foreground">
              {images.length} images
            </p>
          </div>
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMenu(!showMenu)}
            className="p-0 h-auto"
          >
            <MoreVertical className="w-5 h-5" />
          </Button>
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50">
              <button
                onClick={handleNewConversation}
                className="w-full px-4 py-2 text-left text-sm hover:bg-background/50 flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                New Session
              </button>
              {onSwitchToChat && (
                <button
                  onClick={onSwitchToChat}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-background/50 flex items-center gap-2 border-t border-border"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat Mode
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Gallery Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Loader2 className="w-12 h-12 text-accent mb-3 animate-spin" />
            <p className="text-muted-foreground text-sm">
              生成圖像
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              圖像生成中
            </p>
          </div>
        ) : images.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              Generate images with AI
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {images.map((img) => (
              <Card key={img.id} className="bg-card border-border overflow-hidden">
                <div className="aspect-square bg-background/50 relative group">
                  <img
                    src={img.imageUrl}
                    alt={img.prompt}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <Button
                      size="sm"
                      onClick={() => handleDownloadImage(img.imageUrl, img.prompt)}
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteImage(img.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    {new Date(img.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm line-clamp-2">{img.prompt}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-card border-t border-border p-4 sticky bottom-0">
        <div className="flex gap-2">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !isLoading) {
                handleGenerateImage();
              }
            }}
            placeholder="Describe an image..."
            className="flex-1 bg-background text-foreground border-border text-sm"
            disabled={isLoading}
          />
          <Button
            onClick={handleGenerateImage}
            disabled={isLoading || !prompt.trim()}
            className="bg-accent text-accent-foreground hover:bg-accent/90 px-3"
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
