import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import type { ViewToken, ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useThemeColors, useThemeStyles } from '../ProductTheme';
import { fonts, type ProductColors } from '../theme';
import { BottomSheet } from '../motion/BottomSheet';
import { Image } from 'expo-image';
import { MatrixBackdrop } from '../motion/MatrixBackdrop';
import { HintPanel } from '../motion/HintPanel';
import { ProductToggle } from '../ProductToggle';
import { productLevels, productStepNames } from '../content';
import { useProduct } from '../state/ProductProvider';
import { useWebUpdateBlock } from '../updates/webUpdateSafety';
import { DIARY_TEXT_LIMIT, type DiaryCategory, type Observation } from '../state/model';
import { useProductLayout, useProductSpacing } from '../layout';
import { Panel, ProductButton, ProductIconButton, ProductScreen, ProductText } from '../ui';
import { DiaryGlass } from '../diary/DiaryGlass';
import { useBackSwipe, useBackSwipeBlocked } from '../navigation/BackSwipeProvider';
import { PanelBorder } from '../PanelBorder';
import { PanelArtwork } from '../motion/PanelArtwork';
import { diaryArtwork } from '../diary/diaryArtwork';
import { DiaryAsset, DiaryIcon, DiaryEntryIcon } from '../diary/DiaryIcons';
import { DiaryAudio } from '../diary/DiaryAudio';
import { DiaryRecordButton } from '../diary/DiaryRecordButton';
import { useDiaryVoice } from '../diary/useDiaryVoice';
import { DiaryDesignPanel, DiaryDesignAction } from '../diary/DiaryDesignPanel';
import { DiaryEditorPanel } from '../diary/DiaryEditorPanel';
import { RecordingReview } from '../RecordingReview';
import { DiaryFormattedText } from '../diary/DiaryFormattedText';
import { rebaseTextRuns, type DiaryTextRun } from '../diary/text-format';
import { BackupExportForm } from '../settings/BackupExportForm';
import { DiaryFilters } from '../diary/DiaryFilters';
import { useDiaryKeyboard } from '../diary/useDiaryKeyboard';
import { diaryClock, diaryDay, diaryQuestion, diaryMaterial, emptyDiaryFilter, filterDiary, isArchitecture, isAudioEntry, type DiaryFilter, type FeedEntry } from '../diary/feed';

export type DiaryScreenProps = { onBack(): void; onArchitecture(): void; onStep(record: Observation): Promise<void> };
type Sheet = 'filters' | 'report' | 'voice' | 'discard-voice' | 'info' | 'delete' | 'leave' | 'material' | 'editor' | 'backup' | null;
function dayLabel(time: number) {
  const today = new Date(), yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  return diaryDay(time) === diaryDay(today.getTime()) ? 'СЕГОДНЯ' : diaryDay(time) === diaryDay(yesterday.getTime()) ? 'ВЧЕРА' : new Date(time).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
}

