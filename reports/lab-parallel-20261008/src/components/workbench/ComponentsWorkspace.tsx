import { useLabLanguage } from '../../i18n/LabLanguage'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { WebGLVideoEdgeGlass } from '../../liquid-glass/WebGLVideoEdgeGlass'
import type { LiquidGlassSettings } from '../../liquid-glass/settings'
import type { MatrixRainSettings } from '../../backgrounds/matrixRainSettings'
import type { MatrixPulseSettings } from '../../backgrounds/matrixPulseSettings'
import type { ProceduralBackgroundPreset } from '../../backgrounds/backgroundSettings'
import { LabIcon } from '../LabIcon'
import { MatrixGlassPreview } from '../matrix/MatrixGlassPreview'
import { VoiceRecorder } from '../voice/VoiceRecorder'
import { VoicePlayback } from '../voice/VoicePlayback'
import { VoicePlaybackControls } from '../voice/VoicePlaybackControls'
import { VoiceStyleControls } from '../voice/VoiceStyleControls'
import { VoiceExportControls } from '../voice/VoiceExportControls'
import { VoiceWaveField } from '../voice/VoiceWaveField'
import type { VoiceWaveFieldHandle } from '../voice/VoiceWaveField'
import { voiceWaveOrigin } from '../voice/voiceGeometry'
import { WorkbenchSection } from './WorkbenchSection'
import { InspectorTabs } from './InspectorTabs'
import type { InspectorTab } from './InspectorTabs'
import { PercentInput } from './PercentInput'
import { PanelResizeHandles } from '../PanelResize'
import type { PanelSizing } from '../PanelResize'
import { fitPreviewScale } from '../previewLayout'
import type { PreviewSize } from '../previewLayout'
import { CanvasTools } from './CanvasTools'
import { readVoiceTakeSession, rememberVoiceTakes, renewVoiceTakeUrls, readVoiceLoopPreference, rememberVoiceLoopPreference } from './voiceTakeSession'
import type { StoredTake } from './voiceTakeSession'
import { defaultVoiceAppearance, normalizeVoicePreferences, VOICE_PREFERENCES_KEY, VOICE_DEFAULTS_REVISION } from '../voice/voiceAppearance'
import { LockBackgroundPulse } from './LockBackgroundPulse'
import { DiaryCover } from '../diary/DiaryCover'
import type { DiaryCoverHandle } from '../diary/DiaryCover'
import { DiaryControls } from '../diary/DiaryControls'
import { defaultDiarySettings, DIARY_STORAGE_KEY, parseDiaryPreset, serializeDiaryPreset } from '../diary/diarySettings'
import { ArchitectureCover } from '../architecture/ArchitectureCover'
import type { ArchitectureCoverHandle } from '../architecture/ArchitectureCover'
import { ArchitectureControls } from '../architecture/ArchitectureControls'
import { ARCHITECTURE_STORAGE_KEY, defaultArchitectureSettings, parseArchitecturePreset, serializeArchitecturePreset } from '../architecture/architectureSettings'
import { HomeComponentsPreview } from './HomeComponentsPreview'
import { HomeInteractionControls } from './HomeInteractionControls'
import { HOME_INTERACTION_STORAGE_KEY, normalizeHomeInteractionSettings } from './homeInteractionSettings'
import type { VoiceTake } from '../voice/VoiceCapture'
import type { VoiceBands } from '../voice/spectrum'
import { formatVoiceTime } from '../voice/spectrum'
import { ChapterDropdown, MatrixActionButton } from './MatrixControls'
import { ARTBOARD, WORKSPACE_STORAGE_KEY, componentSpecs, constrainComponent, createComponent, initialComponents, panelFromComponent, parseWorkspace, voiceQuestions } from './componentLayout'
import type { ComponentKind, PlacedComponent, SavedWorkspace, WorkspaceBackground, WorkspaceCanvas } from './componentLayout'
import './componentsWorkspace.css'

const blackSource = { kind: 'image' as const, name: 'Black', src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="568"%3E%3Cpath fill="black" d="M0 0h320v568H0z"/%3E%3C/svg%3E' }
const backgrounds = [
  { kind: 'black', label: 'Чёрный', icon: 'background' },
  { kind: 'matrix-rain', label: 'Дождь', icon: 'rain' },
  { kind: 'matrix-pulse', label: 'Касание', icon: 'pulse' },
] as const

function readSaved(): SavedWorkspace {
  let saved: SavedWorkspace | null = null
  try { saved = parseWorkspace(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)) } catch { /* Storage can be unavailable in private browsing. */ }
  return saved ?? { version: 1, items: initialComponents(), background: 'black', showQuestions: true }
}

function readVoicePreferences() {
  let raw: unknown = null
  try { raw = JSON.parse(localStorage.getItem(VOICE_PREFERENCES_KEY) || 'null') } catch { /* Use approved defaults. */ }
  const current = raw && typeof raw === 'object' && 'revision' in raw && raw.revision === VOICE_DEFAULTS_REVISION
  return { ...normalizeVoicePreferences(current ? raw : null), revision: VOICE_DEFAULTS_REVISION }
}

