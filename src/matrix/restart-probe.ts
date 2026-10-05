import type { TimelineEventLike } from '@unomed/react-native-matrix-sdk';

export type EncryptedCheckpoint = {
  roomId: string;
  eventId: string;
  deviceId: string;
  bodySha256: string;
  createdAt: number;
};

export type PeerReplyCheckpoint = EncryptedCheckpoint & { senderUserId: string };

export function checkpointMessageBody(
  event: TimelineEventLike, checkpoint: EncryptedCheckpoint, sender: string, deviceId: string,
): string {
  if (deviceId !== checkpoint.deviceId || event.eventId() !== checkpoint.eventId || event.senderId() !== sender) {
    throw new Error('Устройство или полученное событие отличается от сохранённого теста. Проверка не пройдена.');
  }
  const content = event.content();
  if (content.tag !== 'MessageLike' || content.inner.content.tag !== 'RoomMessage') {
    throw new Error('SDK не расшифровал прежнее тестовое сообщение в текст. Сохранение ключей не подтверждено.');
  }
  const message = content.inner.content.inner.messageType;
  if (message.tag !== 'Text') throw new Error('SDK вернул другой тип сообщения. Проверка не пройдена.');
  return message.inner.content.body;
}

export function assertCheckpointDigest(bodySha256: string, checkpoint: EncryptedCheckpoint): void {
  if (bodySha256 !== checkpoint.bodySha256) {
    throw new Error('Расшифрованный текст отличается от сохранённой контрольной суммы. Проверка не пройдена.');
  }
}
