// node ios-app/harness/run.mjs --app <CodeOfStalker.app> [--demo <demo .app>] --out <folder> [--only part,part]
//
// The same checks as the Android app got on the TECNO, in the iOS Simulator:
// first start, every step in Тишина (shown first), the diary across a restart, the mic,
// the page's back swipe, a backup saved through the Files sheet and restored on a fresh
// install, the other three dark themes, the iPad, and the Intensive against the demo
// server of a development build. Every run of the app is fenced offline (-harnessOffline):
// any http(s) or ws(s) load is blocked and logged, so nothing reaches a real server.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { App, BUNDLE, pickDevice, simctl, sleep } from './lib.mjs';

const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const appPath = arg('app');
const demoPath = arg('demo');
const out = path.resolve(arg('out') ?? 'ios-check');
const only = (arg('only') ?? 'all').split(',');
const part = name => only.includes('all') || only.includes(name);
if (!appPath) throw new Error('--app <CodeOfStalker.app> is required');
fs.mkdirSync(out, { recursive: true });
const logStream = fs.createWriteStream(path.join(out, 'log.txt'), { flags: 'a' });
const log = (...items) => {
  const line = items.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ');
  console.log(line);
  logStream.write(`${line}\n`);
};
const summary = { started: new Date().toISOString(), devices: {}, checks: {} };
const save = () => fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
async function check(name, run) {
  log(`\n=== ${name}`);
  const started = Date.now();
  try { summary.checks[name] = { ok: true, ...(await run()) }; }
  catch (error) { summary.checks[name] = { ok: false, error: String(error.stack || error) }; log('FAILED', name, String(error.stack || error)); }
  summary.checks[name].seconds = Math.round((Date.now() - started) / 1000);
  log(`--- ${name}: ${summary.checks[name].ok ? 'ok' : 'FAILED'} in ${summary.checks[name].seconds}s`);
  save();
}

const LAUNCH = ['-harnessOffline'];
const THEMES = [['ТИШИНА', 'tishina'], ['МАТРИЦА', 'matrix'], ['ИСКРА', 'iskra'], ['АСТРАЛ', 'astral']];
// A throwaway passphrase for the test backup; it lives only in this process.
const PASSWORD = crypto.randomBytes(12).toString('base64url');
const keep = os.tmpdir();

function boot(device) {
  simctl('bootstatus', device.udid, '-b');
  try {
    simctl('status_bar', device.udid, 'override', '--time', '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3',
      '--cellularMode', 'active', '--cellularBars', '4', '--batteryState', 'charged', '--batteryLevel', '100');
  } catch (error) { log('status bar override failed', String(error.message)); }
}

function grantMic(app) {
  try { simctl('privacy', app.udid, 'grant', 'microphone', BUNDLE); return true; } catch (error) { log('mic grant failed', String(error.message)); return false; }
}

const press = async (app, value, wait = 1500) =>
  (await app.tap('label', value, wait, 4)) || (await app.tap('text', value, wait, 2)) || app.tap('prefix', value, wait, 2);
