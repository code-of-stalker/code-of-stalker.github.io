import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ArchitectureCoverProps } from './ArchitectureCover'
import { defaultArchitectureSettings } from './architectureSettings'
import { architectureArtworkTransform } from './architectureGeometry'
import { createParallelPath } from './parallelRenderer'
import { normalizeParallelSettings, parallelDuration, parallelPhase, parallelTimeAtPhase } from './parallelSettings'
import { useCoverGesture } from '../coverGesture'

export function ParallelCover({ settings = defaultArchitectureSettings, active = true, language = 'ru', presentation = 'cover', replayKey = 0, touchKey = 0, controller, onClick, interactive = true }: ArchitectureCoverProps) {
  const ru = language === 'ru', id = `parallel-${useId().replace(/\W/g, '')}`
  const svg = useRef<SVGSVGElement>(null), scene = useRef<SVGSVGElement>(null), parallax = useRef<SVGGElement>(null)
  const [interaction, setInteraction] = useState(0)
  const clock = useRef({ time: 0, replayKey, touchKey, interaction: 0, started: false, trigger: settings.trigger, settings: normalizeParallelSettings(settings.parallel) })
  const aim = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 }), wakeGesture = useRef<() => void>(() => {})
  const hold = () => { if (settings.touchEnabled || settings.trigger === 'tap') setInteraction(value => value + 1) }
  const release = () => {}
  const move = (x: number, y: number) => { aim.current.targetX = x; aim.current.targetY = y; wakeGesture.current() }
  const gesture = useCoverGesture({ holdDelay: settings.holdDelay, disabled: !interactive || !active,
    onHold: hold, onRelease: release, onMove: move, onTap: () => { onClick?.() } })

  useImperativeHandle(controller, () => ({ hold, release, move, svg: () => {
    if (!svg.current) return ''
    const copy = svg.current.cloneNode(true) as SVGSVGElement
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', '288'); copy.setAttribute('height', '160')
    copy.removeAttribute('class'); copy.removeAttribute('aria-hidden'); copy.setAttribute('role', 'img')
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
    title.textContent = ru ? 'Водительство · Параллельный путь' : 'Guidance · Parallel path'; copy.prepend(title)
    for (const node of [copy, ...copy.querySelectorAll('*')]) for (const attr of Array.from(node.attributes)) if (attr.name.startsWith('data-')) node.removeAttribute(attr.name)
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}`
  } }), [settings, ru])

  useEffect(() => {
    const node = scene.current, root = svg.current, offset = parallax.current
    if (!node || !root || !offset) return
    const s = normalizeParallelSettings(settings.parallel), state = clock.current
    const repeat = settings.trigger === 'loop' && s.repeat
    // Preserve the current stage when changing its duration or the visual controls.
    const oldPhase = parallelPhase(state.time, state.settings, settings.trigger === 'loop' && state.settings.repeat)
    const completedCycles = repeat ? Math.floor(state.time / parallelDuration(state.settings)) : 0
    state.time = completedCycles * parallelDuration(s) + parallelTimeAtPhase(oldPhase, s); state.settings = s
    if (state.trigger !== settings.trigger) { state.time = 0; state.started = false; state.trigger = settings.trigger }
    if (state.replayKey !== replayKey || state.touchKey !== touchKey || state.interaction !== interaction) {
      state.time = 0; state.started = true; state.replayKey = replayKey; state.touchKey = touchKey; state.interaction = interaction
    }
    const render = createParallelPath(node, id, { ink: settings.color, warm: settings.lightColor, guide: s.guideColor }, s)
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, last = 0, visible = true
    const canPlay = () => active && visible && !document.hidden && !media.matches
    const advancing = () => settings.playing && (settings.trigger === 'loop' || state.started) && (repeat || state.time < parallelDuration(s))
    function draw(dt: number) {
      if (canPlay() && advancing()) state.time += dt
      const phase = media.matches ? .94 : parallelPhase(state.time, s, repeat)
      render(phase, s)
      root!.dataset.parallelPhase = String(phase)
      root!.dataset.parallelTime = String(state.time)
      const point = aim.current, factor = media.matches ? 1 : 1 - Math.exp(-dt / settings.inertia)
      const x = settings.parallaxEnabled && !media.matches ? point.targetX * settings.parallax : 0
      const y = settings.parallaxEnabled && !media.matches ? point.targetY * settings.parallax * .55 : 0
      point.x += (x - point.x) * factor; point.y += (y - point.y) * factor
      if (!settings.parallaxEnabled) { point.x = 0; point.y = 0 }
      offset!.setAttribute('transform', `translate(${point.x.toFixed(3)} ${point.y.toFixed(3)})`)
      return Math.abs(x - point.x) + Math.abs(y - point.y) > .01
    }
    function tick(now: number) {
      frame = 0
      if (!canPlay()) return
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0
      last = now
      const moving = draw(dt)
      if (advancing() || moving) frame = requestAnimationFrame(tick)
    }
    function wake() {
      cancelAnimationFrame(frame); frame = 0; last = 0; draw(0)
      if (canPlay()) frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; wake() })
    observer.observe(root)
    wakeGesture.current = wake
    document.addEventListener('visibilitychange', wake); media.addEventListener('change', wake)
    wake()
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); wakeGesture.current = () => {}
      document.removeEventListener('visibilitychange', wake); media.removeEventListener('change', wake)
    }
  }, [settings, active, replayKey, touchKey, interaction, id])

  return <button type="button" className="architecture-cover" data-illustration="guidance" data-guidance-variant="parallel" data-theme={settings.theme} data-presentation={presentation} tabIndex={interactive ? undefined : -1}
    aria-label={ru ? 'Архитектура наблюдения · Параллельный путь' : 'Observation architecture · Parallel path'}
    style={{ '--architecture-color': settings.color, '--architecture-bg': settings.theme === 'dark' ? '#000000' : '#FAE6AD' } as CSSProperties} {...gesture}>
    {presentation === 'cover' && settings.frame && <svg className="architecture-frame" viewBox="0 0 288 200" preserveAspectRatio="none" aria-hidden="true"><path d="M.5 .5H270L287.5 18V181L269 199.5H.5Z" fill="none" stroke={settings.color} strokeOpacity=".38"/></svg>}
    <svg className="architecture-artwork" ref={svg} viewBox="0 0 288 160" fill="none" color={settings.color} stroke={settings.color} strokeWidth={settings.parallel.stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g ref={parallax}><g transform={architectureArtworkTransform(settings)}><svg ref={scene} width="288" height="160" viewBox="0 0 288 160" overflow="visible"/></g></g>
    </svg>
    {presentation === 'cover' && settings.labels && <>
      <span className="architecture-serial">01 /</span>
      <span className="architecture-footer"><strong>{ru ? <>Архитектура<br/>Наблюдения</> : <>Observation<br/>Architecture</>}</strong><small>{ru ? 'ВОДИТЕЛЬСТВО · ПАРАЛЛЕЛЬНЫЙ ПУТЬ' : 'GUIDANCE · PARALLEL PATH'}</small></span>
      <svg className="architecture-arrow" viewBox="0 0 24 24" fill="none" stroke={settings.color} strokeWidth="1" aria-hidden="true"><path d="M5 19L19 5M7 5h12v12"/></svg>
    </>}
  </button>
}
