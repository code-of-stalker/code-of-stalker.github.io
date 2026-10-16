import type { ReactNode } from 'react';
export type MicrophoneSettingsProps = {
  value?: string; onChange(value: string): void;
  renderOption(props: { label: string; selected: boolean; onPress(): void }): ReactNode;
};
