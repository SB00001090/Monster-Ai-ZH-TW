import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Zap, Settings2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface SDUIProps {
  onGenerate: (params: SDGenerationParams) => Promise<void>;
  isLoading?: boolean;
  models?: Array<{ id: string; name: string; version: string }>;
}

export interface SDGenerationParams {
  prompt: string;
  negativePrompt?: string;
  modelId: string;
  steps: number;
  cfgScale: number;
  sampler: string;
  width: number;
  height: number;
  seed?: number;
}

const SAMPLERS = [
  "euler",
  "euler_ancestral",
  "heun",
  "dpm_2",
  "dpm_2_ancestral",
  "lms",
  "dpm_fast",
  "dpm_adaptive",
  "dpmpp_2s_ancestral",
  "dpmpp_sde",
  "ddim",
  "pndm",
];

const RESOLUTIONS = [
  { label: "512x512", width: 512, height: 512 },
  { label: "768x512", width: 768, height: 512 },
  { label: "512x768", width: 512, height: 768 },
  { label: "1024x1024", width: 1024, height: 1024 },
];

export default function StableDiffusionUI({
  onGenerate,
  isLoading = false,
  models = [
    { id: "sd-1.5", name: "Stable Diffusion 1.5", version: "1.5" },
    { id: "sd-2.1", name: "Stable Diffusion 2.1", version: "2.1" },
    { id: "sdxl", name: "Stable Diffusion XL", version: "SDXL" },
  ],
}: SDUIProps) {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [modelId, setModelId] = useState(models[0]?.id || "sd-1.5");
  const [steps, setSteps] = useState(20);
  const [cfgScale, setCfgScale] = useState(7.5);
  const [sampler, setSampler] = useState("euler");
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [seed, setSeed] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    try {
      await onGenerate({
        prompt,
        negativePrompt: negativePrompt || undefined,
        modelId,
        steps,
        cfgScale,
        sampler,
        width,
        height,
        seed: seed ? parseInt(seed) : undefined,
      });
    } catch (error) {
      toast.error("Failed to generate image");
    }
  };

  const handleReset = () => {
    setPrompt("");
    setNegativePrompt("");
    setModelId(models[0]?.id || "sd-1.5");
    setSteps(20);
    setCfgScale(7.5);
    setSampler("euler");
    setWidth(512);
    setHeight(512);
    setSeed("");
  };

  return (
    <div className="space-y-4">
      {/* Prompt Input */}
      <Card className="p-4 bg-card border-border">
        <label className="text-sm font-medium mb-2 block">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate..."
          className="w-full h-24 p-3 bg-background border border-border rounded-lg text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent"
          disabled={isLoading}
        />
      </Card>

      {/* Negative Prompt */}
      <Card className="p-4 bg-card border-border">
        <label className="text-sm font-medium mb-2 block">Negative Prompt</label>
        <textarea
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          placeholder="What to avoid in the image..."
          className="w-full h-16 p-3 bg-background border border-border rounded-lg text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent"
          disabled={isLoading}
        />
      </Card>

      {/* Model Selection */}
      <Card className="p-4 bg-card border-border">
        <label className="text-sm font-medium mb-2 block">Model</label>
        <Select value={modelId} onValueChange={setModelId} disabled={isLoading}>
          <SelectTrigger className="bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name} ({model.version})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Basic Parameters */}
      <Card className="p-4 bg-card border-border space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Resolution</label>
          <Select
            value={`${width}x${height}`}
            onValueChange={(val) => {
              const res = RESOLUTIONS.find((r) => `${r.width}x${r.height}` === val);
              if (res) {
                setWidth(res.width);
                setHeight(res.height);
              }
            }}
            disabled={isLoading}
          >
            <SelectTrigger className="w-32 bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((res) => (
                <SelectItem key={res.label} value={`${res.width}x${res.height}`}>
                  {res.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium">Steps: {steps}</label>
            <span className="text-xs text-muted-foreground">1-150</span>
          </div>
          <Slider
            value={[steps]}
            onValueChange={(val) => setSteps(val[0])}
            min={1}
            max={150}
            step={1}
            disabled={isLoading}
            className="w-full"
          />
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium">CFG Scale: {cfgScale.toFixed(1)}</label>
            <span className="text-xs text-muted-foreground">1-20</span>
          </div>
          <Slider
            value={[cfgScale * 10]}
            onValueChange={(val) => setCfgScale(val[0] / 10)}
            min={10}
            max={200}
            step={1}
            disabled={isLoading}
            className="w-full"
          />
        </div>
      </Card>

      {/* Advanced Parameters */}
      <div className="space-y-2">
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full justify-start gap-2"
          disabled={isLoading}
        >
          <Settings2 className="w-4 h-4" />
          {showAdvanced ? "Hide" : "Show"} Advanced Parameters
        </Button>

        {showAdvanced && (
          <Card className="p-4 bg-card border-border space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Sampler</label>
              <Select value={sampler} onValueChange={setSampler} disabled={isLoading}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAMPLERS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Seed (Optional)</label>
              <Input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Leave empty for random"
                type="number"
                className="bg-background border-border"
                disabled={isLoading}
              />
            </div>
          </Card>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleGenerate}
          disabled={isLoading || !prompt.trim()}
          className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Generate Image
            </>
          )}
        </Button>
        <Button
          onClick={handleReset}
          variant="outline"
          disabled={isLoading}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>
    </div>
  );
}