const buttons = app => app.fn(h => [...document.querySelectorAll('[role="button"],button,[role="switch"],[role="radio"]')]
  .filter(e => e.getBoundingClientRect().width > 0).map(e => (e.getAttribute('aria-label') || e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean));

async function firstStart(app, dir) {
  const result = { path: await app.path(), text: await app.text(240) };
  app.shot(`${dir}/00-first-start`, 'png');
  for (let i = 0; i < 45; i++) {
    if (await app.fn(h => h.tap('label', 'ОСТАВИТЬ НАСТРОЙКИ') || h.tap('prefix', 'ОСТАВИТЬ НАСТРОЙКИ'))) { result.tuning = 'kept defaults'; break; }
    if (await app.has('label', 'Архитектура наблюдения')) { result.tuning = 'none shown'; break; }
    await sleep(1000);
  }
  await sleep(3000);
  result.after = await app.path();
  app.shot(`${dir}/01-after-first-start`, 'png');
  return result;
}

async function unlockAll(app) {
  await app.go('/settings');
  const state = () => app.fn(h => h.find('label', 'Всё открыто')?.getAttribute('aria-checked') ?? null);
  if ((await state()) !== 'true') await app.tap('label', 'Всё открыто', 1500);
  return state();
}

async function theme(app, label, dir) {
  await app.go('/settings');
  const checked = () => app.fn((h, name) => [...document.querySelectorAll('[role="radio"]')].find(e => h.norm(e.getAttribute('aria-label')) === h.norm(name))?.getAttribute('aria-checked') ?? null, [label]);
  for (let i = 0; i < 4 && (await checked()) !== 'true'; i++) await app.tap('label', label, 2500);
  const page = await app.fn(() => ({ body: getComputedStyle(document.body).backgroundColor, meta: document.querySelector('meta[name="theme-color"]')?.content || '' }));
  const native = await app.native();
  await app.fn(() => scrollTo(0, 0));
  await sleep(700);
  app.shot(`${dir}/settings`, 'png');
  for (const [route, name, wait] of [['/home', 'home', 3500], ['/levels', 'levels', 2000], ['/diary', 'diary', 2000]]) {
    await app.go(route);
    await sleep(wait);
    app.shot(`${dir}/${name}`, 'png');
  }
  return { checked: await checked(), ...page, shell: { background: native.background, window: native.windowBackground, statusBarLight: native.statusBarLight, safeArea: native.safeArea } };
}

async function walk(app, dir, { maxActions = 170, idleLimit = 8, stopStep = null, maxPages = Infinity } = {}) {
  let last = '', idle = 0, n = 0, action = 'none';
  const seen = [];
  for (let i = 0; i <= maxActions; i++) {
    const s = await app.fn(h => h.state());
    const key = `${s.path} ${s.step} ${s.counter}${s.q} ${s.counter ? '' : s.first}`;
    if (stopStep && s.step && Number(s.step) >= stopStep) { log('-> reached step', s.step); break; }
    if (key !== last) {
      idle = 0;
      await sleep(2200);
      const now = await app.fn(h => h.state());
      n++;
      const tag = (now.counter || now.q.replace(' из ', 'of') || 'na').replace(' / ', 'of');
      const name = `${dir}/${String(n).padStart(2, '0')}-step${now.step || 'x'}-${tag}`;
      app.shot(name);
      const visible = now.scenes.filter(x => x.visible);
      const bad = visible.filter(v => v['data-graphics-error'] || v['data-ready'] === 'false');
      log(`${key.slice(0, 44).padEnd(44)} scenes=${visible.length} ${visible.map(v => `${v.size}:${v['data-graphics-backend'] ?? '-'}:${v['data-graphics-presentation'] ?? '-'}`).join(',')}${bad.length ? ` BAD ${JSON.stringify(bad)}` : ''} | ${now.title.slice(0, 50)}`);
      seen.push({ key, file: `${name}.jpg`, title: now.title, scenes: now.scenes, bad: bad.length });
      last = key;
      if (n >= maxPages) break;
    } else if (action === 'swipe' && ++idle >= idleLimit) break;
    action = await app.fn(h => h.advance());
    await sleep(action === 'swipe' ? 1300 : 500);
  }
  fs.writeFileSync(path.join(out, dir, 'pages.json'), JSON.stringify(seen, null, 1));
  return seen;
}

async function openPractice(app) {
  await app.go('/levels');
  if (!await app.tap('label', 'ПРОДОЛЖИТЬ', 3500, 3)) await app.tap('label', 'НАЧАТЬ', 3500);
  return app.path();
}

async function allSteps(app, dir, options = {}) {
  const practice = await openPractice(app);
  const steps = [];
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    await app.fn(() => scrollTo(0, 0));
    if (!await app.has('label', 'Открыть шаг 1') && !await app.tap('label', 'Выбрать шаг', 1500)) { steps.push({ n, error: 'no step selector' }); continue; }
    if (!await app.tap('label', `Открыть шаг ${n}`, 3500)) { steps.push({ n, error: 'no step button' }); continue; }
    log(`\n--- step ${n}`);
    const seen = await walk(app, `${dir}/step${n}`, { ...options, stopStep: n + 1 });
    steps.push({
      n, pages: seen.length,
      withScenes: seen.filter(p => p.scenes.some(c => c.visible)).length,
      badScenes: seen.filter(p => p.bad).length,
      backends: [...new Set(seen.flatMap(p => p.scenes.map(c => c['data-graphics-backend']).filter(Boolean)))],
    });
  }
  return { practice, steps };
}

