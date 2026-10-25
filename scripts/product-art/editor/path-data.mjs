// SVG path coordinates used by the local editor. Keep commands in absolute form so
// dragging one handle never changes the meaning of a following relative command.
const arity = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const token = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;

export function parsePath(d) {
  const parts = d.match(token) ?? [];
  if (parts.join('').replaceAll(',', '') !== d.replace(/[\s,]/g, '')) throw new Error('Unsupported path data');
  const result = [];
  let i = 0, command = '', x = 0, y = 0, startX = 0, startY = 0, lastC = null, lastQ = null;
  const point = (a, b, relative) => [a + (relative ? x : 0), b + (relative ? y : 0)];
  while (i < parts.length) {
    if (/^[a-zA-Z]$/.test(parts[i])) command = parts[i++];
    if (!command || !(command.toUpperCase() in arity)) throw new Error('Unsupported SVG command');
    const op = command.toUpperCase(), relative = command !== op, count = arity[op];
    if (op === 'Z') { result.push({ op: 'Z', values: [] }); x = startX; y = startY; command = ''; lastC = lastQ = null; continue; }
    if (i + count > parts.length || parts.slice(i, i + count).some(v => /^[a-zA-Z]$/.test(v))) throw new Error('Incomplete SVG command');
    const v = parts.slice(i, i += count).map(Number);
    if (v.some(n => !Number.isFinite(n))) throw new Error('Invalid SVG coordinate');
    let next;
    switch (op) {
      case 'M': case 'L': { const p = point(v[0], v[1], relative); next = { op, values: p }; [x, y] = p; if (op === 'M') { startX = x; startY = y; command = relative ? 'l' : 'L'; } break; }
      case 'H': x = v[0] + (relative ? x : 0); next = { op: 'L', values: [x, y] }; break;
      case 'V': y = v[0] + (relative ? y : 0); next = { op: 'L', values: [x, y] }; break;
      case 'C': { const a = point(v[0], v[1], relative), b = point(v[2], v[3], relative), p = point(v[4], v[5], relative); next = { op: 'C', values: [...a, ...b, ...p] }; [x, y] = p; lastC = b; break; }
      case 'S': { const a = lastC ? [2*x-lastC[0], 2*y-lastC[1]] : [x,y], b = point(v[0], v[1], relative), p = point(v[2], v[3], relative); next = { op: 'C', values: [...a, ...b, ...p] }; [x, y] = p; lastC = b; break; }
      case 'Q': { const a = point(v[0], v[1], relative), p = point(v[2], v[3], relative); next = { op: 'Q', values: [...a, ...p] }; [x, y] = p; lastQ = a; break; }
      case 'T': { const a = lastQ ? [2*x-lastQ[0], 2*y-lastQ[1]] : [x,y], p = point(v[0], v[1], relative); next = { op: 'Q', values: [...a, ...p] }; [x, y] = p; lastQ = a; break; }
      case 'A': { const p = point(v[5], v[6], relative); next = { op: 'A', values: [...v.slice(0,5), ...p] }; [x,y] = p; break; }
    }
    if (op !== 'C' && op !== 'S') lastC = null;
    if (op !== 'Q' && op !== 'T') lastQ = null;
    result.push(next);
  }
  return result;
}

export function serializePath(commands) {
  const number = n => Number(n.toFixed(3)).toString();
  return commands.map(({op, values}) => op + values.map(number).join(' ')).join(' ');
}

export function handles(commands) {
  const out = [];
  commands.forEach(({op, values}, command) => {
    const pairs = op === 'C' ? [0,2,4] : op === 'Q' ? [0,2] : op === 'A' ? [5] : op === 'Z' ? [] : [0];
    pairs.forEach((offset, i) => out.push({ command, offset, x: values[offset], y: values[offset+1], control: op === 'C' ? i < 2 : op === 'Q' && i === 0 }));
  });
  return out;
}
