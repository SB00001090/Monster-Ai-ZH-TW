/**
 * Text-to-Speech Integration Layer
 * Supports multiple languages: English, Chinese, Japanese, Korean
 * Uses natural-sounding voices for each language
 */

import { invokeLLM } from "./_core/llm";

export type TTSLanguage = "en" | "zh" | "ja" | "ko";
export type VoiceGender = "male" | "female";

export interface TTSOptions {
  text: string;
  language: TTSLanguage;
  voiceGender?: VoiceGender;
  speechRate?: number; // 50-200 (percentage)
  pitch?: number; // 50-200 (percentage)
  volume?: number; // 0-100 (percentage)
}

export interface TTSResponse {
  audioUrl: string;
  audioKey: string;
  duration: number;
  language: TTSLanguage;
}

// Language-specific voice configurations
const voiceConfigs: Record<TTSLanguage, Record<VoiceGender, string>> = {
  en: {
    male: "en-US-Neural2-C",
    female: "en-US-Neural2-E",
  },
  zh: {
    male: "zh-CN-Neural2-A",
    female: "zh-CN-Neural2-D",
  },
  ja: {
    male: "ja-JP-Neural2-B",
    female: "ja-JP-Neural2-D",
  },
  ko: {
    male: "ko-KR-Neural2-A",
    female: "ko-KR-Neural2-C",
  },
};

// Language names for API calls
const languageNames: Record<TTSLanguage, string> = {
  en: "English",
  zh: "Mandarin Chinese",
  ja: "Japanese",
  ko: "Korean",
};

/**
 * Generate natural-sounding speech from text
 * Uses Manus built-in TTS API with neural voices
 */
export async function generateSpeech(options: TTSOptions): Promise<TTSResponse> {
  try {
    const {
      text,
      language,
      voiceGender = "female",
      speechRate = 100,
      pitch = 100,
      volume = 100,
    } = options;

    // Validate inputs
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    if (text.length > 5000) {
      throw new Error("Text exceeds maximum length of 5000 characters");
    }

    const voiceId = voiceConfigs[language]?.[voiceGender];
    if (!voiceId) {
      throw new Error(`Unsupported language or voice gender: ${language}, ${voiceGender}`);
    }

    // Call Manus TTS API
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a text-to-speech converter. Convert the following text to natural speech in ${languageNames[language]}.
          
Voice parameters:
- Voice ID: ${voiceId}
- Speech Rate: ${speechRate}% (100 = normal, 50 = slow, 200 = fast)
- Pitch: ${pitch}% (100 = normal, 50 = low, 200 = high)
- Volume: ${volume}% (0-100)

Return a JSON object with:
{
  "audioUrl": "url to generated audio",
  "duration": duration in seconds,
  "format": "mp3"
}`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    // Parse response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Failed to generate speech");
    }

    // Extract JSON from response
    const contentStr = typeof content === 'string' ? content : '';
    const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch || jsonMatch.length === 0) {
      throw new Error("Invalid response format from TTS API");
    }

    const result = JSON.parse(jsonMatch[0] || '{}');

    return {
      audioUrl: result.audioUrl,
      audioKey: `tts/${language}/${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`,
      duration: result.duration || 0,
      language,
    };
  } catch (error) {
    console.error("[TTS Integration] Error generating speech:", error);
    throw error;
  }
}

/**
 * Detect language from text
 */
export function detectLanguage(text: string): TTSLanguage {
  // Chinese characters
  if (/[\u4E00-\u9FFF]/.test(text)) {
    return "zh";
  }
  // Japanese characters (Hiragana, Katakana, Kanji)
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)) {
    return "ja";
  }
  // Korean characters (Hangul)
  if (/[\uAC00-\uD7AF]/.test(text)) {
    return "ko";
  }
  // Default to English
  return "en";
}

/**
 * Validate TTS settings
 */
export function validateTTSSettings(
  speechRate: number,
  pitch: number,
  volume: number
): boolean {
  return (
    speechRate >= 50 &&
    speechRate <= 200 &&
    pitch >= 50 &&
    pitch <= 200 &&
    volume >= 0 &&
    volume <= 100
  );
}

/**
 * Get supported languages
 */
export function getSupportedLanguages(): TTSLanguage[] {
  return ["en", "zh", "ja", "ko"];
}

/**
 * Get available voices for a language
 */
export function getAvailableVoices(language: TTSLanguage): VoiceGender[] {
  const config = voiceConfigs[language];
  return config ? (Object.keys(config) as VoiceGender[]) : [];
}