async function diary(app, dir) {
  await app.go('/diary');
  await sleep(1500);
  const before = await app.fn(h => h.diaryCount());
  const typed = await app.fn(h => h.type('Текст наблюдения', 'Проверка iOS: запись до перезапуска.'));
  await sleep(700);
  const saved = await app.tap('label', 'Сохранить текст', 2500);
  const notice = await app.fn(() => document.body.innerText.match(/ЗАПИСЬ СОХРАНЕНА/i)?.[0] ?? null);
  const afterSave = await app.fn(h => h.diaryCount());
  app.shot(`${dir}/diary-01-saved`, 'png');
  // Cold restart: the process is killed and started again.
  await app.launch(LAUNCH);
  await app.go('/diary');
  await sleep(2500);
  const afterRestart = await app.fn(h => h.diaryCount());
  const text = await app.text(400);
  app.shot(`${dir}/diary-02-after-restart`, 'png');
  return { before, typed, saved, notice, afterSave, afterRestart, entryShown: text.toLowerCase().includes('проверка ios'), text };
}

async function mic(app, dir) {
  const probe = await app.fn(async h => {
    const out = { mediaDevices: !!navigator.mediaDevices?.getUserMedia, recorder: typeof MediaRecorder };
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];
      out.track = track ? { label: track.label, state: track.readyState } : null;
      out.types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac'].filter(t => MediaRecorder.isTypeSupported?.(t));
      const recorder = new MediaRecorder(stream, out.types[0] ? { mimeType: out.types[0] } : undefined);
      const parts = [];
      recorder.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
      const stopped = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.start(250);
      await h.sleep(2500);
      recorder.stop();
      await stopped;
      stream.getTracks().forEach(t => t.stop());
      out.mime = recorder.mimeType;
      out.bytes = parts.reduce((sum, part) => sum + part.size, 0);
    } catch (error) { out.error = `${error.name}: ${error.message}`; }
    return out;
  }, [], 30000);
  log('mic probe', probe);
  // The diary orb: a click without a pointer (detail 0) starts a locked recording; a second click ends it.
  await app.go('/diary');
  await sleep(1500);
  const before = await app.fn(h => h.diaryCount());
  const orb = () => app.fn(() => { const b = document.querySelector('[data-recording-gesture]'); if (!b) return null; const label = b.getAttribute('aria-label'); b.click(); return label; });
  const started = await orb();
  await sleep(4000);
  const during = await app.text(300);
  app.shot(`${dir}/mic-01-recording`, 'png');
  const stopped = await orb();
  await sleep(3500);
  const review = await buttons(app);
  app.shot(`${dir}/mic-02-review`, 'png');
  const saveLabel = review.find(label => /^сохранить/i.test(label));
  if (saveLabel) await press(app, saveLabel, 3500);
  const after = await app.fn(h => h.diaryCount());
  app.shot(`${dir}/mic-03-after`, 'png');
  return { probe, started, during, stopped, review, kept: saveLabel ?? null, before, after, text: await app.text(300) };
}

