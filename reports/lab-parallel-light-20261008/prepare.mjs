import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = 'C:/Code Of Stalker/Liquid_Prnc_Glass-main';
const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
const files = ['parallelSettings.ts', 'parallelGeometry.ts', 'parallelRenderer.ts', 'ArchitectureParallelControls.tsx', 'parallel.test.tsx'].map(name => 'src/components/architecture/' + name);
const baseline = {};
for (const file of files) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const folder of ['', 'original']) { const dest = path.join(base, folder, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, content); }
  baseline[file] = crypto.createHash('sha256').update(content).digest('hex');
}
fs.writeFileSync(path.join(base, 'baseline.json'), JSON.stringify(baseline, null, 2));
fs.copyFileSync(path.join(base, '../lab-parallel-20261008/apply.mjs'), path.join(base, 'apply.mjs'));
console.log('Prepared current parallel lighting files.');
