import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ArchitectureCoverProps } from './ArchitectureCover'
import { defaultArchitectureSettings } from './architectureSettings'
import { architectureArtworkTransform, architectureNumber } from './architectureGeometry'
import { distanceAnimationFrame, distanceCanvas, distanceProfile, distanceProfileThickness, distanceScanLighting, distanceTimeline } from './distanceGeometry'
import { useCoverGesture } from '../coverGesture'
import { normalizeDistanceSettings } from './distanceSettings'
import { distanceVoiceCapacity } from './distanceVoice'

export function DistanceCover({ settings = defaultArchitectureSettings, active = true, language = 'ru', presentation = 'cover', replayKey = 0, touchKey = 0, controller, onClick, interactive = true }: ArchitectureCoverProps) {
  const ru = language === 'ru', d = normalizeDistanceSettings(settings.distance), id = `distance-${useId().replace(/\W/g, '')}`
  const svg = useRef<SVGSVGElement>(null), [interaction, setInteraction] = useState(0)
  const state = useRef({ time: 0, age: Infinity, replayKey, touchKey, interaction: 0, holding: false })
  const aim = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 }), wakeGesture = useRef<() => void>(() => {})
  const initial = distanceAnimationFrame(0, settings)
  const hold = () => {
    state.current.holding = true
    if (settings.touchEnabled || settings.trigger === 'tap') setInteraction(value => value + 1)
  }
  const release = () => { state.current.holding = false }
  const move = (x: number, y: number) => { aim.current.targetX = x; aim.current.targetY = y; wakeGesture.current() }
  const gesture = useCoverGesture({ holdDelay: settings.holdDelay, disabled: !interactive || !active,
    onHold: hold, onRelease: release, onMove: move, onTap: () => { if (settings.trigger === 'tap') setInteraction(value => value + 1); onClick?.() } })
  useImperativeHandle(controller, () => ({ hold, release, move, svg: () => {
    if (!svg.current) return ''
    const copy = svg.current.cloneNode(true) as SVGSVGElement
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', '288'); copy.setAttribute('height', '200')
    copy.removeAttribute('class'); copy.removeAttribute('aria-hidden'); copy.setAttribute('role', 'img')
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
    title.textContent = ru ? 'Между собой и образом · Выставь дистанцию' : 'Between self and image · Set a distance'
    copy.prepend(title)
    for (const node of [copy, ...copy.querySelectorAll('*')]) for (const attr of Array.from(node.attributes)) if (attr.name.startsWith('data-')) node.removeAttribute(attr.name)
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}`
  } }), [settings, ru])

  useEffect(() => {
    const element = svg.current
    if (!element) return
    const node = element
    const clock = state.current
    const timeline = distanceTimeline(d)
    const heldAge = timeline.scanEnd + .25
    const interactionDuration = settings.trigger === 'tap' ? timeline.cycle : settings.touchDuration
    if (clock.replayKey !== replayKey) { clock.time = 0; clock.age = Infinity; clock.replayKey = replayKey }
    if (clock.touchKey !== touchKey || clock.interaction !== interaction) {
      clock.age = 0; clock.touchKey = touchKey; clock.interaction = interaction
      if (settings.trigger === 'loop') clock.time = 0
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const select = <T extends SVGElement>(selector: string) => node.querySelector<T>(selector)!
    const person = select<SVGGElement>('[data-distance-person]'), base = select<SVGGElement>('[data-distance-base]')
    const plane = select<SVGGElement>('[data-distance-plane]'), light = select<SVGGElement>('[data-distance-source]')
    const halo = select<SVGGElement>('[data-distance-halo]'), flare = select<SVGGElement>('[data-distance-flare]')
    const beam = select<SVGGElement>('[data-distance-beam]'), beamGlow = select<SVGPathElement>('[data-distance-beam-glow]')
    const projection = select<SVGGElement>('[data-distance-projection]')
    const scanRay = select<SVGPathElement>('[data-distance-scan-ray]'), scanFront = select<SVGPathElement>('[data-distance-scan-front]')
    const gradient = select<SVGLinearGradientElement>('[data-distance-gradient]')
    const scanGradient = select<SVGLinearGradientElement>('[data-distance-scan-gradient]')
    const rays = Array.from(node.querySelectorAll<SVGPathElement>('[data-distance-ray]'))
    const band = select<SVGRectElement>('[data-distance-band]'), scan = select<SVGGElement>('[data-distance-scan]')
    const scanFilters = Array.from(node.querySelectorAll<SVGFilterElement>('[data-distance-scan-filter]'))
    const voice = select<SVGGElement>('[data-distance-voice]'), mouth = select<SVGCircleElement>('[data-distance-mouth]')
    const voiceWaves = Array.from(node.querySelectorAll<SVGPathElement>('[data-distance-voice-wave]'))
    const auraGain = select<SVGFEFuncAElement>('[data-distance-aura-gain]'), coreGain = select<SVGFEFuncAElement>('[data-distance-core-gain]')
    const scanWhite = select<SVGGElement>('[data-distance-scan-white]'), scanLight = distanceScanLighting(d.scanStrength, d.scanBlur)
    const parallax = select<SVGGElement>('[data-distance-parallax]')
    let frame = 0, last = 0
    function draw(dt: number) {
      if (active && !media.matches) {
        if (settings.playing) clock.time += dt
        clock.age += dt
        if (clock.holding && Number.isFinite(clock.age)) clock.age = Math.min(clock.age, heldAge)
      }
      const motion = distanceAnimationFrame(clock.time, settings, clock.age)
      node.dataset.distancePhase = String(architectureNumber(motion.phase))
      node.dataset.distanceTime = String(architectureNumber(motion.time))
      node.dataset.scanProgress = String(architectureNumber(motion.scanProgress))
      node.dataset.scanY = String(architectureNumber(motion.scanY))
      node.dataset.scanFrom = String(architectureNumber(motion.scanFrom)); node.dataset.scanTo = String(architectureNumber(motion.scanTo))
      node.dataset.scanHit = String(motion.scanHit)
      node.dataset.voiceLevel = String(architectureNumber(motion.voice.level))
      node.dataset.voiceResponse = String(architectureNumber(motion.voice.response))
      person.setAttribute('transform', `translate(${architectureNumber(motion.shift)} 0)`)
      base.setAttribute('opacity', String(motion.profileOpacity)); plane.setAttribute('opacity', String(motion.planeOpacity))
      light.setAttribute('transform', `translate(${architectureNumber(motion.sourceX)} ${architectureNumber(motion.sourceY)})`)
      light.setAttribute('opacity', String(motion.light))
      halo.setAttribute('transform', `scale(${architectureNumber(motion.haloScale)})`)
      flare.setAttribute('transform', `scale(${d.lightSize}) rotate(${architectureNumber(motion.phase * 18 - 9)})`)
      projection.setAttribute('opacity', String(motion.projection))
      beam.setAttribute('opacity', String(motion.scanOpacity))
      beamGlow.setAttribute('d', motion.scanRay)
      scanRay.setAttribute('d', motion.scanRay); scanFront.setAttribute('d', motion.scanFront)
      gradient.setAttribute('x1', String(motion.sourceX)); gradient.setAttribute('y1', String(motion.sourceY))
      gradient.setAttribute('x2', String(motion.rayEndX)); gradient.setAttribute('y2', String(motion.rayEndY))
      rays.forEach((ray, index) => ray.setAttribute('d', motion.rays[index]))
      band.setAttribute('x', String(-144 + motion.shift)); band.setAttribute('y', String(motion.scanTop)); band.setAttribute('height', String(motion.scanBottom - motion.scanTop)); band.setAttribute('transform', `translate(${-motion.shift} 0)`)
      scanGradient.setAttribute('y1', String(motion.scanTop)); scanGradient.setAttribute('y2', String(motion.scanBottom))
      scanFilters.forEach(filter => { filter.setAttribute('y', String(motion.scanTop - 64)); filter.setAttribute('height', String(d.scanWidth + 128)) })
      scan.setAttribute('opacity', String(motion.scanOpacity))
      auraGain.setAttribute('slope', String(scanLight.auraGain * motion.voice.scanGain))
      coreGain.setAttribute('slope', String(scanLight.coreGain * motion.voice.scanGain))
      scanWhite.setAttribute('opacity', String(Math.min(.95, scanLight.whiteOpacity * motion.voice.scanGain)))
      voice.setAttribute('transform', `translate(${architectureNumber(motion.voice.mouthX)} ${motion.voice.mouthY}) rotate(${architectureNumber(motion.voice.angle)})`)
      voiceWaves.forEach((path, index) => {
        const wave = motion.voice.waves[index % distanceVoiceCapacity]
        path.setAttribute('d', wave.path); path.setAttribute('opacity', String(wave.opacity)); path.setAttribute('stroke-width', String(wave.width))
      })
      mouth.setAttribute('r', String(.45 + motion.voice.level * .35))
      mouth.setAttribute('opacity', String(motion.voice.level * d.voiceOpacity * .7))
      const point = aim.current, factor = media.matches ? 1 : 1 - Math.exp(-Math.min(dt, .05) / settings.inertia)
      point.x += ((settings.parallaxEnabled && !media.matches ? point.targetX * settings.parallax : 0) - point.x) * factor
      point.y += ((settings.parallaxEnabled && !media.matches ? point.targetY * settings.parallax * .55 : 0) - point.y) * factor
      parallax.setAttribute('transform', `translate(${architectureNumber(point.x)} ${architectureNumber(point.y)})`)
    }
    function tick(now: number) {
      frame = 0
      if (!active || document.hidden || media.matches) return
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0
      last = now; draw(dt)
      const point = aim.current, moving = settings.parallaxEnabled && (Math.abs(point.targetX * settings.parallax - point.x) > .01 || Math.abs(point.targetY * settings.parallax * .55 - point.y) > .01)
      if ((settings.playing && settings.trigger === 'loop') || clock.age < interactionDuration || moving) frame = requestAnimationFrame(tick)
    }
    function wake() {
      cancelAnimationFrame(frame); frame = 0; last = 0; draw(0)
      if (active && !document.hidden && !media.matches) frame = requestAnimationFrame(tick)
    }
    function pointerWake() { if (!frame && active && !document.hidden && !media.matches) { last = 0; frame = requestAnimationFrame(tick) } }
    wakeGesture.current = pointerWake
    document.addEventListener('visibilitychange', wake); media.addEventListener('change', wake)
    wake()
    return () => { cancelAnimationFrame(frame); wakeGesture.current = () => {}; document.removeEventListener('visibilitychange', wake); media.removeEventListener('change', wake) }
  }, [settings, active, replayKey, touchKey, interaction])

  const thickness = distanceProfileThickness(d.profileWidth), scanLight = distanceScanLighting(d.scanStrength, d.scanBlur)
  const profile = <g transform="translate(-18 -8) scale(2.05)" fill="currentColor" stroke="none" fillRule="evenodd">
    <path data-distance-outline="" d={distanceProfile.outline} mask={thickness.trim > 0 ? `url(#${id}-profile-line)` : undefined} stroke={thickness.expand > 0 ? 'currentColor' : 'none'} strokeWidth={thickness.expand}/>
    <path data-distance-eye="" d={distanceProfile.eye}/>
  </g>
  const scanProfile = <g mask={`url(#${id}-scan-window)`}>{profile}</g>
  return <button type="button" className="architecture-cover" data-illustration="distance" data-theme={settings.theme} data-presentation={presentation} tabIndex={interactive ? undefined : -1}
    aria-label={ru ? 'Архитектура наблюдения · Выставь дистанцию' : 'Observation architecture · Set a distance'}
    style={{ '--architecture-color': settings.color, '--architecture-bg': settings.theme === 'dark' ? '#000000' : '#FAE6AD' } as CSSProperties} {...gesture}>
    {presentation === 'cover' && settings.frame && <svg className="architecture-frame" viewBox="0 0 288 200" preserveAspectRatio="none" aria-hidden="true"><path d="M.5 .5H270L287.5 18V181L269 199.5H.5Z" fill="none" stroke={settings.color} strokeOpacity=".38"/></svg>}
    <svg ref={svg} className="architecture-artwork" viewBox="0 0 288 200" fill="none" color={settings.color} stroke={settings.color} strokeWidth={d.profileWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <defs>
        <mask id={`${id}-profile-line`} maskUnits="userSpaceOnUse" x="30" y="0" width="120" height="250"><path data-distance-line-weight="" d={distanceProfile.outline} fill="white" fillRule="evenodd" stroke="black" strokeWidth={thickness.trim}/></mask>
        <clipPath id={`${id}-card-clip`} clipPathUnits="userSpaceOnUse"><rect data-distance-card-mask="" x="0" y="0" width="288" height="200"/></clipPath>
        <filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation={d.glowRadius}/></filter>
        <filter id={`${id}-beam-blur`} filterUnits="userSpaceOnUse" x="-144" y="-192" width="768" height="768"><feGaussianBlur stdDeviation=".9"/></filter>
        <filter id={`${id}-bloom`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation=".65"/></filter>
        <filter id={`${id}-scan-aura`} data-distance-scan-filter="" filterUnits="userSpaceOnUse" x="-144" y={initial.scanTop - 64} width="576" height={d.scanWidth + 128} colorInterpolationFilters="sRGB"><feMorphology operator="dilate" radius={scanLight.auraSpread}/><feGaussianBlur stdDeviation={scanLight.auraRadius}/><feComponentTransfer><feFuncA data-distance-aura-gain="" type="linear" slope={scanLight.auraGain}/></feComponentTransfer><feGaussianBlur stdDeviation={scanLight.auraSmoothing}/></filter>
        <filter id={`${id}-scan-core`} data-distance-scan-filter="" filterUnits="userSpaceOnUse" x="-144" y={initial.scanTop - 64} width="576" height={d.scanWidth + 128} colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={scanLight.coreRadius}/><feComponentTransfer><feFuncA data-distance-core-gain="" type="linear" slope={scanLight.coreGain}/></feComponentTransfer></filter>
        <filter id={`${id}-voice-glow`} filterUnits="userSpaceOnUse" x="-200" y="-200" width="400" height="400"><feGaussianBlur stdDeviation={.6 + d.voiceGlow * .4}/></filter>
        <radialGradient id={`${id}-source`}><stop stopColor={settings.lightColor} stopOpacity=".9"/><stop offset=".13" stopColor={settings.lightColor} stopOpacity=".75"/><stop offset=".4" stopColor={settings.lightColor} stopOpacity=".19"/><stop offset="1" stopColor={settings.lightColor} stopOpacity="0"/></radialGradient>
        <linearGradient id={`${id}-beam`} data-distance-gradient="" gradientUnits="userSpaceOnUse" x1="157" y1="88" x2="185" y2="76"><stop stopColor={settings.lightColor} stopOpacity=".65"/><stop offset=".45" stopColor={settings.lightColor} stopOpacity=".32"/><stop offset="1" stopColor={settings.lightColor} stopOpacity=".85"/></linearGradient>
        <linearGradient id={`${id}-scan-softness`} data-distance-scan-gradient="" gradientUnits="userSpaceOnUse" x1="0" y1={initial.scanTop} x2="0" y2={initial.scanBottom}><stop stopColor="black"/><stop offset=".25" stopColor="white"/><stop offset=".75" stopColor="white"/><stop offset="1" stopColor="black"/></linearGradient>
        <linearGradient id={`${id}-edge`} data-distance-card-edge="" gradientUnits="userSpaceOnUse" x1="0" y1={200 - Math.max(.001, d.edgeFade)} x2="0" y2="200"><stop stopColor="white"/><stop offset="1" stopColor={d.edgeFade > 0 ? 'black' : 'white'}/></linearGradient>
        <mask data-distance-soft-edge="" id={`${id}-soft-edge`} maskUnits="userSpaceOnUse" x="0" y="0" width="288" height="200"><rect x="0" y="0" width="288" height="200" fill={`url(#${id}-edge)`} stroke="none"/></mask>
        <mask id={`${id}-scan-window`} maskUnits="userSpaceOnUse" x="-144" y="-128" width="576" height="768"><rect data-distance-band="" x={-144 + initial.shift} y={initial.scanTop} width="576" height={initial.scanBottom - initial.scanTop} fill={`url(#${id}-scan-softness)`} stroke="none"/></mask>
      </defs>
      <g clipPath={`url(#${id}-card-clip)`}><g mask={`url(#${id}-soft-edge)`}><g transform={`translate(0 ${distanceCanvas.artworkY})`}><g data-distance-parallax=""><g transform={architectureArtworkTransform(settings)}>
        <g data-distance-plane="" opacity={initial.planeOpacity} strokeWidth=".55"><path d="M126 15H210L228 33V130H115V26M126 15L136 23M210 15V26M115 130L126 120"/></g>
        <g data-distance-projection="" opacity="0" stroke={settings.lightColor} strokeWidth=".35"><g opacity=".17">{[0, 1, 2, 3].map(index => <path key={index} data-distance-ray=""/>)}</g></g>
        <g data-distance-beam="" opacity="0" stroke={settings.lightColor}>
          <path data-distance-beam-glow="" stroke={`url(#${id}-beam)`} strokeWidth={1.6 + Math.min(4, d.scanWidth * .14)} filter={`url(#${id}-beam-blur)`}/>
          <path data-distance-scan-ray="" stroke={`url(#${id}-beam)`} strokeWidth=".65"/>
          <path data-distance-scan-front="" strokeWidth=".4" opacity=".18"/>
        </g>
        <g data-distance-person="">
          <g data-distance-base="" opacity={initial.profileOpacity}>{profile}</g>
          <g data-distance-scan="" opacity="0" color={settings.lightColor}>
            <g filter={`url(#${id}-scan-aura)`} opacity=".85">{scanProfile}</g>
            <g filter={`url(#${id}-scan-core)`}>{scanProfile}</g>
            {scanProfile}<g data-distance-scan-white="" color="#FFFFFF" opacity={scanLight.whiteOpacity}>{scanProfile}</g>
          </g>
        </g>
        <g data-distance-voice="" opacity={d.voiceEnabled ? 1 : 0} stroke={d.voiceColor} fill="none">
          <g filter={`url(#${id}-voice-glow)`} opacity={d.voiceGlow * .7}>{Array.from({ length: distanceVoiceCapacity }, (_, index) => <path key={index} data-distance-voice-wave=""/>)}</g>
          <g>{Array.from({ length: distanceVoiceCapacity }, (_, index) => <path key={index} data-distance-voice-wave=""/>)}</g>
          <circle data-distance-mouth="" r=".45" opacity="0" fill={d.voiceColor} stroke="none"/>
        </g>
        <g data-distance-source="" transform="translate(157 88)" opacity="0" stroke="none" fill={settings.lightColor}>
          <g data-distance-halo=""><circle r="29" fill={`url(#${id}-source)`} filter={`url(#${id}-glow)`} opacity={d.glow}/><circle r="18" fill={`url(#${id}-source)`}/></g>
          <g data-distance-flare="" filter={`url(#${id}-bloom)`}><ellipse rx="12" ry=".6" opacity=".42"/><ellipse rx=".7" ry="6" opacity=".23"/><circle r="3.4" opacity=".85"/></g>
          <circle r={1.35 * d.lightSize}/>
        </g>
      </g></g></g></g></g>
    </svg>
    {presentation === 'cover' && settings.labels && <>
      <span className="architecture-serial">01 /</span>
      <span className="architecture-footer"><strong>{ru ? <>Архитектура<br/>Наблюдения</> : <>Observation<br/>Architecture</>}</strong><small>{ru ? 'ВЫСТАВЬ ДИСТАНЦИЮ' : 'SET A DISTANCE'}</small></span>
      <svg className="architecture-arrow" viewBox="0 0 24 24" fill="none" stroke={settings.color} strokeWidth="1" aria-hidden="true"><path d="M5 19L19 5M7 5h12v12"/></svg>
    </>}
  </button>
}
