import { useCallback, useState } from "react";
import {
  getGuardianCurriculumStatus,
  getGuardianCurriculumTopics,
  getGuardianGenerationSuccess,
  postGuardianCurriculumStart,
  postGuardianCurriculumStop,
} from "@/lib/guardianApi";

export type CurriculumMode = "base" | "extended" | "cybersec" | "languages" | "after_ai";

export type CurriculumModeInfo = {
  id: string;
  label: string;
  topic_count: number;
  duration_hours_default: number;
};

export type CurriculumStatus = {
  running?: boolean;
  progress_pct?: number;
  completed_topics?: number;
  total_topics?: number;
  current_topic_id?: string;
  current_phase?: string;
  mode?: string;
  eta_hours?: number;
  pairs_on_disk?: number;
  modes?: CurriculumModeInfo[];
  extended_topic_count?: number;
  cybersec_topic_count?: number;
};

export type GenerationSuccessStatus = {
  success_rate?: number;
  target_rate?: number;
  on_track?: boolean;
  avg_quality_score?: number | null;
  avg_likeness_similarity?: number | null;
  total_recorded?: number;
};

export function useGuardianCurriculum() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<CurriculumStatus | null>(null);
  const [success, setSuccess] = useState<GenerationSuccessStatus | null>(null);
  const [previewTopics, setPreviewTopics] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const [st, gen] = await Promise.all([
      getGuardianCurriculumStatus(),
      getGuardianGenerationSuccess(),
    ]);
    setStatus(st as CurriculumStatus);
    setSuccess(gen as GenerationSuccessStatus);
    return { status: st, success: gen };
  }, []);

  const loadTopics = useCallback(async (mode: CurriculumMode) => {
    const data = await getGuardianCurriculumTopics(mode);
    const ids = (data.phases ?? []).flatMap(
      (p: { topics?: Array<{ id: string }> }) =>
        (p.topics ?? []).map((t) => t.id),
    );
    setPreviewTopics(ids.slice(0, 12));
    return data;
  }, []);

  const start = useCallback(
    async (params: {
      mode: CurriculumMode;
      fastMode?: boolean;
      resume?: boolean;
      durationHours?: number;
    }) => {
      setBusy(true);
      try {
        const result = await postGuardianCurriculumStart({
          mode: params.mode,
          fast_mode: params.fastMode ?? false,
          resume: params.resume ?? true,
          duration_hours: params.durationHours,
        });
        await refresh();
        return result;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const stop = useCallback(async () => {
    setBusy(true);
    try {
      const result = await postGuardianCurriculumStop();
      await refresh();
      return result;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return {
    busy,
    status,
    success,
    previewTopics,
    refresh,
    loadTopics,
    start,
    stop,
  };
}