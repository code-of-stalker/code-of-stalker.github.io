import { useThemeColors, useThemeStyles } from '../ProductTheme';
import type { ProductColors } from '../theme';
import { MotionModal } from '../motion/MotionModal';
import { Image } from 'expo-image';
import type { ImageSource } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ProductSettings } from '../content';
import { Panel, ProductButton, ProductIconButton, ProductScreen, ProductText, ProductTypography } from '../ui';
import { useEffectsDiagnostics } from '../motion/EffectsQuality';
import { diagnosticsPreference } from '../motion/EffectsController';
import { useBackSwipe } from '../navigation/BackSwipeProvider';
import { ProductToggle } from '../ProductToggle';
import { BackupSection } from '../settings/BackupSection';
import { qualityNames } from '../motion/effectQuality';
import { ObservationIcon } from '../ObservationControls';
import { MicrophoneSettings } from '../settings/MicrophoneSettings';

export type SettingsScreenProps = {
  settings: ProductSettings;
  onChange: (settings: Partial<ProductSettings>) => void;
  onBack: () => void;
  onPreviewCooldown: () => void;
  onOpenSecondStep: () => void;
  onOpenThirdStep: () => void;
  onOpenFourthStep: () => void;
  onReset: () => Promise<void>;
  resetting?: boolean;
};

const assets = {
  theme: require('../../../../assets/product/settings-theme.svg'),
  startup: require('../../../../assets/product/settings-startup.svg'),
  radioOn: require('../../../../assets/product/settings-radio-on.svg'),
  radioOff: require('../../../../assets/product/settings-radio-off.svg'),
};

function SectionHeading({ title, icon }: { title: string; icon: ImageSource }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.sectionHeading}>
      <Image source={icon} tintColor={colors.iconTint} style={styles.sectionIcon} contentFit="contain" />
        <ProductText variant="title" numberOfLines={1} style={styles.sectionTitle}>{title}</ProductText>
    </View>
  );
}

function RadioRow({ label, detail, selected, onPress, disabled = false }: { label: string; detail?: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} aria-checked={selected} aria-disabled={disabled} accessibilityLabel={label} onPress={onPress} disabled={disabled} style={[styles.radioRow, disabled && styles.disabledRow]}>
      <Image source={selected ? assets.radioOn : assets.radioOff} tintColor={colors.iconTint} style={styles.radioImage} contentFit="contain" />
      <View style={styles.optionCopy}>
        <ProductText variant="label" style={[styles.optionLabel, { color: selected ? colors.text : colors.muted }]}>{label}</ProductText>
        {detail ? <ProductText variant="label" style={styles.optionDetail}>{detail}</ProductText> : null}
      </View>
    </Pressable>
  );
}

function ToggleRow({ label, detail, enabled, onToggle }: { label: string; detail: string; enabled: boolean; onToggle: () => void }) {
  const styles = useThemeStyles(createStyles);
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: enabled }} aria-checked={enabled} accessibilityLabel={label} accessibilityHint={detail} onPress={onToggle} style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <ProductText variant="title" style={styles.sectionTitle}>{label}</ProductText>
        <ProductText variant="label" style={styles.toggleDescription}>{detail}</ProductText>
      </View>
      <ProductToggle enabled={enabled} />
    </Pressable>
  );
}

