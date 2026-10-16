import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties, Ref } from 'react'
import { defaultDiarySettings } from './diarySettings'
import type { DiarySettings } from './diarySettings'
import { diaryAnimationFrame, diaryLayout, diaryNumber, diaryPlate } from './diaryGeometry'
import { useCoverGesture } from '../coverGesture'
import './diaryCover.css'

export type DiaryCoverHandle = { svg: () => string; hold: () => void; release: () => void; move: (x: number, y: number) => void }
export type DiaryCoverProps = {
  settings?: DiarySettings; active?: boolean; language?: 'ru' | 'en'
  replayKey?: number; touchKey?: number; controller?: Ref<DiaryCoverHandle>; presentation?: 'cover' | 'artwork'
  onClick?: () => void; interactive?: boolean
}

/** The approved Archive of moments artwork. One animation loop, no per-frame React updates. */
export function DiaryCover({ settings = defaultDiarySettings, active = true, language = 'ru', replayKey = 0, touchKey = 0, controller, presentation = 'cover', onClick, interactive = true }: DiaryCoverProps) {
  const id = `diary-${useId().replace(/\W/g, '')}`, svg = useRef<SVGSVGElement>(null)
  const pointer = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 })
  const clock = useRef({ time: 0, touchAge: Infinity, replayKey, touchKey, interaction: 0, holding: false })
  const wakeGesture = useRef<() => void>(() => {})
  const [interaction, setInteraction] = useState(0)
  const plate = diaryPlate(settings), ru = language === 'ru'
  const hold = () => { clock.current.holding = true; if (settings.touchEnabled) setInteraction(value => value + 1) }
  const release = () => { clock.current.holding = false }
  const move = (x: number, y: number) => { pointer.current.targetX = x; pointer.current.targetY = y; wakeGesture.current() }
  const gesture = useCoverGesture({ holdDelay: settings.holdDelay, disabled: !interactive || !active,
    onHold: hold, onRelease: release, onMove: move, onTap: () => { if (settings.touchEnabled) setInteraction(value => value + 1); onClick?.() } })
  useImperativeHandle(controller, () => ({ hold, release, move, svg: () => {
    if (!svg.current) return ''
    const copy = svg.current.cloneNode(true) as SVGSVGElement
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    copy.setAttribute('width', '288'); copy.setAttribute('height', '130')
    copy.removeAttribute('aria-hidden'); copy.setAttribute('role', 'img')
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
    title.textContent = ru ? 'Архив моментов · Дневник' : 'Archive of moments · Diary'
    copy.prepend(title)
    copy.querySelectorAll('*').forEach(node => Array.from(node.attributes).forEach(attr => {
      if (attr.name.startsWith('data-')) node.removeAttribute(attr.name)
    }))
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}`
  } }), [ru, settings])

  useEffect(() => {
    const node = svg.current
    if (!node) return
    const state = clock.current
    if (state.replayKey !== replayKey) { state.time = 0; state.replayKey = replayKey }
    if (state.touchKey !== touchKey || state.interaction !== interaction) {
      state.touchAge = 0; state.touchKey = touchKey; state.interaction = interaction
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const layers = Array.from(node.querySelectorAll<SVGGElement>('[data-diary-layer]'))
    const scans = Array.from(node.querySelectorAll<SVGRectElement>('[data-diary-scan]'))
    const signals = Array.from(node.querySelectorAll<SVGGElement>('[data-diary-signal]'))
    const halo = node.querySelector<SVGEllipseElement>('[data-diary-halo]')!
    const glow = node.querySelector<SVGGElement>('[data-diary-glow]')!
    const trace = node.querySelector<SVGPathElement>('[data-diary-trace]')
    const ripple = node.querySelector<SVGEllipseElement>('[data-diary-ripple]')!
    const parallax = node.querySelector<SVGGElement>('[data-diary-parallax]')!
    const indicator = node.querySelector<SVGCircleElement>('[data-diary-indicator]')!
    let frame = 0, last = 0
    function draw(dt: number) {
      if (!media.matches && active) {
        if (settings.playing) state.time += dt
        state.touchAge += dt
        if (state.holding && Number.isFinite(state.touchAge)) state.touchAge = Math.min(state.touchAge, settings.touchDuration / 2)
      }
      const motion = diaryAnimationFrame(media.matches ? 0 : state.time, settings, media.matches ? Infinity : state.touchAge)
      layers.forEach(layer => {
        const index = Number(layer.dataset.diaryLayer)
        layer.setAttribute('transform', `translate(0 ${motion.offsets[index]})`)
      })
      scans.forEach(scan => {
        const save = settings.touch === 'save' && state.touchAge < settings.touchDuration
        const progress = Math.min(1, state.touchAge / settings.touchDuration)
        scan.setAttribute('opacity', String(Math.min(1, save ? motion.touch * settings.scanStrength : motion.scan)))
        scan.setAttribute('y', String(save ? 46 + (progress * 50 - 24) * settings.tilt - settings.scanWidth / 2 : motion.scanY - settings.scanWidth / 2))
      })
      signals.forEach(group => {
        Array.from(group.children).forEach((element, index) => {
          const signal = motion.signal[index % motion.signal.length]
          if (element.tagName === 'line') {
            element.setAttribute('y1', String(-signal.height)); element.setAttribute('y2', String(signal.height))
          } else if (element.tagName === 'rect') {
            element.setAttribute('fill-opacity', String(Math.min(1, signal.opacity * settings.signalAmount / 2 + motion.touch * .45)))
          } else if (element.tagName === 'text') {
            element.textContent = ((Math.floor(state.time * settings.signalSpeed * 2) + index * 7) % 13 < 6) ? '1' : '0'
            element.setAttribute('opacity', String(Math.min(1, signal.opacity * settings.signalAmount)))
          }
        })
      })
      halo.setAttribute('opacity', String(Math.min(1, motion.halo)))
      glow.setAttribute('opacity', String(Math.min(1, motion.glow)))
      trace?.setAttribute('stroke-dashoffset', String(motion.traceOffset))
      indicator.setAttribute('opacity', String(.35 + motion.touch * .65 + .2 * Math.sin(state.time * 1.5) ** 2))
      const progress = Math.min(1, state.touchAge / settings.touchDuration)
      ripple.setAttribute('rx', String(64 + progress * 46)); ripple.setAttribute('ry', String(24 + progress * 18))
      ripple.setAttribute('opacity', String(settings.touch === 'pulse' ? Math.max(0, (1 - progress) * settings.touchStrength * .6) : 0))
      const aim = pointer.current
      const smoothing = media.matches ? 1 : 1 - Math.exp(-Math.min(dt, .05) / settings.inertia)
      aim.x += ((settings.parallaxEnabled && !media.matches ? aim.targetX * settings.parallax : 0) - aim.x) * smoothing
      aim.y += ((settings.parallaxEnabled && !media.matches ? aim.targetY * settings.parallax * .55 : 0) - aim.y) * smoothing
      parallax.setAttribute('transform', `translate(${diaryNumber(aim.x)} ${diaryNumber(aim.y)})`)
    }
    function tick(now: number) {
      frame = 0
      if (!active || document.hidden || media.matches) return
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0
      last = now; draw(dt)
      const aim = pointer.current
      const moving = settings.parallaxEnabled && (Math.abs(aim.targetX * settings.parallax - aim.x) > .01 || Math.abs(aim.targetY * settings.parallax * .55 - aim.y) > .01)
      if (settings.playing || state.touchAge < settings.touchDuration || moving) frame = requestAnimationFrame(tick)
    }
    function wake() {
      cancelAnimationFrame(frame); frame = 0; last = 0
      draw(0)
      if (active && !document.hidden && !media.matches) frame = requestAnimationFrame(tick)
    }
    function pointerWake() { if (!frame && active && !document.hidden && !media.matches) { last = 0; frame = requestAnimationFrame(tick) } }
    wakeGesture.current = pointerWake
    document.addEventListener('visibilitychange', wake); media.addEventListener('change', wake)
    wake()
    return () => {
      cancelAnimationFrame(frame)
      wakeGesture.current = () => {}
      document.removeEventListener('visibilitychange', wake); media.removeEventListener('change', wake)
    }
  }, [active, settings, replayKey, touchKey, interaction])

  const signal = (blurred = false) => <g data-diary-signal="" transform={plate.signal} fill={settings.color} stroke={settings.color} strokeWidth={blurred ? settings.lineWidth * 3 : settings.lineWidth}>
    {Array.from({ length: settings.signalCount }, (_, index) => {
      const x = index * 34 / (settings.signalCount - 1)
      if (settings.signal === 'voice') return <line key={index} x1={x} x2={x} y1={-2} y2={2}/>
      const columns = Math.ceil(Math.sqrt(settings.signalCount * 1.5)), column = index % columns, row = Math.floor(index / columns)
      const cx = column * 34 / columns, cy = row * 6 - 8
      return settings.signal === 'cells'
        ? <rect key={index} x={cx} y={cy} width={Math.max(2, 34 / columns - 2)} height={4} strokeWidth={settings.lineWidth * .55}/>
        : <text key={index} x={cx} y={cy + 4} fontFamily="monospace" fontSize="5" stroke="none">{index % 2 ? '0' : '1'}</text>
    })}
  </g>
  return <button type="button" className="diary-cover" data-theme={settings.theme} data-signal={settings.signal} data-presentation={presentation} tabIndex={interactive ? undefined : -1}
    aria-label={ru ? 'Дневник · сохранить момент' : 'Diary · save a moment'}
    style={{ '--diary-color': settings.color, '--diary-light': settings.lightColor, '--diary-bg': settings.theme === 'dark' ? '#030402' : '#FAE6AD' } as CSSProperties}
    {...gesture}>
    {presentation === 'cover' && settings.frame && <svg className="diary-frame" viewBox="0 0 288 200" preserveAspectRatio="none" aria-hidden="true"><path d="M.5 .5H270L287.5 18V181L269 199.5H.5Z" fill="none" stroke={settings.color} strokeOpacity=".38"/></svg>}
    <svg className="diary-artwork" ref={svg} viewBox="0 0 288 130" fill="none" stroke={settings.color} strokeWidth={settings.lineWidth} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-surface`} x1="84" y1="24" x2="212" y2="68" gradientUnits="userSpaceOnUse"><stop stopColor={settings.color} stopOpacity=".13"/><stop offset=".65" stopColor={settings.color} stopOpacity=".01"/><stop offset="1" stopColor={settings.color} stopOpacity=".08"/></linearGradient>
        <linearGradient id={`${id}-scan`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={settings.lightColor} stopOpacity="0"/><stop offset=".55" stopColor={settings.lightColor} stopOpacity=".9"/><stop offset="1" stopColor={settings.lightColor} stopOpacity="0"/></linearGradient>
        <radialGradient id={`${id}-halo`}><stop stopColor={settings.color} stopOpacity=".8"/><stop offset="1" stopColor={settings.color} stopOpacity="0"/></radialGradient>
        <filter id={`${id}-glow`} x="-80%" y="-120%" width="260%" height="340%"><feGaussianBlur stdDeviation={settings.glowRadius}/></filter>
        <clipPath id={`${id}-top`}><path d={plate.top}/></clipPath>
        <clipPath id={`${id}-label`}><path d={plate.label}/></clipPath>
      </defs>
      <ellipse data-diary-halo="" cx="148" cy="78" rx="82" ry="46" stroke="none" fill={`url(#${id}-halo)`} opacity={settings.halo}/>
      {settings.guides && <g opacity=".24" strokeWidth={settings.lineWidth * .8}>
        <path d="M64 95L145 123 232 94M66 99V91M230 98V90M145 127V121M71 38H87M79 34V42M225 42H238M231.5 36V48M68 61H56V80H43M44 77V83"/>
        <path d="M225 61V87H247" opacity=".5" strokeDasharray="5 85"/><path d="M246 84H252V90H246Z"/>
      </g>}
      <g data-diary-parallax="">
        <g transform={diaryLayout(settings)}>
          {Array.from({ length: settings.layers }, (_, reverse) => settings.layers - reverse - 1).map(layer => <g key={layer} data-diary-layer={layer} transform={`translate(0 ${layer * settings.layerGap})`} opacity={layer ? settings.layerOpacity : 1}>
            <path d={plate.body} fill={settings.surfaceColor} fillOpacity={settings.surfaceOpacity}/>
            <path d={plate.top} fill={settings.surfaceColor} fillOpacity={settings.surfaceOpacity}/>
            <path d={plate.top} fill={`url(#${id}-surface)`} stroke="none"/>
            <path d={plate.edges} opacity=".24"/><path d={plate.rail} opacity=".5"/><path d={plate.ticks} stroke={settings.lightColor} opacity=".65"/>
            <g clipPath={`url(#${id}-top)`}><rect data-diary-scan="" x="80" y="0" width="136" height={settings.scanWidth} fill={`url(#${id}-scan)`} stroke="none" opacity="0"/></g>
            {layer === 0 && <>
              <path d={plate.label} fill={settings.color} fillOpacity=".07" strokeOpacity=".24"/>
              <g data-diary-glow="" clipPath={`url(#${id}-label)`} filter={`url(#${id}-glow)`} opacity={settings.glow}>{signal(true)}</g>
              <g clipPath={`url(#${id}-label)`}>{signal()}</g>
              {settings.traceEnabled && <path data-diary-trace="" d={plate.top} stroke={settings.lightColor} strokeDasharray={`${settings.traceLength} 370`} strokeWidth={settings.lineWidth * 1.3}/>} 
              <circle data-diary-indicator="" cx="202" cy={46 + 7 * settings.tilt + settings.depth / 2} r="1.3" fill={settings.lightColor} stroke="none"/>
            </>}
          </g>)}
        </g>
      </g>
      <ellipse data-diary-ripple="" cx="148" cy="78" rx="64" ry="24" stroke={settings.lightColor} strokeWidth={settings.lineWidth} opacity="0"/>
    </svg>
    {presentation === 'cover' && settings.labels && <>
      <span className="diary-serial">01 / {ru ? 'ДНЕВНИК' : 'DIARY'}</span>
      <span className="diary-footer"><strong>{ru ? 'Дневник' : 'Diary'}</strong><small>{ru ? 'Сохрани то, что заметил' : 'Keep what you noticed'}</small></span>
      <svg className="diary-arrow" viewBox="0 0 24 24" fill="none" stroke={settings.color} strokeWidth="1" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>
    </>}
  </button>
}