async function back(app, dir) {
  const swipeBack = () => app.fn(h => h.swipe(30, innerHeight * 0.55, Math.min(innerWidth - 24, 330), innerHeight * 0.55, 260));
  await app.go('/home');
  await app.tap('label', 'Архитектура наблюдения', 2500);
  if (!await app.tap('label', 'ПРОДОЛЖИТЬ', 3500, 3)) await app.tap('label', 'НАЧАТЬ', 3500);
  const trail = [await app.path()];
  app.shot(`${dir}/back-01-start`);
  for (let i = 0; i < 3; i++) {
    await swipeBack();
    await sleep(1800);
    trail.push(await app.path());
    app.shot(`${dir}/back-0${i + 2}`);
  }
  await openPractice(app);
  await app.tap('label', 'Выбрать шаг', 1200);
  const menuBefore = await app.has('label', 'Открыть шаг 1');
  await swipeBack();
  await sleep(1500);
  const menuAfter = await app.has('label', 'Открыть шаг 1');
  return { trail, menuOpenBefore: menuBefore, menuOpenAfter: menuAfter, pathAfterMenu: await app.path() };
}

async function backupSave(app, dir) {
  await app.go('/settings');
  await press(app, 'СОЗДАТЬ РЕЗЕРВНУЮ КОПИЮ', 2000);
  const typed = [
    await app.fn((h, p) => h.type('Пароль резервной копии', p), [PASSWORD]),
    await app.fn((h, p) => h.type('Повтор пароля резервной копии', p), [PASSWORD]),
  ];
  await sleep(600);
  app.shot(`${dir}/backup-01-form`, 'png');
  await press(app, 'СОХРАНИТЬ ФАЙЛ КОПИИ', 500);
  let native = {};
  for (let i = 0; i < 60 && !/DocumentPicker/.test(native.presented ?? ''); i++) { await sleep(500); native = await app.native(); }
  await sleep(2000);
  app.shot(`${dir}/backup-02-files-sheet`, 'png');
  // The real sheet needs a finger to pick a folder: close it as if "Save" had been tapped.
  const dismissed = await app.dismissPicker('saved');
  await sleep(3000);
  const pageSays = await app.fn(() => document.body.innerText.match(/Копия создана[^\n]*|Последнее создание[^\n]*|Не удалось[^\n]*|сохран[^\n]*копи[^\n]*/gi));
  app.shot(`${dir}/backup-03-after`, 'png');
  const folder = path.join(app.harness, 'saved');
  const files = fs.existsSync(folder) ? fs.readdirSync(folder).map(name => ({ name, bytes: fs.statSync(path.join(folder, name)).size })) : [];
  const newest = files.filter(f => f.name.endsWith('.watcherbackup')).at(-1);
  let copy = null;
  if (newest) { copy = path.join(keep, `ios-check-${newest.name}`); fs.copyFileSync(path.join(folder, newest.name), copy); }
  return { typed, presented: native.presented, dismissed, pageSays, files, copy };
}

async function restoreFresh(app, dir, file) {
  app.uninstall();
  app.install(appPath);
  grantMic(app);
  await app.launch(LAUNCH);
  const start = await firstStart(app, dir);
  const before = await app.fn(h => h.diaryCount());
  await app.go('/settings');
  const offered = await app.fn((h, name, data) => h.offerFile(name, data), [path.basename(file).replace(/^ios-check-/, ''), fs.readFileSync(file).toString('base64')], 60000);
  await press(app, 'ВОССТАНОВИТЬ ИЗ ФАЙЛА', 3000);
  const sheet = await app.text(400);
  const typed = await app.fn((h, p) => h.type('Пароль для восстановления', p), [PASSWORD]);
  await sleep(500);
  app.shot(`${dir}/restore-01-password`, 'png');
  await press(app, 'ПРОВЕРИТЬ КОПИЮ', 6000);
  const checked = await app.fn(() => document.body.innerText.match(/Копия от[^\n]*|Ответов Архитектуры[^\n]*|Неверный[^\n]*|запис[^\n]*/gi)?.slice(0, 6));
  app.shot(`${dir}/restore-02-checked`, 'png');
  await press(app, 'ВОССТАНОВИТЬ ЗАПИСИ', 7000);
  const notice = await app.fn(() => document.body.innerText.match(/Записи восстановлены[^\n]*|Не удалось[^\n]*|восстановлен[^\n]*/gi));
  const after = await app.fn(h => h.diaryCount());
  await app.go('/diary');
  await sleep(2500);
  const text = await app.text(400);
  app.shot(`${dir}/restore-03-diary`, 'png');
  return { start, before, offered, sheet, typed, checked, notice, after, entryShown: text.toLowerCase().includes('проверка ios'), text };
}

