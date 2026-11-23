// Drives the test build (compile flag HARNESS) in the iOS Simulator from Node on a Mac.
// The app reads commands from <data container>/Documents/harness/in and answers in .../out
// (ios-app/CodeOfStalker/Harness.swift); screenshots come from `simctl io`.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const BUNDLE = 'code.of.stalker';
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Synchronous, so a hung simulator call would stop the whole run: it is killed after 10 minutes
// and throws, which fails only the check that made it.
export const simctl = (...args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'], timeout: 10 * 60 * 1000 }).trim();

/** The newest available simulator whose name matches one of `names`, in that order of preference. */
export function pickDevice(names, fallback) {
  const { devices } = JSON.parse(simctl('list', 'devices', 'available', '-j'));
  const version = key => key.match(/iOS-(.*)/)[1].split('-').map(Number);
  const newer = (a, b) => { const x = version(a), y = version(b); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((y[i] ?? 0) !== (x[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0); return 0; };
  const runtimes = Object.keys(devices).filter(key => /SimRuntime\.iOS-/.test(key)).sort(newer);
  for (const runtime of runtimes) {
    for (const name of names) {
      const device = devices[runtime].find(d => d.name === name && d.isAvailable !== false);
      if (device) return { ...device, runtime };
    }
  }
  for (const runtime of runtimes) {
    const device = devices[runtime].find(d => fallback.test(d.name));
    if (device) return { ...device, runtime };
  }
  throw new Error(`No simulator like ${names.join(', ')}`);
}

/**
 * Runs in the page (stringified). Plain listeners see the same events a finger makes:
 * the reader pages on touch events, Pressables answer `click()`, React inputs need the
 * native value setter plus an `input` event.
 */
export function pageHelpers() {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const norm = value => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const find = (how, value) => {
    const want = norm(value);
    const all = how === 'text'
      ? [...document.querySelectorAll('body *')].filter(e => norm(e.innerText) === want && shown(e))
      : how === 'prefix'
        ? [...document.querySelectorAll('body *')].filter(e => norm(e.innerText).startsWith(want) && e.children.length === 0 && shown(e))
        : [...document.querySelectorAll('[aria-label]')].filter(e => norm(e.getAttribute('aria-label')).startsWith(want) && shown(e));
    return all.at(-1) || null;
  };
  const tap = (how, value) => {
    const el = find(how, value);
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  };
  const type = (label, text) => {
    const el = find('label', label);
    if (!el) return false;
    const field = el.matches('input,textarea') ? el : el.querySelector('input,textarea');
    if (!field) return false;
    field.focus();
    const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, text);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
  const swipe = async (x0, y0, x1, y1, ms = 220, steps = 12) => {
    const target = document.elementFromPoint(x0, y0) || document.body;
    const point = (x, y) => ({ identifier: 7, target, clientX: x, clientY: y, pageX: x + scrollX, pageY: y + scrollY, screenX: x, screenY: y, radiusX: 8, radiusY: 8, rotationAngle: 0, force: 0.5 });
    const fire = (type, p, active) => {
      const event = new Event(type, { bubbles: true, cancelable: true, composed: true });
      const list = active ? [p] : [];
      Object.defineProperty(event, 'touches', { value: list });
      Object.defineProperty(event, 'targetTouches', { value: list });
      Object.defineProperty(event, 'changedTouches', { value: [p] });
      target.dispatchEvent(event);
    };
    fire('touchstart', point(x0, y0), true);
    for (let i = 1; i <= steps; i++) {
      await sleep(ms / steps);
      const t = i / steps;
      fire('touchmove', point(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t), true);
    }
    fire('touchend', point(x1, y1), false);
  };
  const state = () => {
    const text = document.body.innerText;
    const lines = text.split('\n');
    const counter = (text.match(/(?<![:\d])(\d\d?) \/ (\d\d?)(?![:\d])/) || [])[0] || '';
    const sel = [...document.querySelectorAll('[aria-label^="Выбрать шаг"]')].map(e => e.getAttribute('aria-label')).find(l => /ШАГ \d/.test(l)) || '';
    const step = (sel.match(/ШАГ (\d)/) || text.match(/ШАГ (\d)/) || [])[1] || '';
    const q = ([...document.querySelectorAll('[aria-label^="Вопрос "]')].map(e => e.getAttribute('aria-label')).find(l => / из /.test(l)) || '').replace('Вопрос ', 'q');
    const scenes = [...document.querySelectorAll('canvas')].filter(c => c.getBoundingClientRect().width > 120).map(c => {
      const r = c.getBoundingClientRect();
      const host = c.closest('[data-graphics]') || c;
      const data = {};
      for (const el of [c, c.parentElement, host]) for (const a of el?.attributes ?? []) if (a.name.startsWith('data-')) data[a.name] = a.value.slice(0, 60);
      return { visible: r.bottom > 0 && r.top < innerHeight, size: `${c.width}x${c.height}`, ...data };
    });
    return { path: location.pathname, step, counter, q, first: (lines[0] || '').slice(0, 30), title: lines.slice(0, 4).join(' | ').slice(0, 90), scenes };
  };
  // Start a swipe on plain content, never on a control (a swipe on the record orb locks a
  // recording; on an answer player it toggles playback).
  const swipeStart = () => {
    for (const fy of [0.72, 0.8, 0.64, 0.86, 0.56, 0.48]) for (const fx of [0.5, 0.28, 0.72]) {
      const x = innerWidth * fx, y = innerHeight * fy;
      const hits = [-16, 0, 16].map(d => document.elementFromPoint(x, y + d));
      if (hits.every(el => el && !el.closest('[role="button"],[role="slider"],[role="link"],[role="switch"],[data-recording-gesture],button,a,input,textarea'))) return [x, y];
    }
    return [innerWidth * 0.5, innerHeight * 0.72];
  };
  // A finger scrolls a long page before it pages; synthetic touches do not scroll native
  // overflow, so scroll that part directly and swipe only at its end.
  const advance = async () => {
    const [x, y] = swipeStart();
    let box = document.elementFromPoint(x, y);
    while (box && box !== document.body && box !== document.documentElement) {
      const style = getComputedStyle(box);
      if (/(auto|scroll)/.test(style.overflowY) && box.scrollHeight > box.clientHeight + 4) break;
      box = box.parentElement;
    }
    if (!box || box === document.body || box === document.documentElement) box = document.scrollingElement;
    if (box && box.scrollTop + box.clientHeight < box.scrollHeight - 4) {
      const before = box.scrollTop;
      box.scrollBy({ top: box.clientHeight * 0.8 });
      await sleep(350);
      if (box.scrollTop > before + 1) return 'scroll';
    }
    await swipe(x, y, x, y - innerHeight * 0.5);
    return 'swipe';
  };
  const diaryCount = async () => {
    const db = await new Promise((resolve, reject) => { const q = indexedDB.open('watcher-product-local-v1'); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
    try {
      return await new Promise(resolve => {
        try { const q = db.transaction('encrypted').objectStore('encrypted').count(); q.onsuccess = () => resolve(q.result); q.onerror = () => resolve('error'); }
        catch { resolve('no store'); }
      });
    } finally { db.close(); }
  };
  // The restore picker: hand the next file input this file instead of opening the system sheet.
  const offerFile = (name, base64) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const original = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      if (this.type !== 'file') return original.call(this);
      HTMLInputElement.prototype.click = original;
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], name, { type: 'application/octet-stream' }));
      this.files = transfer.files;
      setTimeout(() => this.dispatchEvent(new Event('change', { bubbles: true })), 50);
    };
    return bytes.length;
  };
  return { sleep, norm, find, tap, type, swipe, state, swipeStart, advance, diaryCount, offerFile };
}

