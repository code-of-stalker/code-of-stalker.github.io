import { useId, useState } from 'react'
import { useLabLanguage } from '../../i18n/LabLanguage'
import { WorkbenchSection } from '../workbench/WorkbenchSection'
import { LabIcon } from '../LabIcon'
import { ColorControl } from '../ColorControl'
import type { ArchitectureSettings } from './architectureSettings'
import { parallelBounds, parallelDuration, parallelStages, normalizeParallelSettings } from './parallelSettings'
import type { ParallelNumber, ParallelSettings } from './parallelSettings'

const parallelLabels: Record<ParallelNumber, [string, string]> = {
  climbDuration: ['Подъём по спирали', 'Spiral ascent'], exitDuration: ['Выход на один уровень', 'Level exit'], signalDuration: ['Финальный отклик', 'Final response'], finalDuration: ['Пауза и затухание', 'Hold and fade'],
  radius: ['Ширина спирали', 'Spiral width'], height: ['Высота спирали', 'Spiral height'], depth: ['Глубина объёма', 'Perspective depth'], turns: ['Количество витков', 'Turns'], sway: ['Поворот при подъёме', 'Sway during ascent'],
  rungs: ['Количество перемычек', 'Connecting rungs'], stroke: ['Толщина линий', 'Line thickness'], brightness: ['Яркость спирали', 'Spiral brightness'], detail: ['Яркость опорной сетки', 'Reference grid brightness'],
  guideBrightness: ['Яркость проводника', 'Guide brightness'], selfBrightness: ['Яркость второго огонька', 'Traveler brightness'], lightSize: ['Размер огоньков', 'Light size'], glow: ['Рассеивание света', 'Light diffusion'], pulseDepth: ['Дыхание света', 'Light breathing'],
  support: ['Сила светового сигнала', 'Signal intensity'], signalCount: ['Сигналов за подъём', 'Signals per ascent'], signalLength: ['Длина светового сигнала', 'Signal length'], ribbonOpacity: ['Прозрачность световой ленты', 'Light ribbon opacity'],
  landingSpread: ['Расстояние между выходами', 'Landing separation'], exitLift: ['Подъём над спиралью', 'Lift above the spiral'], platformSize: ['Размер финальных платформ', 'Landing platform size'],
}
const parallelPercentages = new Set<ParallelNumber>(['pulseDepth', 'signalLength', 'ribbonOpacity'])
function ParallelSlider({ setting, value, onChange, timing = false }: { setting: ParallelNumber; value: ParallelSettings; onChange: (next: Partial<ParallelSettings>) => void; timing?: boolean }) {
  const { language } = useLabLanguage(), id = useId(), [draft, setDraft] = useState<string | null>(null)
  const [min, max, step] = parallelBounds[setting], amount = value[setting], label = parallelLabels[setting][language === 'ru' ? 0 : 1]
  const scale = parallelPercentages.has(setting) ? 100 : 1
  const unit = timing ? (language === 'ru' ? ' с' : ' s') : scale === 100 ? '%' : ['guideBrightness', 'selfBrightness', 'lightSize', 'platformSize'].includes(setting) ? '×' : ''
  const commit = () => {
    if (draft !== null && draft.trim() !== '' && Number.isFinite(Number(draft))) onChange({ [setting]: Math.max(min, Math.min(max, Number(draft))) })
    setDraft(null)
  }
  return <div className="diary-control synchronization-control"><span><label htmlFor={id}>{label}</label>
    {timing ? <span className="synchronization-time"><input type="number" aria-label={`${label} (${language === 'ru' ? 'секунды' : 'seconds'})`} min={min} max={max} step={step} value={draft ?? amount} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') { commit(); event.currentTarget.blur() } if (event.key === 'Escape') { setDraft(null); event.currentTarget.blur() } }}/><span>{unit}</span></span>
      : <output htmlFor={id} aria-hidden="true">{Number((amount * scale).toFixed(2))}{unit}</output>}</span>
    <input id={id} type="range" min={min * scale} max={max * scale} step={step * scale} value={amount * scale} onChange={event => { setDraft(null); onChange({ [setting]: Number(event.target.value) / scale }) }}/>
  </div>
}

