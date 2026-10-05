export type RecoveryReadiness = {
  serverBackupExists: boolean;
  backupState: 'ready' | 'working' | 'unknown';
  recoveryState: 'ready' | 'disabled' | 'incomplete' | 'unknown';
};

// The SDK's Unknown backup state does not mean the homeserver has no backup.
// Keep that fact separate from the explicit network check.
export function recoveryReadiness(serverBackupExists: boolean, backupState: number, recoveryState: number): RecoveryReadiness {
  return {
    serverBackupExists,
    backupState: backupState === 4 ? 'ready' : [1, 2, 3, 5, 6].includes(backupState) ? 'working' : 'unknown',
    recoveryState: recoveryState === 1 ? 'ready' : recoveryState === 2 ? 'disabled' : recoveryState === 3 ? 'incomplete' : 'unknown',
  };
}
