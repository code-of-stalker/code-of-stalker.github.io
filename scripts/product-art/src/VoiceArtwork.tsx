// Derived from approved Laboratory VoiceRecorder visual; native host owns recording.
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
import type { VoiceSpectrum } from '../../../src/features/product/audio/spectrum';
export function VoiceArtwork({active,sample,preset,mode,lockProgress,locked}:{active:boolean;sample:()=>VoiceSpectrum;preset:unknown;mode:"idle"|"record"|"playback";lockProgress:()=>number;locked:boolean}) {
 const root=useRef<HTMLDivElement>(null),id='voice-'+useId().replace(/[^a-z0-9-]/gi,'');
 const preferences=normalizeVoicePreferences(preset),appearance=preferences.appearance;
 // The Laboratory SVG intentionally overflows its 240x220 working viewport.
 // An embedded document cannot overflow its iframe, so frame the longest ray
 // plus its glow here, keeping all original ring geometry and motion intact.
 const extent=Math.ceil((voiceRadii.contour+appearance.contourLength)*appearance.ringsScale+10);
 const viewport={...voiceArtworkViewport(),x:120-extent,y:105-extent,width:extent*2,height:extent*2,
   viewBox:`${120-extent} ${105-extent} ${extent*2} ${extent*2}`};
 const ringsTransform=voiceRingsTransform(appearance.ringsScale),initialOrbit=sphereRingPaths(0);
 // Local filter support covers the largest ring plus four Gaussian sigmas.
 // Keep the paths vector-sharp without allocating a 220% surface per ring.
 const haloExtent=Math.ceil(voiceRadii.fill+1+4*1.8),waveExtent=Math.ceil(voiceRadii.glass+.9*appearance.lineWidth+4*1.8);
 const initialMesh=voiceMeshFrame(0,0,appearance.meshRings,appearance.meshRadius),glassMaterial=undefined;
 const latest=useRef({sample,preferences,mode,lockProgress});latest.current={sample,preferences,mode,lockProgress};
 useEffect(()=>{if(!root.current||!active)return;return mountVoiceMotion(root.current,()=>{
   const bands=latest.current.sample(),p=latest.current.preferences;
   return {frame:{bands,seconds:0,source:latest.current.mode==='playback'?'playback':latest.current.mode==='record'?'mic':'idle'},sensitivity:p.sensitivity,appearance:{...p.appearance,wavesAcrossScreen:false},lockProgress:latest.current.lockProgress()};
 },()=>{});},[active]);
 return <div className="voice-recorder" ref={root} data-state={mode === 'record' ? 'recording' : 'idle'} data-locked={locked} data-active={active} data-source={mode === "playback" ? "playback" : mode === 'record' ? 'mic' : 'idle'} data-style={appearance.styleMode}
  style={{'--vr-color':appearance.color,'--vr-light':appearance.lightColor,'--vr-glow':appearance.glow,'--vr-line':appearance.lineWidth} as CSSProperties}>
 <div className="vr-button">
      <span className="vr-visual">
      {appearance.glassEnabled && <VoiceGlassBacking viewport={viewport} scale={appearance.ringsScale} material={resolveVoiceGlassMaterial(appearance, glassMaterial)}/>}
      <svg className="vr-art" viewBox={viewport.viewBox} fill="none" aria-hidden="true">
        <defs>
          <filter id={`${id}-halo`} filterUnits="userSpaceOnUse" x={120-haloExtent} y={105-haloExtent} width={haloExtent*2} height={haloExtent*2}><feGaussianBlur stdDeviation="1.8"/></filter>
          <filter id={`${id}-wave-glow`} filterUnits="userSpaceOnUse" x={120-waveExtent} y={105-waveExtent} width={waveExtent*2} height={waveExtent*2}><feGaussianBlur stdDeviation="1.8"/><feComponentTransfer><feFuncA type="linear" slope={appearance.waveGlow}/></feComponentTransfer></filter>
        </defs>
        <g className="vr-scaled-geometry" transform={ringsTransform}>
        <VoiceLightField id={id} appearance={appearance}/>
        <g className="vr-waves" stroke={appearance.waveColor} strokeWidth={.65 * appearance.lineWidth}>
          <g filter={`url(#${id}-wave-glow)`} strokeWidth={1.8 * appearance.lineWidth}>{[0, 1, 2].map(index => <use key={index} href={`#${id}-wave-${index}`}/>)}</g>
          {[0, 1, 2].map(index => <circle key={index} id={`${id}-wave-${index}`} className="vr-wave" cx="120" cy="105" r={voiceRadii.fill} opacity="0"/>)}</g>
        <g className="vr-mesh" stroke={appearance.meshColor} strokeWidth={appearance.meshLineWidth} opacity={appearance.meshOpacity} display={appearance.meshEnabled ? undefined : 'none'}>
          {initialMesh.map((ring, index) => <g key={index}>
            <path className="vr-mesh-back" d={ring.back} opacity={ring.opacity * .28}/>
            <path className="vr-mesh-front" d={ring.front} opacity={ring.opacity}/>
          </g>)}
        </g>
        <g className="vr-low-motion" stroke="currentColor" display={appearance.fillRing ? undefined : 'none'}>
          <circle cx="120" cy="105" r={voiceRadii.fill} strokeWidth=".55" opacity=".4"/>
          <circle className="vr-glow vr-fill-arc" cx="120" cy="105" r={voiceRadii.fill} pathLength="100" strokeWidth="1.7" strokeDasharray="0 50" filter={`url(#${id}-halo)`}/>
          <circle className="vr-fill-arc" cx="120" cy="105" r={voiceRadii.fill} pathLength="100" strokeWidth="1.15" strokeDasharray="0 50"/>
        </g>
        <g className="vr-mid-motion" stroke="currentColor" display={appearance.spinRing ? undefined : 'none'}>
          <circle cx="120" cy="105" r={voiceRadii.spin} strokeWidth=".7" strokeDasharray="86 25 8 31" opacity=".7"/>
        </g>
        <g className="vr-high-motion" stroke="currentColor" strokeWidth="1" display={appearance.outerContour ? undefined : 'none'}>
          {Array.from({ length: 40 }, (_, i) => { const a = i * Math.PI / 20; return <line key={i} data-angle={a} className="vr-ray" x1={120 + Math.cos(a) * voiceRadii.contour} y1={105 + Math.sin(a) * voiceRadii.contour} x2={120 + Math.cos(a) * (voiceRadii.contour + 3)} y2={105 + Math.sin(a) * (voiceRadii.contour + 3)}/> })}
        </g>
        <path className="vr-side-marks" d="M1 105H6M234 105H239" stroke="currentColor" strokeWidth=".65" opacity=".35"/>
        </g>
        <VoiceGlyph className="vr-mic" kind={appearance.inputIcon}/>
        <VoiceGlyph className="vr-speaker" kind="speaker"/>
        <rect className="vr-stop" x="113" y="98" width="14" height="14" fill="currentColor"/>
        <g className="vr-sphere-motion" transform={ringsTransform} stroke="currentColor" display={appearance.sphereRing ? undefined : 'none'}>
          <path className="vr-sphere-back" d={initialOrbit.back} opacity=".24"/>
          <path className="vr-sphere-front vr-glow" d={initialOrbit.front} filter={`url(#${id}-halo)`}/>
          <path className="vr-sphere-front" d={initialOrbit.front} opacity=".8"/>
        </g>
      </svg>
      </span>

 <span className="vr-lock" aria-hidden="true"><svg viewBox="0 0 24 34" fill="none" stroke="currentColor" strokeWidth="1.2">
 <g className="vr-lock-arrow"><path d="m7 13 5-5 5 5M12 8v13"/></g>
 <g className="vr-lock-body" opacity="0"><path d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5Z"/>
 <rect className="vr-lock-fill" x="5" y="21" width="14" height="0" stroke="none" fill="currentColor"/>
 <path d="M12 14v3" stroke="#000" strokeWidth="1.5"/></g></svg></span>
 </div><span className="vr-time-value" hidden>00:00</span>
 </div>;
}

