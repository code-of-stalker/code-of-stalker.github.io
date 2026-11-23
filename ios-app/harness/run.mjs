// node ios-app/harness/run.mjs --app <CodeOfStalker.app> [--demo <demo .app>] --out <folder> [--only part,part]
//
// The same checks as the Android app got on the TECNO, in the iOS Simulator:
// first start, every step in Тишина (shown first), the diary across a restart, the mic,
// the page's back swipe, a backup saved through the Files sheet and restored on a fresh
// install, the other three dark themes, the iPad, and the Intensive against the demo
// server of a development build. Every run of the app is fenced offline (-harnessOffline):
// any http(s) or ws(s) load is blocked and logged, so nothing reaches a real server.
//
// The GitHub Mac's simulator GPU runs out of memory under the Rust scenes, and WebKit then
// stops painting the whole page (first run: black screenshots, working page logic). So the
// screen checks run with WebGL and WebGPU hidden from the page (-harnessNoGpu), and a last
// pass on a freshly booted simulator records what the graphics do there. Scenes themselves
// can only be judged on a real iPhone or iPad.
//
// A check fails when one of its expectations is not met; the process exits 1 if any did.
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
// The longest check took about 10 minutes (run 3); one that hangs is ended so the rest still run.
const CHECK_LIMIT_MS = 20 * 60 * 1000;
/** `run` returns its findings; `problems` (unmet expectations) fail the check. `info` checks never fail the run. */
async function check(name, run, { info = false } = {}) {
  log(`\n=== ${name}`);
  const started = Date.now();
  let timer;
  try {
    const limit = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timed out after ${CHECK_LIMIT_MS / 60000} min`)), CHECK_LIMIT_MS); });
    const result = await Promise.race([run(), limit]).finally(() => clearTimeout(timer));
    const problems = result?.problems ?? [];
    summary.checks[name] = { ok: problems.length === 0, info, ...result };
    for (const problem of problems) log('PROBLEM', name, problem);
  } catch (error) { summary.checks[name] = { ok: false, info, error: String(error.stack || error) }; log('FAILED', name, String(error.stack || error)); }
  summary.checks[name].seconds = Math.round((Date.now() - started) / 1000);
  log(`--- ${name}: ${summary.checks[name].ok ? 'ok' : info ? 'NOT OK (information only)' : 'FAILED'} in ${summary.checks[name].seconds}s`);
  save();
}
const expect = (problems, condition, text) => { if (!condition) problems.push(text); return condition; };

// Screen checks: offline fence, no WebGL/WebGPU in the page. Graphics pass: offline fence only.
const LAUNCH = ['-harnessOffline', '-harnessNoGpu'];
const GRAPHICS_LAUNCH = ['-harnessOffline'];
const PROFILE_KEY = 'watcher.device.optimization.v1';
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

const tuning = app => app.fn(() => /НАСТРАИВАЕМ|ПОЧТИ ГОТОВО|НАСТРОЙКА ГОТОВА/.test(document.body.innerText));

async function firstStart(app, dir, { rescue = true } = {}) {
  const problems = [];
  const result = { path: await app.path(), text: await app.text(240) };
  app.shot(`${dir}/00-first-start`, 'png');
  for (let i = 0; i < 45; i++) {
    if (await app.fn(h => h.tap('label', 'ОСТАВИТЬ НАСТРОЙКИ') || h.tap('prefix', 'ОСТАВИТЬ НАСТРОЙКИ'))) { result.tuning = 'kept defaults'; break; }
    if (!await tuning(app)) { result.tuning = 'none shown'; break; }
    await sleep(1000);
  }
  for (let i = 0; i < 15 && await tuning(app); i++) await sleep(1000);
  await sleep(2000);
  result.after = await app.path();
  result.stuck = await tuning(app);
  app.shot(`${dir}/01-after-first-start`, 'png');
  expect(problems, !result.stuck, 'still on the tuning screen 15 s after «ОСТАВИТЬ НАСТРОЙКИ ПО УМОЛЧАНИЮ»');
  if (result.stuck && rescue) {
    // Let the following checks run: store the default profile the button would have stored.
    await app.fn((h, key) => { localStorage.setItem(key, JSON.stringify({ quality: 'balanced', targetFps: 60, smoothness: false, version: 1, completedAt: Date.now(), durationMs: 0, status: 'cancelled', reason: 'cancelled', measurements: [] })); return true; }, [PROFILE_KEY]);
    await app.go('/');
    result.rescued = { path: await app.path(), tuning: await tuning(app) };
  }
  return { ...result, problems };
}

async function unlockAll(app) {
  await app.go('/settings');
  const state = () => app.fn(h => h.find('label', 'Всё открыто')?.getAttribute('aria-checked') ?? null);
  if ((await state()) !== 'true') await app.tap('label', 'Всё открыто', 1500);
  const allOpen = await state();
  return { allOpen, problems: allOpen === 'true' ? [] : ['the «Всё открыто» switch is not on'] };
}

async function theme(app, label, dir) {
  await app.go('/settings');
  const checked = () => app.fn((h, name) => [...document.querySelectorAll('[role="radio"]')].find(e => h.norm(e.getAttribute('aria-label')) === h.norm(name))?.getAttribute('aria-checked') ?? null, [label]);
  for (let i = 0; i < 4 && (await checked()) !== 'true'; i++) await app.tap('label', label, 2500);
  const page = await app.fn(() => {
    // The color a person sees at the top of the page: the first painted background under that point, in
    // stacking order. Only a zero alpha is see-through; black rgb(0, 0, 0) is a painted color (Матрица, Искра).
    const clear = c => !c || c === 'transparent' || /^rgba\([^)]*,\s*0(\.0+)?\)$/.test(c);
    const shown = e => { for (let a = e; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.opacity === '0' || s.visibility === 'hidden') return false; } return true; };
    const top = document.elementsFromPoint(innerWidth / 2, 2).map(e => [e, getComputedStyle(e).backgroundColor]).find(([e, c]) => !clear(c) && shown(e))?.[1] ?? null;
    return { body: getComputedStyle(document.body).backgroundColor, top, meta: document.querySelector('meta[name="theme-color"]')?.content || '' };
  });
  const native = await app.native();
  // Read the choice while the settings page, with its radios, is still open.
  const selected = await checked();
  await app.fn(() => scrollTo(0, 0));
  await sleep(700);
  app.shot(`${dir}/settings`, 'png');
  for (const [route, name, wait] of [['/home', 'home', 3500], ['/levels', 'levels', 2000], ['/diary', 'diary', 2000]]) {
    await app.go(route);
    await sleep(wait);
    app.shot(`${dir}/${name}`, 'png');
  }
  const result = { checked: selected, ...page, shell: { background: native.background, window: native.windowBackground, statusBarLight: native.statusBarLight, safeArea: native.safeArea } };
  const problems = [];
  expect(problems, result.checked === 'true', `theme ${label} is not selected`);
  // The page's own background (the theme's) against the color the shell paints behind and around it.
  const rgb = ((result.top ?? result.body).match(/\d+(\.\d+)?/g) || []).map(Number);
  const opaque = rgb.length === 3 || (rgb.length === 4 && rgb[3] === 1);
  result.pageHex = opaque ? `#${rgb.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase() : null;
  if (result.pageHex) expect(problems, native.background?.slice(0, 7).toUpperCase() === result.pageHex, `the shell behind the page (${native.background}) is not the page color (${result.pageHex})`);
  expect(problems, native.statusBarLight === true, 'status bar text is not light on a dark theme');
  return { ...result, problems };
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
      reached: [...new Set(seen.map(p => p.key.split(' ')[1]).filter(Boolean))],
    });
  }
  const problems = [];
  for (const step of steps) {
    if (step.error) problems.push(`step ${step.n}: ${step.error}`);
    else expect(problems, step.pages > 0 && step.reached.includes(String(step.n)), `step ${step.n}: its pages were not reached (saw steps ${step.reached.join(',') || 'none'})`);
  }
  return { practice, steps, problems };
}

