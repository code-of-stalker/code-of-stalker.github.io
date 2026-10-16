import { useId, useMemo } from 'react'
import type { CSSProperties } from 'react'
import illustration from '../../assets/crowd-awareness.svg?raw'
import { directSvgDrawings } from '../../../directSvgDrawings'

const browserIllustration = directSvgDrawings(illustration)

export type CrowdAwarenessProps = {
  className?: string
  cycleSeconds?: number
  playing?: boolean
  color?: string
  lightColor?: string
  glow?: number
  replayKey?: number
}

/** A solitary woman, an arriving crowd, then inner light and a body scan. */
export function CrowdAwareness({ className, cycleSeconds = 12, playing = true,
  color = '#E7E100', lightColor = '#FFF59A', glow = .8, replayKey = 0 }: CrowdAwarenessProps) {
  const instance = useId().replace(/[^a-z0-9-]/gi, '')
  const markup = useMemo(() => browserIllustration.replaceAll('mcw-id-', `mcw-${instance}-`), [instance])
  const duration = Number.isFinite(cycleSeconds) ? Math.max(8, Math.min(24, cycleSeconds)) : 12
  const strength = Number.isFinite(glow) ? Math.max(0, Math.min(1, glow)) : .8
  const style = {
    '--mcw-cycle': `${duration}s`, '--mcw-play': playing ? 'running' : 'paused',
    '--mcw-ink': color, '--mcw-light': lightColor, '--mcw-glow': strength,
    width: '100%', height: 244, maxHeight: 244, overflow: 'hidden', lineHeight: 0,
  } as CSSProperties
  return <div className={className} style={style} key={replayKey}
    dangerouslySetInnerHTML={{ __html: markup }} />
}
