import type { SasData, TrustReport, TrustStatus } from './trust-types';
import type { TrustDiagnostics } from './trust-diagnostics';
import type { AudioProbeReport } from './audio-probe';
import type { IncomingVoiceReport } from './audio-checkpoint';
import type { VoiceBeforeUpload, VoiceDraft, VoiceProbeReport } from './voice-types';
import type { RecoveryReadiness } from './recovery-readiness-model';

export type ServerReport = {
  url: string;
  passwordLogin: boolean;
  nativeSync: boolean;
};

export type EncryptionProof = {
  eventType: 'm.room.encrypted';
  algorithm: 'm.megolm.v1.aes-sha2';
  ciphertextLength: number;
};

export type MessageReport = {
  roomId: string;
  eventId: string;
  body: string;
  elapsedMs: number;
} & ({ mode: 'plaintext' } | { mode: 'encrypted'; encryption: EncryptionProof });

export type RestartProbeStatus = {
  roomId: string;
  eventId: string;
  deviceId: string;
  createdAt: number;
  requiresRestart: boolean;
};

export type RestartReport = {
  roomId: string;
  eventId: string;
  deviceId: string;
  body: string;
  elapsedMs: number;
  encryption: EncryptionProof;
};

export type PeerRoom = { roomId: string; peerUserId: string };
export type GroupRoom = { roomId: string; ipadUserId: string; computerUserId: string };

export type PeerRestartProbe = RestartProbeStatus & { senderUserId: string };
export type PeerRestartReport = RestartReport & { senderUserId: string };
export type AudioHistoryItem = { eventId: string; receivedAt: number; durationMs: number };

export type PeerExchangeReport = PeerRoom & {
  sentEventId: string;
  replyEventId: string;
  requestBody: string;
  replyBody: string;
  outgoingEncryption: EncryptionProof;
  incomingEncryption: EncryptionProof;
  elapsedMs: number;
};