export function ArchitectureParallelControls({ value, patch, onReplay }: { value: ArchitectureSettings; patch: (value: Partial<ArchitectureSettings>) => void; onReplay: () => void }) {
  const { language } = useLabLanguage(), ru = language === 'ru', s = normalizeParallelSettings(value.parallel)
  const txt = (r: string, e: string) => ru ? r : e
  const update = (next: Partial<ParallelSettings>) => patch({ parallel: normalizeParallelSettings({ ...s, ...next }) })
  const sliders = (...keys: ParallelNumber[]) => keys.map(setting => <ParallelSlider key={setting} setting={setting} value={s} onChange={update}/>)
  const check = (key: 'repeat' | 'rungsEnabled' | 'axisEnabled' | 'platformsEnabled' | 'signalsEnabled', r: string, e: string) => <label className="cw-check"><input type="checkbox" checked={s[key]} onChange={event => update({ [key]: event.target.checked })}/>{txt(r, e)}</label>
  return <>
    <WorkbenchSection name="parallel-mode" title={txt('Режим спирали', 'Spiral mode')} icon="motion">
      <div className="diary-options">{([['together', 'Рядом', 'Together'], ['dialogue', 'Диалог', 'Dialogue'], ['ribbon', 'Световая лента', 'Light ribbon']] as const).map(([key, r, e]) => <button type="button" key={key} aria-pressed={s.mode === key} onClick={() => update({ mode: key })}>{txt(r, e)}</button>)}</div>
      <p className="cw-help">{s.mode === 'together' ? txt('Утверждённая спираль: два огонька движутся рядом по своим линиям. Проводник чуть ярче; в финале оба выходят на один уровень.', 'The approved spiral: two lights follow their own paths side by side. The guide is slightly brighter; both finish at the same height.') : s.mode === 'dialogue'
        ? txt('Световые импульсы идут в обе стороны. Каждый огонёк сохраняет свою траекторию.', 'Light impulses travel in both directions. Each light keeps its own path.')
        : txt('Между линиями проявляется полупрозрачная световая лента. Световая волна поднимается вместе с огоньками.', 'A translucent light ribbon appears between the paths. A wave of light rises with both sources.')}</p>
      {s.mode === 'ribbon' && sliders('ribbonOpacity')}
      <div className="cw-row-actions"><button type="button" aria-pressed={value.playing} onClick={() => patch({ playing: !value.playing })}><LabIcon name={value.playing ? 'pause' : 'play'}/>{value.playing ? txt('Пауза', 'Pause') : txt('Продолжить', 'Resume')}</button><button type="button" onClick={onReplay}><LabIcon name="reset"/>{txt('С начала', 'Restart')}</button></div>
    </WorkbenchSection>
    <WorkbenchSection name="parallel-geometry" title={txt('Геометрия спирали', 'Spiral geometry')} icon="architecture" defaultOpen={false}>
      {sliders('radius', 'height', 'depth', 'turns', 'sway', 'stroke', 'brightness')}
      {check('rungsEnabled', 'Перемычки между линиями', 'Rungs between the paths')}{s.rungsEnabled && sliders('rungs')}
      {check('axisEnabled', 'Опорная сетка и основание', 'Reference grid and base')}{(s.rungsEnabled || s.axisEnabled) && sliders('detail')}
    </WorkbenchSection>
    <WorkbenchSection name="parallel-light" title={txt('Проводник и свет', 'Guide and light')} icon="light" defaultOpen={false}>
      <ColorControl language={language} label={txt('Цвет проводника', 'Guide color')} value={s.guideColor} onChange={guideColor => update({ guideColor })}/>
      <ColorControl language={language} label={txt('Цвет второго огонька', 'Traveler color')} value={value.lightColor} onChange={lightColor => patch({ lightColor })}/>
      {sliders('guideBrightness', 'selfBrightness', 'lightSize', 'glow', 'pulseDepth')}
    </WorkbenchSection>
    <WorkbenchSection name="parallel-signals" title={txt('Сигналы и финал', 'Signals and finale')} icon="pulse" defaultOpen={false}>
      {check('signalsEnabled', 'Сигналы во время подъёма', 'Signals during ascent')}
      {s.signalsEnabled && sliders('signalCount', 'signalLength')}{sliders('support')}
      <p className="cw-help">{txt('Огоньки сначала останавливаются на одном уровне. Только после этого начинается финальный отклик.', 'Both lights first come to rest at the same height. Only then does the final response begin.')}</p>
      <div className="diary-options">{([['confirm', 'Импульс', 'Confirmation'], ['echo', 'Взаимный отклик', 'Mutual response'], ['quiet', 'Тихая пауза', 'Quiet hold']] as const).map(([key, r, e]) => <button type="button" key={key} aria-pressed={s.finale === key} onClick={() => update({ finale: key })}>{txt(r, e)}</button>)}</div>
      {sliders('landingSpread', 'exitLift')}{check('platformsEnabled', 'Финальные платформы', 'Landing platforms')}{s.platformsEnabled && sliders('platformSize')}
    </WorkbenchSection>
    <WorkbenchSection name="parallel-timing" title={txt('Время и запуск', 'Timing and playback')} icon="motion" defaultOpen={false}>
      {parallelStages.map(stage => <ParallelSlider key={stage.key} setting={stage.key} value={s} onChange={update} timing/>)}
      <p className="cw-help">{txt('Общая длительность', 'Total duration')}: <output>{Number(parallelDuration(s).toFixed(2))} {txt('с', 's')}</output></p>
      <div className="diary-options diary-options--two">{([['loop', 'Автоматически', 'Automatic'], ['tap', 'По удержанию', 'On hold']] as const).map(([key, r, e]) => <button type="button" key={key} aria-pressed={value.trigger === key} onClick={() => patch({ trigger: key })}>{txt(r, e)}</button>)}</div>
      {value.trigger === 'loop' && check('repeat', 'Повторять цикл', 'Repeat cycle')}
      {(value.trigger === 'tap' || !s.repeat) && <p className="cw-help">{txt('Один проход остаётся на спокойном финальном кадре. Удержание или «С начала» повторяет анимацию.', 'A single pass holds the calm final frame. Hold the cover or press Restart to replay.')}</p>}
    </WorkbenchSection>
  </>
}
