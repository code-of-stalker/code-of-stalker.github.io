import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = 'C:/Code Of Stalker/Liquid_Prnc_Glass-main';
const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
const files = [
  'src/components/architecture/architectureSettings.ts', 'src/components/architecture/ArchitectureControls.tsx',
  'src/components/architecture/ArchitectureCover.tsx', 'src/components/architecture/architectureExport.ts',
  'src/components/workbench/ComponentsWorkspace.tsx', 'src/components/workbench/HomeComponentsPreview.tsx',
];
const manifest = {};
for (const file of files) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  const destination = path.join(base, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
  const original = path.join(base, 'original', file);
  fs.mkdirSync(path.dirname(original), { recursive: true });
  fs.writeFileSync(original, content);
  manifest[file] = crypto.createHash('sha256').update(content).digest('hex');
}
fs.writeFileSync(path.join(base, 'baseline.json'), JSON.stringify(manifest, null, 2));
const read = file => fs.readFileSync(path.join(base, file), 'utf8');
const save = (file, text) => fs.writeFileSync(path.join(base, file), text);
function patch(file, before, after) {
  const content = read(file);
  if (!content.includes(before)) throw new Error('Cannot patch ' + file + ': ' + before);
  save(file, content.replace(before, after));
}
const a = 'src/components/architecture/';
let cover = fs.readFileSync(path.join(root, a, 'SynchronizationCover.tsx'), 'utf8')
  .replaceAll('Synchronization', 'Guidance').replaceAll('synchronization', 'guidance')
  .replaceAll('createSynchronizedMatrix', 'createGuidanceJunction')
  .replaceAll('Полная синхронизация', 'Подсказка в узле').replaceAll('Full synchronization', 'Hint at the junction')
  .replaceAll('Интенсив', 'Водительство').replaceAll('Intensive', 'Guidance')
  .replaceAll('ИНТЕНСИВ · СИНХРОНИЗАЦИЯ', 'ВОДИТЕЛЬСТВО · ПОДСКАЗКА В УЗЛЕ').replaceAll('INTENSIVE · SYNCHRONIZATION', 'GUIDANCE · HINT AT THE JUNCTION');
cover = cover.replace('started: false, settings:', 'started: false, trigger: settings.trigger, settings:');
cover = cover.replace('state.time = guidanceTimeAtPhase(oldPhase, s); state.settings = s', `const completedCycles = repeat ? Math.floor(state.time / guidanceDuration(state.settings)) : 0
    state.time = completedCycles * guidanceDuration(s) + guidanceTimeAtPhase(oldPhase, s); state.settings = s
    if (state.trigger !== settings.trigger) { state.time = 0; state.started = false; state.trigger = settings.trigger }`);
cover = cover.replace('{ ink: settings.color, warm: settings.lightColor }', '{ ink: settings.color, warm: settings.lightColor, guide: s.guideColor }');
cover = cover.replace('render(phase, s)', 'render(phase, s, repeat ? Math.floor(state.time / guidanceDuration(s)) : 0)');
cover = cover.replace('media.matches ? .9', 'media.matches ? .89');
save(a + 'GuidanceCover.tsx', cover);

