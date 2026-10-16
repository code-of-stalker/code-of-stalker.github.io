import { useId, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useLabLanguage } from '../../i18n/LabLanguage'
import { WorkbenchSection } from '../workbench/WorkbenchSection'
import { LabIcon } from '../LabIcon'
import { ColorControl } from '../ColorControl'
import { applyArchitectureTheme, architectureBounds, defaultArchitectureSettings, parseArchitecturePreset, serializeArchitecturePreset } from './architectureSettings'
import type { ArchitectureNumber, ArchitectureSettings } from './architectureSettings'
import { exportArchitectureComponent } from './architectureExport'
import { ArchitectureDistanceControls } from './ArchitectureDistanceControls'
import { defaultDistanceSettings } from './distanceSettings'
import { ArchitectureSynchronizationControls } from './ArchitectureSynchronizationControls'
import { ArchitectureGuidanceControls } from './ArchitectureGuidanceControls'
import { defaultGuidanceSettings } from './guidanceSettings'
import { defaultSynchronizationSettings } from './synchronizationSettings'

const labels: Record<ArchitectureNumber, [string, string]> = {
  cycle: ['Длительность цикла', 'Cycle duration'], columns: ['Столбцы матрицы', 'Matrix columns'], rows: ['Ряды матрицы', 'Matrix rows'],
  cellSize: ['Размер ячеек', 'Cell size'], spread: ['Расхождение ячеек', 'Cell separation'], frameSpread: ['Раскрытие центральной рамки', 'Central frame opening'],
  startScale: ['Фигура в начале', 'Initial figure size'], figureScale: ['Фигура после раскрытия', 'Expanded figure size'], neighborOpacity: ['Видимость окружающих фигур', 'Surrounding figure opacity'],
  lineWidth: ['Толщина линий', 'Line thickness'], size: ['Размер иллюстрации', 'Artwork size'], offsetX: ['Сдвиг иллюстрации по X', 'Artwork X offset'], offsetY: ['Сдвиг иллюстрации по Y', 'Artwork Y offset'],
  lightSize: ['Размер огонька', 'Inner light size'], lightOffset: ['Высота огонька относительно шеи', 'Light offset from the throat'],
  glow: ['Свечение огонька', 'Inner light glow'], glowRadius: ['Рассеивание света', 'Light diffusion'], lightPulse: ['Пульсация света', 'Light pulse depth'],
  scanWidth: ['Ширина сканера', 'Scan width'], scanStrength: ['Яркость сканера', 'Scan intensity'], touchStrength: ['Сила отклика', 'Touch response strength'],
  touchDuration: ['Длительность отклика', 'Touch response duration'], holdDelay: ['Порог удержания', 'Hold delay'], parallax: ['Глубина параллакса', 'Parallax range'], inertia: ['Инерция движения', 'Motion inertia'],
}
const percentages = new Set<ArchitectureNumber>(['cellSize', 'startScale', 'figureScale', 'neighborOpacity', 'size', 'lightSize', 'lightPulse'])
function ArchitectureSlider({ setting, value, onChange }: { setting: ArchitectureNumber; value: ArchitectureSettings; onChange: (patch: Partial<ArchitectureSettings>) => void }) {
  const { language } = useLabLanguage(), id = useId(), [min, max, step] = architectureBounds[setting]
  const amount = value[setting], percent = percentages.has(setting)
  const unit = ['cycle', 'touchDuration', 'holdDelay', 'inertia'].includes(setting) ? ' s' : ['offsetX', 'offsetY', 'lightOffset', 'scanWidth', 'glowRadius'].includes(setting) ? ' px' : ''
  return <div className="diary-control"><span><label htmlFor={id}>{labels[setting][language === 'ru' ? 0 : 1]}</label><output htmlFor={id} aria-hidden="true">{percent ? `${Math.round(amount * 100)}%` : `${Number(amount.toFixed(2))}${unit}`}</output></span>
    <input id={id} type="range" min={percent ? min * 100 : min} max={percent ? max * 100 : max} step={percent ? step * 100 : step} value={percent ? amount * 100 : amount}
      onChange={event => onChange({ [setting]: Number(event.target.value) / (percent ? 100 : 1) })}/>
  </div>
}

