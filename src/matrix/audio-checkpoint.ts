import type { AudioMessageContent, TimelineEventLike } from '@unomed/react-native-matrix-sdk';
import type { VoiceProbeReport } from './voice-types';
import { AudioProbeError } from './audio-probe';

export type IncomingVoiceReport = VoiceProbeReport & { audioSha256: string };
export type AudioCheckpoint = {
  roomId: string; eventId: string; deviceId: string; senderUserId: string;
  audioSha256: string; byteLength: number; durationMs: number; createdAt: number;
};

export function checkpointAudio(event: TimelineEventLike, checkpoint: AudioCheckpoint): AudioMessageContent {
  if (event.eventId() !== checkpoint.eventId || event.senderId() !== checkpoint.senderUserId) {
    throw new AudioProbeError('SDK вернул другое сообщение или другого отправителя.');
  }
  const content = event.content();
  if (content.tag !== 'MessageLike' || content.inner.content.tag !== 'RoomMessage') {
    throw new AudioProbeError('SDK не смог расшифровать прежнее голосовое сохранёнными ключами.');
  }
  const message = content.inner.content.inner.messageType;
  if (message.tag !== 'Audio') throw new AudioProbeError('Прежнее сообщение больше не содержит аудиозапись.');
  return message.inner.content;
}
