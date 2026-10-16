import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { ProductButton, ProductText } from '../ui';
import { PanelBorder } from '../PanelBorder';
import { useThemeColors } from '../ProductTheme';
import { useProduct } from '../state/ProductProvider';
import { BACKUP_MAX_MEGABYTES, clearBackup } from '../state/backup-model';
import { encryptBackup, validateBackupPassword } from '../state/backup-crypto';
import { downloadBackup } from '../state/backup-files.web';
import { useWebUpdateBlock } from '../updates/webUpdateSafety';
import type { BackupExportFormProps } from './BackupExportForm.types';

/** Shared export flow, rendered inside the current sheet rather than another modal. */
export function BackupExportForm({ onCancel, onCreated, onBusyChange }: BackupExportFormProps) {
  const colors = useThemeColors(), product = useProduct();
  const [password, setPassword] = useState(''), [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), inFlight = useRef(false);
  useWebUpdateBlock(busy);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function saveCopy() {
    if (inFlight.current || product.resetting) return;
    inFlight.current = true; setBusy(true); setError(''); onBusyChange(true);
    try {
      validateBackupPassword(password);
      if (password !== repeat) throw new Error('Пароли не совпадают.');
      const data = await product.createBackup();
      try {
        const encrypted = await encryptBackup(data, password);
        if (!alive.current) return;
        downloadBackup(encrypted, data.createdAt);
        await product.updateSettings({ lastBackupAt: data.createdAt });
        if (alive.current) { setPassword(''); setRepeat(''); onCreated(); }
      } finally { clearBackup(data); }
    } catch (problem) {
      if (alive.current) setError(problem instanceof Error ? problem.message : 'Не удалось создать копию. Попробуй ещё раз.');
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
      onBusyChange(false);
    }
  }
  return <View testID="backup-export-form" style={styles.root}>
    <ProductText style={[styles.copy, { color: colors.muted }]}>Локальная копия базы данных содержит тексты, аудиозаписи, настройки и прогресс. Размер файла — до {BACKUP_MAX_MEGABYTES} МБ.</ProductText>
    <ProductText style={[styles.copy, { color: colors.muted }]}>Придумай пароль от 12 символов. Он нужен для восстановления на другом адресе или устройстве. Пароль не сохраняется; восстановить забытый пароль невозможно.</ProductText>
    {([['Пароль резервной копии', 'ПАРОЛЬ КОПИИ', password, setPassword], ['Повтор пароля резервной копии', 'ПОВТОРИ ПАРОЛЬ', repeat, setRepeat]] as const).map(([label, placeholder, value, change]) => <View key={label} style={styles.field}><PanelBorder /><TextInput accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={colors.muted} secureTextEntry autoComplete="new-password" autoCapitalize="none" autoCorrect={false} editable={!busy} value={value} onChangeText={change} style={[styles.input, { color: colors.text }]} maxLength={512} /></View>)}
    {!!error && <ProductText accessibilityRole="alert" style={[styles.copy, { color: colors.error }]}>{error}</ProductText>}
    <ProductButton label={busy ? 'СОЗДАЁМ КОПИЮ…' : 'СОХРАНИТЬ ФАЙЛ КОПИИ'} disabled={busy || product.resetting} onPress={() => { void saveCopy(); }} />
    <ProductButton label="ОТМЕНА" kind="ghost" disabled={busy} onPress={onCancel} />
  </View>;
}
const styles = StyleSheet.create({
  root: { gap: 14 }, copy: { fontSize: 10, lineHeight: 16 },
  field: { minHeight: 48, position: 'relative' },
  input: { minHeight: 48, width: '100%', padding: 12, fontSize: 16, lineHeight: 22 },
});