export function ArchitectureControls({ value, onChange, onReplay, onTouch, getSvg, onAdd, placed, onHome }: {
  value: ArchitectureSettings; onChange: Dispatch<SetStateAction<ArchitectureSettings>>; onReplay: () => void; onTouch: () => void
  getSvg: () => string; onAdd: () => void; placed: boolean; onHome: () => void
}) {
  const { language } = useLabLanguage(), ru = language === 'ru', file = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ru: string; en: string } | null>(null), [fallback, setFallback] = useState('')
  const txt = (r: string, e: string) => ru ? r : e
  const patch = (next: Partial<ArchitectureSettings>) => onChange(current => ({ ...current, ...next }))
  const sliders = (...keys: ArchitectureNumber[]) => keys.map(setting => <ArchitectureSlider key={setting} setting={setting} value={value} onChange={patch}/>)
  const check = (key: 'frame' | 'labels' | 'neighbors' | 'scanEnabled' | 'touchEnabled' | 'parallaxEnabled' | 'fadeFigureFrame', r: string, e: string) => <label className="cw-check"><input type="checkbox" checked={value[key]} onChange={event => patch({ [key]: event.target.checked })}/>{txt(r, e)}</label>
  function download(name: string, source: string, type: string) {
    if (!source) { setMessage({ ru: 'Предпросмотр ещё не готов.', en: 'Preview is not ready yet.' }); return }
    const url = URL.createObjectURL(new Blob([source], { type })), link = document.createElement('a')
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setMessage({ ru: `${name} сохранён с текущими настройками.`, en: `${name} saved with your current settings.` })
  }
  async function copy() {
    const code = exportArchitectureComponent(value, language)
    try { await navigator.clipboard.writeText(code); setFallback(''); setMessage({ ru: 'Компонент и настройки скопированы.', en: 'Component and settings copied.' }) }
    catch { setFallback(code); setMessage({ ru: 'Скопируй код из поля или скачай файл.', en: 'Copy the code below or download the file.' }) }
  }
  return <div className="diary-editor architecture-editor">
    <div className="diary-editor-intro">
      <div className="diary-options" aria-label={txt('Состояние Архитектуры', 'Architecture state')}>
        <button type="button" aria-pressed={value.illustration === 'distance'} onClick={() => { patch({ illustration: 'distance' }); onReplay() }}>{txt('Выставь дистанцию', 'Set a distance')}</button>
        <button type="button" aria-pressed={value.illustration === 'cell'} onClick={() => { patch({ illustration: 'cell' }); onReplay() }}>{txt('Ощути себя', 'Feel yourself')}</button>
        <button type="button" aria-pressed={value.illustration === 'synchronization'} onClick={() => { patch({ illustration: 'synchronization' }); onReplay() }}>{txt('Синхронизация', 'Synchronization')}</button>
        <button type="button" aria-pressed={value.illustration === 'guidance'} onClick={() => { patch({ illustration: 'guidance' }); onReplay() }}>{txt('Водительство', 'Guidance')}</button>
      </div>
      <strong>{value.illustration === 'guidance' ? txt('Водительство · Подсказка в узле', 'Guidance · Hint at the junction') : value.illustration === 'synchronization' ? txt('Интенсив · Полная синхронизация', 'Intensive · Full synchronization') : value.illustration === 'distance' ? txt('Между собой и образом', 'Between self and image') : txt('Вне ячейки · Ощути себя', 'Beyond the cell · Feel yourself')}</strong>
      <p className="cw-help">{value.illustration === 'guidance' ? txt('Проводник даёт короткую подсказку на развилке. Второй огонёк выбирает направление и продолжает путь самостоятельно.', 'The guide offers a brief hint at the junction. The other light chooses a direction and continues independently.') : value.illustration === 'synchronization' ? txt('Свет проходит по платформам, собирает систему единой волной и поднимается над ней как источник проекции.', 'Light follows the platforms, unifies the system in one wave and rises above it as the source of its projection.') : value.illustration === 'distance'
        ? txt('Состояние до прогресса в Архитектуре. Свет отделяется от образа человека, затем сканирует его.', 'The state before progress in Architecture. Light separates from the human image, then scans it.')
        : txt('Выбранный четвёртый вариант. Фигура растёт из маленькой ячейки; огонёк остаётся у основания шеи.', 'The selected fourth concept. The figure grows out of a small cell; its inner light stays at the base of the neck.')}</p>
      <div className="cw-row-actions"><button type="button" onClick={onHome}><LabIcon name="layout"/>{txt('Обе плашки на главной', 'Both covers on Home')}</button><button type="button" onClick={onAdd}><LabIcon name={placed ? 'move' : 'plus'}/>{txt('В конструктор', 'Place in builder')}</button></div>
    </div>
    {value.illustration === 'guidance' ? <ArchitectureGuidanceControls value={value} patch={patch} onReplay={onReplay}/> : value.illustration === 'synchronization' ? <ArchitectureSynchronizationControls value={value} patch={patch} onReplay={onReplay}/> : value.illustration === 'distance' ? <ArchitectureDistanceControls value={value} patch={patch} onReplay={onReplay}/> : <>
    <WorkbenchSection name="architecture-motion" title={txt('Движение и режим', 'Motion and mode')} icon="motion">
      <div className="diary-options">{([['release', 'Вне ячейки', 'Beyond the cell'], ['wave', 'Волна', 'Wave'], ['breathe', 'Дыхание', 'Breathing']] as const).map(([key, r, e]) => <button type="button" key={key} aria-pressed={value.motion === key} onClick={() => patch({ motion: key })}>{txt(r, e)}</button>)}</div>
      <p className="cw-help">{value.motion === 'release' ? txt('Утверждённое движение: фигура растёт, рамка раскрывается, матрица отступает.', 'The approved motion: the figure grows, its frame opens and the matrix moves aside.') : value.motion === 'wave'
        ? txt('Свет и движение расходятся по ячейкам от центра, с задержкой по расстоянию.', 'Light and motion travel through the cells from the center, delayed by distance.')
        : txt('Фигура и пространство плавно раскрываются и собираются без остановок.', 'The figure and its surrounding space open and settle continuously.')}</p>
      <div className="diary-options diary-options--two">{([['loop', 'По кругу', 'Loop'], ['tap', 'По удержанию', 'On hold']] as const).map(([key, r, e]) => <button type="button" key={key} aria-pressed={value.trigger === key} onClick={() => patch({ trigger: key })}>{txt(r, e)}</button>)}</div>
      {value.trigger === 'loop' ? sliders('cycle') : <p className="cw-help">{txt('Зажми плашку: фигура приближается и остаётся раскрытой до отпускания. Затем плавно возвращается. Короткое касание открывает раздел.', 'Hold the cover: the figure grows and stays expanded until release, then gently returns. A short tap opens the section.')}</p>}
      <div className="cw-row-actions"><button type="button" aria-pressed={value.playing} onClick={() => patch({ playing: !value.playing })}><LabIcon name={value.playing ? 'pause' : 'play'}/>{value.playing ? txt('Пауза', 'Pause') : txt('Продолжить', 'Resume')}</button><button type="button" onClick={onReplay}><LabIcon name="reset"/>{txt('С начала', 'Restart')}</button></div>
    </WorkbenchSection>
    <WorkbenchSection name="architecture-grid" title={txt('Матрица и фигура', 'Matrix and figure')} icon="architecture" defaultOpen={false}>
      {check('neighbors', 'Окружающие ячейки и фигуры', 'Surrounding cells and figures')}
      {value.neighbors && sliders('columns', 'rows', 'cellSize', 'spread', 'neighborOpacity')}
      {sliders('startScale', 'figureScale', 'frameSpread')}
      {check('fadeFigureFrame', 'Растворять рамку при приближении', 'Fade frame during zoom-in')}
    </WorkbenchSection>
    <WorkbenchSection name="architecture-light" title={txt('Внутренний свет и сканер', 'Inner light and scanner')} icon="light" defaultOpen={false}>
      <ColorControl language={language} label={txt('Цвет света', 'Light color')} value={value.lightColor} onChange={lightColor => patch({ lightColor })}/>
      {sliders('lightSize', 'lightOffset', 'glow', 'glowRadius', 'lightPulse')}
      {check('scanEnabled', 'Сканировать центральную фигуру', 'Scan the central figure')}{value.scanEnabled && sliders('scanWidth', 'scanStrength')}
    </WorkbenchSection>
    </>}
    <WorkbenchSection name="architecture-touch" title={txt('Удержание и параллакс', 'Hold and parallax')} icon="touch" defaultOpen={false}>
      <p className="cw-help">{value.illustration === 'synchronization' || value.illustration === 'guidance' ? txt('Короткое касание открывает раздел. Удержание запускает проход с начала; движение пальца управляет параллаксом.', 'A short tap opens the section. A hold restarts the sequence; dragging controls parallax.') : txt('Короткое касание открывает раздел. Зажми плашку для отклика и двигай палец для параллакса. После отпускания иллюстрация мягко возвращается.', 'A short tap opens the section. Hold the cover for a response and drag for parallax. The artwork gently settles on release.')}</p>
      {sliders('holdDelay')}{check('touchEnabled', 'Анимация при удержании', 'Animate on hold')}
      {value.touchEnabled && value.illustration === 'cell' && <div className="diary-options diary-options--two">{([['open', 'Раскрытие', 'Opening'], ['pulse', 'Импульс', 'Pulse']] as const).map(([key, r, e]) => <button type="button" key={key} aria-pressed={value.touch === key} onClick={() => patch({ touch: key })}>{txt(r, e)}</button>)}</div>}
      {value.illustration === 'cell' && (value.touchEnabled || value.trigger === 'tap') && sliders('touchStrength', 'touchDuration')}
      {value.illustration === 'distance' && <p className="cw-help">{txt('При удержании отдаление и сканирование используют выбранные длительности. В конце прохода фигура остаётся освещённой до отпускания.', 'On hold, retreat and scanning use their selected durations. After the sweep, the figure stays illuminated until release.')}</p>}
      <div className="cw-row-actions"><button type="button" onClick={onTouch}><LabIcon name="touch"/>{txt('Проверить касание', 'Test touch')}</button></div>
      {check('parallaxEnabled', 'Параллакс при движении пальца', 'Parallax while dragging')}{value.parallaxEnabled && sliders('parallax', 'inertia')}
    </WorkbenchSection>
    <WorkbenchSection name="architecture-scene" title={txt('Вид и положение', 'Appearance and position')} icon="sliders" defaultOpen={false}>
      <div className="diary-options diary-options--two">{(['dark', 'light'] as const).map(theme => <button type="button" key={theme} aria-pressed={value.theme === theme} onClick={() => onChange(current => applyArchitectureTheme(current, theme))}>{theme === 'dark' ? txt('Тёмная палитра', 'Dark palette') : txt('Светлая палитра', 'Light palette')}</button>)}</div>
      <ColorControl language={language} label={value.illustration === 'guidance' ? txt('Цвет маршрута', 'Route color') : value.illustration === 'distance' ? txt('Цвет профиля', 'Profile color') : txt('Линии матрицы', 'Matrix lines')} value={value.color} onChange={color => patch({ color })}/>
      {value.illustration === 'cell' && <ColorControl language={language} label={txt('Заливка фигур', 'Figure fill')} value={value.surfaceColor} onChange={surfaceColor => patch({ surfaceColor })}/>}
      {sliders(...(value.illustration === 'cell' ? ['lineWidth', 'size', 'offsetX', 'offsetY'] as const : ['size', 'offsetX', 'offsetY'] as const))}
      {check('frame', 'Контур карточки', 'Card outline')}{check('labels', 'Заголовок и подпись', 'Title and caption')}
    </WorkbenchSection>
    <WorkbenchSection name="architecture-export" title={txt('Сохранить и перенести', 'Save and transfer')} icon="export" defaultOpen={false}>
      <p className="cw-help">{txt('Настройки сохраняются автоматически. Можно перенести пресет или весь компонент с анимацией.', 'Settings save automatically. Transfer a preset or the complete animated component.')}</p>
      <div className="cw-row-actions"><button type="button" onClick={copy}><LabIcon name="copy"/>{txt('Копировать код', 'Copy code')}</button><button type="button" onClick={() => download('PrinceArchitecture.tsx', exportArchitectureComponent(value, language), 'text/plain;charset=utf-8')}>TSX ↓</button></div>
      <div className="cw-row-actions"><button type="button" onClick={() => download('prince-architecture.svg', getSvg(), 'image/svg+xml;charset=utf-8')}>SVG ↓</button><button type="button" onClick={() => download('prince-architecture.json', serializeArchitecturePreset(value), 'application/json')}>JSON ↓</button><button type="button" onClick={() => file.current?.click()}><LabIcon name="source"/>{txt('Загрузить JSON', 'Import JSON')}</button></div>
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={async event => {
        const input = event.currentTarget, selected = input.files?.[0]
        if (!selected) return
        try { if (selected.size > 64_000) throw new Error('Oversized preset'); onChange(parseArchitecturePreset(await selected.text())); setMessage({ ru: 'Пресет применён.', en: 'Preset applied.' }) }
        catch { setMessage({ ru: 'Не удалось прочитать пресет Архитектуры.', en: 'Unable to read an Architecture preset.' }) }
        input.value = ''
      }}/>
      {fallback && <textarea className="cw-code-fallback" aria-label={txt('Код обложки Архитектуры', 'Architecture cover code')} readOnly value={fallback} onFocus={event => event.currentTarget.select()}/>}
      {message && <p className="cw-help" role="status">{ru ? message.ru : message.en}</p>}
      <div className="cw-row-actions"><button type="button" onClick={() => {
        onChange(current => current.illustration === 'guidance' ? { ...current, guidance: { ...defaultGuidanceSettings } } : current.illustration === 'synchronization' ? { ...current, synchronization: { ...defaultSynchronizationSettings } } : current.illustration === 'distance' ? { ...current, distance: { ...defaultDistanceSettings } } : { ...defaultArchitectureSettings, distance: current.distance, synchronization: current.synchronization, guidance: current.guidance }); onReplay()
      }}><LabIcon name="reset"/>{txt('Вернуть утверждённый вариант', 'Restore approved concept')}</button></div>
    </WorkbenchSection>
  </div>
}
