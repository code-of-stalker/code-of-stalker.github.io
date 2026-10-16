import { useId, useState } from 'react'
import { useLabLanguage } from '../../i18n/LabLanguage'
import { WorkbenchSection } from '../workbench/WorkbenchSection'
import { LabIcon } from '../LabIcon'
import { ColorControl } from '../ColorControl'
import type { ArchitectureSettings } from './architectureSettings'
import { guidanceBounds, guidanceDuration, guidanceStages, normalizeGuidanceSettings } from './guidanceSettings'
import type { GuidanceNumber, GuidanceSettings } from './guidanceSettings'

const guidanceLabels: Record<GuidanceNumber, [string, string]> = {
  approachDuration: ['Подход к развилке', 'Approach the junction'], hintDuration: ['Подсказка и пауза', 'Hint and pause'], departureDuration: ['Самостоятельный путь', 'Independent path'], finalDuration: ['Финал', 'Finale'],
  guideBrightness: ['Яркость проводника', 'Guide brightness'], selfBrightness: ['Яркость второго огонька', 'Traveler brightness'], glow: ['Рассеивание света', 'Light diffusion'], lightSize: ['Размер огоньков', 'Light size'], pulseDepth: ['Дыхание проводника', 'Guide breathing'],
  cueStrength: ['Яркость подсказки', 'Hint brightness'], cueWidth: ['Толщина подсказки', 'Hint thickness'], trailLength: ['Длина следа', 'Trail length'],
  spread: ['Раскрытие развилки', 'Junction spread'], platformSize: ['Размер платформ', 'Platform size'], platformBrightness: ['Яркость платформ', 'Platform brightness'], routeBrightness: ['Яркость выбранного пути', 'Chosen path brightness'], inactiveOpacity: ['Видимость остальных веток', 'Other branch visibility'],
  stroke: ['Толщина линий', 'Line thickness'], guideX: ['Проводник по горизонтали', 'Guide horizontal position'], guideY: ['Проводник по вертикали', 'Guide vertical position'],
}
const guidancePercentages = new Set<GuidanceNumber>(['pulseDepth', 'trailLength', 'platformBrightness', 'routeBrightness', 'inactiveOpacity'])
function GuidanceSlider({ setting, value, onChange, timing = false }: { setting: GuidanceNumber; value: GuidanceSettings; onChange: (patch: Partial<GuidanceSettings>) => void; timing?: boolean }) {
  const { language } = useLabLanguage(), id = useId(), [draft, setDraft] = useState<string | null>(null)
  const [min, max, step] = guidanceBounds[setting], amount = value[setting], label = guidanceLabels[setting][language === 'ru' ? 0 : 1]
  const scale = guidancePercentages.has(setting) ? 100 : 1
  const unit = timing ? (language === 'ru' ? ' с' : ' s') : scale === 100 ? '%' : ['guideBrightness', 'selfBrightness', 'spread', 'platformSize', 'lightSize'].includes(setting) ? '×' : ''
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

export function ArchitectureGuidanceControls({ value, patch, onReplay }: { value: ArchitectureSettings; patch: (value: Partial<ArchitectureSettings>) => void; onReplay: () => void }) {
  const { language } = useLabLanguage(), ru = language === 'ru', s = normalizeGuidanceSettings(value.guidance)
  const txt = (r: string, e: string) => ru ? r : e
  const update = (next: Partial<GuidanceSettings>) => patch({ guidance: normalizeGuidanceSettings({ ...s, ...next }) })
  const sliders = (...keys: GuidanceNumber[]) => keys.map(setting => <GuidanceSlider key={setting} setting={setting} value={s} onChange={update}/>)
  const check = (key: 'repeat' | 'platforms' | 'trail' | 'connection' | 'confirmation', r: string, e: string) => <label className="cw-check"><input type="checkbox" checked={s[key]} onChange={event => update({ [key]: event.target.checked })}/>{txt(r, e)}</label>
  return <>
    <WorkbenchSection name="guidance-mode" title={txt('Режим подсказки', 'Hint mode')} icon="motion">
      <div className="diary-options">{([['hint', 'Пунктир', 'Dashed hint'], ['pulse', 'Импульс', 'Pulse'], ['beam', 'Световой путь', 'Light path']] as const).map(([key, r, e]) => <button type="button" key={key} aria-pressed={s.mode === key} onClick={() => update({ mode: key })}>{txt(r, e)}</button>)}</div>
      <p className="cw-help">{s.mode === 'hint' ? txt('Утверждённый вариант: короткая пунктирная подсказка на развилке. Затем огонёк идёт сам.', 'The approved concept: a brief dashed hint at the junction. The light then continues independently.') : s.mode === 'pulse'
        ? txt('Проводник передаёт один импульс в узел. Он проходит по выбранной ветке и гаснет перед движением второго огонька.', 'The guide sends a single impulse into the junction. It travels down the chosen branch and fades before the traveler moves.')
        : txt('Мягкий свет проводника раскрывает направление. Подсветка постепенно растворяется, оставляя самостоятельный путь.', 'Soft guide light reveals the direction. The illumination gradually dissolves, leaving an independent path.')}</p>
      <div className="cw-row-actions"><button type="button" aria-pressed={value.playing} onClick={() => patch({ playing: !value.playing })}><LabIcon name={value.playing ? 'pause' : 'play'}/>{value.playing ? txt('Пауза', 'Pause') : txt('Продолжить', 'Resume')}</button><button type="button" onClick={onReplay}><LabIcon name="reset"/>{txt('С начала', 'Restart')}</button></div>
    </WorkbenchSection>
    <WorkbenchSection name="guidance-route" title={txt('Развилка и направление', 'Junction and direction')} icon="architecture" defaultOpen={false}>
      <div className="diary-options" aria-label={txt('Направление пути', 'Path direction')}>{([['upper', 'Вверх', 'Upper'], ['middle', 'Прямо', 'Middle'], ['lower', 'Вниз', 'Lower'], ['alternate', 'По очереди', 'Alternating']] as const).map(([key, r, e]) => <button type="button" key={key} aria-pressed={s.branch === key} onClick={() => { update({ branch: key }); onReplay() }}>{txt(r, e)}</button>)}</div>
      {s.branch === 'alternate' && <p className="cw-help">{txt('Каждый повтор выбирает следующую ветку: прямо, вверх, вниз.', 'Each repeated cycle chooses the next branch: middle, upper, lower.')}</p>}
      {sliders('spread', 'stroke', 'routeBrightness', 'inactiveOpacity')}
      {check('platforms', 'Платформы под узлами', 'Platforms beneath the nodes')}{s.platforms && sliders('platformSize', 'platformBrightness')}
    </WorkbenchSection>
    <WorkbenchSection name="guidance-light" title={txt('Проводник и огоньки', 'Guide and lights')} icon="light" defaultOpen={false}>
      <ColorControl language={language} label={txt('Цвет проводника', 'Guide color')} value={s.guideColor} onChange={guideColor => update({ guideColor })}/>
      <ColorControl language={language} label={txt('Цвет второго огонька', 'Traveler color')} value={value.lightColor} onChange={lightColor => patch({ lightColor })}/>
      {sliders('guideBrightness', 'selfBrightness', 'glow', 'lightSize', 'pulseDepth', 'guideX', 'guideY')}
    </WorkbenchSection>
    <WorkbenchSection name="guidance-hint" title={txt('Подсказка, след и отклик', 'Hint, trail and response')} icon="scan" defaultOpen={false}>
      {sliders('cueStrength', 'cueWidth')}
      {check('connection', 'Связь с проводником', 'Connection to the guide')}
      {check('trail', 'Световой след', 'Light trail')}{s.trail && sliders('trailLength')}
      {check('confirmation', 'Импульсы на развилке и в финале', 'Junction and arrival pulses')}
    </WorkbenchSection>
    <WorkbenchSection name="guidance-timing" title={txt('Время и запуск', 'Timing and playback')} icon="motion" defaultOpen={false}>
      <p className="cw-help">{txt('Сначала свет скрыт. Огонёк доходит до узла, получает подсказку и продолжает путь. Этапы настраиваются независимо.', 'Light starts hidden. The traveler reaches the junction, receives a hint and continues. Adjust each stage independently.')}</p>
      {guidanceStages.map(stage => <GuidanceSlider key={stage.key} setting={stage.key} value={s} onChange={update} timing/>)}
      <p className="cw-help">{txt('Общая длительность', 'Total duration')}: <output>{Number(guidanceDuration(s).toFixed(2))} {txt('с', 's')}</output></p>
      <div className="diary-options diary-options--two">{([['loop', 'Автоматически', 'Automatic'], ['tap', 'По удержанию', 'On hold']] as const).map(([key, r, e]) => <button type="button" key={key} aria-pressed={value.trigger === key} onClick={() => patch({ trigger: key })}>{txt(r, e)}</button>)}</div>
      {value.trigger === 'loop' && check('repeat', 'Повторять цикл', 'Repeat cycle')}
      {(value.trigger === 'tap' || !s.repeat) && <p className="cw-help">{txt('Один проход остаётся на финальном кадре. Удержание или «С начала» запускает его заново.', 'A single pass holds the final frame. Hold the cover or press Restart to replay.')}</p>}
    </WorkbenchSection>
  </>
}
