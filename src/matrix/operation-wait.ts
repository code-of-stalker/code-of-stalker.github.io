export type OperationSettlement = {
  settled: Promise<void>;
  isPending: () => boolean;
};

// Cancelling the screen's wait must not wait for native cancellation/cleanup.
// Keep the actual work tracked: its client and handles remain owned until it
// settles, and callers must not start another operation or dispose them early.
export function observeOperation<T>(work: Promise<T>, signal: AbortSignal): OperationSettlement & { result: Promise<T> } {
  let pending = true;
  const settled = work.then(() => { pending = false; }, () => { pending = false; });
  const result = new Promise<T>((resolve, reject) => {
    const cancel = () => {
      signal.removeEventListener('abort', cancel);
      reject(new Error('Aborted'));
    };
    signal.addEventListener('abort', cancel, { once: true });
    // Handle both late success and late failure, without publishing either as
    // the result of a cancelled wait. settled still tracks the real cleanup.
    void work.then((value) => {
      signal.removeEventListener('abort', cancel);
      if (signal.aborted) cancel(); else resolve(value);
    }, (error: unknown) => {
      signal.removeEventListener('abort', cancel);
      if (signal.aborted) cancel(); else reject(error);
    });
    if (signal.aborted) cancel();
  });
  return { result, settled, isPending: () => pending };
}
