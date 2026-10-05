import type { EncryptionProof } from './network-types';

type ExpectedEvent = { eventId: string; sender: string; roomId: string; body?: string };

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Сервер вернул неожиданный формат события; шифрование не подтверждено.');
  }
  return value as Record<string, unknown>;
}

export function assertMegolmRoomState(value: unknown): void {
  if (record(value).algorithm !== 'm.megolm.v1.aes-sha2') {
    throw new Error('Сервер не подтвердил ожидаемую настройку шифрования Megolm для комнаты. Сообщение не отправлено.');
  }
}

// Only the raw server response can prove that the server stored ciphertext.
// A decrypted timeline item's latestJson() can already contain plaintext.
export function inspectEncryptedEvent(value: unknown, expected: ExpectedEvent): EncryptionProof {
  const event = record(value);
  if (event.event_id !== expected.eventId || event.sender !== expected.sender ||
      (event.room_id !== undefined && event.room_id !== expected.roomId)) {
    throw new Error('Ответ сервера не соответствует отправленному тестовому событию.');
  }
  if (event.type !== 'm.room.encrypted') {
    throw new Error('На сервере событие не зашифровано. Проверка шифрования не пройдена.');
  }
  const content = record(event.content);
  if (content.algorithm !== 'm.megolm.v1.aes-sha2' ||
      typeof content.ciphertext !== 'string' || !content.ciphertext.trim() ||
      typeof content.session_id !== 'string' || !content.session_id.trim()) {
    throw new Error('В событии нет ожидаемого шифротекста Megolm. Проверка не пройдена.');
  }
  if ('body' in content || 'msgtype' in content || (expected.body !== undefined && JSON.stringify(content).includes(expected.body))) {
    throw new Error('Содержимое события включает открытый текст; шифрование не подтверждено.');
  }
  // Do not return ciphertext, encryption keys or the raw response to the UI.
  return { eventType: 'm.room.encrypted', algorithm: 'm.megolm.v1.aes-sha2', ciphertextLength: content.ciphertext.length };
}
