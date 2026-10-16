import { useId, useMemo } from 'react'
import type { CSSProperties } from 'react'
import illustration from '../../assets/comparison-scan.svg?raw'

export type ComparisonScanProps = {
  className?: string
  cycleSeconds?: number
  playing?: boolean
  color?: string
  lightColor?: string
  glow?: number
  replayKey?: number
}

/** Approved contour drawing, kept within a 244 px animation slot. */
export function ComparisonScan({ className, cycleSeconds = 8.8, playing = true,
  color = '#E7E100', lightColor = '#FFF59A', glow = 0.4, replayKey = 0 }: ComparisonScanProps) {
  const instance = useId().replace(/[^a-z0-9-]/gi, '')
  // Inline only the bundled SVG. Instance-specific IDs keep clips and filters
  // independent when several illustrations are mounted on the same screen.
  const markup = useMemo(() => illustration.replaceAll('mcs-id-', `mcs-${instance}-`), [instance])
  const duration = Number.isFinite(cycleSeconds) ? Math.max(4, Math.min(20, cycleSeconds)) : 8.8
  const strength = Number.isFinite(glow) ? Math.max(0, Math.min(1, glow)) : 0.4
  const style = { '--mcs-cycle': `${duration}s`, '--mcs-play': playing ? 'running' : 'paused',
    '--mcs-ink': color, '--mcs-light': lightColor, '--mcs-glow': strength,
    width: '100%', height: 244, maxHeight: 244, lineHeight: 0 } as CSSProperties

  return <div className={className} style={style} key={replayKey}
    dangerouslySetInnerHTML={{ __html: markup }} />
}