export class App {
  constructor(device, out, log = console.log) {
    this.udid = device.udid;
    this.device = device;
    this.out = out;
    this.log = log;
    fs.mkdirSync(out, { recursive: true });
  }

  install(appPath) {
    try { simctl('terminate', this.udid, BUNDLE); } catch {}
    simctl('install', this.udid, appPath);
    this.container = simctl('get_app_container', this.udid, BUNDLE, 'data');
    this.harness = path.join(this.container, 'Documents', 'harness');
  }

  uninstall() {
    try { simctl('terminate', this.udid, BUNDLE); } catch {}
    try { simctl('uninstall', this.udid, BUNDLE); } catch {}
  }

  async launch(args = []) {
    try { simctl('terminate', this.udid, BUNDLE); } catch {}
    await sleep(600);
    simctl('launch', this.udid, BUNDLE, '-harness', ...args);
    this.container = simctl('get_app_container', this.udid, BUNDLE, 'data');
    this.harness = path.join(this.container, 'Documents', 'harness');
    return this.ready(60000);
  }

  terminate() { try { simctl('terminate', this.udid, BUNDLE); } catch {} }

  /** Waits for the page to be loaded and showing text. */
  async ready(timeout = 40000) {
    const start = Date.now();
    let last;
    while (Date.now() - start < timeout) {
      try {
        last = await this.fn(() => ({ state: document.readyState, text: document.body ? document.body.innerText.length : 0, path: location.pathname }), [], 5000);
        if (last.state === 'complete' && last.text > 20) { await sleep(1500); return last; }
      } catch (error) { last = String(error.message || error); }
      await sleep(500);
    }
    throw new Error(`page not ready: ${JSON.stringify(last)}`);
  }