async function diary(app, dir) {
  await app.go('/diary');
  await sleep(1500);
  // The product store keeps the diary inside a few encrypted records, so their count need not grow;
  // a unique line that is absent before and shown after the restart is the proof.
  const marker = `Проверка iOS ${Date.now().toString(36)}: запись до перезапуска.`;
  const before = await app.fn(h => h.diaryCount());
  const shownBefore = (await app.fn(() => document.body.innerText)).toLowerCase().includes(marker.slice(0, 22).toLowerCase());
  const typed = await app.fn((h, line) => h.type('Текст наблюдения', line), [marker]);
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
  const entryShown = (await app.fn(() => document.body.innerText)).toLowerCase().includes(marker.slice(0, 22).toLowerCase());
  app.shot(`${dir}/diary-02-after-restart`, 'png');
  const result = { marker, shownBefore, before, typed, saved, notice, afterSave, afterRestart, entryShown, text };
  const problems = [];
  expect(problems, typed && saved, 'the text entry could not be typed or saved');
  expect(problems, !shownBefore, 'the test line was already in the diary before it was typed');
  expect(problems, typeof afterRestart === 'number' && afterRestart > 0, `the encrypted store is empty after the restart (${afterRestart})`);
  expect(problems, entryShown, 'the saved entry is not shown after the restart');
  return { ...result, problems };
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
  const problems = [];
  expect(problems, !!probe.track && probe.track.state === 'live', `no live microphone track (${probe.error ?? 'no track'})`);
  expect(problems, !!started, 'no record button in the diary');
  // The simulator's mock input may record silence or nothing at all; bytes and the kept
  // voice entry are written down, the real test is the iPad.
  return { probe, started, during, stopped, review, kept: saveLabel ?? null, before, after, text: await app.text(300), problems };
}