function readDiarySettings() {
  try { return parseDiaryPreset(localStorage.getItem(DIARY_STORAGE_KEY) || '') } catch { return { ...defaultDiarySettings } }
}
function readArchitectureSettings() {
  let settings
  try { settings = parseArchitecturePreset(localStorage.getItem(ARCHITECTURE_STORAGE_KEY) || '') } catch { settings = { ...defaultArchitectureSettings, distance: { ...defaultArchitectureSettings.distance } } }
  const query = new URLSearchParams(typeof window !== 'undefined' ? window.location?.search ?? '' : '')
  const illustration = query.get('illustration'), guidance = query.get('guidance')
  if (illustration === 'distance' || illustration === 'synchronization' || illustration === 'guidance') settings.illustration = illustration
  if (guidance === 'junction' || guidance === 'parallel') { settings.guidanceVariant = guidance; settings.illustration = 'guidance' }
  return settings
}
function readHomeInteractionSettings() {
  try { return normalizeHomeInteractionSettings(JSON.parse(localStorage.getItem(HOME_INTERACTION_STORAGE_KEY) || 'null')) } catch { return normalizeHomeInteractionSettings(null) }
}

function PositionInput({ label, value, onCommit, disabled }: { label: string; value: number; onCommit: (value: number) => void; disabled: boolean }) {
  const [draft, setDraft] = useState<string | null>(null)
  function commit() {
    if (draft?.trim() && Number.isFinite(Number(draft))) onCommit(Number(draft))
    setDraft(null)
  }
  return <label className="cw-position-input"><span>{label}</span><input inputMode="numeric" type="text" value={draft ?? value} disabled={disabled}
    onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); commit() }
      if (event.key === 'Escape') { event.preventDefault(); setDraft(null) }
    }}/></label>
}