function events(app) {
  const all = app.events();
  const pick = kinds => all.filter(e => kinds.includes(e.kind));
  return {
    total: all.length,
    outside: pick(['outside']).map(e => e.text).slice(0, 30),
    missing: pick(['missing']).map(e => e.text).slice(0, 30),
    errors: pick(['error', 'unhandledrejection', 'console.error', 'csp', 'resource-error']).map(e => `${e.kind}: ${e.text}`.slice(0, 400)).slice(0, 40),
    warnings: pick(['console.warn']).map(e => e.text.slice(0, 300)).slice(0, 20),
    fence: pick(['offline', 'offline-failed']).map(e => e.text),
  };
}

function sheet() {
  // A plain page of every screenshot, folder by folder, to look through after the run.
  const shots = [];
  const visit = dir => { for (const name of fs.readdirSync(dir).sort()) { const full = path.join(dir, name); if (fs.statSync(full).isDirectory()) visit(full); else if (/\.(jpg|png)$/.test(name)) shots.push(path.relative(out, full).split(path.sep).join('/')); } };
  visit(out);
  const groups = Object.groupBy ? Object.groupBy(shots, s => s.split('/').slice(0, -1).join('/')) : shots.reduce((g, s) => { (g[s.split('/').slice(0, -1).join('/')] ??= []).push(s); return g; }, {});
  const html = `<!doctype html><meta charset="utf-8"><title>Код Сталкера — iOS Simulator</title>
<style>body{background:#0d1520;color:#cfd8e3;font:14px system-ui;margin:16px}h2{font-size:15px;margin:28px 0 8px}div{display:flex;flex-wrap:wrap;gap:10px}figure{margin:0;width:200px}img{width:200px;border:1px solid #2a3442}figcaption{font-size:11px;word-break:break-all}</style>
<h1>Код Сталкера в iOS Simulator</h1><p>${new Date().toISOString()}</p>
${Object.entries(groups).map(([group, list]) => `<h2>${group || '.'}</h2><div>${list.map(s => `<figure><a href="${s}"><img loading="lazy" src="${s}"></a><figcaption>${s.split('/').at(-1)}</figcaption></figure>`).join('')}</div>`).join('\n')}`;
  fs.writeFileSync(path.join(out, 'index.html'), html);
}

// ---------------------------------------------------------------- iPhone, release build
const phone = pickDevice(['iPhone 17 Pro', 'iPhone 17', 'iPhone 16 Pro', 'iPhone 16'], /^iPhone/);
summary.devices.phone = { name: phone.name, runtime: phone.runtime, udid: phone.udid };
log('iPhone', summary.devices.phone);
boot(phone);
const app = new App(phone, out, log);
let backupFile = null;
if (part('phone')) {
  await check('install', async () => { app.uninstall(); app.install(appPath); return { mic: grantMic(app), first: await app.launch(LAUNCH), native: await app.native() }; });
  await check('first start', () => firstStart(app, 'iphone/tishina'));
  await check('all steps open', async () => ({ allOpen: await unlockAll(app) }));
  await check('theme ТИШИНА', () => theme(app, 'ТИШИНА', 'iphone/tishina'));
  await check('Тишина: every step', () => allSteps(app, 'iphone/tishina'));
  await check('diary across a restart', () => diary(app, 'iphone/tishina'));
  await check('microphone', () => mic(app, 'iphone/tishina'));
  await check('back swipe', () => back(app, 'iphone/tishina'));
  await check('backup save', async () => { const r = await backupSave(app, 'iphone/tishina'); backupFile = r.copy; return r; });
  for (const [label, dir] of THEMES.slice(1)) {
    await check(`theme ${label}`, () => theme(app, label, `iphone/${dir}`));
    await check(`${label}: first pages of every step`, () => allSteps(app, `iphone/${dir}`, { maxPages: 3, idleLimit: 4 }));
  }
  await check('iPhone page events', async () => events(app));
  if (backupFile) await check('backup restore on a fresh install', () => restoreFresh(app, 'iphone/restore', backupFile));
  await check('fresh install page events', async () => events(app));
}