async function back(app, dir) {
  const swipeBack = () => app.fn(h => h.swipe(30, innerHeight * 0.55, Math.min(innerWidth - 24, 330), innerHeight * 0.55, 260));
  // Where the person is: the route plus, in the practice, the step and page. In the practice the
  // swipe is the step's own back (Step 3: the previous step), so the route alone does not show it.
  const place = async () => { const s = await app.fn(h => h.state()); return { path: s.path, step: s.step ?? '', key: `${s.path} ${s.step ?? ''} ${s.counter || s.q || ''}`.trim() }; };
  // A fixed start that shows without WebGL: step 3, opened from the step menu.
  await openPractice(app);
  await app.fn(() => scrollTo(0, 0));
  if (!await app.has('label', 'Открыть шаг 3')) await app.tap('label', 'Выбрать шаг', 1500);
  await app.tap('label', 'Открыть шаг 3', 3500);
  const trail = [await place()];
  app.shot(`${dir}/back-01-start`);
  for (let i = 0; i < 2; i++) {
    await swipeBack();
    await sleep(1800);
    trail.push(await place());
    app.shot(`${dir}/back-0${i + 2}`);
  }
  await openPractice(app);
  const placeWithMenu = await place();
  await app.tap('label', 'Выбрать шаг', 1200);
  const menuBefore = await app.has('label', 'Открыть шаг 1');
  await swipeBack();
  await sleep(1500);
  const menuAfter = await app.has('label', 'Открыть шаг 1');
  const placeAfterMenu = await place();
  app.shot(`${dir}/back-04-menu-swipe`);
  const problems = [];
  const [from, to] = trail;
  expect(problems, from.path === '/practice' && from.step === '3', `the swipe did not start on step 3 (${from.key})`);
  // Step 3's own back (its button and the swipe) leads to the end of step 2, as on the site.
  expect(problems, to.path === '/practice' && to.step === '2', `a swipe from the left edge did not go back to step 2 (${trail.map(p => p.key).join(' → ')})`);
  // As on the site, an open menu blocks the page swipe (it closes by its own button), so the swipe
  // must not move the page underneath it.
  expect(problems, menuBefore, 'the step menu did not open');
  expect(problems, placeAfterMenu.key === placeWithMenu.key, `a swipe over the open step menu moved the page (${placeWithMenu.key} → ${placeAfterMenu.key})`);
  return { trail: trail.map(p => p.key), menuOpenBefore: menuBefore, menuOpenAfter: menuAfter, placeWithMenu: placeWithMenu.key, placeAfterMenu: placeAfterMenu.key, problems };
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
  const problems = [];
  expect(problems, typed.every(Boolean), 'the backup password fields were not found');
  expect(problems, /DocumentPicker/.test(native.presented ?? ''), `the Files save sheet did not open (${native.presented || 'nothing shown'})`);
  expect(problems, !!newest && newest.bytes > 0, 'no .watcherbackup file reached the Files sheet');
  return { typed, presented: native.presented, dismissed, pageSays, files, copy, problems };
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
  const result = { start, before, offered, sheet, typed, checked, notice, after, entryShown: text.toLowerCase().includes('проверка ios'), text };
  const problems = [...(start.problems ?? []).map(p => `first start: ${p}`)];
  expect(problems, typed, 'the restore password field was not found');
  expect(problems, typeof after === 'number' && after > 0 && after !== before, `the diary holds ${after} records after the restore, ${before} before`);
  expect(problems, result.entryShown, 'the restored entry is not shown in the diary');
  return { ...result, problems };
}

