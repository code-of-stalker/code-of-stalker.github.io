import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(project, 'assets/product/motion/book-projection-approved.html'), 'utf8');
const svg = source.match(/<svg class="wbq-art"[\s\S]*?<\/svg>/)?.[0];
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`Approved book source is missing ${start}`);
  return source.slice(a, b);
}
if (!svg) throw new Error('Approved book illustration is missing');
const geometry = section('    const $=s=>svg.querySelector(s)', '    let elapsed=0');
const draw = section('    function draw(t,time=t*settings.cycle)', '    function sanitize()');
const runtime = fs.readFileSync(path.join(project, 'scripts/product-art/src/book-projection-runtime.js'), 'utf8');
let script = `(()=>{const svg=document.querySelector('.wbq-art');const ns='http://www.w3.org/2000/svg';
const settings={cycle:14,glow:.8,beam:.6,paper:.8,fill:.85,particles:true};
${geometry}
let lastBookPhase=-1;
${draw}
${runtime}
})();`;
// Semantic tokens replace authored colors in both static SVG and generated paths.
const tokens = new Map([
  ['#E7E100','ink'], ['#EEE33C','ink'], ['#F9E956','ink'], ['#F8ED5C','ink'],
  ['#FFF9D4','light'], ['#FFF9DC','light'], ['#FFF8BE','light'], ['#FFF7BB','light'], ['#FFFADC','light'], ['#FFF7C0','light'], ['#FFF8C0','light'], ['#FAEF9C','light'],
  ['#080A04','cover'], ['#0C0C04','cover'], ['#0C0E06','cover'], ['#0D0F06','cover'],
  ['#101107','paper'], ['#151609','paper'], ['#121309','edge'], ['#22210A','edge'], ['#35300D','edge'],
  ['#383315','dim'], ['#514B15','dim'], ['#716D30','dim'], ['#77732A','dim'],
  ['#827C2A','line'], ['#8D822D','line'], ['#928C27','line'], ['#C9C249','line'],
  ['#AFA83A','bright'], ['#AAA032','bright'], ['#C0B84D','bright'], ['#BEB445','bright'], ['#D7CF47','bright'], ['#EEE563','bright'],
]);
const theme = text => { for (const [color, token] of tokens) text = text.replaceAll(color, `var(--book-${token})`); return text; };
script = theme(script);
fs.writeFileSync(path.join(project, 'src/features/product/motion/bookProjection.generated.ts'),
  `// Generated from the approved book source. Run node scripts/product-art/build-book-projection.mjs.\nexport const bookSvg = ${JSON.stringify(theme(svg))};\nexport const bookScript = ${JSON.stringify(script)};\n`);
console.log('Generated book projection: shared offline SVG scene for web and native.');
