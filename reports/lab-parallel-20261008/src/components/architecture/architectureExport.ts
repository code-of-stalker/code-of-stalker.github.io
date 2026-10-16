import settingsSource from './architectureSettings.ts?raw'
import geometrySource from './architectureGeometry.ts?raw'
import componentSource from './ArchitectureCover.tsx?raw'
import css from './architectureCover.css?raw'
import gestureSource from '../coverGesture.ts?raw'
import distanceSettingsSource from './distanceSettings.ts?raw'
import distanceGeometrySource from './distanceGeometry.ts?raw'
import distanceComponentSource from './DistanceCover.tsx?raw'
import distanceVoiceSource from './distanceVoice.ts?raw'
import synchronizationSettingsSource from './synchronizationSettings.ts?raw'
import synchronizationRendererSource from './synchronizationRenderer.ts?raw'
import synchronizationComponentSource from './SynchronizationCover.tsx?raw'
import guidanceSettingsSource from './guidanceSettings.ts?raw'
import guidanceGeometrySource from './guidanceGeometry.ts?raw'
import guidanceRendererSource from './guidanceRenderer.ts?raw'
import guidanceComponentSource from './GuidanceCover.tsx?raw'
import parallelSettingsSource from './parallelSettings.ts?raw'
import parallelGeometrySource from './parallelGeometry.ts?raw'
import parallelRendererSource from './parallelRenderer.ts?raw'
import parallelComponentSource from './ParallelCover.tsx?raw'
import { normalizeArchitectureSettings } from './architectureSettings'
import type { ArchitectureSettings } from './architectureSettings'

export function exportArchitectureComponent(settings: ArchitectureSettings, language: 'ru' | 'en' = 'ru') {
  const sources = [parallelSettingsSource, parallelGeometrySource, parallelRendererSource, parallelComponentSource, distanceSettingsSource, synchronizationSettingsSource, guidanceSettingsSource, guidanceGeometrySource, guidanceRendererSource, guidanceComponentSource, settingsSource, geometrySource, distanceVoiceSource, distanceGeometrySource, gestureSource, distanceComponentSource, synchronizationRendererSource, synchronizationComponentSource, componentSource].map(source => source.replace(/^import[^\r\n]*(?:\r?\n|$)/gm, '').trim()).join('\n\n')
  return `/**
 * Prince Laboratory · ${settings.illustration === 'guidance' ? (settings.guidanceVariant === 'parallel' ? 'Guidance · Parallel path' : 'Guidance · Hint at the junction') : settings.illustration === 'synchronization' ? 'Full synchronization' : settings.illustration === 'distance' ? 'Set a distance' : 'Beyond the cell'} · 288 × 200.
 * Save as PrinceArchitecture.tsx. Import { PrinceArchitecture }.
 * Includes the current preset, SVG animation, touch response and styles.
 * Provide Tektur and Disket Mono fonts. active=false pauses the animation.
 * onClick opens your section after a short tap. Holds and drags animate without opening.
 */
import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties, Ref, MouseEvent, PointerEvent } from 'react'

export const architecturePreset: ArchitectureSettings = ${JSON.stringify(normalizeArchitectureSettings(settings), null, 2)}
const architectureStyles = ${JSON.stringify(css)}

${sources}

export function PrinceArchitecture(props: ArchitectureCoverProps) {
  return <><style>{architectureStyles}</style><div style={{ width: 288, height: 200, maxWidth: '100%' }}>
    <ArchitectureCover {...props} language={props.language ?? '${language}'} settings={props.settings ?? architecturePreset}/>
  </div></>
}
`
}