/** Page events since install. Anything that left the app, or a file the app lacks, fails. */
function events(app, { allowOutside = [] } = {}) {
  const all = app.events();
  const pick = kinds => all.filter(e => kinds.includes(e.kind));
  const outside = pick(['outside']).map(e => e.text);
  const result = {
    total: all.length,
    outside: outside.slice(0, 30),
    missing: pick(['missing']).map(e => e.text).slice(0, 30),
    errors: pick(['error', 'unhandledrejection', 'console.error', 'csp', 'resource-error']).map(e => `${e.kind}: ${e.text}`.slice(0, 400)).slice(0, 40),
    warnings: pick(['console.warn']).map(e => e.text.slice(0, 300)).slice(0, 20),
    fence: pick(['offline', 'offline-failed']).map(e => e.text),
    gpuHidden: [...new Set(pick(['gpu-hidden']).map(e => e.text))],
    refusedSockets: pick(['ws-refused']).map(e => e.text).slice(0, 5),
    panics: pick(['console.error']).filter(e => /panic/i.test(e.text)).length,
  };
  const problems = [];
  const unexpected = outside.filter(text => !allowOutside.some(allowed => text.includes(allowed)));
  expect(problems, unexpected.length === 0, `requests to the outside: ${unexpected.slice(0, 5).join(', ')}`);
  expect(problems, result.missing.length === 0, `files missing from the app: ${result.missing.slice(0, 5).join(', ')}`);
  expect(problems, result.fence.includes('network fenced'), 'the offline fence was not on');
  return { ...result, problems };
}

/** What WebGL2 and WebGPU offer inside the app on this simulator. */
const gpuProbe = app => app.fn(async () => {
  const out = { webgpu: !!navigator.gpu };
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const gl = canvas.getContext('webgl2');
  if (gl) {
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    out.webgl2 = {
      version: gl.getParameter(gl.VERSION), vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER),
      unmasked: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE), maxRenderbuffer: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      extensions: (gl.getSupportedExtensions() || []).length, textures: {},
    };
    for (const size of [1024, 2048, 4096]) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, size, size);
      out.webgl2.textures[size] = gl.getError();
      gl.deleteTexture(texture);
    }
    out.webgl2.lost = gl.isContextLost();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } else out.webgl2 = null;
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      out.adapter = adapter ? { features: adapter.features.size, maxTexture: adapter.limits.maxTextureDimension2D, maxBuffer: adapter.limits.maxBufferSize, vendor: adapter.info?.vendor ?? null, architecture: adapter.info?.architecture ?? null } : null;
    } catch (error) { out.adapterError = String(error); }
  }
  return out;
}, [], 30000);

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
const installed = async (target, file, launch = LAUNCH) => {
  target.uninstall();
  target.install(file);
  const mic = grantMic(target); // before the launch: a permission change ends a running app
  const first = await target.launch(launch);
  const native = await target.native();
  const problems = [];
  expect(problems, native.url?.startsWith('codeofstalker://localhost/'), `the page is not served from the app (${native.url})`);
  expect(problems, native.backGestures === false, 'the web view\'s own back gesture is on (two backs)');
  return { mic, first, native, problems };
};
let backupFile = null;
if (part('phone')) {
  await check('install', () => installed(app, appPath));
  await check('first start', () => firstStart(app, 'iphone/tishina'));
  await check('all steps open', () => unlockAll(app));
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
  else await check('backup restore on a fresh install', async () => ({ problems: ['no backup file to restore from'] }));
  await check('fresh install page events', async () => events(app));
}

