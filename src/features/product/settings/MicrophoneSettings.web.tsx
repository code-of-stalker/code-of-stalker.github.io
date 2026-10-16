import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ProductButton, ProductText } from '../ui';
import { useThemeColors } from '../ProductTheme';
import { listMicrophoneInputs, microphoneError, openMicrophone, type MicrophoneInput } from '../audio/microphone-input';
import type { MicrophoneSettingsProps } from './MicrophoneSettings.types';

export function MicrophoneSettings({ value = '', onChange, renderOption }: MicrophoneSettingsProps) {
  const colors = useThemeColors(), alive = useRef(true);
  const [inputs, setInputs] = useState<MicrophoneInput[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const media = globalThis.navigator?.mediaDevices;
  const refresh = useCallback(async () => {
    if (!media) return;
    try { const next = await listMicrophoneInputs(media); if (alive.current) setInputs(next); } catch { /* Permission button can retry enumeration. */ }
  }, [media]);
  useEffect(() => {
    alive.current = true;
    if (media) void listMicrophoneInputs(media).then(next => { if (alive.current) setInputs(next); }).catch(() => {});
    media?.addEventListener?.('devicechange', refresh);
    return () => { alive.current = false; media?.removeEventListener?.('devicechange', refresh); };
  }, [media, refresh]);
  async function showInputs() {
    if (!media || loading) return;
    setLoading(true); setError('');
    try {
      const opened = await openMicrophone(media, '', () => alive.current);
      try { await refresh(); } finally { opened.stream.getTracks().forEach(track => track.stop()); }
    } catch (problem) { if (alive.current) setError(microphoneError(problem)); }
    finally { if (alive.current) { setLoading(false); void refresh(); } }
  }
  return <View testID="microphone-settings" style={styles.section}>
    <View style={[styles.divider, { backgroundColor: colors.accent }]} />
    <ProductText variant="title" style={styles.title}>Микрофон</ProductText>
    <ProductText variant="label" color={colors.muted}>Подключи микрофон и выбери источник. Здесь видны устройства, доступные браузеру.</ProductText>
    <View accessibilityRole="radiogroup" accessibilityLabel="Источник записи">
      {renderOption({ label: 'АВТОМАТИЧЕСКИ', selected: !value, onPress: () => onChange('') })}
      {inputs.map(input => <View key={input.deviceId}>{renderOption({ label: input.label, selected: value === input.deviceId, onPress: () => onChange(input.deviceId) })}</View>)}
    </View>
    <ProductButton label={loading ? 'ОТКРЫВАЕМ МИКРОФОНЫ…' : 'ПОКАЗАТЬ МИКРОФОНЫ'} kind="outline" disabled={loading || !media?.getUserMedia} onPress={() => { void showInputs(); }} />
    {value && !inputs.some(input => input.deviceId === value) && <ProductText variant="label" color={colors.muted}>Выбранный источник сейчас недоступен. Подключи его или выбери другой.</ProductText>}
    {!!error && <ProductText accessibilityRole="alert" color={colors.error}>{error}</ProductText>}
  </View>;
}
const styles = StyleSheet.create({ section: { gap: 8 }, title: { fontSize: 14, lineHeight: 18 }, divider: { height: .75, opacity: .2, marginBottom: 8 } });
