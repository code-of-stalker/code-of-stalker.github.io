import type { IdentityTrust, TrustStatus } from './trust-types';

export function identityTrustText(identity: IdentityTrust): string {
  return identity.violation ? 'Ранее подтверждённые ключи изменились'
    : !identity.present ? 'Ключи подтверждения пока не найдены'
      : identity.verified ? 'Подтверждён нативным SDK' : 'Ожидает подтверждения';
}

export function trustConfirmed(status: TrustStatus, target: 'own' | 'peer', userId: string): boolean {
  const own = status.ownIdentity, peer = status.peerIdentity;
  return status.deviceState === 'verified' && own.present && own.verified && !own.violation &&
    (target === 'own' ? own.userId === userId
      : !!peer && peer.userId === userId && peer.present && peer.verified && !peer.violation);
}

export function trustPendingText(status: TrustStatus, target: 'own' | 'peer'): string {
  if (status.ownIdentity.violation || (target === 'peer' && status.peerIdentity?.violation)) {
    return 'Ранее подтверждённые ключи изменились. Доверие не подтверждено.';
  }
  if (status.deviceState !== 'verified' || !status.ownIdentity.present || !status.ownIdentity.verified) {
    return 'SDK ещё не подтвердил Tecno или первый аккаунт. Открой Element на Компьютере с тем же аккаунтом и проверь состояние сессии Tecno.';
  }
  return 'Tecno и первый аккаунт подтверждены. SDK пока не подтвердил ключи аккаунта iPad. Нажми «Проверить статус доверия»: приложение подождёт обновления, без нового сравнения эмодзи. Если статус не изменится, сохрани этапы проверки во вкладке «Диагностика».';
}