export function DiaryScreen({ onBack, onArchitecture, onStep }: DiaryScreenProps) {
  const colors = useThemeColors(), styles = useThemeStyles(createStyles), { gutter } = useProductSpacing(), { width, height } = useWindowDimensions(), { air, icon } = useProductLayout();
  const { observations, diaryEntries = [], listenLater = [], settings, ready, resetting, error: storageError, retryLoad, updateSettings, saveDiaryText, deleteObservation, setListenLater } = useProduct();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const keyboard = useDiaryKeyboard();
  const [filter, setFilter] = useState<DiaryFilter>({ ...emptyDiaryFilter }), [collection, setCollection] = useState(false);
  const [selected, setSelected] = useState<string | null>(null), [expanded, setExpanded] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null), [deleteId, setDeleteId] = useState<string | null>(null);
  const [sheetKind, setSheetKind] = useState<Sheet>(null), [editorSession, setEditorSession] = useState(0);
  const [material, setMaterial] = useState<Observation | null>(null);
  const [text, setText] = useState(''), [category, setCategory] = useState<DiaryCategory>('observation');
  useWebUpdateBlock(!!text.trim());
  const [format, setFormat] = useState<DiaryTextRun[]>([]), [feedScrolled, setFeedScrolled] = useState(false);
  const feedViewport = useRef<View>(null);
  const composerHeight = width >= 375 ? 48 : 44;
  const [inputHeight, setInputHeight] = useState(composerHeight);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [today, setToday] = useState(() => diaryDay(Date.now()));
  const input = useRef<TextInput>(null), list = useRef<FlatList<FeedEntry>>(null), pending = useRef(false), marking = useRef(new Set<string>());
  const alive = useRef(true);
  const focusAfterSheet = useRef(false);
  const leaveAction = useRef(onBack);
  const voice = useDiaryVoice({ active: focused && foreground, enabled: ready && !busy && !resetting && sheet === null, category, onSaved: () => afterSave(true) });
  useBackSwipeBlocked(voice.capturing || voice.review);
  useEffect(() => {
    if (!voice.review) return;
    const frame = requestAnimationFrame(() => { Keyboard.dismiss(); setSelected(null); setSheetKind('voice'); setSheet('voice'); });
    return () => cancelAnimationFrame(frame);
  }, [voice.review]);
  const showArchitecture = settings.diaryShowArchitecture !== false, newest = settings.diaryNewestFirst !== false;
  const allEntries = useMemo(() => [...observations, ...diaryEntries], [observations, diaryEntries]);
  const entries = useMemo(() => filterDiary(allEntries, filter, showArchitecture, newest, collection ? listenLater : undefined), [allEntries, filter, showArchitecture, newest, collection, listenLater]);
  const reportsToday = diaryEntries.filter(entry => entry.category === 'dynamics' && diaryDay(entry.createdAt) === today).length;
  const activeFilter = Object.keys(emptyDiaryFilter).some(key => filter[key as keyof DiaryFilter] !== emptyDiaryFilter[key as keyof DiaryFilter]);
  const frames = useMemo(() => ({ prompt: diaryArtwork('prompt', colors), input: diaryArtwork('input', colors, true) }), [colors]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const css = document.createElement('style');
    const fields = 'textarea[data-testid="diary-text"], textarea[data-testid="diary-editor"]';
    css.textContent = `${fields}{overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;resize:none;overflow-wrap:anywhere;outline-style:none;scrollbar-width:thin;scrollbar-color:${colors.muted} transparent;scrollbar-gutter:stable}
      ${fields.split(', ').map(selector => `${selector}::-webkit-scrollbar`).join(',')}{width:4px;background:transparent}
      ${fields.split(', ').map(selector => `${selector}::-webkit-scrollbar-thumb`).join(',')}{background:${colors.muted};border-radius:2px}
      ${fields.split(', ').map(selector => `${selector}::-webkit-scrollbar-track`).join(',')}{background:transparent}
      ${fields.split(', ').map(selector => `${selector}::-webkit-scrollbar-button`).join(',')}{display:none;height:0}`;
    document.head.append(css);
    return () => css.remove();
  }, [colors.muted]);
  useEffect(() => {
    alive.current = true;
    const tick = () => setToday(diaryDay(Date.now()));
    const event = AppState.addEventListener('change', state => { setForeground(state === 'active'); if (state !== 'active') setSelected(null); else tick(); });
    const timer = setInterval(tick, 60000);
    return () => { alive.current = false; clearInterval(timer); event.remove(); };
  }, []);
  useEffect(() => { if (focused) return () => { setSelected(null); setSheet(null); focusAfterSheet.current = false; }; }, [focused]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer); }, [notice]);
  const trackVisibleRecords = useCallback(({ viewableItems }: { viewableItems: ViewToken<FeedEntry>[] }) => {
    const visible = new Set(viewableItems.map(item => item.item.id));
    setSelected(value => value && visible.has(value) ? value : null);
  }, []);
  function open(next: Sheet) { if (voice.capturing && next !== 'discard-voice') return; Keyboard.dismiss(); setSelected(null); setError(''); setSheetKind(next); if (next === 'editor') setEditorSession(value => value + 1); setSheet(next); }
  function closeSheet() { if (busy || voice.saving) return; if (sheet === 'voice') { leaveAction.current = () => {}; open('discard-voice'); } else if (sheet === 'discard-voice') { if (voice.review) { setSheetKind('voice'); setSheet('voice'); } else setSheet(null); } else if (sheet === 'editor') closeEditor(); else setSheet(null); }
  function changeText(value: string) { setFormat(current => rebaseTextRuns(text, value, current)); setText(value); }
  function leave(action: () => void) { if (busy || voice.saving) return; leaveAction.current = action; if (voice.capturing || voice.review) open('discard-voice'); else if (text.trim()) open('leave'); else { setSelected(null); action(); } }
  function back() { leave(onBack); }
  useBackSwipe(back);
  function switchCollection() { setSelected(null); setExpanded(null); setFilter({ ...emptyDiaryFilter }); setCollection(value => !value); }
  async function changeSettings(patch: Parameters<typeof updateSettings>[0]) {
    setSelected(null);
    try { await updateSettings(patch); list.current?.scrollToOffset({ offset: 0, animated: false }); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Не удалось сохранить настройку.'); }
  }
  function afterSave(preserveTextDraft = false) {
    setSheet(null); setFilter({ ...emptyDiaryFilter }); setCollection(false);
    if (!preserveTextDraft || !text.trim()) setCategory('observation');
    setNotice('ЗАПИСЬ СОХРАНЕНА');
    requestAnimationFrame(() => { if (newest) list.current?.scrollToOffset({ offset: 0, animated: true }); else list.current?.scrollToEnd({ animated: true }); });
  }
  async function sendText() {
    if (!text.trim() || !ready || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await saveDiaryText(text, category, format.length ? format : undefined); if (alive.current) { setText(''); setFormat([]); setInputHeight(composerHeight); Keyboard.dismiss(); afterSave(); } }
    catch (problem) { if (alive.current) setError(problem instanceof Error ? problem.message : 'Не удалось сохранить текст.'); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  async function mark(id: string) {
    if (marking.current.has(id)) return;
    marking.current.add(id);
    try { await setListenLater(id, !listenLater.includes(id)); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Не удалось сохранить отметку.'); }
    finally { marking.current.delete(id); }
  }
  async function remove() {
    if (!deleteId || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await deleteObservation(deleteId); if (alive.current) { setDeleteId(null); setSheet(null); } }
    catch (problem) { if (alive.current) setError(problem instanceof Error ? problem.message : 'Не удалось удалить запись.'); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  function startReport() { setCategory('dynamics'); setSheet(null); }
  async function recordAgain() { voice.player.pause(); await voice.discard(); setSheet(null); }
  async function visitStep(record: Observation) {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try { await onStep(record); }
    catch (problem) { if (alive.current) setError(problem instanceof Error ? problem.message : 'Не удалось открыть шаг.'); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  function closeEditor() { focusAfterSheet.current = true; setSheet(null); }
  return <>
    <ProductScreen scroll={false} contentStyle={styles.screen} background={<View testID="diary-background" pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: .32 }]}><MatrixBackdrop active={focused && foreground} reducedMotion={settings.reducedMotion} /></View>}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined} style={[styles.screen, keyboard.visible && { paddingBottom: keyboard.bottomInset }]}>
        <View style={[styles.header, { paddingHorizontal: gutter }, air > 1 && { paddingBottom: 10 + (air - 1) * 32 }]}>
          <ProductIconButton icon="back" onPress={back} />
          <ProductText variant="title" style={styles.title}>{'ДНЕВНИК\nСТАЛКЕРА'}</ProductText>
          <Pressable accessibilityRole="button" accessibilityLabel="Архитектура наблюдения" onPress={() => leave(onArchitecture)} style={[styles.architectureButton, { width: icon.width, height: icon.buttonHeight }]}><DiaryGlass shape="icon" style={{top:1,bottom:1}} /><DiaryAsset name="collection" transparentBackground size={icon} /></Pressable>
        </View>
        {!keyboard.visible && <><View style={[styles.tools, { marginHorizontal: gutter }, air > 1 && { marginBottom: (air - 1) * 16 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Выбрать даты записей" onPress={() => open('filters')} style={styles.dates}><DiaryAsset name="calendar" /><ProductText style={styles.dateLabel}>{filter.from || filter.to ? 'ПЕРИОД' : 'ВСЕ ДАТЫ'}</ProductText></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={newest ? 'Сначала новые. Показать сначала старые' : 'Сначала старые. Показать сначала новые'} onPress={() => { void changeSettings({ diaryNewestFirst: !newest }); }} style={styles.sort}><DiaryGlass /><PanelBorder color={colors.accent} /><DiaryAsset name="chevron" /><ProductText style={styles.sortLabel}>{newest ? 'СНАЧАЛА НОВЫЕ' : 'СНАЧАЛА СТАРЫЕ'}</ProductText></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Фильтры дневника" accessibilityState={{ expanded: sheet === 'filters' }} onPress={() => open('filters')} style={styles.filterButton}><DiaryIcon name="filter" size={18} />{activeFilter && <View style={styles.filterDot} />}</Pressable>
          <View style={styles.toolLine} />
        </View>
        <View style={[styles.sourceRow, { paddingHorizontal: gutter }]}>
          {collection ? <Pressable accessibilityRole="button" accessibilityLabel="Вернуться ко всем записям" onPress={switchCollection} style={styles.sourceToggle}><DiaryIcon name="bookmark" filled size={16} /><ProductText style={styles.sourceLabel}>К ПРОСЛУШИВАНИЮ</ProductText><DiaryIcon name="close" size={14} /></Pressable> :
            <Pressable accessibilityRole="switch" accessibilityLabel="Ответы архитектуры" accessibilityState={{ checked: showArchitecture }} aria-checked={showArchitecture} onPress={() => { void changeSettings({ diaryShowArchitecture: !showArchitecture }); }} style={styles.sourceToggle}>
              <ProductToggle enabled={showArchitecture} compact /><ProductText style={styles.sourceLabel}>ОТВЕТЫ АРХИТЕКТУРЫ</ProductText>
            </Pressable>}
          <ProductText style={styles.count}>{collection ? listenLater.length : observations.length}</ProductText>
          <Pressable accessibilityRole="button" accessibilityLabel={collection ? 'Вся лента дневника' : `К прослушиванию: ${listenLater.length}`} accessibilityState={{ selected: collection }} onPress={switchCollection} style={styles.collectionButton}><DiaryIcon name="bookmark" filled={collection} size={16} />{listenLater.length > 0 && !collection && <ProductText style={styles.badge}>{listenLater.length}</ProductText>}</Pressable>
        </View>
        {!collection && <Pressable accessibilityRole="button" accessibilityLabel="Добавить отчёт о динамике" disabled={!ready} onPress={() => open('report')} style={[styles.reportPrompt, { marginHorizontal: gutter }, air > 1 && { marginTop: (air - 1) * 16, marginBottom: 8 * air }]}>
          <DiaryGlass shape="panel" /><PanelArtwork source={frames.prompt} /><DiaryAsset name="sparkle" /><View style={styles.reportCopy}><ProductText variant="title" style={styles.reportTitle}>{reportsToday ? 'Сегодняшнее наблюдение сохранено' : 'Что ощутили сегодня?'}</ProductText><ProductText style={styles.reportHint}>{reportsToday ? 'ДОПОЛНИТЬ ОТЧЁТ О ДИНАМИКЕ' : 'ДОБАВИТЬ ОТЧЁТ ДИНАМИКИ'}</ProductText></View><DiaryIcon name="plus" />
        </Pressable>}
        {activeFilter && <Pressable accessibilityRole="button" accessibilityLabel="Сбросить активные фильтры" onPress={() => { setFilter({ ...emptyDiaryFilter }); setSelected(null); }} style={[styles.applied, { marginHorizontal: gutter }]}><ProductText style={styles.small}>ФИЛЬТРЫ · {entries.length} ЗАПИСЕЙ</ProductText><DiaryIcon name="close" size={14} /></Pressable>}</>}
        <View ref={feedViewport} testID="diary-feed-viewport" style={[styles.feed, Platform.OS === 'web' && { maskImage: 'linear-gradient(to bottom, transparent, #000 var(--diary-fade-top, 0px), #000 calc(100% - 24px), transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 var(--diary-fade-top, 0px), #000 calc(100% - 24px), transparent)' } as ViewStyle]}>
        <FlatList ref={list} testID="diary-feed" style={styles.feed} removeClippedSubviews={false} scrollEventThrottle={16}
          onScroll={event => { const offset = event.nativeEvent.contentOffset.y;
            if (Platform.OS === 'web') (feedViewport.current as unknown as HTMLElement | null)?.style.setProperty('--diary-fade-top', `${Math.min(24, Math.max(0, offset))}px`);
            else setFeedScrolled(offset > 1);
          }} contentContainerStyle={[styles.feedContent, { paddingHorizontal: gutter, paddingBottom: Math.max(48, gutter) }, !entries.length && styles.emptyFeed]}
          data={entries} extraData={{ selected, expanded, listenLater }} keyExtractor={record => record.id} initialNumToRender={5} maxToRenderPerBatch={5} windowSize={5}
          onViewableItemsChanged={trackVisibleRecords} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          renderItem={({ item: entry, index }) => {
            const architecture = isArchitecture(entry), audio = architecture || entry.kind === 'audio', marked = listenLater.includes(entry.id);
            return <View testID={`diary-entry-${entry.id}`}>
              {index === 0 || diaryDay(entries[index - 1].createdAt) !== diaryDay(entry.createdAt) ? <View style={styles.dayRow}><View style={styles.dayLine} /><ProductText style={styles.day}>{dayLabel(entry.createdAt)}</ProductText><View style={styles.dayLine} /></View> : null}
              <Panel style={[styles.card, {backgroundColor:"transparent"}]}><DiaryGlass shape="card" />
                <View style={styles.cardMeta}><View style={styles.kindRow}><DiaryEntryIcon kind={architecture ? 'architecture' : entry.category} /><ProductText style={styles.kind}>{architecture ? 'АРХИТЕКТУРА' : entry.category === 'dynamics' ? 'ОТЧЁТ О ДИНАМИКЕ' : 'НАБЛЮДЕНИЕ'}</ProductText></View><ProductText style={styles.time}>{new Date(entry.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</ProductText></View>
                {architecture && <>
                  <View style={styles.stepRow}>
                    <ProductText style={styles.level}>{productLevels.find(level => level.id === entry.level)?.title} ·</ProductText>
                    {entry.level === 'basic' && entry.step <= 2 ? <Pressable accessibilityRole="link" accessibilityLabel={`Открыть шаг ${entry.step}`} disabled={busy || !ready}
                      onPress={() => leave(() => { void visitStep(entry); })} style={styles.stepLink}><ProductText style={[styles.level, styles.linkText]}>ШАГ {entry.step}</ProductText></Pressable> : <ProductText style={styles.level}>ШАГ {entry.step}</ProductText>}
                  </View>
                  {entry.level === 'basic' && productStepNames[entry.step as keyof typeof productStepNames] && <ProductText style={styles.step}>{productStepNames[entry.step as keyof typeof productStepNames]}</ProductText>}
                  <Pressable accessibilityRole="button" accessibilityLabel={`${expanded === entry.id ? 'Скрыть' : 'Раскрыть'} вопрос ${entry.questionIndex + 1}`} accessibilityState={{ expanded: expanded === entry.id }} onPress={() => setExpanded(expanded === entry.id ? null : entry.id)} style={styles.questionToggle}><ProductText style={styles.questionLabel}>ВОПРОС {entry.questionIndex + 1}</ProductText><View style={expanded === entry.id && { transform: [{ rotate: '180deg' }] }}><DiaryAsset name="chevron" /></View></Pressable>
                  {expanded === entry.id && <View style={styles.questionMaterial}>
                    <ProductText style={styles.question}>{diaryQuestion(entry)}</ProductText>
                    {diaryMaterial(entry) && <Pressable accessibilityRole="button" accessibilityLabel={`Посмотреть материал шага ${entry.step}`} onPress={() => { setMaterial(entry); open('material'); }} style={styles.materialLink}>
                      <ProductText style={[styles.small, styles.linkText]}>ПОСМОТРЕТЬ МАТЕРИАЛ</ProductText>
                    </Pressable>}
                  </View>}
                </>}
                {isAudioEntry(entry) ? <DiaryAudio record={entry} active={selected === entry.id && focused} onActivate={() => { setError(''); setSelected(entry.id); }} /> : <DiaryFormattedText entry={entry} />}
                <View style={styles.cardFooter}>
                  {audio && <Pressable accessibilityRole="button" accessibilityLabel={marked ? 'Убрать из подборки к прослушиванию' : 'Добавить к прослушиванию'} accessibilityState={{ selected: marked }} onPress={() => { void mark(entry.id); }} style={styles.bookmark}><DiaryIcon name="bookmark" filled={marked} size={15} /><ProductText style={styles.bookmarkText}>{marked ? 'В ПОДБОРКЕ' : 'К ПРОСЛУШИВАНИЮ'}</ProductText></Pressable>}
                  <Pressable accessibilityRole="button" accessibilityLabel="Удалить запись" onPress={() => { setDeleteId(entry.id); open('delete'); }} style={styles.delete}><DiaryIcon name="trash" size={16} /></Pressable>
                </View>
              </Panel>
            </View>;
          }}
          ListEmptyComponent={<View style={styles.empty}><ProductText variant="title" style={styles.emptyTitle}>{!ready ? 'ОТКРЫВАЕМ ДНЕВНИК' : collection ? 'К ПРОСЛУШИВАНИЮ' : activeFilter || allEntries.length ? 'ЗДЕСЬ ПОКА НЕТ ЗАПИСЕЙ' : 'ЗАПИШИ СВОИ НАБЛЮДЕНИЯ'}</ProductText><ProductText style={styles.emptyCopy}>{collection ? 'ОТМЕЧАЙ ГОЛОСОВЫЕ ЗАПИСИ ЗАКЛАДКОЙ, ЧТОБЫ ВЕРНУТЬСЯ К НИМ.' : activeFilter || allEntries.length ? 'ИЗМЕНИ ФИЛЬТРЫ ИЛИ ДОБАВЬ НОВОЕ НАБЛЮДЕНИЕ.' : 'ИНСАЙТ. ОЩУЩЕНИЕ. МАЛЕНЬКИЙ СДВИГ.\nЗАПИШИ ТЕКСТОМ ИЛИ ГОЛОСОМ.'}</ProductText></View>}
        />
        {Platform.OS !== 'web' && feedScrolled && <Image pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 24 }} contentFit="fill" source={{ uri: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="24"><defs><linearGradient id="fade" x2="0" y2="1"><stop stop-color="${colors.background}"/><stop offset="1" stop-color="${colors.background}" stop-opacity="0"/></linearGradient></defs><rect width="1" height="24" fill="url(#fade)"/></svg>`) }} />}
        {Platform.OS !== 'web' && entries.length > 0 && <Image pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 24 }} contentFit="fill" source={{ uri: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="24"><defs><linearGradient id="fade" x2="0" y2="1"><stop stop-color="${colors.background}" stop-opacity="0"/><stop offset="1" stop-color="${colors.background}"/></linearGradient></defs><rect width="1" height="24" fill="url(#fade)"/></svg>`) }} />}
        </View>
        <View testID="diary-composer" style={[styles.composer, { paddingHorizontal: gutter }]}>
          {!!(storageError || error) && <View><ProductText accessibilityRole="alert" style={styles.error}>{error || storageError}</ProductText>{!ready && <ProductButton label="ПОВТОРИТЬ ЗАГРУЗКУ" kind="ghost" onPress={() => { void retryLoad(); }} />}</View>}
          {!!notice && <ProductText accessibilityLiveRegion="polite" style={styles.notice}>{notice}</ProductText>}
          {!!(voice.recorder.error || voice.hint) && !voice.review && <ProductText accessibilityRole={voice.recorder.error ? 'alert' : undefined} style={voice.recorder.error ? styles.error : styles.notice}>{voice.recorder.error || voice.hint}</ProductText>}
          {category === 'dynamics' && <View testID="diary-dynamics-draft" style={styles.draftCategory}><ProductText style={[styles.small, { flex: 1 }]}>ОТЧЁТ О ДИНАМИКЕ · ЧТО ИЗМЕНИЛОСЬ ЗА ДЕНЬ?</ProductText><Pressable accessibilityRole="button" accessibilityLabel="Писать обычное наблюдение" disabled={voice.capturing || voice.review} onPress={() => setCategory('observation')} style={styles.filterButton}><DiaryIcon name="close" size={16} /></Pressable></View>}
          <View style={styles.composerRow}>
            <View style={styles.inputWrap}><DiaryGlass shape="input" /><PanelArtwork source={frames.input} />{voice.capturing ? <View testID="diary-recording-timer" style={[styles.recordingInput, { height: composerHeight }]}>
              <View style={[styles.recordingDot, { backgroundColor: colors.accent }]} />
              <ProductText maxFontSize={12} style={styles.recordingTime}>{diaryClock(voice.recorder.durationMs)} / 15:00</ProductText>
              <ProductText maxFontSize={10} color={colors.muted} style={styles.recordingHint}>{voice.recorder.phase === 'preparing' ? 'МИКРОФОН…' : voice.recorder.phase === 'stopping' ? 'ЗАВЕРШАЕМ…' : voice.locked ? 'ЗАПИСЬ ЗАКРЕПЛЕНА' : voice.cancelProgress === 1 ? 'ОТПУСТИ — ОТМЕНА' : '← ОТМЕНА'}</ProductText>
              {voice.locked && <Pressable accessibilityRole="button" accessibilityLabel="Отменить голосовую запись" onPress={() => { void voice.discard(); }} style={styles.cancelRecord}><DiaryIcon name="trash" size={16} /></Pressable>}
            </View> : <><TextInput ref={input} testID="diary-text" accessibilityLabel={category === 'dynamics' ? 'Текст отчёта о динамике' : 'Текст наблюдения'} value={text} onChangeText={changeText}
              onContentSizeChange={event => setInputHeight(Math.max(composerHeight, Math.min(116, event.nativeEvent.contentSize.height)))}
              multiline scrollEnabled maxLength={DIARY_TEXT_LIMIT} editable={ready && !busy && !resetting} placeholder="ВВЕДИТЕ ТЕКСТ" placeholderTextColor={colors.faint} selectionColor={colors.accent}
              style={[styles.textInput, { position: 'relative', zIndex: 1, height: text ? Math.max(composerHeight, inputHeight) : composerHeight, fontSize: width >= 375 ? 16 : 12, lineHeight: width >= 375 ? 24 : 20 }, Platform.OS === 'web' && { outlineWidth: 0 }]} />
              <Pressable accessibilityRole="button" accessibilityLabel="Раскрыть редактор текста" accessibilityState={{ expanded: sheet === 'editor' }} disabled={!ready || busy || resetting} onPress={() => open('editor')} style={styles.expandInput}><DiaryIcon name="expand" size={16} /></Pressable>
            </>}
            </View>
            {text.trim() && !voice.capturing ? <Pressable accessibilityRole="button" accessibilityLabel="Сохранить текст" accessibilityState={{ disabled: busy || !ready || resetting, busy }} disabled={!ready || busy || resetting} onPress={() => { void sendText(); }} style={[styles.voiceButton, { width: composerHeight, height: composerHeight }]}><DiaryGlass /><PanelBorder color={colors.accent} />{busy ? <ProductText>···</ProductText> : <DiaryIcon name="send" size={20} />}</Pressable>
              : <DiaryRecordButton voice={voice} size={composerHeight} disabled={!ready || busy || resetting || sheet !== null} />}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="О локальном хранении дневника" onPress={() => open('info')} style={styles.storageNote}><ProductText style={styles.storageText}>ДНЕВНИК ЛОКАЛЬНЫЙ</ProductText><DiaryAsset name="info" dim /></Pressable>
        </View>
      </KeyboardAvoidingView>
    </ProductScreen>
    <BottomSheet open={sheet !== null && focused} onClose={closeSheet} reducedMotion={settings.reducedMotion} bottomInset={keyboard.bottomInset}
      onDismiss={() => { setSheetKind(null); if (focusAfterSheet.current && focused) { focusAfterSheet.current = false; input.current?.focus(); } }}>
      {sheetKind === 'material' && material && diaryMaterial(material) ? <HintPanel text={diaryMaterial(material)!} reducedMotion={settings.reducedMotion} /> : sheetKind === 'voice' ?
        <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}>{voice.recorder.draft && <RecordingReview waveform={voice.recorder.draft.waveform} positionMs={voice.player.positionMs} durationMs={voice.recorder.draft.durationMs}
          playing={voice.player.playing} loaded={voice.player.loaded} muted={voice.player.muted} volume={voice.player.volume} saving={voice.saving} error={voice.error || voice.player.error} reducedMotion={settings.reducedMotion}
          onPlay={() => { void voice.player.toggle(); }} onSeek={ms => { void voice.player.seekTo(ms / 1000); }} onMute={() => voice.player.setMuted(!voice.player.muted)} onVolume={voice.player.setVolume}
          onSave={() => { void voice.save(); }} onRecordAgain={() => { void recordAgain(); }} />}</View> : sheetKind === 'editor' ?
        <DiaryEditorPanel session={editorSession} height={Math.min((keyboard.viewportHeight || height) - gutter * 2, height * .86, width >= 375 ? 600 : 460)}
          text={text} runs={format} size={width >= 375 ? 16 : 12} onChange={(value, runs) => { setText(value); setFormat(runs); }} onDone={closeEditor} /> :
      sheetKind === 'report' || sheetKind === 'leave' || sheetKind === 'discard-voice' ?
        <DiaryDesignPanel title={sheetKind === 'report' ? 'ОТЧЁТ О ДИНАМИКЕ' : sheetKind === 'leave' ? 'ТЕКСТ НЕ СОХРАНЁН' : 'ЗАПИСЬ НЕ СОХРАНЕНА'} height={Math.min(height * .78, width >= 375 ? 416 : sheetKind === 'report' ? 317 : 319)}>
          <ProductText style={styles.designCopy}>{sheetKind === 'report' ? 'ЗАМЕТЬ КАК МЕНЯЮТСЯ ТВОИ ОЩУЩЕНИЯ. КАЖДЫЙ ДЕНЬ СТАРАЙСЯ ОТМЕЧАТЬ ДИНАМИКУ НАБЛЮДЕНИЯ.\n\n-КАКИЕ ПАТТЕРНЫ ПОВТОРЯЮТСЯ?\n-КАК ПРОВОЦИРУЕТ ЛИЧНОСТЬ?\n-ГДЕ ПРОИСХОДИТ ЗАЛИПАНИЕ В ПЕРСОНАЖ?' : sheetKind === 'leave' ? 'ВЕРНУТЬСЯ К ТЕКСТУ ЧТОБЫ СОХРАНИТЬ НАБЛЮДЕНИЕ?' : 'ВЕРНУТЬСЯ К ЗАПИСИ ЧТОБЫ СОХРАНИТЬ НАБЛЮДЕНИЕ?'}</ProductText>
          <View style={styles.designActions}>
            <DiaryDesignAction label={sheetKind === 'report' ? 'ЗАПИСАТЬ ОТЧЁТ' : 'ПРОДОЛЖИТЬ ЗАПИСЬ'} onPress={() => { if (sheetKind === 'report') startReport(); else if (sheetKind === 'discard-voice' && voice.review) { setSheetKind('voice'); setSheet('voice'); } else setSheet(null); }} />
            <DiaryDesignAction ghost label={sheetKind === 'report' ? 'ПОСМОТРЕТЬ ОТЧЁТЫ' : 'ВЫЙТИ БЕЗ СОХРАНЕНИЯ'} onPress={() => {
              if (sheetKind === 'report') { setCollection(false); setFilter({ ...emptyDiaryFilter, category: 'dynamics' }); setSheet(null); }
              else if (sheetKind === 'discard-voice') { void voice.discard().then(() => { setSheet(null); leaveAction.current(); }); }
              else { setText(''); setFormat([]); setSheet(null); leaveAction.current(); }
            }} />
          </View>
        </DiaryDesignPanel> :
      <DiaryDesignPanel testID="diary-sheet" title={sheetKind === 'filters' ? 'ФИЛЬТРЫ ДНЕВНИКА' : sheetKind === 'delete' ? 'УДАЛИТЬ ЗАПИСЬ?' : sheetKind === 'backup' ? 'ЛОКАЛЬНАЯ КОПИЯ' : 'О ДНЕВНИКЕ'} onClose={sheetKind === 'backup' ? undefined : closeSheet} closeDisabled={busy}
        footer={sheetKind === 'info' ? <View style={styles.sheetStack}>
          {Platform.OS === 'web' && <ProductButton label="СОЗДАТЬ ЛОКАЛЬНУЮ КОПИЮ" disabled={busy || resetting} onPress={() => open('backup')} />}
          <ProductButton label="ПОНЯТНО" kind="outline" onPress={() => setSheet(null)} />
        </View> : undefined}>

            {sheetKind === 'filters' && <DiaryFilters value={filter} onApply={next => { setFilter(next); setSelected(null); setSheet(null); if (next.category === 'architecture' || next.level !== 'all') void changeSettings({ diaryShowArchitecture: true }); list.current?.scrollToOffset({ offset: 0, animated: false }); }} />}
            {sheetKind === 'delete' && <View style={styles.sheetStack}><ProductText style={styles.bodyCopy}>Запись будет удалена с этого устройства{observations.some(entry => entry.id === deleteId) ? ', в том числе из ответов на задание' : ''}.</ProductText>{!!error && <ProductText accessibilityRole="alert" style={styles.error}>{error}</ProductText>}<ProductButton label={busy ? 'УДАЛЯЕМ…' : 'УДАЛИТЬ'} disabled={busy} onPress={() => { void remove(); }} /><ProductButton label="ОСТАВИТЬ" kind="ghost" disabled={busy} onPress={() => setSheet(null)} /></View>}
            {sheetKind === 'info' && <View style={styles.sheetStack}>
              <ProductText style={styles.bodyCopy}>Записи хранятся на этом устройстве. Ответы на задания тоже попадают в дневник. На других устройствах они не появятся автоматически.</ProductText>
              <ProductText style={styles.bodyCopy}>Если очистить данные {Platform.OS === 'web' ? 'сайта или браузера' : 'приложения'}, записи исчезнут.</ProductText>
              {Platform.OS === 'web' && <ProductText style={styles.bodyCopy}>Чтобы сохранить их, скачай копию. В неё входят тексты, аудио, настройки и прогресс. Файл защищён твоим паролем. Вернуть записи из копии можно в настройках.</ProductText>}
            </View>}
          {sheetKind === 'backup' && <BackupExportForm onCancel={closeSheet} onBusyChange={value => { pending.current = value; if (alive.current) setBusy(value); }} onCreated={() => { setSheet(null); setNotice('КОПИЯ СОЗДАНА. СОХРАНИ ФАЙЛ ОТДЕЛЬНО ОТ ДАННЫХ САЙТА.'); }} />}
      </DiaryDesignPanel>}
    </BottomSheet>
  </>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  screen: { flex: 1, padding: 0, minHeight: 0 }, header: { paddingTop: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, title: { fontSize: 20, lineHeight: 26, textAlign: 'center', flexShrink: 1 }, architectureButton: { width: 44, height: 44, justifyContent: 'center' }, collectionButton: { width: 32, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, badge: { position: 'absolute', right: 0, bottom: 0, fontSize: 7, backgroundColor: colors.background, color: colors.accent, paddingHorizontal: 2 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingBottom: 8 }, toolLine: { position: 'absolute', bottom: 0, left: 0, right: 0, height: .25, backgroundColor: colors.accent }, dates: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 4, minHeight: 36, alignItems: 'center' }, dateLabel: { fontSize: 10, lineHeight: 14 }, sort: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 6, minHeight: 25 }, sortLabel: { fontSize: 8, lineHeight: 12 }, filterButton: { minWidth: 32, height: 40, justifyContent: 'center', alignItems: 'center' }, filterDot: { position: 'absolute', right: 0, top: 3, height: 4, width: 4, borderRadius: 2, backgroundColor: colors.accent },
  sourceRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, sourceToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minHeight: 40 }, sourceLabel: { fontFamily: fonts.bodyBold, fontSize: 8, lineHeight: 12, flexShrink: 1 }, count: { fontSize: 8, color: colors.muted },
  reportPrompt: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }, reportCopy: { flex: 1, minWidth: 0, gap: 6 }, reportTitle: { fontSize: 12, lineHeight: 16 }, reportHint: { color: colors.muted, fontSize: 8, lineHeight: 12 }, applied: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 }, small: { fontSize: 8, lineHeight: 13 },
  feed: { flex: 1, minHeight: 0 }, feedContent: { paddingTop: 8, paddingBottom: 12 }, emptyFeed: { flexGrow: 1, justifyContent: 'center' }, empty: { gap: 8, paddingVertical: 16 }, emptyTitle: { fontSize: 20, lineHeight: 26, textAlign: 'center' }, emptyCopy: { fontSize: 10, lineHeight: 17.5, color: colors.muted, textAlign: 'center' }, dayRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 12 }, day: { fontSize: 8, lineHeight: 12, color: colors.muted }, dayLine: { height: .25, flex: 1, backgroundColor: colors.border },
  card: { gap: 8, marginBottom: 12 }, cardMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }, kind: { fontFamily: fonts.bodyBold, fontSize: 8, lineHeight: 12, color: colors.accent, flexShrink: 1 }, time: { color: colors.muted, fontSize: 8, lineHeight: 12 }, level: { fontSize: 10, lineHeight: 16 }, step: { fontSize: 8, lineHeight: 12, color: colors.muted }, questionToggle: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 10 }, questionLabel: { fontSize: 8, lineHeight: 12, color: colors.muted, textDecorationLine: 'underline' }, question: { fontSize: 10, lineHeight: 17, paddingBottom: 8 }, entryText: { fontSize: 12, lineHeight: 20, marginTop: 3 }, cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, bookmark: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, flexShrink: 1 }, bookmarkText: { fontSize: 8, lineHeight: 12, color: colors.muted }, delete: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  recordingInput: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 8 }, recordingDot: { width: 5, height: 5, borderRadius: 3 }, recordingTime: { fontSize: 10, lineHeight: 14, flexShrink: 0 }, recordingHint: { fontSize: 8, lineHeight: 12, flex: 1, textAlign: 'right' }, cancelRecord: { width: 24, height: 40, alignItems: 'center', justifyContent: 'center' },
  designCopy: { fontSize: 12, lineHeight: 16.8, textTransform: 'uppercase' }, designActions: { gap: 12 },
  composer: { flexShrink: 0, paddingTop: 8, paddingBottom: 4 }, composerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' }, inputWrap: { flex: 1, minWidth: 0, minHeight: 44, overflow: 'hidden' }, textInput: { fontFamily: fonts.body, color: colors.text, paddingLeft: 14, paddingRight: 36, paddingVertical: 12, minHeight: 44, maxHeight: 116, textAlignVertical: 'top' }, voiceButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }, storageNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 25 }, storageText: { fontSize: 8, lineHeight: 11, color: colors.faint, letterSpacing: 3 }, draftCategory: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 6 },
  stepRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, stepLink: { minHeight: 28, justifyContent: 'center' }, linkText: { textDecorationLine: 'underline' }, questionMaterial: { gap: 4 }, materialLink: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' }, materialContent: { paddingHorizontal: 16, paddingBottom: 16 },
  expandInput: { position: 'absolute', top: 4, right: 5, width: 28, height: 28, zIndex: 2, alignItems: 'center', justifyContent: 'center' },
  editorContent: { flex: 1, minHeight: 0, padding: 16, paddingTop: 4 }, editorInput: { flex: 1, minHeight: 0, fontFamily: fonts.body, color: colors.text, textAlignVertical: 'top', padding: 8 }, editorFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingTop: 12 },
  error: { fontSize: 10, lineHeight: 16, color: colors.error, paddingVertical: 6 }, notice: { fontSize: 8, lineHeight: 13, paddingBottom: 6, color: colors.muted },
  sheetStack: { gap: 18 }, bodyCopy: { fontSize: 12, lineHeight: 20 },
});
