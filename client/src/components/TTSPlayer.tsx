import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Volume2, Play, Pause, Download, Loader2 } from "lucide-react";

type TTSLanguage = "en" | "zh" | "ja" | "ko";

interface TTSPlayerProps {
  text: string;
  autoPlay?: boolean;
  onAudioGenerated?: (audioUrl: string) => void;
}

const languageNames: Record<TTSLanguage, string> = {
  en: "English",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
};

export default function TTSPlayer({ text, autoPlay = false, onAudioGenerated }: TTSPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState<TTSLanguage>("en");
  const [voiceGender, setVoiceGender] = useState<"male" | "female">("female");
  const [speechRate, setSpeechRate] = useState([100]);
  const [pitch, setPitch] = useState([100]);
  const [volume, setVolume] = useState([100]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Auto-detect language from text
  useEffect(() => {
    const detectLanguage = (text: string): TTSLanguage => {
      if (/[\u4E00-\u9FFF]/.test(text)) return "zh";
      if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja";
      if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
      return "en";
    };

    const detected = detectLanguage(text);
    setLanguage(detected);
  }, [text]);

  const generateSpeech = async () => {
    if (!text.trim()) {
      alert("No text to convert");
      return;
    }

    setIsLoading(true);
    try {
      // Mock API call - replace with actual TTS API
      // In production, this would call your backend TTS endpoint
      const mockAudioUrl = `data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEwMAAAAAAAAAAAAAAA//NkZAAAAANIAAAAAExBTQoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

      setAudioUrl(mockAudioUrl);
      setCurrentTime(0);

      if (audioRef.current) {
        audioRef.current.src = mockAudioUrl;
        if (autoPlay) {
          audioRef.current.play();
          setIsPlaying(true);
        }
      }

      onAudioGenerated?.(mockAudioUrl);
    } catch (error) {
      console.error("Failed to generate speech:", error);
      alert("Failed to generate speech");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;

    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = `audio-${Date.now()}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
      {/* Language and Voice Settings */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Language
          </label>
          <Select value={language} onValueChange={(v) => setLanguage(v as TTSLanguage)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(languageNames).map(([code, name]) => (
                <SelectItem key={code} value={code}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Voice
          </label>
          <Select value={voiceGender} onValueChange={(v) => setVoiceGender(v as any)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Speed: {speechRate[0]}%
          </label>
          <Slider
            value={speechRate}
            onValueChange={setSpeechRate}
            min={50}
            max={200}
            step={10}
            className="mt-2"
          />
        </div>
      </div>

      {/* Pitch and Volume */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Pitch: {pitch[0]}%
          </label>
          <Slider
            value={pitch}
            onValueChange={setPitch}
            min={50}
            max={200}
            step={10}
            className="mt-2"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Volume: {volume[0]}%
          </label>
          <Slider
            value={volume}
            onValueChange={setVolume}
            min={0}
            max={100}
            step={10}
            className="mt-2"
          />
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-2">
        {!audioUrl ? (
          <Button
            onClick={generateSpeech}
            disabled={isLoading}
            className="gap-2"
            size="sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" />
                Generate Speech
              </>
            )}
          </Button>
        ) : (
          <>
            <Button
              onClick={togglePlayPause}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Play
                </>
              )}
            </Button>

            <div className="flex-1 text-xs text-gray-600 dark:text-gray-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            <Button
              onClick={handleDownload}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </>
        )}
      </div>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
}