export function SettingsScreen({ settings, onChange, onBack, onPreviewCooldown, onOpenSecondStep, onOpenThirdStep, onOpenFourthStep, onReset, resetting = false }: SettingsScreenProps) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const [confirmReset, setConfirmReset] = useState(false), [resetError, setResetError] = useState('');
  useBackSwipe(() => { if (confirmReset) setConfirmReset(false); else onBack(); });
  const effectDiagnostics = useEffectsDiagnostics();
  async function reset() {
    if (resetting) return;
    setResetError('');
    try { await onReset(); }
    catch (problem) { setResetError(problem instanceof Error ? problem.message : 'Не удалось сбросить данные. Попробуй ещё раз.'); }
  }
  return (
    <ProductTypography section="settings"><ProductScreen contentStyle={[styles.screen, { paddingTop: 0, paddingBottom: 24 }]} headerStyle={{ paddingTop: 16 }} header={
      <View style={styles.header}>
        <ProductIconButton icon="back" onPress={onBack} />
        <View style={styles.heading}>
          <ProductText variant="title" numberOfLines={1} style={styles.title}>НАСТРОЙКИ</ProductText>
          <ProductText variant="label" style={styles.subtitle}>ТВОЕГО РИТМА</ProductText>
        </View>
        <View style={styles.headerBalance} />
      </View>}>
      <View style={styles.settings}>
        <View style={styles.divider} />
        <View style={styles.section}>
          <SectionHeading title="Тема" icon={assets.theme} />
          <View accessibilityRole="radiogroup" accessibilityLabel="Тема приложения">
            <RadioRow label="ТИШИНА" selected={settings.theme === 'neutral'} onPress={() => onChange({ theme: 'neutral' })} />
            <RadioRow label="ИСКРА" selected={settings.theme === 'dark' || settings.theme === 'system'} onPress={() => onChange({ theme: 'dark' })} />
            <RadioRow label="ДЮНА" selected={settings.theme === 'light'} onPress={() => onChange({ theme: 'light' })} />
            <RadioRow label="АСТРАЛ" selected={settings.theme === 'violet'} onPress={() => onChange({ theme: 'violet' })} />
            <RadioRow label="МАТРИЦА" selected={settings.theme === 'matrix'} onPress={() => onChange({ theme: 'matrix' })} />
            <RadioRow label="МИРАЖ" selected={settings.theme === 'mirage'} onPress={() => onChange({ theme: 'mirage' })} />
            <RadioRow label="РАССВЕТ" selected={settings.theme === 'dawn'} onPress={() => onChange({ theme: 'dawn' })} />
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.section}>
          <SectionHeading title="При открытии приложения" icon={assets.startup} />
          <View accessibilityRole="radiogroup" accessibilityLabel="При открытии приложения">
            <RadioRow label="ГЛАВНАЯ" selected={settings.startAt === 'home'} onPress={() => onChange({ startAt: 'home' })} />
            <RadioRow label="ПОСЛЕДНИЙ ШАГ АРХИТЕКТУРЫ" detail="ПРОДОЛЖИТЬ С МЕСТА ОСТАНОВКИ" selected={settings.startAt === 'architecture'} onPress={() => onChange({ startAt: 'architecture' })} />
            <RadioRow label="ДНЕВНИК" selected={settings.startAt === 'diary'} onPress={() => onChange({ startAt: 'diary' })} />
          </View>
        </View>
        <MicrophoneSettings value={settings.microphoneDeviceId} onChange={deviceId => onChange({ microphoneDeviceId: deviceId })} renderOption={props => <RadioRow {...props} />} />
        <View style={styles.divider} />
        <View accessibilityRole="radiogroup" accessibilityLabel="Качество эффектов">
          <ProductText variant="title" style={styles.sectionTitle}>Качество эффектов</ProductText>
          {(['high', 'balanced', 'economy'] as const).map(quality => <RadioRow key={quality} label={qualityNames[quality].toUpperCase()}
            selected={(settings.effectQuality ?? 'high') === quality} onPress={() => onChange({ effectQuality: quality })} />)}
        </View>
        <View style={styles.divider} />
        <ToggleRow label="Плавность" detail={(settings.smoothness ?? true) ? `ЦЕЛЬ — ${settings.effectTargetFps ?? 60} FPS. КАЧЕСТВО ЭФФЕКТОВ ПОДСТРАИВАЕТСЯ АВТОМАТИЧЕСКИ` : 'ФИКСИРОВАННОЕ КАЧЕСТВО ЭФФЕКТОВ. ЦЕЛЬ — 60 FPS'} enabled={settings.smoothness ?? true} onToggle={() => onChange({ smoothness: !(settings.smoothness ?? true) })} />
        {(settings.smoothness ?? true) && <View accessibilityRole="radiogroup" accessibilityLabel="Целевая плавность">
          {([60,90,120] as const).map(fps=><RadioRow key={fps} label={`${fps} FPS`} selected={(settings.effectTargetFps ?? 60)===fps} onPress={()=>onChange({effectTargetFps:fps})}/>)}</View>}
        <View style={styles.divider} />
        <ToggleRow label="Диагностика эффектов" detail="УРОВЕНЬ КАЧЕСТВА И ПЛАВНОСТЬ ДЛЯ ПРОВЕРКИ НА УСТРОЙСТВЕ" enabled={effectDiagnostics} onToggle={() => diagnosticsPreference.set(!effectDiagnostics)} />
        <View style={styles.divider} />
        <ToggleRow label="Всё открыто" detail="ПРОСМОТР ГОТОВЫХ ШАГОВ БЕЗ ПРОХОЖДЕНИЯ И ОЖИДАНИЯ СУТОК. ПРОХОЖДЕНИЕ НЕ ЗАСЧИТЫВАЕТСЯ."
          enabled={settings.testUnlockAll ?? false} onToggle={() => onChange({ testUnlockAll: !settings.testUnlockAll })} />
        {settings.testUnlockAll && <>
          <ProductButton label="ОТКРЫТЬ ВТОРОЙ ШАГ" kind="outline" onPress={onOpenSecondStep} />
          <ProductButton label="ОТКРЫТЬ ТРЕТИЙ ШАГ" kind="outline" onPress={onOpenThirdStep} />
          <ProductButton label="ОТКРЫТЬ ЧЕТВЁРТЫЙ ШАГ" kind="outline" onPress={onOpenFourthStep} />
        </>}
        <View style={styles.divider} />
        <Pressable accessibilityRole="button" accessibilityLabel="Второй шаг с таймером"
          accessibilityHint="Открыть тестовый экран ожидания второго шага" onPress={onPreviewCooldown} style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <ProductText variant="title" style={styles.sectionTitle}>Второй шаг с таймером</ProductText>
            <ProductText variant="label" style={styles.toggleDescription}>ОТКРЫТЬ ТЕСТОВЫЙ ЭКРАН ОЖИДАНИЯ</ProductText>
          </View>
          <View style={styles.previewArrow}><ObservationIcon name="arrow" size={16} /></View>
        </Pressable>
        <View style={styles.divider} />
        <BackupSection />
        <View style={styles.section}>
          <ProductText variant="title" style={styles.sectionTitle}>Начать заново</ProductText>
          <ProductText style={styles.resetDescription}>Удалить записи, прогресс и настройки с этого устройства.</ProductText>
          <ProductButton label="СБРОСИТЬ ВСЁ" kind="outline" disabled={resetting}
            onPress={() => { setResetError(''); setConfirmReset(true); }} />
        </View>
      </View>
    </ProductScreen>
      <MotionModal visible={confirmReset} transparent animationType="fade"
        onRequestClose={() => { if (!resetting) setConfirmReset(false); }}>
        <View style={styles.resetBackdrop}><Panel filled style={styles.resetPanel}>
          <ProductText variant="title">НАЧАТЬ ЗАНОВО?</ProductText>
          <ProductText style={styles.resetDescription}>Все записи, прогресс и настройки будут удалены. Затем заново подберём настройки для этого устройства.</ProductText>
          {resetError ? <ProductText accessibilityRole="alert" color={colors.error}>{resetError}</ProductText> : null}
          <ProductButton label={resetting ? 'СБРАСЫВАЕМ…' : 'УДАЛИТЬ ВСЁ И НАЧАТЬ'} disabled={resetting} onPress={() => { void reset(); }} />
          <ProductButton label="ОТМЕНА" kind="outline" disabled={resetting} onPress={() => setConfirmReset(false)} />
        </Panel></View>
      </MotionModal>
    </ProductTypography>
  );
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  screen: { paddingTop: 0, paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 },
  heading: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3 },
  title: { fontSize: 20, lineHeight: 28 },
  subtitle: { fontSize: 8, lineHeight: 12, letterSpacing: 4.96 },
  headerBalance: { width: 44, height: 44 },
  settings: { marginTop: 8, gap: 16 },
  divider: { height: 0.75, backgroundColor: colors.accent, opacity: 0.2 },
  section: { gap: 8 },
  sectionHeading: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { width: 15, height: 15 },
  sectionTitle: { fontSize: 14, lineHeight: 18 },
  radioRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 10 },
  disabledRow: { opacity: 0.45 },
  radioImage: { width: 14, height: 16 },
  optionCopy: { flex: 1, gap: 4, paddingVertical: 4 },
  optionLabel: { fontSize: 10, lineHeight: 14 },
  optionDetail: { fontSize: 8, lineHeight: 12, letterSpacing: 2.2, color: colors.faint },
  toggleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 16 },
  toggleCopy: { flex: 1, gap: 8 },
  toggleDescription: { color: colors.muted, fontSize: 10, lineHeight: 13 },
  previewArrow: { width: 16, height: 16, marginHorizontal: 10 },
  resetDescription: { color: colors.muted, lineHeight: 18 },
  resetBackdrop: { flex: 1, backgroundColor: colors.background === '#000000' ? '#000c' : colors.overlay, justifyContent: 'center', padding: 16 },
  resetPanel: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 16 },
});
