import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Loader, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function VideoGenerationPage() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(8);
  const [fps, setFps] = useState(24);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);

  const generateMutation = trpc.image.generateVideo.useMutation({
    onError: (error) => toast.error(error.message),
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error(t("video.enterPrompt"));
      return;
    }
    const result = await generateMutation.mutateAsync({
      prompt,
      duration,
      fps,
      width: 1280,
      height: 720,
    });
    if (result.videoUrl) {
      setGeneratedVideo(result.videoUrl);
      toast.success(t("video.success"));
    } else {
      toast.error(t("video.noUrl"));
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("video.title")}</CardTitle>
          <CardDescription>{t("video.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("video.promptPlaceholder")}
            rows={4}
          />
          <div>
            <label className="text-sm font-medium">
              {t("video.duration", { seconds: duration })}
            </label>
            <Slider value={[duration]} min={2} max={20} step={1} onValueChange={(v) => setDuration(v[0])} />
          </div>
          <div>
            <label className="text-sm font-medium">{t("video.fps", { fps })}</label>
            <Slider value={[fps]} min={8} max={30} step={1} onValueChange={(v) => setFps(v[0])} />
          </div>
          <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="w-full">
            {generateMutation.isPending ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                {t("video.generating")}
              </>
            ) : (
              t("video.generate")
            )}
          </Button>
        </CardContent>
      </Card>

      {generatedVideo && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <video src={generatedVideo} controls className="w-full rounded-lg" />
            <Button asChild variant="outline">
              <a href={generatedVideo} download>
                <Download className="w-4 h-4 mr-2" />
                {t("video.download")}
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}