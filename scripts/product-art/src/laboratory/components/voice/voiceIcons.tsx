import { voiceIconPaths } from '../../../../../../src/features/product/audio/voice-icons';
export { voiceIconPaths } from '../../../../../../src/features/product/audio/voice-icons';

export function VoiceGlyph({ kind, className }: { kind: keyof typeof voiceIconPaths; className?: string }) {
  return <g className={className} stroke="currentColor" strokeWidth=".85" strokeLinecap="round" strokeLinejoin="round" fill="none"><path d={voiceIconPaths[kind]}/></g>
}
