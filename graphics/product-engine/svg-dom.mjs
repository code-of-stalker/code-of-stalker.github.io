/** Build-time SVG authoring adapter. Never shipped in the application runtime. */
export class SvgNode {
  constructor(tag, attrs = {}) {
    this.tagName = tag; this.attrs = { ...attrs }; this.children = []; this.parentNode = null;
    this.style = new Proxy({ setProperty: (key, value) => { this.styles[key] = String(value); }, removeProperty: key => delete this.styles[key] }, {
      set: (obj, key, value) => { this.styles[key] = String(value); return true; }, get: (obj, key) => obj[key] ?? this.styles[key] ?? '',
    }); this.styles = {};
    this.dataset = new Proxy({}, { get: (_, key) => this.getAttribute('data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase())),
      set: (_, key, value) => { this.setAttribute('data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase()), String(value)); return true; } });
    this.transform = { baseVal: { consolidate: () => ({ matrix: matrix(this.getAttribute('transform') ?? '') }) } };
    this.clientWidth = 400; this.clientHeight = 160;
  }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  getAttribute(key) { return this.attrs[key] ?? null; }
  removeAttribute(key) { delete this.attrs[key]; }
  get firstElementChild() { return this.children[0] ?? null; }
  get lastElementChild() { return this.children.at(-1) ?? null; }
  appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  prepend(child) { child.remove(); child.parentNode = this; this.children.unshift(child); }
  insertBefore(child, before) { if (!before) return this.appendChild(child); child.remove(); child.parentNode = this; this.children.splice(this.children.indexOf(before), 0, child); return child; }
  insertAdjacentHTML(position, value) { const nodes = [...parseSvg('<root>' + value + '</root>').children]; if (position === 'beforeend') this.append(...nodes); else if (position === 'afterbegin') [...nodes].reverse().forEach(node => this.prepend(node)); else throw new Error('Unsupported authoring insertion ' + position); }
  remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
  replaceChildren(...children) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; this.append(...children); }
  set innerHTML(value) { this.replaceChildren(); const parsed = parseSvg('<root>' + value + '</root>'); [...parsed.children].forEach(child => this.appendChild(child)); }
  get innerHTML() { return this.children.map(node => node.outerHTML).join(''); }
  get outerHTML() { const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
    const attrs = { ...this.attrs }; if (Object.keys(this.styles).length) attrs.style = Object.entries(this.styles).map(([key, value]) => key + ':' + value).join(';');
    return '<' + this.tagName + Object.entries(attrs).map(([key, value]) => ' ' + key + '="' + escape(value) + '"').join('') + '>' + (this.textContent ?? '') + this.innerHTML + '</' + this.tagName + '>'; }
  querySelectorAll(selector) {
    const result = [], selectors = selector.split(',').map(s => s.trim());
    const walk = node => { for (const child of node.children) { if (selectors.some(s => matchesChain(child, s))) result.push(child); walk(child); } };
    walk(this); return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  addEventListener() {} removeEventListener() {}
  getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight, top: 0, left: 0 }; }
}
function matches(node, selector) {
  const tag = selector.match(/^[a-zA-Z][\w:-]*/)?.[0]; if (tag && tag !== node.tagName) return false;
  for (const match of selector.matchAll(/\.([\w-]+)/g)) if (!(node.attrs.class ?? '').split(/\s+/).includes(match[1])) return false;
  for (const match of selector.matchAll(/#([\w-]+)/g)) if (node.attrs.id !== match[1]) return false;
  for (const match of selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)) {
    if (!(match[1] in node.attrs) || match[2] !== undefined && node.attrs[match[1]] !== match[2]) return false;
  }
  return true;
}
export function matchesChain(node, selector) {
  const parts = selector.split(/\s+/).filter(Boolean); if (!matches(node, parts.pop())) return false;
  let parent = node.parentNode; while (parts.length) { const part = parts.pop(); while (parent && !matches(parent, part)) parent = parent.parentNode; if (!parent) return false; parent = parent.parentNode; } return true;
}
export function parseSvg(source) {
  const root = new SvgNode('root'), stack = [root];
  for (const match of source.matchAll(/<!--[\s\S]*?-->|<\/?[\w:-]+\b[^>]*>|[^<]+/g)) {
    const text = match[0]; if (text.startsWith('<!--')) continue;
    if (text.startsWith('</')) { stack.pop(); continue; }
    if (!text.startsWith('<')) { stack.at(-1).textContent = (stack.at(-1).textContent ?? '') + text; continue; }
    const tag = text.match(/^<([\w:-]+)/)[1], attrs = {};
    for (const attr of text.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) attrs[attr[1]] = (attr[3]??attr[4]).replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&lt;','<');
    const node = new SvgNode(tag, attrs); stack.at(-1).appendChild(node); if (!text.endsWith('/>')) stack.push(node);
  }
  return root.children[0];
}
export function matrix(value) {
  let a = 1, b = 0, c = 0, d = 1, e = 0, f = 0;
  for (const match of value.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const v = match[2].match(/[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi)?.map(Number) ?? []; let m;
    if (match[1] === 'translate') m = [1,0,0,1,v[0],v[1] ?? 0];
    else if (match[1] === 'scale') m = [v[0],0,0,v[1] ?? v[0],0,0];
    else if (match[1] === 'rotate') { const rad = v[0] * Math.PI/180, s = Math.sin(rad), k = Math.cos(rad), x = v[1] ?? 0, y = v[2] ?? 0; m = [k,s,-s,k,x-k*x+s*y,y-s*x-k*y]; }
    else if (match[1] === 'matrix') m = v; else throw new Error('Unsupported transform ' + match[1]);
    [a,b,c,d,e,f] = [a*m[0]+c*m[1], b*m[0]+d*m[1], a*m[2]+c*m[3], b*m[2]+d*m[3], a*m[4]+c*m[5]+e, b*m[4]+d*m[5]+f];
  }
  return { a,b,c,d,e,f };
}
export function installAuthoringDom() {
  const queue = new Map(); let next = 1;
  globalThis.document = { hidden: false, createElementNS: (_, tag) => new SvgNode(tag), addEventListener() {}, removeEventListener() {} };
  globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), setTimeout, clearTimeout };
  globalThis.requestAnimationFrame = fn => { const id = next++; queue.set(id, fn); return id; };
  globalThis.cancelAnimationFrame = id => queue.delete(id);
  globalThis.ResizeObserver = class { constructor(fn) { this.fn = fn; } observe() { this.fn(); } disconnect() {} };
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
  return { tick(now) { const jobs = [...queue.values()]; queue.clear(); jobs.forEach(fn => fn(now)); }, clear() { queue.clear(); } };
}
