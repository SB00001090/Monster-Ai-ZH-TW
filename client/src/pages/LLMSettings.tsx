import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const PROVIDERS = [
  { id: "ollama", name: "Ollama", description: "本地 AI - 無需網絡", icon: "🦙", requiresKey: false },
  { id: "openai", name: "OpenAI", description: "GPT-4, GPT-3.5", icon: "🤖", requiresKey: true },
  { id: "claude", name: "Claude", description: "Anthropic Claude", icon: "🧠", requiresKey: true },
  { id: "mistral", name: "Mistral", description: "Mistral AI", icon: "🌊", requiresKey: true },
  { id: "groq", name: "Groq", description: "超快速推理", icon: "⚡", requiresKey: true },
  { id: "together", name: "Together AI", description: "開源模型", icon: "🤝", requiresKey: true },
  { id: "huggingface", name: "Hugging Face", description: "開源模型庫", icon: "🤗", requiresKey: true },
  { id: "cohere", name: "Cohere", description: "企業級 AI", icon: "💎", requiresKey: true },
  { id: "replicate", name: "Replicate", description: "雲端模型", icon: "☁️", requiresKey: true },
  { id: "custom", name: "自定義", description: "自定義 API 端點", icon: "🔧", requiresKey: false },
];

const DEFAULT_MODELS: Record<string, string[]> = {
  ollama: ["llama2", "llama3", "mistral", "codellama", "neural-chat", "phi", "gemma"],
  openai: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "gpt-4o", "gpt-4o-mini"],
  claude: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307", "claude-3-5-sonnet-20241022"],
  mistral: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "open-mistral-7b"],
  groq: ["mixtral-8x7b-32768", "llama2-70b-4096", "gemma-7b-it"],
  together: ["meta-llama/Llama-2-70b-chat-hf", "mistralai/Mixtral-8x7B-Instruct-v0.1"],
  huggingface: ["meta-llama/Llama-2-7b-chat-hf", "mistralai/Mistral-7B-Instruct-v0.1"],
  cohere: ["command", "command-light", "command-r", "command-r-plus"],
  replicate: ["meta/llama-2-70b-chat", "mistralai/mixtral-8x7b-instruct-v0.1"],
  custom: [],
};

