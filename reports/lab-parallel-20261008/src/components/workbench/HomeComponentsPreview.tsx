import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, Ref } from 'react'
import { ArchitectureCover } from '../architecture/ArchitectureCover'
import type { ArchitectureCoverHandle } from '../architecture/ArchitectureCover'
import type { ArchitectureSettings } from '../architecture/architectureSettings'
import { DiaryCover } from '../diary/DiaryCover'
import type { DiaryCoverHandle } from '../diary/DiaryCover'
import type { DiarySettings } from '../diary/diarySettings'
import { useCoverGesture } from '../coverGesture'
import { HomeSectionPreview } from './HomeSectionPreview'
import type { HomeSection } from './HomeSectionPreview'
import { defaultHomeInteractionSettings } from './homeInteractionSettings'
import type { HomeInteractionSettings } from './homeInteractionSettings'
import './homeComponentsPreview.css'

export function HomeComponentsPreview({ active, language, architecture, diary, architectureReplay, architectureTouch, diaryReplay, diaryTouch, architectureController, diaryController, onSettings, interactionSettings = defaultHomeInteractionSettings, resetKey = 0 }: {
  active: boolean; language: 'ru' | 'en'; architecture: ArchitectureSettings; diary: DiarySettings
  architectureReplay: number; architectureTouch: number; diaryReplay: number; diaryTouch: number
  architectureController: Ref<ArchitectureCoverHandle>; diaryController: Ref<DiaryCoverHandle>; onSettings: () => void
  interactionSettings?: HomeInteractionSettings; resetKey?: number
}) {
  const ru = language === 'ru', background = architecture.theme === 'dark' ? '#000000' : '#FAE6AD'
  const root = useRef<HTMLDivElement>(null), architectureGesture = useRef<ArchitectureCoverHandle>(null), diaryGesture = useRef<DiaryCoverHandle>(null)
  useImperativeHandle(architectureController, () => ({ svg: () => architectureGesture.current?.svg() ?? '', hold: () => architectureGesture.current?.hold(), release: () => architectureGesture.current?.release(), move: (x, y) => architectureGesture.current?.move(x, y) }), [])
  useImperativeHandle(diaryController, () => ({ svg: () => diaryGesture.current?.svg() ?? '', hold: () => diaryGesture.current?.hold(), release: () => diaryGesture.current?.release(), move: (x, y) => diaryGesture.current?.move(x, y) }), [])
  const [section, setSection] = useState<HomeSection | null>(null)
  const [transition, setTransition] = useState<{ kind: HomeSection; direction: 'in' | 'out'; duration: number; style: HomeInteractionSettings['transitionStyle'] } | null>(null)
  const transitioning = useRef(false)
  const initialFocus = useRef(true), lastOpened = useRef<HomeSection>('architecture')
  function navigate(kind: HomeSection, direction: 'in' | 'out') {
    if (transitioning.current || (direction === 'in' && !interactionSettings.navigateOnTap)) return
    if (direction === 'in') lastOpened.current = kind
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setSection(direction === 'in' ? kind : null); return }
    transitioning.current = true
    setTransition({ kind, direction, duration: interactionSettings.transitionDuration, style: interactionSettings.transitionStyle })
  }
  useEffect(() => {
    if (!transition) return
    const timer = window.setTimeout(() => { setSection(transition.direction === 'in' ? transition.kind : null); setTransition(null); transitioning.current = false }, transition.duration * 1000)
    return () => window.clearTimeout(timer)
  }, [transition])
  useEffect(() => { setTransition(null); setSection(null); transitioning.current = false }, [resetKey, architectureReplay, diaryReplay])
  useEffect(() => {
    if (initialFocus.current) { initialFocus.current = false; return }
    if (transition) return
    if (section) root.current?.querySelector<HTMLButtonElement>('.home-section-back')?.focus({ preventScroll: true })
    else root.current?.querySelector<HTMLButtonElement>(`.home-preview-cover--${lastOpened.current} button`)?.focus({ preventScroll: true })
  }, [section, transition])
  const screenGesture = useCoverGesture({ holdDelay: Math.min(architecture.holdDelay, diary.holdDelay), disabled: !active || section !== null || transition !== null,
    canStart: target => !(target instanceof Element && target.closest('button')),
    onHold: () => { architectureGesture.current?.hold(); diaryGesture.current?.hold() },
    onRelease: () => { architectureGesture.current?.release(); diaryGesture.current?.release() },
    onMove: (x, y) => { architectureGesture.current?.move(x, y); diaryGesture.current?.move(x, y) } })
  const selectedSection = section ?? transition?.kind, homeActive = active && (section === null || transition?.direction === 'out')
  const homeInteractive = section === null && transition === null
  const copy = (serial: string, title: ReactNode, caption: string, color: string, visible: boolean) => visible && <>
    <span className="home-cover-serial" style={{ color }}>{serial} /</span>
    <span className="home-cover-copy" style={{ color }}><strong>{title}</strong><small>{caption}</small></span>
    <svg className="home-cover-arrow" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1" aria-hidden="true"><path d="M5 19L19 5M7 5h12v12"/></svg>
  </>
  const frame = (color: string, visible: boolean) => visible && <svg className="home-cover-frame" viewBox="0 0 288 200" preserveAspectRatio="none" aria-hidden="true"><path d="M.5 .5H270L287.5 18V181L269 199.5H.5Z" fill="none" stroke={color} strokeOpacity=".45" strokeWidth=".7"/></svg>
  return <div className="cw-home-preview" ref={root} data-theme={architecture.theme} data-section={section ?? 'home'} data-direction={transition?.direction} data-transition-style={transition?.style}
    style={{ '--home-color': architecture.color, '--home-background': background, '--home-transition-duration': `${transition?.duration ?? interactionSettings.transitionDuration}s` } as CSSProperties}
    {...screenGesture} onKeyDown={event => { if (event.key === 'Escape' && section && !transition) { event.preventDefault(); navigate(section, 'out') } }}>
    <div className="home-preview-page" aria-hidden={section !== null} inert={!homeInteractive}>
    <header className="home-preview-header"><h1>{ru ? 'КОД СТАЛКЕРА' : 'STALKER CODE'}</h1><p>{ru ? 'ПРОСТРАНСТВО СЕБЯ' : 'SPACE OF SELF'}</p>
      <button type="button" className="home-settings" aria-label={ru ? 'Настройки главного экрана' : 'Home screen settings'} onClick={onSettings}>
        <svg viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth=".6" aria-hidden="true"><path d="M.5 .5H33L43.5 11V43.5H11L.5 33Z"/><g strokeWidth=".8"><circle cx="17" cy="16" r="3"/><path d="M20 16h10M14 26h10"/><circle cx="27" cy="26" r="3"/></g></svg>
      </button>
    </header>
    <article className="home-preview-cover home-preview-cover--architecture" data-opening={transition?.direction === 'in' && transition.kind === 'architecture'} aria-label={ru ? 'Плашка Архитектуры · 288 × 200' : 'Architecture cover · 288 × 200'}>
      <ArchitectureCover settings={architecture} language={language} presentation="artwork" active={homeActive} interactive={homeInteractive} replayKey={architectureReplay} touchKey={architectureTouch} controller={architectureGesture} onClick={() => navigate('architecture', 'in')}/>
      {frame(architecture.color, architecture.frame)}
      {copy('01', ru ? <>Архитектура<br/>Наблюдения</> : <>Observation<br/>Architecture</>, architecture.illustration === 'guidance' ? (architecture.guidanceVariant === 'parallel' ? (ru ? 'ВОДИТЕЛЬСТВО · ПАРАЛЛЕЛЬНЫЙ ПУТЬ' : 'GUIDANCE · PARALLEL PATH') : (ru ? 'ВОДИТЕЛЬСТВО · ПОДСКАЗКА В УЗЛЕ' : 'GUIDANCE · HINT AT THE JUNCTION')) : architecture.illustration === 'synchronization' ? (ru ? 'ИНТЕНСИВ · СИНХРОНИЗАЦИЯ' : 'INTENSIVE · SYNCHRONIZATION') : architecture.illustration === 'distance' ? (ru ? 'ВЫСТАВЬ ДИСТАНЦИЮ' : 'SET A DISTANCE') : (ru ? 'БАЗОВЫЙ · ШАГ 1' : 'BASIC · STEP 1'), architecture.color, architecture.labels)}
    </article>
    <article className="home-preview-cover home-preview-cover--diary" data-opening={transition?.direction === 'in' && transition.kind === 'diary'} aria-label={ru ? 'Плашка Дневника · 288 × 200' : 'Diary cover · 288 × 200'}>
      <DiaryCover settings={diary} language={language} presentation="artwork" active={homeActive} interactive={homeInteractive} replayKey={diaryReplay} touchKey={diaryTouch} controller={diaryGesture} onClick={() => navigate('diary', 'in')}/>
      {frame(diary.color, diary.frame)}
      {copy('02', ru ? <>Дневник<br/>Сталкера</> : <>Stalker<br/>Diary</>, ru ? 'СОХРАНИ НАБЛЮДЕНИЯ' : 'KEEP YOUR OBSERVATIONS', diary.color, diary.labels)}
    </article>
    <div className="home-preview-note"><div><span>{ru ? 'ТЫ ТОЛЬКО ТВОЁ НАБЛЮДЕНИЕ' : 'YOU ARE YOUR OBSERVATION'}</span><span aria-hidden="true">{ru ? 'ТЫ ТОЛЬКО ТВОЁ НАБЛЮДЕНИЕ' : 'YOU ARE YOUR OBSERVATION'}</span></div></div>
    </div>
    {selectedSection && <section className="home-section-preview" data-kind={selectedSection} aria-label={selectedSection === 'architecture' ? (ru ? 'Раздел Архитектуры' : 'Architecture section') : (ru ? 'Раздел Дневника' : 'Diary section')} aria-hidden={transition !== null} inert={transition !== null}>
      <HomeSectionPreview section={selectedSection} architecture={architecture} diary={diary} language={language} active={active && section === selectedSection && !transition} onBack={() => navigate(selectedSection, 'out')}/>
    </section>}
  </div>
}
