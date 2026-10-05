function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      reject(new Error('Aborted'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', cancel);
    if (signal.aborted) cancel();
  });
}

// Room creation can produce a local placeholder before required state arrives
// through sync. Unknown must never count as NotEncrypted (or as Encrypted).
export async function waitForEncryptionState(
  readState: (signal: AbortSignal) => Promise<number>,
  expected: number,
  signal: AbortSignal,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const controller = new AbortController();
  let timedOut = false;
  let lastState: number | undefined;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel);
  if (signal.aborted) cancel();
  const deadline = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    while (true) {
      if (controller.signal.aborted) throw new Error('Aborted');
      lastState = await readState(controller.signal);
      if (controller.signal.aborted) throw new Error('Aborted');
      if (lastState === expected) return;
      await pause(options.intervalMs ?? 400, controller.signal);
    }
  } catch (error) {
    if (timedOut && !signal.aborted) {
      const observed = lastState === 0 ? 'включено' : lastState === 1 ? 'выключено' : 'неизвестно';
      throw new Error(`Настройка сервера проверена, но SDK не успел получить ожидаемое состояние шифрования за ${Math.ceil(timeoutMs / 1000)} секунд (SDK: ${observed}). Сообщение не отправлено. Повторите проверку позже.`);
    }
    throw error;
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener('abort', cancel);
  }
}