export default function LLMSettings() {
  const { data: backendStatus } = trpc.llm.getBackendStatus.useQuery();
  const { data: currentConfig, refetch } = trpc.llm.getConfig.useQuery();
  const updateConfig = trpc.llm.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("LLM 配置已更新", { description: "您的 AI 模型設置已保存" });
      refetch();
    },
    onError: (err) => {
      toast.error("更新失敗", { description: err.message });
    },
  });
  const deleteConfig = trpc.llm.deleteConfig.useMutation({
    onSuccess: () => {
      toast.success("已重置", { description: "已恢復使用默認 AI 模型" });
      refetch();
      setSelectedProvider(null);
      setFormData({});
    },
  });

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (currentConfig) {
      setSelectedProvider(currentConfig.provider);
      setFormData(currentConfig);
    }
  }, [currentConfig]);

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    const provider = PROVIDERS.find(p => p.id === providerId);
    const defaultUrl = providerId === "ollama" ? "http://localhost:11434" :
      providerId === "openai" ? "https://api.openai.com/v1" :
      providerId === "claude" ? "https://api.anthropic.com" :
      providerId === "mistral" ? "https://api.mistral.ai" :
      providerId === "groq" ? "https://api.groq.com" :
      providerId === "together" ? "https://api.together.xyz" :
      providerId === "huggingface" ? "https://api-inference.huggingface.co" :
      providerId === "cohere" ? "https://api.cohere.ai" :
      providerId === "replicate" ? "https://api.replicate.com" : "";

    setFormData({
      provider: providerId,
      url: defaultUrl,
      model: DEFAULT_MODELS[providerId]?.[0] || "",
      connectorKey: "",
      temperature: 0.7,
      maxTokens: 2048,
      topP: 1,
      topK: 40,
      frequencyPenalty: 0,
      presencePenalty: 0,
    });
  };

  const handleSave = () => {
    if (!selectedProvider) return;
    
    updateConfig.mutate({
      provider: formData.provider as any,
      url: formData.url || undefined,
      connectorKey: formData.connectorKey || undefined,
      model: formData.model || "default",
      temperature: Number(formData.temperature) || 0.7,
      maxTokens: Number(formData.maxTokens) || 2048,
      topP: Number(formData.topP) || 1,
      topK: Number(formData.topK) || 40,
      frequencyPenalty: Number(formData.frequencyPenalty) || 0,
      presencePenalty: Number(formData.presencePenalty) || 0,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">LLM 模型設置</h2>
        <p className="text-muted-foreground mt-1">
          選擇並配置您的 AI 模型提供商。支持本地 Ollama 和所有主流雲端 API。
        </p>
      </div>

      <Card className={backendStatus?.ok ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}>
        <CardContent className="pt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Python 後端 LLM</p>
            <p className="text-xs text-muted-foreground mt-1">
              {backendStatus?.ok
                ? `運行中 — ${String(backendStatus.backend ?? "connected")}`
                : "離線 — 請執行 run.bat 啟動 Python"}
            </p>
          </div>
          <Badge variant={backendStatus?.ok ? "default" : "secondary"}>
            {backendStatus?.ok ? "Online" : "Offline"}
          </Badge>
        </CardContent>
      </Card>

      {/* Current Status */}
      {currentConfig && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-green-500 text-green-500">
                已連接
              </Badge>
              <span className="text-sm">
                當前使用: <strong>{PROVIDERS.find(p => p.id === currentConfig.provider)?.name}</strong>
                {" - "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">{currentConfig.model}</code>
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteConfig.mutate()}
              className="text-red-500 hover:text-red-600"
            >
              重置為默認
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Provider Selection */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {PROVIDERS.map((provider) => (
          <Card
            key={provider.id}
            className={`cursor-pointer transition-all hover:border-primary/50 ${
              selectedProvider === provider.id ? "border-primary ring-2 ring-primary/20" : ""
            }`}
            onClick={() => handleProviderSelect(provider.id)}
          >
            <CardContent className="p-4 text-center">
              <div className="text-2xl mb-2">{provider.icon}</div>
              <div className="font-medium text-sm">{provider.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{provider.description}</div>
              {!provider.requiresKey && (
                <Badge variant="secondary" className="mt-2 text-xs">免費</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Configuration Form */}
      {selectedProvider && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {PROVIDERS.find(p => p.id === selectedProvider)?.icon}{" "}
              {PROVIDERS.find(p => p.id === selectedProvider)?.name} 配置
            </CardTitle>
            <CardDescription>
              配置您的 {PROVIDERS.find(p => p.id === selectedProvider)?.name} 連接參數
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* API URL */}
            <div className="space-y-2">
              <Label>API 端點 URL</Label>
              <Input
                value={formData.url || ""}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://api.example.com"
              />
              {selectedProvider === "ollama" && (
                <p className="text-xs text-muted-foreground">
                  本地 Ollama 默認地址: http://localhost:11434
                </p>
              )}
            </div>

            {/* API Key / Connector Key */}
            {PROVIDERS.find(p => p.id === selectedProvider)?.requiresKey && (
              <div className="space-y-2">
                <Label>API 密鑰</Label>
                <Input
                  type="password"
                  value={formData.connectorKey || ""}
                  onChange={(e) => setFormData({ ...formData, connectorKey: e.target.value })}
                  placeholder="sk-..."
                />
                <p className="text-xs text-muted-foreground">
                  您的 API 密鑰將安全存儲，不會被分享
                </p>
              </div>
            )}

            {/* Model Selection */}
            <div className="space-y-2">
              <Label>模型名稱</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.model || ""}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="model-name"
                  className="flex-1"
                />
              </div>
              {DEFAULT_MODELS[selectedProvider]?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {DEFAULT_MODELS[selectedProvider].map((model) => (
                    <Badge
                      key={model}
                      variant={formData.model === model ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => setFormData({ ...formData, model })}
                    >
                      {model}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Advanced Parameters */}
            <details className="space-y-4">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                進階參數
              </summary>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <Label>Temperature ({formData.temperature || 0.7})</Label>
                  <Input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.temperature || 0.7}
                    onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={formData.maxTokens || 2048}
                    onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Top P ({formData.topP || 1})</Label>
                  <Input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={formData.topP || 1}
                    onChange={(e) => setFormData({ ...formData, topP: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Top K</Label>
                  <Input
                    type="number"
                    value={formData.topK || 40}
                    onChange={(e) => setFormData({ ...formData, topK: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </details>

            {/* Save Button */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={updateConfig.isPending}
                className="flex-1"
              >
                {updateConfig.isPending ? "保存中..." : "💾 保存配置"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedProvider(null);
                  setFormData({});
                }}
              >
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Section */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <h3 className="font-medium mb-2">💡 使用說明</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Ollama (本地)</strong>: 無需 API 密鑰，完全離線使用。需要在本地安裝 Ollama。</li>
            <li>• <strong>雲端 API</strong>: 需要對應服務的 API 密鑰。費用由您的 API 帳戶承擔。</li>
            <li>• <strong>自定義端點</strong>: 支持任何 OpenAI 兼容的 API 端點。</li>
            <li>• 如果未配置或配置無效，系統將自動使用默認 AI 模型。</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
