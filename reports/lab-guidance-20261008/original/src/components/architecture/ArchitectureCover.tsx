import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties, Ref } from 'react'
import { defaultArchitectureSettings } from './architectureSettings'
import type { ArchitectureSettings } from './architectureSettings'
import { architectureAnimationFrame, architectureArtworkTransform, architectureBody, architectureCorners, architectureDetail, architectureGrid, architectureNumber } from './architectureGeometry'
import { useCoverGesture } from '../coverGesture'
import './architectureCover.css'
import { DistanceCover } from './DistanceCover'
import { SynchronizationCover } from './SynchronizationCover'

export type ArchitectureCoverHandle = { svg: () => string; hold: () => void; release: () => void; move: (x: number, y: number) => void }
export type ArchitectureCoverProps = {
  settings?: ArchitectureSettings; active?: boolean; language?: 'ru' | 'en'; presentation?: 'cover' | 'artwork'
  replayKey?: number; touchKey?: number; controller?: Ref<ArchitectureCoverHandle>; onClick?: () => void; interactive?: boolean
}

/** One SVG animation loop. The React tree is updated only when settings change. */
export function ArchitectureCover(props: ArchitectureCoverProps) {
  if (props.settings?.illustration === 'synchronization') return <SynchronizationCover {...props}/>
  return props.settings?.illustration === 'distance' ? <DistanceCover {...props}/> : <CellArchitectureCover {...props}/>
}

