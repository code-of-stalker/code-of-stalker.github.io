import type { VoiceAppearance } from './voiceAppearance'

export function VoiceLightField({ id, appearance: a }: { id: string; appearance: VoiceAppearance }) {
  // Shade with opaque colors so 100% fill is actually opaque at full assembly.
  const shade = (factor: number) => '#' + [1, 3, 5].map(start => Math.round(parseInt(a.meshColor.slice(start, start + 2), 16) * factor).toString(16).padStart(2, '0')).join('')
  return <>
    <defs>
      <radialGradient id={`${id}-light-volume`}><stop stopColor={a.coreColor} stopOpacity=".28"/><stop offset=".55" stopColor={a.coreColor} stopOpacity=".12"/><stop offset="1" stopColor={a.coreColor} stopOpacity="0"/></radialGradient>
      <radialGradient id={`${id}-mesh-volume`} cx="38%" cy="32%" r="70%"><stop stopColor={shade(.8)}/><stop offset=".6" stopColor={shade(.3)}/><stop offset="1" stopColor={shade(.7)}/></radialGradient>
      <radialGradient id={`${id}-mesh-emission`}><stop offset=".64" stopColor={a.lightColor} stopOpacity="0"/><stop offset=".86" stopColor={a.lightColor} stopOpacity=".48"/><stop offset="1" stopColor={a.lightColor} stopOpacity="0"/></radialGradient>
      <filter id={`${id}-caustic-glow`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2"/></filter>
      <clipPath id={`${id}-light-bounds`}><circle cx="120" cy="105" r="83"/></clipPath>
    </defs>
    <circle className="vr-mesh-fill" cx="120" cy="105" r={a.meshRadius} fill={`url(#${id}-mesh-volume)`} opacity="0"/>
    <circle className="vr-mesh-emission" cx="120" cy="105" r={Math.min(113, a.meshRadius + 15)} fill={`url(#${id}-mesh-emission)`} opacity="0"/>
    <g className="vr-core-field" clipPath={`url(#${id}-light-bounds)`} display={a.coreEnabled ? undefined : 'none'}>
      <circle className="vr-core-volume" cx="120" cy="105" r="60" fill={`url(#${id}-light-volume)`} opacity="0"/>
      <g stroke={a.coreColor} strokeWidth="2.5" filter={`url(#${id}-caustic-glow)`}>{[0, 1, 2].map(i => <use key={i} href={`#${id}-caustic-${i}`}/>)}</g>
      <g stroke={a.lightColor} strokeWidth=".7" fill="none">{[0, 1, 2].map(i => <path key={i} id={`${id}-caustic-${i}`} className="vr-caustic" pathLength="100" opacity="0"/>)}</g>
    </g>
  </>
}