// ---------------------------------------------------------------- iPhone, development build: Intensive on the demo server
if (part('intensive') && demoPath) {
  const demo = new App(phone, out, log);
  await check('Intensive demo install', () => installed(demo, demoPath));
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
    const problems = [...(start.problems ?? []).map(p => `first start: ${p}`)];
    expect(problems, persona, 'the demo participant «Алекс Морозов» could not be chosen');
    expect(problems, typed && sent, 'the message could not be typed or sent');
    expect(problems, feed.includes('Проверка из приложения на iOS'), 'the sent message is not in the conversation');
    return { start, welcome, persona, after, labels: labels.slice(0, 40), typed, sent, feed, problems };
  });
  // The development build's own client asks Metro for ws://localhost/hot (reload) and ws://localhost/message
  // (dev menu); neither is the Intensive server, and the fence and the page CSP refuse both.
  await check('Intensive page events', async () => events(demo, { allowOutside: ['ws://localhost/hot', 'ws://localhost/message'] }));
  demo.uninstall();
}

// ---------------------------------------------------------------- iPad, release build
if (part('ipad')) {
  const tablet = pickDevice(['iPad Pro 13-inch (M5)', 'iPad Pro 13-inch (M4)', 'iPad Air 13-inch (M3)', 'iPad Air 11-inch (M3)'], /^iPad/);
  summary.devices.tablet = { name: tablet.name, runtime: tablet.runtime, udid: tablet.udid };
  log('iPad', summary.devices.tablet);
  try { simctl('shutdown', phone.udid); } catch {}
  boot(tablet);
  const pad = new App(tablet, out, log);
  await check('iPad install', () => installed(pad, appPath));
  await check('iPad first start', () => firstStart(pad, 'ipad/tishina'));
  await check('iPad all steps open', () => unlockAll(pad));
  await check('iPad theme ТИШИНА', () => theme(pad, 'ТИШИНА', 'ipad/tishina'));
  await check('iPad Тишина: first pages of every step', () => allSteps(pad, 'ipad/tishina', { maxPages: 4, idleLimit: 4 }));
  await check('iPad page events', async () => events(pad));
  pad.uninstall();
  try { simctl('shutdown', tablet.udid); } catch {}
}

// ---------------------------------------------------------------- iPhone, release build with graphics on (information)
if (part('graphics')) {
  // A fresh boot, so nothing earlier has used the simulator's GPU.
  try { simctl('shutdown', phone.udid); } catch {}
  boot(phone);
  const gfx = new App(phone, out, log);
  await check('graphics: install with WebGL on', () => installed(gfx, appPath, GRAPHICS_LAUNCH), { info: true });
  await check('graphics: what the simulator GPU offers', async () => ({ probe: await gpuProbe(gfx) }), { info: true });
  await check('graphics: tuning and step 1 scenes', async () => {
    const start = await firstStart(gfx, 'graphics', { rescue: true });
    await gfx.go('/settings');
    await gfx.tap('label', 'ТИШИНА', 2500, 4);
    const practice = await openPractice(gfx);
    const pages = await walk(gfx, 'graphics/step1', { maxPages: 4, idleLimit: 4 });
    const drawn = pages.flatMap(p => p.scenes).filter(c => c.visible && c.size !== '300x150' && c['data-graphics-backend']);
    const painted = gfx.events().filter(e => e.kind === 'console.error' && /panic/i.test(e.text)).map(e => e.text.slice(0, 300));
    const problems = [];
    expect(problems, (start.problems ?? []).length === 0, 'tuning screen stuck');
    expect(problems, drawn.length > 0, 'no scene was drawn');
    expect(problems, painted.length === 0, `the Rust engine panicked ${painted.length} times: ${painted[0] ?? ''}`);
    return { start, practice, scenes: pages.map(p => ({ file: p.file, scenes: p.scenes })), drawn: drawn.length, panics: painted.slice(0, 4), problems };
  }, { info: true });
  await check('graphics: page events', async () => events(gfx), { info: true });
  gfx.uninstall();
}

summary.finished = new Date().toISOString();
save();
sheet();
const failed = Object.entries(summary.checks).filter(([, r]) => !r.ok && !r.info).map(([name]) => name);
const notes = Object.entries(summary.checks).filter(([, r]) => !r.ok && r.info).map(([name]) => name);
log(`\nchecks ${Object.keys(summary.checks).length}, failed ${failed.length}${failed.length ? `: ${failed.join(', ')}` : ''}`);
if (notes.length) log(`information only, not ok: ${notes.join(', ')}`);
logStream.end(() => process.exit(failed.length ? 1 : 0));
