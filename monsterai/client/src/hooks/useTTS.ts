import { useState, useCallback } from 'react';

interface TTSOptions {
  language?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export function useTTS() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback(async (text: string, options: TTSOptions = {}) => {
    // Check if browser supports Web Speech API
    const SpeechSynthesisUtterance = window.SpeechSynthesisUtterance;
    const speechSynthesis = window.speechSynthesis;

    if (!SpeechSynthesisUtterance || !speechSynthesis) {
      console.error('Speech Synthesis API not supported');
      return;
    }

    // Cancel any ongoing speech
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // Set language - detect from text or use provided language
    const language = options.language || detectLanguage(text) || 'en-US';
    utterance.lang = language;

    // Set speech parameters
    utterance.rate = options.rate || 1;
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 1;

    // Set up event handlers
    utterance.onstart = () => {
      setIsPlaying(true);
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setIsPlaying(false);
      setIsSpeaking(false);
    };

    // Speak the text
    speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    const speechSynthesis = window.speechSynthesis;
    if (speechSynthesis && speechSynthesis.speaking) {
      speechSynthesis.cancel();
      setIsPlaying(false);
      setIsSpeaking(false);
    }
  }, []);

  const pause = useCallback(() => {
    const speechSynthesis = window.speechSynthesis;
    if (speechSynthesis && speechSynthesis.speaking) {
      speechSynthesis.pause();
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(() => {
    const speechSynthesis = window.speechSynthesis;
    if (speechSynthesis && speechSynthesis.paused) {
      speechSynthesis.resume();
      setIsPlaying(true);
    }
  }, []);

  return {
    speak,
    stop,
    pause,
    resume,
    isPlaying,
    isSpeaking,
  };
}

// Helper function to detect language from text
function detectLanguage(text: string): string {
  // Chinese characters
  if (/[\u4E00-\u9FFF]/.test(text)) {
    return 'zh-CN';
  }
  // Japanese characters
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return 'ja-JP';
  }
  // Korean characters
  if (/[\uAC00-\uD7AF]/.test(text)) {
    return 'ko-KR';
  }
  // Default to English
  return 'en-US';
}
