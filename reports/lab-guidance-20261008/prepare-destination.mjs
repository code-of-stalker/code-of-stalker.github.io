import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
const file = 'src/components/workbench/HomeSectionPreview.tsx';
const original = fs.readFileSync(path.join('C:/Code Of Stalker/Liquid_Prnc_Glass-main', file), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(base, 'applied.json'), 'utf8'));
manifest[file] = crypto.createHash('sha256').update(original).digest('hex');
fs.writeFileSync(path.join(base, 'applied.json'), JSON.stringify(manifest, null, 2));
fs.mkdirSync(path.dirname(path.join(base, 'original', file)), { recursive: true });
fs.writeFileSync(path.join(base, 'original', file), original);
let source = original.replace("{architecture.illustration === 'distance' ? (ru ? 'ВЫСТАВЬ ДИСТАНЦИЮ'", "{architecture.illustration === 'guidance' ? (ru ? 'ВОДИТЕЛЬСТВО · ПОДСКАЗКА В УЗЛЕ' : 'GUIDANCE · HINT AT THE JUNCTION') : architecture.illustration === 'distance' ? (ru ? 'ВЫСТАВЬ ДИСТАНЦИЮ'");
source = source.replace("{architecture.illustration === 'distance' ? <>", `{architecture.illustration === 'guidance' ? <>
          <p><strong>{ru ? 'Водительство от проводника' : 'Guidance from a guide'}</strong></p>
          <p>{ru ? 'На развилке появляется подсказка. Следующий шаг остаётся твоим.' : 'A hint appears at the junction. The next step remains yours.'}</p>
        </> : architecture.illustration === 'distance' ? <>`);
source = source.replace('<span className="home-section-step">{architecture.illustration === \'distance\'', '<span className="home-section-step">{architecture.illustration === \'guidance\' ? (ru ? \'ВОДИТЕЛЬСТВО\' : \'GUIDANCE\') : architecture.illustration === \'distance\'');
if (source === original) throw new Error('No destination changes');
fs.writeFileSync(path.join(base, file), source);
