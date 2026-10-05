import type { SessionVerificationData } from '@unomed/react-native-matrix-sdk';
import type { SasData } from './trust-types';

// Show only the short authentication strings supplied by the native protocol.
// They are neither generated in JS nor approved automatically.
export function sasData(data: SessionVerificationData, userId: string): SasData {
  if (data.tag === 'Emojis') {
    if (data.inner.emojis.length !== 7) throw new Error('SDK вернул неполный набор эмодзи. Подтверждение не выполнено.');
    const values = data.inner.emojis.map((emoji) => ({ symbol: emoji.symbol(), description: emoji.description() }));
    if (values.some(({ symbol, description }) => !symbol || symbol.length > 32 || !description || description.length > 120)) {
      throw new Error('SDK вернул некорректные эмодзи. Подтверждение не выполнено.');
    }
    return { userId, kind: 'emojis', values };
  }
  if (data.tag === 'Decimals') {
    const values = [...data.inner.values];
    if (values.length !== 3 || values.some((value) => !Number.isInteger(value) || value < 1000 || value > 9191)) {
      throw new Error('SDK вернул некорректные числа сравнения. Подтверждение не выполнено.');
    }
    return { userId, kind: 'decimals', values };
  }
  throw new Error('SDK вернул неподдерживаемый способ сравнения. Подтверждение не выполнено.');
}