export function ComponentsWorkspace({ active, settings, rain, pulse, onBackgroundSettings, onGlassSettings, panelSizing, previewSize }: {
  active: boolean; settings: LiquidGlassSettings; rain: MatrixRainSettings; pulse: MatrixPulseSettings
  onBackgroundSettings: (kind: 'matrix-rain' | 'matrix-pulse') => void; onGlassSettings: () => void
  panelSizing: PanelSizing
  previewSize: PreviewSize
}) {
  const { language, t } = useLabLanguage()
  const [saved] = useState(readSaved)
  const [items, setItems] = useState(saved.items), [background, setBackground] = useState<WorkspaceBackground>(saved.background)
  const [showQuestions, setShowQuestions] = useState(saved.showQuestions)
  const [mode, setMode] = useState<'test' | 'edit'>('test'), [selected, setSelected] = useState<string | null>(() => saved.items.find(item => item.kind === 'voice')?.id ?? saved.items[0]?.id ?? null)
  const [question, setQuestion] = useState(3), [closed, setClosed] = useState(false)
  const [busy, setBusy] = useState(false), busyRef = useRef(false), takeQuestion = useRef(3)
  const [voicePreferences, setVoicePreferences] = useState(readVoicePreferences)
  const [sensitivity, setSensitivity] = useState<VoiceBands>(voicePreferences.sensitivity)
  const [appearance, setAppearance] = useState(voicePreferences.appearance)
  const voiceStyle = { ...defaultVoiceAppearance, ...appearance }
  const waveField = useRef<VoiceWaveFieldHandle>(null)
  const playback = useRef<VoicePlayback | null>(null), [playbackId, setPlaybackId] = useState<number | null>(null)
  const [playbackError, setPlaybackError] = useState(''), [loopPlayback, setLoopPlayback] = useState(readVoiceLoopPreference)
  const [lockPulse, setLockPulse] = useState({ key: 0, x: .5, y: .5 })
  const [takes, setTakes] = useState<StoredTake[]>(readVoiceTakeSession), takesRef = useRef(takes), nextTakeId = useRef(Math.max(0, ...takes.map(take => take.id)) + 1)
  takesRef.current = takes
  rememberVoiceTakes(takes)
  const [undoLayout, setUndoLayout] = useState<{ items: PlacedComponent[]; showQuestions: boolean } | null>(null)
  const [backgroundPlaying, setBackgroundPlaying] = useState(true), [replay, setReplay] = useState(0)
  const [panelContent, setPanelContent] = useState(true), [panelFrame, setPanelFrame] = useState(true)
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>(() => {
    try { const component = new URLSearchParams(window.location.search).get('component'); return component === 'diary' ? 'diary' : component === 'voice' ? 'voice' : 'architecture' } catch { return 'architecture' }
  })
  const [canvas, setCanvas] = useState<WorkspaceCanvas>(() => {
    try { const component = new URLSearchParams(window.location.search).get('component'); if (component === 'voice') return 'components'; if (['home', 'architecture', 'diary'].includes(component || '')) return 'home' } catch { /* Use saved canvas. */ }
    return saved.canvas ?? 'home'
  })
  const [homePlaying, setHomePlaying] = useState(true)
  const [homeInteraction, setHomeInteraction] = useState(readHomeInteractionSettings), [homeResetKey, setHomeResetKey] = useState(0)
  const [diarySettings, setDiarySettings] = useState(readDiarySettings)
  const [diaryReplay, setDiaryReplay] = useState(0), [diaryTouch, setDiaryTouch] = useState(0)
  const diaryController = useRef<DiaryCoverHandle>(null)
  const [architectureSettings, setArchitectureSettings] = useState(readArchitectureSettings)
  const [architectureReplay, setArchitectureReplay] = useState(0), [architectureTouch, setArchitectureTouch] = useState(0)
  const architectureController = useRef<ArchitectureCoverHandle>(null)
  const homeFocused = canvas === 'home'
  const scale = zoom === 'fit' ? fitPreviewScale(previewSize, ARTBOARD) : zoom
  const recordings = useRef<HTMLDivElement>(null), meters = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; id: string; clientX: number; clientY: number; x: number; y: number } | null>(null)
  const chosen = items.find(item => item.id === selected), panelItem = items.find(item => item.kind === 'panel')
  const voiceItem = items.find(item => item.kind === 'voice')
  const diaryItem = items.find(item => item.kind === 'diary')
  const architectureItem = items.find(item => item.kind === 'architecture')
  const panel = panelItem ? panelFromComponent(panelItem) : undefined
  const actualBackground = useMemo<ProceduralBackgroundPreset | undefined>(() => background === 'black' ? undefined : background === 'matrix-rain'
    ? { version: 1, kind: background, settings: { ...rain, playing: backgroundPlaying && rain.playing } }
    : { version: 1, kind: background, settings: { ...pulse, playing: backgroundPlaying && pulse.playing } }, [background, rain, pulse, backgroundPlaying])

  useEffect(() => {
    try { window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ version: 1, items, background, showQuestions, canvas } satisfies SavedWorkspace)) } catch { /* The workspace still works without storage. */ }
  }, [items, background, showQuestions, canvas])
  useEffect(() => {
    try { localStorage.setItem(DIARY_STORAGE_KEY, serializeDiaryPreset(diarySettings)) } catch { /* Optional persistence. */ }
  }, [diarySettings])
  useEffect(() => {
    try { localStorage.setItem(ARCHITECTURE_STORAGE_KEY, serializeArchitecturePreset(architectureSettings)) } catch { /* Optional persistence. */ }
  }, [architectureSettings])
  useEffect(() => {
    try { localStorage.setItem(HOME_INTERACTION_STORAGE_KEY, JSON.stringify(homeInteraction)) } catch { /* Optional persistence. */ }
  }, [homeInteraction])
  useEffect(() => {
    // A hot update must not save pre-preset state over the newly approved defaults.
    if (voicePreferences.revision !== VOICE_DEFAULTS_REVISION) {
      const next = readVoicePreferences()
      setAppearance(next.appearance); setSensitivity(next.sensitivity); setVoicePreferences(next)
      return
    }
    try { localStorage.setItem(VOICE_PREFERENCES_KEY, JSON.stringify({ revision: VOICE_DEFAULTS_REVISION, appearance, sensitivity })) } catch { /* Optional persistence. */ }
  }, [appearance, sensitivity, voicePreferences.revision])
  useEffect(() => {
    const graph = new VoicePlayback(); playback.current = graph
    // Rebuild audio elements after a hot update: a media source can only bind once.
    // Keep the blobs, and replace object URLs revoked by the previous effect cleanup.
    const renewedTakes = renewVoiceTakeUrls(takesRef.current)
    takesRef.current = renewedTakes; rememberVoiceTakes(renewedTakes); setTakes(renewedTakes)
    setPlaybackId(null)
    const visible = () => { if (!document.hidden) void graph.resumeAnalysis() }
    document.addEventListener('visibilitychange', visible)
    return () => { document.removeEventListener('visibilitychange', visible); graph.dispose(); playback.current = null }
  }, [])
  useEffect(() => () => { takesRef.current.forEach(take => URL.revokeObjectURL(take.url)) }, [])
  useEffect(() => {
    if (busy || !active || closed || mode === 'edit' || homeFocused) { playback.current?.pause(); setPlaybackId(null) }
  }, [busy, active, closed, mode, homeFocused])

  function updateItem(id: string, patch: Partial<PlacedComponent>) {
    setItems(current => current.map(item => item.id === id ? constrainComponent({ ...item, ...patch }) : item))
  }
  function add(kind: ComponentKind) {
    if (busy) return
    setCanvas('components')
    const existing = ['voice', 'panel', 'diary', 'architecture'].includes(kind) ? items.find(item => item.kind === kind) : undefined
    if (existing) { setSelected(existing.id); setMode('edit'); return }
    if (items.length >= 24) return
    const item = createComponent(kind, crypto.randomUUID())
    setUndoLayout({ items, showQuestions }); setItems([...items, item]); setSelected(item.id); setMode('edit'); setClosed(false)
  }
  function remove(id: string) {
    if (busy) return
    setUndoLayout({ items, showQuestions }); setItems(items.filter(item => item.id !== id)); setSelected(null)
  }
  function recordBusy(next: boolean) {
    if (next && !busyRef.current) takeQuestion.current = question
    if (next) { playback.current?.pause(); setPlaybackId(null) }
    busyRef.current = next; setBusy(next)
  }
  async function playRecording(player: HTMLAudioElement, takeId: number) {
    if (busyRef.current || !active) { player.pause(); return }
    setMode('test'); setClosed(false); setPlaybackError('')
    try { if (await playback.current?.listenTo(player)) setPlaybackId(takeId) }
    catch { player.pause(); setPlaybackId(null); setPlaybackError('Не удалось подключить звук. Нажми воспроизведение ещё раз.') }
  }
  async function endRecording(player: HTMLAudioElement, takeId: number) {
    const allowed = () => readVoiceLoopPreference() && active && !busyRef.current && !closed && mode === 'test' && player.isConnected
    if (!allowed()) { if (playback.current?.paused(player)) setPlaybackId(null); return }
    try { if (await playback.current?.repeatEnded(player, allowed)) setPlaybackId(takeId) }
    catch (error) {
      playback.current?.paused(player); setPlaybackId(null)
      if (!(error instanceof DOMException && error.name === 'AbortError')) setPlaybackError('Повтор приостановлен. Нажми воспроизведение, чтобы продолжить.')
    }
  }
  function showLevels(bands: VoiceBands, source: 'mic' | 'playback' | 'idle') {
    const node = meters.current
    if (!node) return
    node.querySelectorAll<HTMLElement>('.cw-band-fill').forEach((bar, i) => { bar.style.transform = `scaleX(${bands[(['low', 'mid', 'high'] as const)[i]]})` })
    const label = node.querySelector<HTMLElement>('.cw-band-source')
    if (label) label.textContent = source === 'mic' ? t("Микрофон") : source === 'playback' ? t("Прослушивание") : t("Ожидание звука")
  }
  function changeZoom(value: number) { setZoom(Math.max(.25, Math.min(2, Math.round(value * 100) / 100))) }
  function saveTake(take: VoiceTake) {
    const stored = { ...take, id: nextTakeId.current++, question: takeQuestion.current, url: URL.createObjectURL(take.blob) }
    setTakes(current => [stored, ...current])
  }
  function selectQuestion(index: number) { if (!busy) { setQuestion(index); setClosed(false) } }
  function restoreScreen() {
    setCanvas('components')
    setUndoLayout({ items, showQuestions }); setItems(initialComponents()); setShowQuestions(true); setQuestion(3); setSelected('voice'); setMode('test'); setClosed(false)
  }
  function showHome() { setCanvas('home'); setHomeResetKey(value => value + 1) }
  function changeInspector(tab: InspectorTab) {
    setInspectorTab(tab)
    if (tab === 'architecture' || tab === 'diary') showHome()
    else if (tab === 'voice' || tab === 'takes') setCanvas('components')
  }
  function replayCovers() { setArchitectureReplay(value => value + 1); setDiaryReplay(value => value + 1) }

  return <section className="components-workspace" hidden={!active} aria-label={t("Компоненты Prince Laboratory")}>
    <div className="cw-preview">
      <CanvasTools>
        <strong>{t("Экран 320 × 568")}</strong>
        <nav className="cw-segmented" aria-label={t("Экран предпросмотра")}>
          <button type="button" disabled={busy} aria-pressed={homeFocused} onClick={showHome}>{t("Главная")}</button>
          <button type="button" disabled={busy} aria-pressed={!homeFocused} onClick={() => setCanvas('components')}>{t("Конструктор")}</button>
        </nav>
          <div className="cw-zoom" aria-label={t("Масштаб макета")}>
            <div className="cw-zoom-step">
            <button type="button" aria-label={t("Отдалить макет")} disabled={busy || scale <= .25} onClick={() => changeZoom(scale - .25)}>−</button>
            <PercentInput label={t("Масштаб макета, проценты")} value={scale * 100} min={25} max={200} disabled={busy}
              onCommit={percent => changeZoom(percent / 100)}/>
            <button type="button" aria-label={t("Приблизить макет")} disabled={busy || scale >= 2} onClick={() => changeZoom(scale + .25)}>+</button>
            </div>
            <div className="cw-zoom-presets">
            <button type="button" disabled={busy} aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>{t("Вписать")}</button>
            <button type="button" disabled={busy} aria-pressed={zoom === 1} onClick={() => setZoom(1)}>1:1</button>
            </div>
          </div>
        {!homeFocused && <nav className="cw-segmented" aria-label={t("Режим холста")}>
          <button type="button" aria-pressed={mode === 'test'} disabled={busy} onClick={() => setMode('test')}><LabIcon name="play"/>{t("Проверка")}</button>
          <button type="button" aria-pressed={mode === 'edit'} disabled={busy} onClick={() => setMode('edit')}><LabIcon name="move"/>{t("Размещение")}</button>
        </nav>}
      </CanvasTools>
      <div className="cw-stage">
        <div className="cw-stage-pan">
        <div className="cw-board-space" style={{ width: 320 * scale, height: 568 * scale }}>
          <div className="cw-board" data-mode={homeFocused ? 'test' : mode} style={{ transform: `scale(${scale})` }}>
            {active && (background !== 'black' || (!homeFocused && panel)) && <WebGLVideoEdgeGlass language={language} background={actualBackground} source={blackSource} sourceNaturalSize={ARTBOARD}
              settings={settings} glassPanel={homeFocused ? undefined : panel} showGlass={!homeFocused && Boolean(panel)} revealKey={replay} backgroundReplayKey={replay} interactionMode={!homeFocused && mode === 'edit' ? 'move' : 'touch'}>
              {!homeFocused && panel && <MatrixGlassPreview panel={panel} settings={settings} showContent={panelContent} showFrame={panelFrame} replayKey={replay}/>}
            </WebGLVideoEdgeGlass>}
            <LockBackgroundPulse active={active && !homeFocused && appearance.lockBurst && !closed} pulse={lockPulse} color={appearance.color} lightColor={appearance.lightColor}/>
            {voiceItem && <VoiceWaveField controller={waveField} active={active && !homeFocused && mode === 'test' && !closed && voiceStyle.wavesAcrossScreen}
              origin={voiceWaveOrigin(voiceItem, voiceStyle)} appearance={voiceStyle}/>}
            {showQuestions && <div className="cw-screen-copy" aria-hidden={closed} hidden={homeFocused}>
              <h2>{t("Задание")}</h2>
              <div className="cw-prompt"><strong>{t("Запиши для себя свои наблюдения:")}</strong><p>– {t(voiceQuestions[question])}</p></div>
              <div className="cw-screen-note"><div className="cw-note-track"><span>{t("Здесь нет правильных ответов, есть только твои наблюдения.")}</span><span aria-hidden="true">{t("Здесь нет правильных ответов, есть только твои наблюдения.")}</span></div></div>
            </div>}
            <div className="cw-items" inert={closed} hidden={homeFocused}>
              {items.map(item => <div className="cw-item" key={item.id} data-kind={item.kind} data-selected={selected === item.id} data-pinned={item.pinned}
                style={{ left: item.x, top: item.y, width: item.width, height: item.height, zIndex: item.kind === 'dropdown' ? 6 : item.kind === 'panel' ? 1 : 2 } as CSSProperties}>
                <div className="cw-item-content" inert={mode === 'edit'}>
                  {item.kind === 'voice' && <VoiceRecorder language={language} active={active && !homeFocused && mode === 'test' && !closed} sensitivity={sensitivity} appearance={appearance} glassMaterial={settings}
                    playbackActive={playbackId !== null} samplePlayback={() => playback.current?.sample()} onLevels={showLevels}
                    onWave={wave => waveField.current?.emit(wave)}
                    onLock={() => { if (appearance.lockBurst) setLockPulse(value => ({ key: value.key + 1, x: (item.x + item.width / 2) / 320, y: (item.y + (item.height - 66) / 2) / 568 })) }}
                    onTake={saveTake} onBusyChange={recordBusy}/>}
                  {(item.kind === 'back' || item.kind === 'close' || item.kind === 'next') && <MatrixActionButton kind={item.kind} width={item.width} height={item.height}
                    onClick={() => { if (item.kind === 'close') setClosed(true); else selectQuestion((question + (item.kind === 'back' ? 3 : 1)) % 4) }}/>}
                  {item.kind === 'dropdown' && <ChapterDropdown width={item.width} height={item.height} x={item.x} y={item.y} active={active && !homeFocused && mode === 'test' && !closed}/>}
                  {item.kind === 'diary' && <DiaryCover settings={diarySettings} language={language} active={active && !homeFocused && !closed && mode === 'test'} replayKey={diaryReplay} touchKey={diaryTouch}/>}
                  {item.kind === 'architecture' && <ArchitectureCover settings={architectureSettings} language={language} active={active && !homeFocused && !closed && mode === 'test'} replayKey={architectureReplay} touchKey={architectureTouch}/>}
                </div>
                {mode === 'edit' && <button type="button" className="cw-drag-target" aria-label={`${t(componentSpecs[item.kind].label)}. ${item.pinned ? t("Закреплён") : t("Перетащи или используй клавиши со стрелками")}`}
                  onFocus={() => setSelected(item.id)} onPointerDown={event => {
                    if (!event.isPrimary || event.button !== 0) return
                    event.preventDefault(); setSelected(item.id); event.currentTarget.focus({ preventScroll: true })
                    if (item.pinned) return
                    drag.current = { pointerId: event.pointerId, id: item.id, clientX: event.clientX, clientY: event.clientY, x: item.x, y: item.y }
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }} onPointerMove={event => {
                    const origin = drag.current
                    if (!origin || origin.pointerId !== event.pointerId || origin.id !== item.id) return
                    updateItem(item.id, { x: origin.x + (event.clientX - origin.clientX) / scale, y: origin.y + (event.clientY - origin.clientY) / scale })
                  }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}
                  onKeyDown={event => {
                    if (item.pinned) return
                    const delta = event.shiftKey ? 10 : 1
                    const offsets: Record<string, [number, number]> = { ArrowLeft: [-delta, 0], ArrowRight: [delta, 0], ArrowUp: [0, -delta], ArrowDown: [0, delta] }
                    const move = offsets[event.key]
                    if (move) { event.preventDefault(); updateItem(item.id, { x: item.x + move[0], y: item.y + move[1] }) }
                  }}><span>{item.pinned && <LabIcon name="pin"/>}{t(componentSpecs[item.kind].label)} · {item.width} × {item.height}</span></button>}
              </div>)}
            </div>
            <div className="cw-home-scene" hidden={!homeFocused}>
              <HomeComponentsPreview language={language} active={active && homeFocused && homePlaying} architecture={architectureSettings} diary={diarySettings}
                architectureReplay={architectureReplay} architectureTouch={architectureTouch} diaryReplay={diaryReplay} diaryTouch={diaryTouch}
                architectureController={architectureController} diaryController={diaryController} onSettings={() => setInspectorTab('scene')} interactionSettings={homeInteraction} resetKey={homeResetKey}/>
            </div>
            {!homeFocused && closed && <div className="cw-closed"><LabIcon name="close"/><strong>{t("Раздел закрыт")}</strong><button type="button" onClick={() => setClosed(false)}>{t("Вернуться к заданию")}</button></div>}
          </div>
        </div>
        </div>
      </div>
      <div className="cw-frequency-monitor" hidden={homeFocused} ref={meters} style={{ color: appearance.color }} aria-label={t("Уровни частот за пределами макета")}>
        <span className="cw-band-source">{t("Ожидание звука")}</span>
        <div>{[t("НЧ"), t("СЧ"), t("ВЧ")].map(label => <span key={label}><small>{label}</small><i><b className="cw-band-fill"/></i></span>)}</div>
      </div>
      <p className="cw-canvas-hint">{homeFocused ? t("Обе плашки работают одновременно. Касание — открыть; удержание и движение — параллакс.") : busy ? t("Идёт запись · вверх — закрепить · нажатие — закончить закреплённую запись")
        : mode === 'edit' ? t("Выбери элемент. Открепи его, чтобы перемещать.") : t("Зажми голосовую кнопку. Проведи вверх, чтобы говорить без удержания.")}</p>
    </div>

    <div className="lab-panel-shell cw-panel-shell">
    <PanelResizeHandles sizing={panelSizing} language={language}/>
    <aside className="cw-inspector" aria-label={t("Библиотека и настройки компонентов")}>
      <InspectorTabs value={inspectorTab} onChange={changeInspector} count={takes.length} playing={playbackId !== null} diaryDisabled={busy}>
      {{ scene: <>
      <WorkbenchSection name="canvas-scene" title={t("Экран предпросмотра")} icon="layout">
        <div className="cw-backgrounds"><button type="button" disabled={busy} aria-pressed={homeFocused} onClick={showHome}><LabIcon name="layout"/>{t("Главная")}</button>
          <button type="button" disabled={busy} aria-pressed={!homeFocused} onClick={() => setCanvas('components')}><LabIcon name="move"/>{t("Конструктор")}</button></div>
        {homeFocused && <>
          <p className="cw-help">{t("Макет 320 × 568. Обе плашки — 288 × 200; иллюстрации заходят за названия.")}</p>
          <div className="cw-row-actions"><button type="button" aria-pressed={homePlaying} onClick={() => setHomePlaying(value => !value)}><LabIcon name={homePlaying ? 'pause' : 'play'}/>{homePlaying ? t("Пауза обеих") : t("Продолжить обе")}</button>
            <button type="button" onClick={replayCovers}><LabIcon name="reset"/>{t("Обе с начала")}</button></div>
          <div className="cw-row-actions"><button type="button" onClick={() => changeInspector('architecture')}><LabIcon name="architecture"/>{t("Архитектура")}</button>
            <button type="button" onClick={() => changeInspector('diary')}><LabIcon name="archive"/>{t("Дневник")}</button></div>
        </>}
      </WorkbenchSection>
      {homeFocused && <HomeInteractionControls value={homeInteraction} language={language} onChange={setHomeInteraction}/>}
      <WorkbenchSection name="background" title={t("Фон")} icon="background">
        <div className="cw-backgrounds">{backgrounds.map(option => <button key={option.kind} type="button" aria-pressed={background === option.kind} disabled={busy}
          onClick={() => setBackground(option.kind)}><LabIcon name={option.icon}/>{t(option.label)}</button>)}</div>
        {background !== 'black' && <div className="cw-row-actions">
          <button type="button" disabled={busy} onClick={() => onBackgroundSettings(background)}><LabIcon name="sliders"/>{t("Настроить фон")}</button>
          <button type="button" aria-label={backgroundPlaying ? t("Остановить фон") : t("Включить фон")} aria-pressed={backgroundPlaying} onClick={() => setBackgroundPlaying(value => !value)}><LabIcon name={backgroundPlaying ? 'pause' : 'play'}/></button>
        </div>}
        <p className="cw-help">{background === 'matrix-pulse' ? t("Касайся свободного места на экране — символы проявятся волной.") : background === 'matrix-rain' ? t("Используются текущие настройки дождя из раздела «Фон».") : t("Чистый фон, как в макете задания.")}</p>
      </WorkbenchSection>

      <WorkbenchSection name="library-v2" title={t("Добавить компонент")} icon="plus" defaultOpen={false}>
        <div className="cw-catalog">{(Object.keys(componentSpecs) as ComponentKind[]).map(kind => <button type="button" key={kind} disabled={busy || items.length >= 24} onClick={() => add(kind)}>
          <LabIcon name={componentSpecs[kind].icon}/><span>{t(componentSpecs[kind].label)}</span><LabIcon name={['voice', 'panel', 'diary', 'architecture'].includes(kind) && items.some(item => item.kind === kind) ? 'apply' : 'plus'}/>
        </button>)}</div>
      </WorkbenchSection>

      <WorkbenchSection name="layout" title={homeFocused ? t("В конструкторе") : t("На экране")} icon="layout" count={items.length} defaultOpen={!homeFocused}>
        <div className="cw-layers">{items.map(item => <div className="cw-layer" key={item.id} data-selected={selected === item.id}>
          <button type="button" disabled={busy} onClick={() => { setCanvas('components'); setSelected(item.id); setMode('edit') }}><LabIcon name={componentSpecs[item.kind].icon}/><span>{t(componentSpecs[item.kind].label)}</span><small>{item.width} × {item.height}</small></button>
          <button type="button" disabled={busy} aria-label={`${item.pinned ? t("Открепить") : t("Закрепить")}: ${t(componentSpecs[item.kind].label)}`} aria-pressed={item.pinned} onClick={() => updateItem(item.id, { pinned: !item.pinned })}><LabIcon name="pin"/></button>
          <button type="button" disabled={busy} aria-label={t('Удалить: {name}', { name: t(componentSpecs[item.kind].label) })} onClick={() => remove(item.id)}><LabIcon name="trash"/></button>
        </div>)}</div>
        {!items.length && <p className="cw-help">{t("Добавь компоненты из библиотеки.")}</p>}
        {chosen && !homeFocused && <div className="cw-selected-settings" key={chosen.id}>
          <div className="cw-selected-title"><strong>{t(componentSpecs[chosen.kind].label)}</strong><button type="button" disabled={busy} aria-pressed={chosen.pinned}
            onClick={() => updateItem(chosen.id, { pinned: !chosen.pinned })}><LabIcon name="pin"/>{chosen.pinned ? t("Открепить") : t("Закрепить")}</button></div>
          <div className="cw-position-grid">{(['x', 'y', 'width', 'height'] as const).map((key, index) => <PositionInput key={key} label={['X', 'Y', t("Ширина"), t("Высота")][index]} value={chosen[key]} disabled={busy || chosen.pinned} onCommit={value => updateItem(chosen.id, { [key]: value })}/>)}</div>
          {chosen.kind === 'voice' && <><p className="cw-help">{t("Область управления — до 288 × 260. Кольца и лучи могут выходить за её края.")}</p>
            <div className="cw-row-actions"><button type="button" onClick={() => setInspectorTab('voice')}><LabIcon name="sliders"/>{t("Настроить голос")}</button></div></>}
          {chosen.kind === 'diary' && <div className="cw-row-actions"><button type="button" onClick={() => setInspectorTab('diary')}><LabIcon name="archive"/>{t("Настроить дневник")}</button></div>}
          {chosen.kind === 'architecture' && <div className="cw-row-actions"><button type="button" onClick={() => changeInspector('architecture')}><LabIcon name="architecture"/>{t("Настроить архитектуру")}</button></div>}
          {chosen.kind === 'panel' && <>
            <label className="cw-check"><input type="checkbox" checked={panelFrame} onChange={event => setPanelFrame(event.target.checked)}/>{t("Наша рамка")}</label>
            <label className="cw-check"><input type="checkbox" checked={panelContent} onChange={event => setPanelContent(event.target.checked)}/>{t("Текст, сферы и декодер")}</label>
            <div className="cw-row-actions"><button type="button" disabled={busy} onClick={onGlassSettings}><LabIcon name="glass"/>{t("Настройки стекла")}</button><button type="button" onClick={() => setReplay(value => value + 1)}><LabIcon name="scan"/>{t("Сканер")}</button></div>
          </>}
        </div>}
        {!homeFocused && <label className="cw-check"><input type="checkbox" checked={showQuestions} disabled={busy} onChange={event => setShowQuestions(event.target.checked)}/>{t("Текст задания и заголовок")}</label>}
        <div className="cw-row-actions"><button type="button" disabled={busy} onClick={restoreScreen}><LabIcon name="reset"/>{t("Экран записи")}</button>
          {undoLayout && <button type="button" disabled={busy} onClick={() => { setItems(undoLayout.items); setShowQuestions(undoLayout.showQuestions); setUndoLayout(null); setSelected(null) }}><LabIcon name="back"/>{t("Отменить")}</button>}
        </div>
      </WorkbenchSection>

      </>, architecture: <ArchitectureControls value={architectureSettings} onChange={setArchitectureSettings} onReplay={() => setArchitectureReplay(value => value + 1)} onTouch={() => setArchitectureTouch(value => value + 1)}
        getSvg={() => architectureController.current?.svg() ?? ''} placed={Boolean(architectureItem)} onHome={showHome} onAdd={() => { add('architecture'); setInspectorTab('scene') }}/>, voice: <>
        {!voiceItem && <div className="cw-empty-state"><p className="cw-help">{t("На макете пока нет голосового компонента.")}</p><div className="cw-row-actions">
          <button type="button" disabled={busy || items.length >= 24} onClick={() => add('voice')}><LabIcon name="plus"/>{t("Добавить голос")}</button></div></div>}
        <VoiceStyleControls value={appearance} onChange={setAppearance} sensitivity={sensitivity} onSensitivityChange={setSensitivity} glass={settings} onGlassSettings={onGlassSettings}/>
        <VoiceExportControls appearance={appearance} sensitivity={sensitivity} glass={settings}/>
      </>, diary: <DiaryControls value={diarySettings} onChange={setDiarySettings} onReplay={() => setDiaryReplay(value => value + 1)} onTouch={() => setDiaryTouch(value => value + 1)}
        getSvg={() => diaryController.current?.svg() ?? ''} placed={Boolean(diaryItem)} onAdd={() => { add('diary'); setInspectorTab('scene') }}
        background={background} onBackgroundChange={setBackground} onBackground={() => { if (background !== 'black') onBackgroundSettings(background) }}/>, takes: <>
      <WorkbenchSection name="takes" title={t("Мои пробы")} icon="play" count={takes.length}>
        <p className="cw-help">{t("Записи хранятся в браузере до обновления страницы. При прослушивании компонент реагирует на запись — можно настраивать его без микрофона.")}</p>
        <VoicePlaybackControls onMute={muted => playback.current?.setMuted?.(muted)}/>
        <label className="cw-check"><input type="checkbox" checked={loopPlayback} onChange={event => { rememberVoiceLoopPreference(event.target.checked); setLoopPlayback(event.target.checked) }}/>{t("Повторять запись по кругу")}</label>
        {!takes.length && <p className="cw-help cw-empty-state">{t("Зажми компонент на макете, чтобы записать первую пробу. Затем включи её здесь и вернись во вкладку «Голос» для настройки.")}</p>}
        {playbackError && <p className="cw-help" role="alert">{t(playbackError)}</p>}
        <div className="cw-takes" ref={recordings}>{takes.map(take => <article className="cw-take" key={take.id}>
          <div><strong>{t('Вопрос {question} · проба {take}', { question: take.question + 1, take: take.id })}</strong><span>{formatVoiceTime(take.seconds)}</span></div>
          <audio key={take.url} controls loop={loopPlayback} preload="metadata" src={take.url} aria-label={t('Запись к вопросу {question}', { question: take.question + 1 })}
            onPlay={event => { void playRecording(event.currentTarget, take.id) }}
            onPause={event => { if (playback.current?.paused(event.currentTarget)) setPlaybackId(null) }}
            onEnded={event => { void endRecording(event.currentTarget, take.id) }}/>
          <div className="cw-row-actions"><a href={take.url} download={`prince-question-${take.question + 1}-take-${take.id}.${take.mimeType.includes('mp4') ? 'm4a' : take.mimeType.includes('ogg') ? 'ogg' : 'webm'}`}><LabIcon name="export"/>{t("Скачать")}</a>
            <button type="button" aria-label={t('Удалить пробу {take}', { take: take.id })} onClick={event => {
              const player = event.currentTarget.closest('article')?.querySelector('audio')
              if (player) playback.current?.remove(player)
              if (playbackId === take.id) setPlaybackId(null)
              URL.revokeObjectURL(take.url); setTakes(current => current.filter(item => item.id !== take.id))
            }}><LabIcon name="trash"/></button></div>
        </article>)}</div>
      </WorkbenchSection>
      </> }}
      </InspectorTabs>
    </aside>
    </div>
  </section>
}
