import { useId, useMemo } from 'react'
import type { CSSProperties } from 'react'
import illustration from '../../assets/attention-awareness.svg?raw'

export type AttentionAwarenessProps = {
  className?: string
  cycleSeconds?: number
  playing?: boolean
  color?: string
  lightColor?: string
  glow?: number
  replayKey?: number
}

/** Eye-to-eye attention followed by a wide view of the luminous observer. */
export function AttentionAwareness({ className, cycleSeconds = 11.2, playing = true,
  color = '#E7E100', lightColor = '#FFF59A', glow = 0.75, replayKey = 0 }: AttentionAwarenessProps) {
  const instance = useId().replace(/[^a-z0-9-]/gi, '')
  const markup = useMemo(() => illustration.replaceAll('maw-id-', `maw-${instance}-`), [instance])
  // React compares this prop by identity. A fresh object rewrites innerHTML and
  // restarts every SVG animation whenever the benchmark publishes its metrics.
  const svgContent = useMemo(() => ({ __html: markup }), [markup])
  const duration = Number.isFinite(cycleSeconds) ? Math.max(6, Math.min(24, cycleSeconds)) : 11.2
  const strength = Number.isFinite(glow) ? Math.max(0, Math.min(1, glow)) : 0.75
  const style = {
    '--maw-cycle': `${duration}s`, '--maw-play': playing ? 'running' : 'paused',
    '--maw-ink': color, '--maw-light': lightColor, '--maw-glow': strength,
    width: '100%', height: 320, maxHeight: 320, overflow: 'hidden', lineHeight: 0,
  } as CSSProperties

  return <div className={className} style={style} key={replayKey}
    dangerouslySetInnerHTML={svgContent} />
}
