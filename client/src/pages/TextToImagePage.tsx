import { useMemo, useState } from "react";
import StableDiffusionUI, { type SDGenerationParams } from "@/components/StableDiffusionUI";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function TextToImagePage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const checkpointsQuery = trpc.image.getCheckpoints.useQuery();
  const models = useMemo(() => {
    const checkpoints = checkpointsQuery.data?.checkpoints ?? [];
    if (checkpoints.length === 0) {
      return undefined;
    }
    return checkpoints.map((id) => ({
      id,
      name: id.split(/[/\\]/).pop() ?? id,
      version: checkpointsQuery.data?.active === id ? "active" : "",
    }));
  }, [checkpointsQuery.data]);

  const generateMutation = trpc.image.generateImage.useMutation({
    onError: (error) => toast.error(error.message),
  });

  const handleGenerate = async (params: SDGenerationParams) => {
    const result = await generateMutation.mutateAsync({
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      width: params.width,
      height: params.height,
      style: params.modelId,
      checkpoint: params.modelId,
    });
    if (result.imageUrl) {
      setPreviewUrl(result.imageUrl);
    }
    if (result.warning) {
      toast.warning(result.warning);
    }
    toast.success("Image generated");
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Text to Image</h1>
      <StableDiffusionUI
        onGenerate={handleGenerate}
        isLoading={generateMutation.isPending}
        models={models}
      />
      {previewUrl && (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <img src={previewUrl} alt="Generated" className="w-full max-h-[70vh] object-contain" />
        </div>
      )}
    </div>
  );
}