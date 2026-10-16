import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { ProductButton, ProductText } from '../ui';
import { PanelBorder } from '../PanelBorder';
import { useThemeColors } from '../ProductTheme';
import { BottomSheet } from '../motion/BottomSheet';
import { useProduct } from '../state/ProductProvider';
import { BACKUP_MAX_MEGABYTES, clearBackup } from '../state/backup-model';
import type { BackupData } from '../state/backup-model';
import { decryptBackup } from '../state/backup-crypto';
import { chooseBackup, readBackupFile } from '../state/backup-files.web';
import { storageProtection } from '../state/storage-protection';
import type { StorageProtection } from '../state/storage-protection';

import { DiaryDesignPanel } from '../diary/DiaryDesignPanel';
import { BackupExportForm } from './BackupExportForm';

const bytesLabel = (bytes: number) => `${(bytes / 1048576).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`;
export function BackupSection() {
  const colors = useThemeColors();
  const product = useProduct();
  const [now] = useState(() => Date.now());
  const [protection, setProtection] = useState<StorageProtection | null>(null);
  const [mode, setMode] = useState<'export' | 'import' | null>(null), [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null), [prepared, setPrepared] = useState<BackupData | null>(null);
  const sensitive = useRef<BackupData | null>(null), alive = useRef(true), inFlight = useRef(false);
  const cleanupRequested = useRef(false);
  useEffect(() => {
    alive.current = true;
    const refresh = () => { void storageProtection().then(value => { if (alive.current) setProtection(value); }).catch(() => { if (alive.current) setProtection({ state: 'unsupported' }); }); };
    refresh(); window.addEventListener('watcher-storage-protection', refresh);
    return () => { alive.current = false; window.removeEventListener('watcher-storage-protection', refresh); if (!inFlight.current) clearBackup(sensitive.current); };
  }, []);
  const resetSheet = () => {
    if (inFlight.current) { cleanupRequested.current = true; return; }
    cleanupRequested.current = false;
    clearBackup(sensitive.current); sensitive.current = null; setPrepared(null); setPassword(''); setFile(null); setMode(null); setError('');
  };
  const close = () => { if (!inFlight.current) setOpen(false); };
  async function run(work: () => Promise<void>) {
    if (inFlight.current || product.resetting) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try { await work(); }
    catch (problem) { if (alive.current) setError(problem instanceof Error ? problem.message : 'Не удалось выполнить действие. Текущие записи не изменены.'); }
    finally {
      inFlight.current = false;
      if (alive.current) { setBusy(false); if (cleanupRequested.current) resetSheet(); }
      else clearBackup(sensitive.current);
    }
  }
  function startExport() { resetSheet(); setMode('export'); setOpen(true); setNotice(''); }
  async function pickFile() {
    await run(async () => {
      const selected = await chooseBackup();
      if (!selected || !alive.current) return;
      clearBackup(sensitive.current); sensitive.current = null; setPrepared(null); setPassword(''); setError('');
      setFile(selected); setMode('import'); setOpen(true);
    });
  }
  async function checkCopy() {
    await run(async () => {
      if (!file) throw new Error('Сначала выбери файл копии.');
      const data = await decryptBackup(await readBackupFile(file), password);
      if (!alive.current) { clearBackup(data); return; }
      sensitive.current = data; setPrepared(data); setPassword('');
    });
  }
  async function restoreCopy() {
    await run(async () => {
      if (!prepared) return;
      await product.restoreBackup(prepared);
      clearBackup(prepared); sensitive.current = null;
      if (alive.current) { setOpen(false); setNotice('Записи восстановлены. Уже имеющиеся записи сохранены.'); }
      void storageProtection().then(value => { if (alive.current) setProtection(value); }).catch(() => {});
    });
  }
  const lastBackup = product.settings.lastBackupAt;
  const protectedStorage = protection?.state === 'protected';
  const inputStyle = [styles.input, { color: colors.text }];
  return <>
    <View style={styles.section}>
      <ProductText variant="title" style={styles.title}>Хранение записей</ProductText>
      <ProductText style={[styles.copy, { color: colors.muted }]}>{!protection ? 'Проверяем хранение…' : protectedStorage ? 'Защита от автоматической очистки включена.' : protection.state === 'unsupported' ? 'Браузер не позволяет включить защиту от автоматической очистки.' : 'Браузер пока не предоставил защиту от автоматической очистки.'}</ProductText>
      <ProductText style={[styles.copy, { color: colors.muted }]}>Ручная очистка данных сайта всё равно удалит записи. Резервная копия хранится отдельным файлом.</ProductText>
      {protection?.usage !== undefined && <ProductText style={[styles.copy, { color: colors.muted }]}>Занято {bytesLabel(protection.usage)}{protection.quota ? ` из доступных ${bytesLabel(protection.quota)}` : ''}.</ProductText>}
      {protection?.state === 'standard' && <ProductButton label={busy && !open ? 'ПРОВЕРЯЕМ…' : 'ВКЛЮЧИТЬ ЗАЩИТУ ХРАНЕНИЯ'} kind="outline" disabled={busy || product.resetting} onPress={() => { void run(async () => {
        const value = await storageProtection(true);
        if (alive.current) { setProtection(value); setNotice(value.state === 'protected' ? 'Браузер предоставил защиту хранения.' : 'Браузер не предоставил защиту. Сохраняй резервные копии.'); }
      }); }} />}
    </View>
    <View style={[styles.divider, { backgroundColor: colors.accent }]} />
    <View style={styles.section}>
      <ProductText variant="title" style={styles.title}>Резервные копии</ProductText>
      <ProductText style={[styles.copy, { color: colors.muted }]}>Все тексты и голосовые записи, отчёты, ответы Архитектуры, отметки, настройки и прогресс — в файле с паролем. Размер одной копии — до {BACKUP_MAX_MEGABYTES} МБ.</ProductText>
      <ProductText style={[styles.copy, { color: colors.muted }]}>{lastBackup ? `Последнее создание: ${new Date(lastBackup).toLocaleString('ru-RU')}.${now - lastBackup >= 7 * 86400000 ? ' Пора обновить копию.' : ''}` : 'Копия ещё не создавалась. Сохрани её после важных записей.'}</ProductText>
      <ProductButton label="СОЗДАТЬ РЕЗЕРВНУЮ КОПИЮ" kind="outline" disabled={busy || product.resetting} onPress={startExport} />
      <ProductButton label="ВОССТАНОВИТЬ ИЗ ФАЙЛА" kind="outline" disabled={busy || product.resetting} onPress={() => { void pickFile(); }} />
      {!!notice && <ProductText accessibilityLiveRegion="polite" style={styles.copy}>{notice}</ProductText>}
      {!!error && !open && <ProductText accessibilityRole="alert" style={[styles.copy, { color: colors.error }]}>{error}</ProductText>}
    </View>
    <View style={[styles.divider, { backgroundColor: colors.accent }]} />
    <BottomSheet open={open} onClose={close} onDismiss={resetSheet}>
      <DiaryDesignPanel title={mode === 'export' ? 'ЛОКАЛЬНАЯ КОПИЯ' : 'ВОССТАНОВЛЕНИЕ'} contentStyle={styles.sheetContent}>
          {mode === 'export' && <BackupExportForm onCancel={close} onBusyChange={value => { inFlight.current = value; if (alive.current) { setBusy(value); if (!value && cleanupRequested.current) resetSheet(); } }} onCreated={() => { setOpen(false); setNotice('Копия создана и передана браузеру. Сохрани файл отдельно от данных сайта.'); }} />}
          {mode === 'import' && !prepared && <>
            <ProductText style={[styles.copy, { color: colors.muted }]} numberOfLines={2}>{file?.name}</ProductText>
            <ProductText style={[styles.copy, { color: colors.muted }]}>Введи пароль, с которым создавалась копия. Сначала проверим файл; текущие записи не изменятся.</ProductText>
            <View style={styles.field}><PanelBorder /><TextInput accessibilityLabel="Пароль для восстановления" placeholder="ПАРОЛЬ КОПИИ" placeholderTextColor={colors.muted} secureTextEntry autoComplete="off" autoCapitalize="none" autoCorrect={false} editable={!busy} value={password} onChangeText={setPassword} style={inputStyle} maxLength={512} /></View>
            <ProductButton label={busy ? 'ПРОВЕРЯЕМ КОПИЮ…' : 'ПРОВЕРИТЬ КОПИЮ'} disabled={busy} onPress={() => { void checkCopy(); }} />
          </>}
          {mode === 'import' && prepared && <>
            <ProductText style={styles.copy}>Копия от {new Date(prepared.createdAt).toLocaleString('ru-RU')}.</ProductText>
            <ProductText style={styles.copy}>Ответов Архитектуры: {prepared.snapshot.observations.length}. Записей дневника: {prepared.snapshot.diaryEntries?.length ?? 0}. Голосовых файлов: {prepared.audio.length}.</ProductText>
            <ProductText style={[styles.copy, { color: colors.muted }]}>Добавим записи из копии. Совпадающие записи не дублируются. При наличии текущих записей или прогресса сохраним твои настройки и прогресс; в пустом приложении восстановим их из копии.</ProductText>
            <ProductButton label={busy ? 'ВОССТАНАВЛИВАЕМ…' : 'ВОССТАНОВИТЬ ЗАПИСИ'} disabled={busy} onPress={() => { void restoreCopy(); }} />
          </>}
          {!!error && <ProductText accessibilityRole="alert" style={[styles.copy, { color: colors.error }]}>{error}</ProductText>}
          {mode !== 'export' && <ProductButton label="ОТМЕНА" kind="ghost" disabled={busy} onPress={close} />}
      </DiaryDesignPanel>
    </BottomSheet>
  </>;
}
const styles = StyleSheet.create({
  section: { gap: 10 }, title: { fontSize: 14, lineHeight: 20 }, copy: { fontSize: 10, lineHeight: 16 },
  divider: { height: 0.75, opacity: 0.2 },
  sheetContent: { gap: 14 },
  field: { minHeight: 48, position: 'relative' }, input: { minHeight: 48, width: '100%', padding: 12, fontSize: 16, lineHeight: 22 },
});
