/** Guardian Ai API client — re-exports from monsterApi. */
import { monsterApi } from "./monsterApi";
import type { OAuthProvider } from "@/const";

export type { OAuthProvider };
export type SyncBundleType =
  | "oc_cards"
  | "chat_sessions"
  | "preferences"
  | "training_vault";

export const getGuardianStatus = () => monsterApi.guardianStatus();
export const getGuardianDisclaimer = (locale = "zh-TW") =>
  monsterApi.guardianDisclaimer(locale);
export const getGuardianConnection = () => monsterApi.guardianConnection();

export function uploadGuardianSync(params: {
  provider: OAuthProvider;
  providerSub: string;
  passphrase: string;
  bundleType: SyncBundleType;
  payload: Record<string, unknown> | unknown[];
  deviceId?: string;
  googleAccessToken?: string;
}) {
  return monsterApi.guardianSyncUpload({
    provider: params.provider,
    provider_sub: params.providerSub,
    passphrase: params.passphrase,
    bundle_type: params.bundleType,
    payload: params.payload,
    device_id: params.deviceId,
    google_access_token: params.googleAccessToken,
  });
}

export function downloadGuardianSync(params: {
  provider: OAuthProvider;
  providerSub: string;
  passphrase: string;
  bundleType: SyncBundleType;
  googleAccessToken?: string;
}) {
  return monsterApi.guardianSyncDownload({
    provider: params.provider,
    provider_sub: params.providerSub,
    passphrase: params.passphrase,
    bundle_type: params.bundleType,
    google_access_token: params.googleAccessToken,
  });
}

export function reportGuardianError(params: {
  errorType: string;
  message: string;
  stack?: string;
  context?: string;
  source?: string;
  accountId?: string;
  discordNotify?: boolean;
  jamUrl?: string;
  autoFixAction?: string;
  autoFixResult?: string;
  incidentId?: number;
}) {
  return monsterApi.guardianReportError({
    error_type: params.errorType,
    message: params.message,
    stack: params.stack,
    context: params.context,
    source: params.source,
    account_id: params.accountId,
    discord_notify: params.discordNotify,
    jam_url: params.jamUrl,
    auto_fix_action: params.autoFixAction,
    auto_fix_result: params.autoFixResult,
    incident_id: params.incidentId,
  });
}

export function listGuardianSync(provider: string, providerSub: string) {
  return monsterApi.guardianSyncList(provider, providerSub);
}

export function exportGuardianTrainingVault() {
  return monsterApi.guardianTrainingExport();
}

export function importGuardianTrainingVault(bundle: Record<string, unknown>) {
  return monsterApi.guardianTrainingImport(bundle);
}

export const getNetworkLearningStatus = () =>
  monsterApi.guardianNetworkLearningStatus();

export const postNetworkLearningConsent = (consented: boolean, metrics = false) =>
  monsterApi.guardianNetworkLearningConsent({ consented, metrics });

export const postNetworkLearningTrigger = (body: {
  force?: boolean;
  topics?: string[];
}) => monsterApi.guardianNetworkLearningTrigger(body);

export const getNetworkLearningDirectives = (limit = 5) =>
  monsterApi.guardianNetworkLearningDirectives(limit);

export const getArtTriageStatus = () => monsterApi.guardianArtTriageStatus();

export const postArtTriageRun = () => monsterApi.guardianArtTriageRun();

export const getManuscriptVersions = (ocId: string) =>
  monsterApi.guardianManuscriptVersions(ocId);

export const restoreManuscriptVersion = (ocId: string, version: number) =>
  monsterApi.guardianManuscriptRestore(ocId, version);

export const createCharacterShare = (params: {
  ocId: string;
  card: Record<string, unknown>;
  ownerId?: string;
  mode: "private" | "link" | "public";
  ttlHours?: number;
  passphrase: string;
}) =>
  monsterApi.guardianShareCreate({
    oc_id: params.ocId,
    card: params.card,
    owner_id: params.ownerId,
    mode: params.mode,
    ttl_hours: params.ttlHours,
    passphrase: params.passphrase,
  });

export const importCharacterShare = (token: string, passphrase: string) =>
  monsterApi.guardianShareImport(token, passphrase);

export const registerGuardianAccount = (username: string, displayName?: string) =>
  monsterApi.guardianAccountRegister(username, displayName);

export const linkGuardianAccount = (params: {
  accountId: string;
  provider: "google" | "github" | "discord";
  providerSub: string;
  displayName?: string;
  email?: string;
}) =>
  monsterApi.guardianAccountLink({
    account_id: params.accountId,
    provider: params.provider,
    provider_sub: params.providerSub,
    display_name: params.displayName,
    email: params.email,
  });

export const getGuardianAccountStatus = (accountId: string) =>
  monsterApi.guardianAccountStatus(accountId);

export const getManuscriptDiff = (ocId: string, v1: number, v2: number) =>
  monsterApi.guardianManuscriptDiff(ocId, v1, v2);

export const appendDiary = (
  characterId: string,
  body: {
    sessionId: string;
    messages: Array<Record<string, unknown>>;
    vaultKey: string;
    mood?: string;
  },
) =>
  monsterApi.guardianDiaryAppend(characterId, {
    session_id: body.sessionId,
    messages: body.messages,
    vault_key: body.vaultKey,
    mood: body.mood,
  });

export const readDiary = (characterId: string, date: string, vaultKey: string) =>
  monsterApi.guardianDiaryRead(characterId, date, vaultKey);

export const summarizeDiary = (characterId: string, date: string, vaultKey: string) =>
  monsterApi.guardianDiarySummary(characterId, date, vaultKey);

export const listDiaryDates = (characterId: string) =>
  monsterApi.guardianDiaryDates(characterId);

export const listCharacterShares = (ownerId: string) =>
  monsterApi.guardianShareList(ownerId);

export const bindDiscordWebhook = (accountId: string, webhookUrl: string) =>
  monsterApi.guardianAccountDiscordWebhook(accountId, webhookUrl);

export const getGuardianCurriculumStatus = () =>
  monsterApi.guardianCurriculumStatus();

export const getGuardianCurriculumTopics = (mode = "extended") =>
  monsterApi.guardianCurriculumTopics(mode);

export const postGuardianCurriculumStart = (body: {
  mode?: string;
  duration_hours?: number;
  resume?: boolean;
  fast_mode?: boolean;
}) => monsterApi.guardianCurriculumStart(body);

export const postGuardianCurriculumStop = () => monsterApi.guardianCurriculumStop();

export const getGuardianGenerationSuccess = () => monsterApi.guardianGenerationSuccess();

export const GUARDIAN_ACCOUNT_KEY = "guardian_account_id";
export const GUARDIAN_DIARY_VAULT_KEY = "guardian_diary_vault_key";

export function getStoredGuardianAccountId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GUARDIAN_ACCOUNT_KEY);
}

export function setStoredGuardianAccountId(id: string): void {
  localStorage.setItem(GUARDIAN_ACCOUNT_KEY, id);
}