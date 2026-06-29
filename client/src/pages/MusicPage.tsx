import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const GENRES = [
  "Pop", "Rock", "Hip-Hop", "R&B", "Jazz", "Classical",
  "Electronic", "EDM", "House", "Techno", "Ambient",
  "Folk", "Country", "Blues", "Reggae", "Latin",
  "Metal", "Punk", "Indie", "Lo-fi", "Synthwave",
  "K-Pop", "J-Pop", "C-Pop", "Anime OST",
  "Cinematic", "Orchestral", "Chillhop", "Trap",
];

const MOODS = [
  "Happy", "Sad", "Energetic", "Calm", "Romantic",
  "Dark", "Uplifting", "Melancholic", "Aggressive",
  "Dreamy", "Nostalgic", "Epic", "Mysterious",
  "Playful", "Intense", "Peaceful", "Dramatic",
];

export default function MusicPage() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState("");
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [vocals, setVocals] = useState(false);
  const [language, setLanguage] = useState("English");
  const [result, setResult] = useState<any>(null);

  const generateMutation = trpc.music.generate.useMutation({
    onSuccess: (data: any) => {
      if (data.blocked) {
        toast.error(data.blockReason || t("music.blocked"));
      } else if (data.success) {
        setResult(data);
        toast.success(t("music.generatedSuccess"));
      } else {
        toast.error(data.error || t("music.generationFailed"));
      }
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message);
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error(t("music.enterDescription"));
      return;
    }
    generateMutation.mutate({
      prompt,
      genre: genre || undefined,
      mood: mood || undefined,
      vocals,
      language,
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          🎵 {t("music.title")}
        </h1>
        <p className="text-zinc-400 mt-1">{t("music.subtitle")}</p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg">{t("music.describe")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("music.promptPlaceholder")}
            className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white placeholder-zinc-500 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />

          <div>
            <label className="block text-sm text-zinc-400 mb-2">{t("music.genre")}</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenre(genre === g ? "" : g)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    genre === g
                      ? "bg-purple-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">{t("music.mood")}</label>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(mood === m ? "" : m)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    mood === m
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={vocals}
                onChange={(e) => setVocals(e.target.checked)}
                className="rounded border-zinc-600 bg-zinc-800 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-zinc-300">{t("music.vocals")}</span>
            </label>

            {vocals && (
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1 text-sm text-white"
              >
                <option value="English">English</option>
                <option value="Chinese">中文</option>
                <option value="Japanese">日本語</option>
                <option value="Korean">한국어</option>
                <option value="Spanish">Español</option>
              </select>
            )}
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !prompt.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
          >
            {generateMutation.isPending ? t("music.generating") : `🎵 ${t("music.generate")}`}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg text-green-400">✅ {t("music.resultTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="text-sm text-zinc-400 mb-1">{t("music.originalPrompt")}</p>
              <p className="text-white">{result.prompt}</p>
            </div>
            {result.enhancedPrompt && (
              <div className="bg-zinc-800 rounded-lg p-4">
                <p className="text-sm text-zinc-400 mb-1">{t("music.enhancedPrompt")}</p>
                <p className="text-white whitespace-pre-wrap">{result.enhancedPrompt}</p>
              </div>
            )}
            <div className="flex gap-4 text-sm text-zinc-400">
              <span>
                {t("music.genre")}: <span className="text-purple-400">{result.genre}</span>
              </span>
              <span>
                {t("music.mood")}: <span className="text-blue-400">{result.mood}</span>
              </span>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-yellow-400 text-sm">💡 {t("music.tip")}</p>
            </div>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(result.enhancedPrompt || result.prompt);
                toast.success(t("music.copied"));
              }}
              variant="outline"
              className="w-full"
            >
              📋 {t("music.copyEnhanced")}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="text-center text-xs text-zinc-600 mt-4">
        <p>🛡️ {t("music.safety")}</p>
      </div>
    </div>
  );
}