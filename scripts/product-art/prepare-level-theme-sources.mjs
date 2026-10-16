import fs from 'node:fs/promises';
const root = new URL('../../assets/product/levels/', import.meta.url);
const names = ['basic-expanded','basic-closed','intensive-expanded','intensive-closed','guidance-expanded','guidance-closed','notes'];
const sources = {};
for (const name of names) sources[name] = await fs.readFile(new URL(`${name}.svg`, root), 'utf8');
await fs.writeFile(new URL('sources.json', root), JSON.stringify(sources, null, 2) + '\n');