// ---------------------------------------------------------------- iPad, release build
if (part('ipad')) {
  const tablet = pickDevice(['iPad Pro 13-inch (M5)', 'iPad Pro 13-inch (M4)', 'iPad Air 13-inch (M3)', 'iPad Air 11-inch (M3)'], /^iPad/);
  summary.devices.tablet = { name: tablet.name, runtime: tablet.runtime, udid: tablet.udid };
  log('iPad', summary.devices.tablet);
  try { simctl('shutdown', phone.udid); } catch {}
  boot(tablet);
  const pad = new App(tablet, out, log);
  await check('iPad install', async () => { pad.uninstall(); pad.install(appPath); return { mic: grantMic(pad), first: await pad.launch(LAUNCH), native: await pad.native() }; });
  await check('iPad first start', () => firstStart(pad, 'ipad/tishina'));
  await check('iPad all steps open', async () => ({ allOpen: await unlockAll(pad) }));
  await check('iPad theme ТИШИНА', () => theme(pad, 'ТИШИНА', 'ipad/tishina'));
  await check('iPad Тишина: first pages of every step', () => allSteps(pad, 'ipad/tishina', { maxPages: 4, idleLimit: 4 }));
  await check('iPad page events', async () => events(pad));
  pad.uninstall();
  try { simctl('shutdown', tablet.udid); } catch {}
  boot(phone);
}

// ---------------------------------------------------------------- iPhone, development build: Intensive on the demo server
if (part('intensive') && demoPath) {
  const demo = new App(phone, out, log);
  await check('Intensive demo install', async () => { demo.uninstall(); demo.install(demoPath); grantMic(demo); return { first: await demo.launch(LAUNCH) }; });
  await check('Intensive on the demo server', async () => {
    const start = await firstStart(demo, 'iphone/intensive');
    await demo.go('/levels');
    await sleep(1500);
    demo.shot('iphone/intensive/01-levels', 'png');
    await demo.go('/intensive');
    await sleep(4000);
    const welcome = await demo.text(500);
    demo.shot('iphone/intensive/02-welcome', 'png');
    const persona = await press(demo, 'Алекс Морозов', 6000);
    const after = await demo.text(600);
    demo.shot('iphone/intensive/03-after-persona', 'png');
    const labels = await buttons(demo);
    const typed = await demo.fn(h => h.type('Сообщение', 'Проверка из приложения на iOS'));
    await sleep(500);
    const sent = await demo.tap('label', 'Отправить', 3000, 4);
    const feed = await demo.fn(() => document.body.innerText.split('\n').filter(Boolean).slice(-14).join(' | ').slice(-500));
    demo.shot('iphone/intensive/04-text-sent', 'png');
    return { start, welcome, persona, after, labels: labels.slice(0, 40), typed, sent, feed };
  });
  await check('Intensive page events', async () => events(demo));
  demo.uninstall();
}

summary.finished = new Date().toISOString();
save();
sheet();
const failed = Object.entries(summary.checks).filter(([, r]) => !r.ok).map(([name]) => name);
log(`\nchecks ${Object.keys(summary.checks).length}, failed ${failed.length}${failed.length ? `: ${failed.join(', ')}` : ''}`);
logStream.end();
