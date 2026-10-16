import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = 'C:/Code Of Stalker/Liquid_Prnc_Glass-main';
const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
const a = 'src/components/architecture/';
const files = [a + 'architectureSettings.ts', a + 'ArchitectureControls.tsx', a + 'ArchitectureCover.tsx', a + 'architectureExport.ts',
  'src/components/workbench/ComponentsWorkspace.tsx', 'src/components/workbench/HomeComponentsPreview.tsx', 'src/components/workbench/HomeSectionPreview.tsx'];
const baseline = {};
for (const file of files) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const dir of ['', 'original']) {
    const destination = path.join(base, dir, file); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, content);
  }
  baseline[file] = crypto.createHash('sha256').update(content).digest('hex');
}
fs.writeFileSync(path.join(base, 'baseline.json'), JSON.stringify(baseline, null, 2));
fs.copyFileSync(path.join(base, '../lab-guidance-20261008/apply.mjs'), path.join(base, 'apply.mjs'));
function patch(file, before, after) {
  const location = path.join(base, file), source = fs.readFileSync(location, 'utf8');
  if (!source.includes(before)) throw new Error('Missing expected text in ' + file + ': ' + before);
  fs.writeFileSync(location, source.replace(before, after));
}
let cover = fs.readFileSync(path.join(root, a, 'GuidanceCover.tsx'), 'utf8')
  .replaceAll('Guidance', 'Parallel').replaceAll('guidance', 'parallel').replaceAll('createParallelJunction', 'createParallelPath')
  .replaceAll('Подсказка в узле', 'Параллельный путь').replaceAll('Hint at the junction', 'Parallel path')
  .replaceAll('ПОДСКАЗКА В УЗЛЕ', 'ПАРАЛЛЕЛЬНЫЙ ПУТЬ').replaceAll('HINT AT THE JUNCTION', 'PARALLEL PATH');
cover = cover.replace('guide: s.guideColor })', 'guide: s.guideColor }, s)')
  .replace('render(phase, s, repeat ? Math.floor(state.time / parallelDuration(s)) : 0)', 'render(phase, s)')
  .replace("media.matches ? .89", "media.matches ? .94")
  .replace('data-illustration="parallel"', 'data-illustration="guidance" data-guidance-variant="parallel"');
fs.writeFileSync(path.join(base, a, 'ParallelCover.tsx'), cover);
patch(a + 'architectureSettings.ts', "import { defaultGuidanceSettings", "import { defaultParallelSettings, normalizeParallelSettings } from './parallelSettings'\nimport type { ParallelSettings } from './parallelSettings'\nimport { defaultGuidanceSettings");
patch(a + 'architectureSettings.ts', 'guidance: GuidanceSettings;', "guidance: GuidanceSettings; guidanceVariant: 'junction' | 'parallel'; parallel: ParallelSettings;");
patch(a + 'architectureSettings.ts', "illustration: 'cell', guidance:", "illustration: 'cell', guidanceVariant: 'junction', parallel: { ...defaultParallelSettings }, guidance:");
patch(a + 'architectureSettings.ts', 'const result = { ...defaultArchitectureSettings,', 'const result = { ...defaultArchitectureSettings, parallel: { ...defaultParallelSettings },');
patch(a + 'architectureSettings.ts', 'result.guidance = normalizeGuidanceSettings(input.guidance)', "result.guidance = normalizeGuidanceSettings(input.guidance)\n  result.parallel = normalizeParallelSettings(input.parallel)\n  if (input.guidanceVariant === 'junction' || input.guidanceVariant === 'parallel') result.guidanceVariant = input.guidanceVariant");
patch(a + 'ArchitectureCover.tsx', "import { GuidanceCover }", "import { ParallelCover } from './ParallelCover'\nimport { GuidanceCover }");
patch(a + 'ArchitectureCover.tsx', "if (props.settings?.illustration === 'guidance') return <GuidanceCover {...props}/>", "if (props.settings?.illustration === 'guidance') return props.settings.guidanceVariant === 'parallel' ? <ParallelCover {...props}/> : <GuidanceCover {...props}/>");
patch(a + 'ArchitectureControls.tsx', "import { defaultGuidanceSettings }", "import { ArchitectureParallelControls } from './ArchitectureParallelControls'\nimport { defaultParallelSettings } from './parallelSettings'\nimport { defaultGuidanceSettings }");
patch(a + 'ArchitectureControls.tsx', "      <strong>{value.illustration === 'guidance'", `      {value.illustration === 'guidance' && <div className="diary-options diary-options--two" aria-label={txt('Анимация водительства', 'Guidance animation')}>
        <button type="button" aria-pressed={value.guidanceVariant === 'junction'} onClick={() => { patch({ guidanceVariant: 'junction' }); onReplay() }}>{txt('Подсказка в узле', 'Hint at the junction')}</button>
        <button type="button" aria-pressed={value.guidanceVariant === 'parallel'} onClick={() => { patch({ guidanceVariant: 'parallel' }); onReplay() }}>{txt('Параллельный путь', 'Parallel path')}</button>
      </div>}
      <strong>{value.illustration === 'guidance'`);