function CellArchitectureCover({ settings = defaultArchitectureSettings, active = true, language = 'ru', presentation = 'cover', replayKey = 0, touchKey = 0, controller, onClick, interactive = true }: ArchitectureCoverProps) {
  const id = `architecture-${useId().replace(/\W/g, '')}`, svg = useRef<SVGSVGElement>(null), ru = language === 'ru'
  const clock = useRef({ time: 0, touchAge: Infinity, replayKey, touchKey, interaction: 0, holding: false })
  const aim = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 })
  const wakeGesture = useRef<() => void>(() => {})
  const [interaction, setInteraction] = useState(0)
  const initial = architectureAnimationFrame(0, settings)
  const hold = () => { clock.current.holding = true; if (settings.touchEnabled || settings.trigger === 'tap') setInteraction(value => value + 1) }
  const release = () => { clock.current.holding = false }
  const move = (x: number, y: number) => { aim.current.targetX = x; aim.current.targetY = y; wakeGesture.current() }
  const gesture = useCoverGesture({ holdDelay: settings.holdDelay, disabled: !interactive || !active,
    onHold: hold, onRelease: release, onMove: move, onTap: () => { if (settings.touchEnabled || settings.trigger === 'tap') setInteraction(value => value + 1); onClick?.() } })
  useImperativeHandle(controller, () => ({ hold, release, move, svg: () => {
    if (!svg.current) return ''
    const copy = svg.current.cloneNode(true) as SVGSVGElement
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', '288'); copy.setAttribute('height', '156')
    copy.removeAttribute('class'); copy.removeAttribute('aria-hidden'); copy.setAttribute('role', 'img')
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
    title.textContent = ru ? 'Вне ячейки · Ощути себя' : 'Beyond the cell · Feel yourself'; copy.prepend(title)
    const elements = [copy, ...copy.querySelectorAll('*')]
    elements.forEach(node => Array.from(node.attributes).forEach(attr => { if (attr.name.startsWith('data-')) node.removeAttribute(attr.name) }))
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}`
  } }), [ru, settings])

  useEffect(() => {
    const element = svg.current
    if (!element) return
    const node = element
    const state = clock.current
    if (state.replayKey !== replayKey) { state.time = 0; state.touchAge = Infinity; state.replayKey = replayKey }
    if (state.touchKey !== touchKey || state.interaction !== interaction) { state.touchAge = 0; state.touchKey = touchKey; state.interaction = interaction }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const cells = Array.from(node.querySelectorAll<SVGGElement>('[data-architecture-cell]'))
    const person = node.querySelector<SVGGElement>('[data-architecture-person]')!
    const corners = node.querySelector<SVGPathElement>('[data-architecture-corners]')!
    const light = node.querySelector<SVGGElement>('[data-architecture-light]')!
    const scan = node.querySelector<SVGRectElement>('[data-architecture-scan]')!
    const ripple = node.querySelector<SVGCircleElement>('[data-architecture-ripple]')!
    const parallax = node.querySelector<SVGGElement>('[data-architecture-parallax]')!
    let frame = 0, last = 0
    function draw(dt: number) {
      if (active && !media.matches) {
        if (settings.playing) state.time += dt
        state.touchAge += dt
        if (state.holding && Number.isFinite(state.touchAge)) state.touchAge = Math.min(state.touchAge, settings.touchDuration / 2)
      }
      const motion = architectureAnimationFrame(media.matches ? settings.cycle * .55 : state.time, settings, media.matches ? Infinity : state.touchAge)
      node.dataset.architecturePhase = architectureNumber(motion.phase).toString()
      cells.forEach((cell, index) => {
        const value = motion.cells[index]
        cell.setAttribute('transform', `translate(${architectureNumber(value.x)} ${architectureNumber(value.y)}) scale(${settings.cellSize})`)
        cell.setAttribute('opacity', String(value.opacity))
      })
      person.setAttribute('transform', `translate(144 ${architectureNumber(motion.personY)}) scale(${architectureNumber(motion.personScale)})`)
      corners.setAttribute('transform', `translate(144 77) scale(${architectureNumber(motion.frameScale)}) translate(-144 -77)`)
      corners.setAttribute('opacity', String(motion.frameOpacity))
      light.setAttribute('transform', `translate(144 ${architectureNumber(motion.lightY)}) scale(${settings.lightSize})`)
      light.setAttribute('opacity', String(Math.min(1, motion.lightOpacity)))
      scan.setAttribute('y', String(motion.scanY)); scan.setAttribute('opacity', String(motion.scanOpacity))
      ripple.setAttribute('r', String(motion.rippleRadius)); ripple.setAttribute('cy', String(motion.lightY)); ripple.setAttribute('opacity', String(motion.rippleOpacity))
      const point = aim.current, smoothing = media.matches ? 1 : 1 - Math.exp(-Math.min(dt, .05) / settings.inertia)
      point.x += ((settings.parallaxEnabled && !media.matches ? point.targetX * settings.parallax : 0) - point.x) * smoothing
      point.y += ((settings.parallaxEnabled && !media.matches ? point.targetY * settings.parallax * .55 : 0) - point.y) * smoothing
      parallax.setAttribute('transform', `translate(${architectureNumber(point.x)} ${architectureNumber(point.y)})`)
    }
    function tick(now: number) {
      frame = 0
      if (!active || document.hidden || media.matches) return
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0
      last = now; draw(dt)
      const point = aim.current, moving = settings.parallaxEnabled && (Math.abs(point.targetX * settings.parallax - point.x) > .01 || Math.abs(point.targetY * settings.parallax * .55 - point.y) > .01)
      if ((settings.playing && settings.trigger === 'loop') || state.touchAge < settings.touchDuration || moving) frame = requestAnimationFrame(tick)
    }
    function wake() {
      cancelAnimationFrame(frame); frame = 0; last = 0; draw(0)
      if (active && !document.hidden && !media.matches) frame = requestAnimationFrame(tick)
    }
    function pointerWake() { if (!frame && active && !document.hidden && !media.matches) { last = 0; frame = requestAnimationFrame(tick) } }
    wakeGesture.current = pointerWake
    document.addEventListener('visibilitychange', wake); media.addEventListener('change', wake)
    wake()
    return () => {
      cancelAnimationFrame(frame); wakeGesture.current = () => {}
      document.removeEventListener('visibilitychange', wake); media.removeEventListener('change', wake)
    }
  }, [settings, active, replayKey, touchKey, interaction])

  return <button type="button" className="architecture-cover" data-theme={settings.theme} data-presentation={presentation} data-motion={settings.motion} tabIndex={interactive ? undefined : -1}
    aria-label={ru ? 'Архитектура наблюдения · Ощути себя' : 'Observation architecture · Feel yourself'}
    style={{ '--architecture-color': settings.color, '--architecture-bg': settings.theme === 'dark' ? '#000000' : '#FAE6AD' } as CSSProperties}
    {...gesture}>
    {presentation === 'cover' && settings.frame && <svg className="architecture-frame" viewBox="0 0 288 200" preserveAspectRatio="none" aria-hidden="true"><path d="M.5 .5H270L287.5 18V181L269 199.5H.5Z" fill="none" stroke={settings.color} strokeOpacity=".38"/></svg>}
    <svg className="architecture-artwork" ref={svg} viewBox="0 0 288 156" fill="none" stroke={settings.color} strokeWidth={settings.lineWidth} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <defs>
        <filter id={`${id}-glow`} x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation={settings.glowRadius}/></filter>
        <clipPath id={`${id}-body`}><path d={architectureBody}/></clipPath>
        <linearGradient id={`${id}-scan`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={settings.lightColor} stopOpacity="0"/><stop offset=".5" stopColor={settings.lightColor}/><stop offset="1" stopColor={settings.lightColor} stopOpacity="0"/></linearGradient>
      </defs>
      <g data-architecture-parallax=""><g transform={architectureArtworkTransform(settings)}>
        {settings.neighbors && <g>{architectureGrid(settings).map(cell => <g key={cell.id} data-architecture-cell={cell.id} transform={`translate(${cell.x} ${cell.y}) scale(${settings.cellSize})`} opacity={settings.neighborOpacity}>
          <path d="M-17-14H13L17-10V14H-17Z" strokeWidth={settings.lineWidth * .7}/>
          <g transform="translate(0 -10) scale(.2)" opacity=".7"><path d={architectureBody} fill={settings.surfaceColor}/><path d={architectureDetail} strokeWidth={settings.lineWidth * .7} opacity=".5"/></g>
        </g>)}</g>}
        <path data-architecture-corners="" d={architectureCorners} opacity=".7" transform={`translate(144 77) scale(${initial.frameScale}) translate(-144 -77)`}/>
        <g data-architecture-person="" transform={`translate(144 ${initial.personY}) scale(${initial.personScale})`}>
          <path d={architectureBody} fill={settings.surfaceColor}/><path d={architectureDetail} opacity=".5" strokeWidth={settings.lineWidth * .7}/>
          <g clipPath={`url(#${id}-body)`}><rect data-architecture-scan="" x="-35" y="-5" width="70" height={settings.scanWidth} stroke="none" fill={`url(#${id}-scan)`} opacity="0"/></g>
        </g>
        <g data-architecture-light="" transform={`translate(144 ${initial.lightY}) scale(${settings.lightSize})`} opacity={initial.lightOpacity}>
          <circle r="12" fill={settings.lightColor} stroke="none" filter={`url(#${id}-glow)`} opacity={settings.glow}/>
          <circle r="3" fill={settings.lightColor} stroke="none"/><circle r="7" stroke={settings.lightColor} opacity=".65"/>
        </g>
        <circle data-architecture-ripple="" cx="144" cy={initial.lightY} r="8" opacity="0" stroke={settings.lightColor}/>
      </g></g>
    </svg>
    {presentation === 'cover' && settings.labels && <>
      <span className="architecture-serial">01 /</span>
      <span className="architecture-footer"><strong>{ru ? <>Архитектура<br/>Наблюдения</> : <>Observation<br/>Architecture</>}</strong><small>{ru ? 'БАЗОВЫЙ · ШАГ 1' : 'BASIC · STEP 1'}</small></span>
      <svg className="architecture-arrow" viewBox="0 0 24 24" fill="none" stroke={settings.color} strokeWidth="1" aria-hidden="true"><path d="M5 19L19 5M7 5h12v12"/></svg>
    </>}
  </button>
}