  async command(op, body, timeout = 30000) {
    const inbox = path.join(this.harness, 'in');
    const outbox = path.join(this.harness, 'out');
    const start = Date.now();
    while (!fs.existsSync(inbox)) { if (Date.now() - start > timeout) throw new Error('harness folder missing'); await sleep(200); }
    const id = crypto.randomUUID();
    const temp = path.join(inbox, `${id}.tmp`);
    fs.writeFileSync(temp, JSON.stringify({ id, op, body }));
    fs.renameSync(temp, path.join(inbox, `${id}.json`));
    const answer = path.join(outbox, `${id}.json`);
    while (Date.now() - start < timeout) {
      if (fs.existsSync(answer)) {
        const reply = JSON.parse(fs.readFileSync(answer, 'utf8'));
        fs.rmSync(answer, { force: true });
        return reply;
      }
      await sleep(80);
    }
    try { fs.rmSync(path.join(inbox, `${id}.json`), { force: true }); } catch {}
    throw new Error(`${op} timed out`);
  }

  /** Runs `f(h, ...args)` in the page, `h` being pageHelpers(); returns its JSON value. */
  async fn(f, args = [], timeout = 30000) {
    const body = `if (!window.__harness) window.__harness = (${pageHelpers.toString()})();
const value = await (${f.toString()})(window.__harness, ...${JSON.stringify(args)});
return JSON.stringify({ value: value === undefined ? null : value });`;
    for (let attempt = 0; ; attempt++) {
      const reply = await this.command('js', body, timeout);
      if (reply.ok) return JSON.parse(reply.value).value;
      // WKErrorDomain 5 (unsupported result type) comes back when the page reloads during
      // the call: the answer is lost, not wrong. Ask again once the new page is up.
      if (attempt < 2 && /WKErrorDomain 5\b/.test(reply.error)) { await sleep(1500); continue; }
      throw new Error(`js: ${reply.error}`);
    }
  }

  async native() {
    const reply = await this.command('native');
    return reply.value;
  }

  async dismissPicker(result) {
    return this.command('dismiss', result);
  }

  /** Opens a route with a full page load, as the Android checks did. */
  async go(route) {
    await this.fn((h, to) => { setTimeout(() => location.assign(to), 30); return true; }, [route]);
    await sleep(1200);
    return this.ready();
  }

  path() { return this.fn(() => location.pathname); }
  text(limit = 400) { return this.fn((h, n) => document.body.innerText.replace(/\s+/g, ' ').slice(0, n), [limit]); }

  async tap(how, value, wait = 1500, tries = 12) {
    for (let i = 0; i < tries; i++) {
      if (await this.fn((h, a, b) => h.tap(a, b), [how, value])) { await sleep(wait); return true; }
      await sleep(700);
    }
    this.log(`MISSING ${how} ${value}`);
    return false;
  }

  async has(how, value) { return this.fn((h, a, b) => !!h.find(a, b), [how, value]); }

  shot(name, type = 'jpeg') {
    const file = path.join(this.out, `${name}.${type === 'png' ? 'png' : 'jpg'}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    simctl('io', this.udid, 'screenshot', `--type=${type}`, file);
    return file;
  }

  events() {
    const file = path.join(this.harness, 'events.log');
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return { kind: 'bad-line', text: line }; } });
  }
}
