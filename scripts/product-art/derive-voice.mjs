// One-time derivation from the approved Laboratory voice visual; no capture code is copied.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const lab = process.env.LABORATORY_SOURCE || 'C:/Code Of Stalker/Liquid_Prnc_Glass-main';
const original = readFileSync(path.join(lab, 'src/components/voice/VoiceRecorder.tsx'), 'utf8');
const visual = original.slice(original.indexOf('      <span className="vr-visual">'), original.indexOf('      <span className="vr-lock"'));
if (!visual.includes('vr-scaled-geometry') || !visual.endsWith('\n')) throw new Error('Voice source boundaries changed.');
const output = `// Derived from approved Laboratory VoiceRecorder visual; native host owns recording.
import { useEffect, useId, useRef } from 'react';
import type { CSSProperties } from 'react';
import { mountVoiceMotion } from './laboratory/components/voice/voiceMotion';
import { normalizeVoicePreferences } from './laboratory/components/voice/voiceAppearance';
import { sphereRingPaths, voiceRadii, voiceArtworkViewport, voiceRingsTransform } from './laboratory/components/voice/voiceGeometry';
import { voiceMeshFrame } from './laboratory/components/voice/voiceMesh';
import { VoiceLightField } from './laboratory/components/voice/VoiceLightField';
import { VoiceGlyph } from './laboratory/components/voice/voiceIcons';
import { resolveVoiceGlassMaterial, VoiceGlassBacking } from './laboratory/components/voice/VoiceGlassBacking';
import './laboratory/components/voice/voiceRecorder.css';
export function VoiceArtwork({active,sample,preset,mode}:{active:boolean;sample:()=>number;preset:unknown;mode:"record"|"playback"}) {
 const root=useRef<HTMLDivElement>(null),id='voice-'+useId().replace(/[^a-z0-9-]/gi,'');
 const preferences=normalizeVoicePreferences(preset),appearance=preferences.appearance;
 const viewport=voiceArtworkViewport(),ringsTransform=voiceRingsTransform(appearance.ringsScale),initialOrbit=sphereRingPaths(0);
 const initialMesh=voiceMeshFrame(0,0,appearance.meshRings,appearance.meshRadius),glassMaterial=undefined;
 const latest=useRef({sample,preferences,mode});latest.current={sample,preferences,mode};
 useEffect(()=>{if(!root.current||!active)return;return mountVoiceMotion(root.current,()=>{
   const level=latest.current.sample(),p=latest.current.preferences;
   return {frame:{bands:{low:level,mid:level*.78,high:level*.46},seconds:0,source:latest.current.mode==='playback'?'playback':level>0?'mic':'idle'},sensitivity:p.sensitivity,appearance:{...p.appearance,wavesAcrossScreen:false},lockProgress:0};
 },()=>{});},[active]);
 return <div className="voice-recorder" ref={root} data-state="idle" data-locked="false" data-active={active} data-source={mode === "playback" ? "playback" : "mic"} data-style={appearance.styleMode}
  style={{'--vr-color':appearance.color,'--vr-light':appearance.lightColor,'--vr-glow':appearance.glow,'--vr-line':appearance.lineWidth} as CSSProperties}>
 <div className="vr-button">
${visual}
 </div><span className="vr-time-value" hidden>00:00</span>
 <svg width="0" height="0" style={{position:'absolute'}}><g className="vr-lock-arrow"/><g className="vr-lock-body"/><rect className="vr-lock-fill"/></svg>
 </div>;
}
`;
writeFileSync(path.join(here, 'src/VoiceArtwork.tsx'), output);