patch(a + 'ArchitectureControls.tsx', "? txt('Водительство · Подсказка в узле', 'Guidance · Hint at the junction')", "? (value.guidanceVariant === 'parallel' ? txt('Водительство · Параллельный путь', 'Guidance · Parallel path') : txt('Водительство · Подсказка в узле', 'Guidance · Hint at the junction'))");
patch(a + 'ArchitectureControls.tsx', "? txt('Проводник даёт короткую подсказку на развилке. Второй огонёк выбирает направление и продолжает путь самостоятельно.', 'The guide offers a brief hint at the junction. The other light chooses a direction and continues independently.')", "? (value.guidanceVariant === 'parallel' ? txt('Два огонька поднимаются по отдельным спиральным линиям, плавно выходят на один уровень и обмениваются световым импульсом.', 'Two lights rise along separate spiral paths, settle at the same height and exchange a light impulse.') : txt('Проводник даёт короткую подсказку на развилке. Второй огонёк выбирает направление и продолжает путь самостоятельно.', 'The guide offers a brief hint at the junction. The other light chooses a direction and continues independently.'))");
patch(a + 'ArchitectureControls.tsx', "? <ArchitectureGuidanceControls value={value} patch={patch} onReplay={onReplay}/>", "? (value.guidanceVariant === 'parallel' ? <ArchitectureParallelControls value={value} patch={patch} onReplay={onReplay}/> : <ArchitectureGuidanceControls value={value} patch={patch} onReplay={onReplay}/>)");
patch(a + 'ArchitectureControls.tsx', "current.illustration === 'guidance' ? { ...current, guidance: { ...defaultGuidanceSettings } }", "current.illustration === 'guidance' ? (current.guidanceVariant === 'parallel' ? { ...current, parallel: { ...defaultParallelSettings } } : { ...current, guidance: { ...defaultGuidanceSettings } })");
patch(a + 'ArchitectureControls.tsx', 'guidance: current.guidance }); onReplay()', 'guidance: current.guidance, parallel: current.parallel, guidanceVariant: current.guidanceVariant }); onReplay()');
patch(a + 'architectureExport.ts', "import { normalizeArchitectureSettings }", "import parallelSettingsSource from './parallelSettings.ts?raw'\nimport parallelGeometrySource from './parallelGeometry.ts?raw'\nimport parallelRendererSource from './parallelRenderer.ts?raw'\nimport parallelComponentSource from './ParallelCover.tsx?raw'\nimport { normalizeArchitectureSettings }");
patch(a + 'architectureExport.ts', '[distanceSettingsSource,', '[parallelSettingsSource, parallelGeometrySource, parallelRendererSource, parallelComponentSource, distanceSettingsSource,');
patch(a + 'architectureExport.ts', "? 'Guidance · Hint at the junction'", "? (settings.guidanceVariant === 'parallel' ? 'Guidance · Parallel path' : 'Guidance · Hint at the junction')");
patch('src/components/workbench/ComponentsWorkspace.tsx', "const illustration = new URLSearchParams(typeof window !== 'undefined' ? window.location?.search ?? '' : '').get('illustration')", "const query = new URLSearchParams(typeof window !== 'undefined' ? window.location?.search ?? '' : '')\n  const illustration = query.get('illustration'), guidance = query.get('guidance')");
patch('src/components/workbench/ComponentsWorkspace.tsx', 'settings.illustration = illustration\n  return settings', "settings.illustration = illustration\n  if (guidance === 'junction' || guidance === 'parallel') { settings.guidanceVariant = guidance; settings.illustration = 'guidance' }\n  return settings");
const oldCaption = "(ru ? 'ВОДИТЕЛЬСТВО · ПОДСКАЗКА В УЗЛЕ' : 'GUIDANCE · HINT AT THE JUNCTION')";
const caption = "(architecture.guidanceVariant === 'parallel' ? (ru ? 'ВОДИТЕЛЬСТВО · ПАРАЛЛЕЛЬНЫЙ ПУТЬ' : 'GUIDANCE · PARALLEL PATH') : (ru ? 'ВОДИТЕЛЬСТВО · ПОДСКАЗКА В УЗЛЕ' : 'GUIDANCE · HINT AT THE JUNCTION'))";
patch('src/components/workbench/HomeComponentsPreview.tsx', oldCaption, caption);
patch('src/components/workbench/HomeSectionPreview.tsx', oldCaption, caption);
patch('src/components/workbench/HomeSectionPreview.tsx', "<p>{ru ? 'На развилке появляется подсказка. Следующий шаг остаётся твоим.' : 'A hint appears at the junction. The next step remains yours.'}</p>", "<p>{architecture.guidanceVariant === 'parallel' ? (ru ? 'Два самостоятельных источника света. Движение рядом, каждый по своему пути.' : 'Two independent sources of light. Moving side by side, each on their own path.') : (ru ? 'На развилке появляется подсказка. Следующий шаг остаётся твоим.' : 'A hint appears at the junction. The next step remains yours.')}</p>");
console.log('Prepared Parallel path alongside the existing junction, with independent presets.');
