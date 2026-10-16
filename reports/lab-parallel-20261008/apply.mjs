import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = 'C:/Code Of Stalker/Liquid_Prnc_Glass-main';
const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
const baseline = JSON.parse(fs.readFileSync(path.join(base, fs.existsSync(path.join(base, 'applied.json')) ? 'applied.json' : 'baseline.json'), 'utf8'));
const hash = content => crypto.createHash('sha256').update(content).digest('hex');
const files = [];
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else files.push(path.relative(base, file).replaceAll('\\', '/')); } }
walk(path.join(base, 'src'));
for (const file of files) {
  const dest = path.resolve(root, file);
  if (!dest.startsWith(path.resolve(root) + path.sep)) throw new Error('Invalid destination');
  if (fs.existsSync(dest)) {
    const original = fs.readFileSync(dest, 'utf8');
    if (baseline[file] !== hash(original) && original !== fs.readFileSync(path.join(base, file), 'utf8')) throw new Error('Concurrent or unexpected edit: ' + file);
  } else if (baseline[file]) throw new Error('Original file disappeared: ' + file);
}
let changed = 0;
for (const file of files) {
  const destination = path.join(root, file);
  if (fs.existsSync(destination) && fs.readFileSync(destination, 'utf8') === fs.readFileSync(path.join(base, file), 'utf8')) continue;
  fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(path.join(base, file), destination); changed++;
}
fs.writeFileSync(path.join(base, 'applied.json'), JSON.stringify(Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(path.join(base, file), 'utf8'))])), null, 2));
console.log('Applied ' + changed + ' changed files to the existing Laboratory.');
