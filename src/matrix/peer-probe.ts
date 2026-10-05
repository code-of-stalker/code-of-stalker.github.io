export function validatePeerUserId(value: string, ownUserId: string): string {
  const userId = value.trim();
  if (userId.length > 255 || !/^@[^\s:\0]+:[^\s\0]+$/.test(userId)) {
    throw new Error('Введите полный адрес аккаунта iPad, например @имя:matrix.org.');
  }
  if (userId === ownUserId) throw new Error('Нужен другой Matrix-аккаунт — тот, который открыт на iPad.');
  return userId;
}

export function peerChallenge(nonce: string): { requestBody: string; replyBody: string } {
  if (!/^[a-f0-9]{32}$/.test(nonce)) throw new Error('Не удалось создать уникальный код проверки.');
  const replyBody = `Matrix ответ ${nonce}`;
  return {
    requestBody: `Matrix · проверка обмена между двумя аккаунтами.\nСкопируйте строку ниже и отправьте её отдельным сообщением в эту комнату:\n${replyBody}`,
    replyBody,
  };
}

export function assertTwoJoinedUsers(value: unknown, ownUserId: string, peerUserId: string): void {
  if (value === null || typeof value !== 'object' || !('joined' in value) ||
      value.joined === null || typeof value.joined !== 'object' || Array.isArray(value.joined)) {
    throw new Error('Сервер не вернул список участников тестовой комнаты. Сообщение не отправлено.');
  }
  const members = Object.keys(value.joined);
  if (!members.includes(peerUserId)) throw new Error('Второй аккаунт ещё не вошёл в комнату. Примите приглашение в Element X и повторите проверку.');
  if (ownUserId === peerUserId || members.length !== 2 || !members.includes(ownUserId)) {
    throw new Error('В тестовой комнате должны быть только аккаунты Tecno и iPad. Сообщение не отправлено.');
  }
}