patch(a + 'architectureSettings.ts', "import { defaultSynchronizationSettings", "import { defaultGuidanceSettings, normalizeGuidanceSettings } from './guidanceSettings'\nimport type { GuidanceSettings } from './guidanceSettings'\nimport { defaultSynchronizationSettings");
patch(a + 'architectureSettings.ts', "illustration: 'cell' | 'distance' | 'synchronization';", "illustration: 'cell' | 'distance' | 'synchronization' | 'guidance'; guidance: GuidanceSettings;");
patch(a + 'architectureSettings.ts', "illustration: 'cell', distance:", "illustration: 'cell', guidance: { ...defaultGuidanceSettings }, distance:");
patch(a + 'architectureSettings.ts', 'const result = { ...defaultArchitectureSettings,', 'const result = { ...defaultArchitectureSettings, guidance: { ...defaultGuidanceSettings },');
patch(a + 'architectureSettings.ts', "input.illustration === 'synchronization')", "input.illustration === 'synchronization' || input.illustration === 'guidance')");
patch(a + 'architectureSettings.ts', 'result.synchronization = normalizeSynchronizationSettings(input.synchronization)', 'result.synchronization = normalizeSynchronizationSettings(input.synchronization)\n  result.guidance = normalizeGuidanceSettings(input.guidance)');
patch(a + 'ArchitectureCover.tsx', "import { SynchronizationCover }", "import { GuidanceCover } from './GuidanceCover'\nimport { SynchronizationCover }");
patch(a + 'ArchitectureCover.tsx', 'export function ArchitectureCover(props: ArchitectureCoverProps) {', "export function ArchitectureCover(props: ArchitectureCoverProps) {\n  if (props.settings?.illustration === 'guidance') return <GuidanceCover {...props}/>");
patch(a + 'ArchitectureControls.tsx', "import { defaultSynchronizationSettings }", "import { ArchitectureGuidanceControls } from './ArchitectureGuidanceControls'\nimport { defaultGuidanceSettings } from './guidanceSettings'\nimport { defaultSynchronizationSettings }");
patch(a + 'ArchitectureControls.tsx', "{txt('Синхронизация', 'Synchronization')}</button>", "{txt('Синхронизация', 'Synchronization')}</button>\n        <button type=\"button\" aria-pressed={value.illustration === 'guidance'} onClick={() => { patch({ illustration: 'guidance' }); onReplay() }}>{txt('Водительство', 'Guidance')}</button>");
patch(a + 'ArchitectureControls.tsx', "<strong>{value.illustration === 'synchronization'", "<strong>{value.illustration === 'guidance' ? txt('Водительство · Подсказка в узле', 'Guidance · Hint at the junction') : value.illustration === 'synchronization'");
patch(a + 'ArchitectureControls.tsx', '<p className="cw-help">{value.illustration === \'synchronization\' ? txt(\'Свет проходит', '<p className="cw-help">{value.illustration === \'guidance\' ? txt(\'Проводник даёт короткую подсказку на развилке. Второй огонёк выбирает направление и продолжает путь самостоятельно.\', \'The guide offers a brief hint at the junction. The other light chooses a direction and continues independently.\') : value.illustration === \'synchronization\' ? txt(\'Свет проходит');
patch(a + 'ArchitectureControls.tsx', "{value.illustration === 'synchronization' ? <ArchitectureSynchronizationControls", "{value.illustration === 'guidance' ? <ArchitectureGuidanceControls value={value} patch={patch} onReplay={onReplay}/> : value.illustration === 'synchronization' ? <ArchitectureSynchronizationControls");
patch(a + 'ArchitectureControls.tsx', "{value.illustration === 'synchronization' ? txt('Короткое", "{value.illustration === 'synchronization' || value.illustration === 'guidance' ? txt('Короткое");
patch(a + 'ArchitectureControls.tsx', "label={value.illustration === 'distance'", "label={value.illustration === 'guidance' ? txt('Цвет маршрута', 'Route color') : value.illustration === 'distance'");
patch(a + 'ArchitectureControls.tsx', "onChange(current => current.illustration === 'synchronization'", "onChange(current => current.illustration === 'guidance' ? { ...current, guidance: { ...defaultGuidanceSettings } } : current.illustration === 'synchronization'");
patch(a + 'ArchitectureControls.tsx', 'distance: current.distance, synchronization: current.synchronization', 'distance: current.distance, synchronization: current.synchronization, guidance: current.guidance');
patch(a + 'architectureExport.ts', "import { normalizeArchitectureSettings }", "import guidanceSettingsSource from './guidanceSettings.ts?raw'\nimport guidanceGeometrySource from './guidanceGeometry.ts?raw'\nimport guidanceRendererSource from './guidanceRenderer.ts?raw'\nimport guidanceComponentSource from './GuidanceCover.tsx?raw'\nimport { normalizeArchitectureSettings }");
patch(a + 'architectureExport.ts', '[distanceSettingsSource, synchronizationSettingsSource,', '[distanceSettingsSource, synchronizationSettingsSource, guidanceSettingsSource, guidanceGeometrySource, guidanceRendererSource, guidanceComponentSource,');
patch(a + 'architectureExport.ts', "settings.illustration === 'synchronization' ? 'Full synchronization'", "settings.illustration === 'guidance' ? 'Guidance · Hint at the junction' : settings.illustration === 'synchronization' ? 'Full synchronization'");
patch('src/components/workbench/ComponentsWorkspace.tsx', "illustration === 'synchronization')", "illustration === 'synchronization' || illustration === 'guidance')");
patch('src/components/workbench/HomeComponentsPreview.tsx', "architecture.illustration === 'synchronization' ?", "architecture.illustration === 'guidance' ? (ru ? 'ВОДИТЕЛЬСТВО · ПОДСКАЗКА В УЗЛЕ' : 'GUIDANCE · HINT AT THE JUNCTION') : architecture.illustration === 'synchronization' ?");
console.log('Prepared scoped integration against current Laboratory files.');