export interface MatrixTestSession {
  readonly voiceUploadBoundaryVersion: 3;
  readonly voicePlaybackCacheVersion: 1;
  readonly diaryBoundaryVersion: 1;
  readonly userId: string;
  readonly serverUrl: string;
  readonly deviceId: string;
  readonly restartProbe: RestartProbeStatus | null;
  readonly peerRoom: PeerRoom | null;
  readonly peerRestartProbe: PeerRestartProbe | null;
  readonly peerAudioRestartProbe: PeerRestartProbe | null;
  readonly peerAudioHistory: readonly AudioHistoryItem[];
  readonly ownAudioHistory: readonly AudioHistoryItem[];
  readonly diaryRoomId: string | null;
  readonly diaryAudioHistory: readonly AudioHistoryItem[];
  readonly diarySharedEventId: string | null;
  readonly groupRoom: GroupRoom | null;
  inspectRecoveryReadiness(signal: AbortSignal, onStage: (stage: string) => void): Promise<RecoveryReadiness>;
  enableDiaryRecovery(code: string, signal: AbortSignal, onStage: (stage: string) => void): Promise<RecoveryReadiness>;
  recoverOneDiaryRecord(code: string, signal: AbortSignal, onStage: (stage: string) => void): Promise<IncomingVoiceReport>;
  prepareGroupRoom(computerUserId: string, signal: AbortSignal, onStage: (stage: string) => void): Promise<GroupRoom>;
  sendGroupAudio(signal: AbortSignal, onStage: (stage: string) => void): Promise<AudioProbeReport>;
  readGroupAudio(sender: 'ipad' | 'computer', signal: AbortSignal, onStage: (stage: string) => void): Promise<VoiceProbeReport>;
  prepareDiary(signal: AbortSignal, onStage: (stage: string) => void): Promise<string>;
  saveDiaryVoice(draft: VoiceDraft, signal: AbortSignal, onStage: (stage: string) => void, beforeUpload: VoiceBeforeUpload): Promise<VoiceProbeReport>;
  readDiaryVoice(eventId: string, signal: AbortSignal, onStage: (stage: string) => void): Promise<VoiceProbeReport>;
  shareDiaryVoice(eventId: string, signal: AbortSignal, onStage: (stage: string) => void): Promise<AudioProbeReport>;
  readPeerAudio(eventId: string, signal: AbortSignal, onStage: (stage: string) => void): Promise<VoiceProbeReport>;
  readCachedPeerAudio(eventId: string, signal: AbortSignal, onStage: (stage: string) => void): Promise<VoiceProbeReport | null>;
  readPeerAudioAfterRestart(signal: AbortSignal, onStage: (stage: string) => void): Promise<VoiceProbeReport>;
  sendTestMessage(signal: AbortSignal, onStage: (stage: string) => void): Promise<MessageReport>;
  sendEncryptedTestMessage(signal: AbortSignal, onStage: (stage: string) => void): Promise<MessageReport>;
  readEncryptedMessageAfterRestart(signal: AbortSignal, onStage: (stage: string) => void): Promise<RestartReport>;
  preparePeerRoom(peerUserId: string, signal: AbortSignal, onStage: (stage: string) => void): Promise<PeerRoom>;
  exchangeWithPeer(signal: AbortSignal, onStage: (stage: string) => void): Promise<PeerExchangeReport>;
  sendEncryptedAudioToPeer(signal: AbortSignal, onStage: (stage: string) => void): Promise<AudioProbeReport>;
  sendVoiceMessageToPeer(draft: VoiceDraft, signal: AbortSignal, onStage: (stage: string) => void, beforeUpload: VoiceBeforeUpload): Promise<VoiceProbeReport>;
  receiveMissedVoiceFromPeer(signal: AbortSignal, onStage: (stage: string) => void): Promise<VoiceProbeReport | null>;
  receiveVoiceMessageFromPeer(signal: AbortSignal, onStage: (stage: string) => void): Promise<VoiceProbeReport>;
  watchVoiceMessagesFromPeer(signal: AbortSignal, onStage: (stage: string) => void, onReceived: () => void): Promise<void>;
  readPeerReplyAfterRestart(signal: AbortSignal, onStage: (stage: string) => void): Promise<PeerRestartReport>;
  inspectTrust(signal: AbortSignal, onStage: (stage: string) => void): Promise<TrustStatus>;
  verifyTrust(target: 'own' | 'peer', signal: AbortSignal, onStage: (stage: string) => void,
    onSas: (data: SasData | null) => void, onDiagnostics?: (report: TrustDiagnostics) => void): Promise<TrustReport>;
  respondToVerification(matches: boolean): Promise<void>;
  logout(signal: AbortSignal): Promise<void>;
  dispose(): void;
}

export function validateServerUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Укажите HTTPS-адрес Matrix-сервера без пароля, параметров и фрагмента.');
  }
  return url.toString().replace(/\/+$/, '');
}

export function networkErrorText(error: unknown, secret = ''): string {
  let text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (secret) text = text.split(secret).join('[скрыто]');
  text = text.replace(/(access_token|refresh_token|password)(["'\s:=]+)[^\s,"'&}]+/gi, '$1$2[скрыто]');
  if (/aborted|aborterror|cancelled|canceled/i.test(text)) {
    return 'Проверка отменена или время ожидания истекло. Сообщение могло уже попасть на сервер; автоматического повтора нет.';
  }
  if (/M_FORBIDDEN|invalid.*password|invalid.*credential/i.test(text)) {
    return 'Сервер отклонил вход. Проверьте имя пользователя и пароль тестового аккаунта.';
  }
  if (/M_LIMIT_EXCEEDED|429|rate.limit/i.test(text)) {
    return 'Сервер просит подождать. Повторите проверку позже.';
  }
  return text.slice(0, 700);
}
