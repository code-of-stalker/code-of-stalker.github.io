// Platform adapter only. Rust owns all movement, deformation and rendering.
import init, { Marionette } from './pkg/watcher_theatre_marionette.js';
import { exportVideo, VIDEO } from './export.mjs';

const query = new URLSearchParams(location.search), manual = query.has('qa'), renderMode = query.has('render');
if (renderMode) document.documentElement.classList.add('render');
const root = document.documentElement, canvas = document.querySelector('#scene'), stage = document.querySelector('#stage');
const status = document.querySelector('#status'), pause = document.querySelector('#pause'), original = document.querySelector('#original');
const reduce = document.querySelector('#reduce'), timeline = document.querySelector('#timeline'), time = document.querySelector('#time');
const strength = document.querySelector('#strength'), exportButton = document.querySelector('#export'), progress = document.querySelector('#progress'), download = document.querySelector('#download');
const atmosphere = document.querySelector('#atmosphere');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let renderer, raf = 0, paused = false, source = false, reducedByUser = false, environment = true, visible = true, lost = false, exporting = false, disposed = false, lastReadout = 0;
const reduced = () => reducedByUser || preference.matches;
const image = async name => { const element = new Image(); element.src = `./assets/${name}.png`; await element.decode(); return element; };
const readout = () => {
  if (!renderer || disposed) return;
  root.dataset.frames = String(renderer.frame_count()); root.dataset.elapsed = renderer.elapsed().toFixed(4);
  const gpuError = renderer.gpu_error();
  if (gpuError || !root.dataset.gpuError) root.dataset.gpuError = String(gpuError);
  if (document.activeElement !== timeline) timeline.value = String(renderer.elapsed());
  time.value = `${renderer.elapsed().toFixed(2).replace('.', ',')} с`;
};
const idleMessage = () => {
  if (reduced()) return 'Движение выключено. Иллюстрация сохранена без изменений.';
  if (source) return 'Исходная иллюстрация для сравнения.';
  if (paused || manual) return 'Пауза. Выбери момент на шкале или продолжи просмотр.';
  return environment ? 'Объёмный свет, матричный дождь и глубина театра. Петля — 24 секунды.' : 'Фон и свет выключены для сравнения. Движение героини сохранено.';
};
const stop = () => { cancelAnimationFrame(raf); raf = 0; renderer?.suspend(); };
const tick = now => { raf = 0; renderer.frame(now); if (now - lastReadout >= 250) { readout(); lastReadout = now; } wake(); };
const wake = () => { if (!raf && renderer && !disposed && !manual && !paused && !source && !reduced() && !exporting && !document.hidden && visible && !lost) raf = requestAnimationFrame(tick); };
const controls = () => {
  pause.textContent = paused ? 'Продолжить' : 'Пауза'; pause.setAttribute('aria-pressed', String(paused)); original.setAttribute('aria-pressed', String(source)); reduce.setAttribute('aria-pressed', String(reduced()));
  atmosphere.setAttribute('aria-pressed', String(environment));
  for (const node of document.querySelectorAll('button,input')) node.disabled = exporting || !renderer || lost;
  reduce.disabled = exporting || !renderer || lost || preference.matches;
  root.dataset.paused = String(paused); root.dataset.original = String(source); root.dataset.reduced = String(reduced()); root.dataset.exporting = String(exporting);
  root.dataset.atmosphere = String(environment); root.dataset.sceneVersion = '3';
};
const resize = () => {
  if (!renderer || disposed || exporting) return;
  const rect = canvas.getBoundingClientRect(), density = renderMode ? 1 : Math.max(1.5, Math.min(2, devicePixelRatio || 1));
  if (rect.width < 1 || rect.height < 1) return;
  renderer.resize(Math.round(rect.width * density), Math.round(rect.height * density));
  root.dataset.density = (canvas.width / rect.width).toFixed(3); root.dataset.buffer = `${canvas.width}×${canvas.height}`;
  readout();
};
const jump = seconds => {
  if (!renderer || exporting || lost) return;
  paused = true; stop(); renderer.pause(true); renderer.seek(seconds); controls(); readout(); status.textContent = idleMessage();
};

try {
  const [, artwork, plate, person] = await Promise.all([init(), image('original'), image('background'), image('heroine')]);
  renderer = new Marionette(canvas, artwork, plate, person); renderer.reduced(reduced());
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize(); stage.classList.add('loaded'); controls();
  status.textContent = idleMessage(); root.dataset.ready = 'true';
  pause.onclick = () => { paused = !paused; renderer.pause(paused); stop(); controls(); readout(); status.textContent = idleMessage(); wake(); };
  original.onclick = () => { source = !source; renderer.original(source); stop(); controls(); readout(); status.textContent = idleMessage(); wake(); };
  reduce.onclick = () => { reducedByUser = !reducedByUser; renderer.reduced(reduced()); stop(); controls(); readout(); status.textContent = idleMessage(); wake(); };
  atmosphere.onclick = () => { environment = !environment; renderer.atmosphere(environment); controls(); readout(); status.textContent = idleMessage(); };
  document.querySelector('#start').onclick = () => jump(0);
  timeline.oninput = event => jump(Number(event.target.value));
  strength.oninput = event => { renderer.strength(Number(event.target.value)); readout(); };
  document.querySelector('#fullscreen').onclick = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.requestFullscreen?.(); }
    catch { status.textContent = 'Полноэкранный просмотр недоступен в этом браузере.'; }
  };
  preference.addEventListener('change', () => { renderer.reduced(reduced()); stop(); controls(); readout(); status.textContent = idleMessage(); wake(); });
  document.addEventListener('visibilitychange', () => { stop(); wake(); });
  const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; stop(); wake(); }); intersection.observe(canvas);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; stop(); controls(); stage.classList.remove('loaded'); status.textContent = 'Просмотр приостановлен. Обнови страницу, чтобы продолжить.'; root.dataset.error = 'WebGL context lost'; });
  window.addEventListener('pagehide', () => { stop(); observer.disconnect(); intersection.disconnect(); renderer.dispose(); disposed = true; });
  exportButton.onclick = async () => {
    if (exporting || !renderer || lost) return;
    const elapsed = renderer.elapsed(), previousPaused = paused;
    exporting = true; stop(); controls(); root.classList.add('exporting'); progress.value = 0; exportButton.textContent = 'Подготовка…';
    renderer.pause(true); renderer.original(false); renderer.reduced(false); renderer.resize(VIDEO.width, VIDEO.height);
    try {
      const result = await exportVideo(renderer, canvas, (current, total) => { if (lost || disposed) throw new Error('Просмотр прерван. Открой его снова и повтори сохранение.'); progress.value = current; root.dataset.exportFrames = String(current); status.textContent = `Сохраняю видео: ${Math.round(current / total * 100)}%`; });
      download.hidden = false; download.href = `./${encodeURIComponent(result.file)}?v=${Date.now()}`;
      root.dataset.exportReady = 'true'; root.dataset.exportBytes = String(result.bytes);
      status.textContent = 'Видео готово: 24 секунды, 60 кадров/с. Можно скачать файл.';
    } catch (error) { root.dataset.exportError = String(error); status.textContent = error instanceof Error ? error.message : 'Не удалось сохранить видео.'; console.error(error); }
    finally {
      exporting = false; paused = previousPaused;
      if (!disposed && !lost) { renderer.pause(paused); renderer.original(source); renderer.reduced(reduced()); renderer.seek(elapsed); renderer.suspend(); }
      root.classList.remove('exporting'); exportButton.textContent = 'Сохранить видео'; controls(); if (!disposed && !lost) { resize(); readout(); wake(); }
    }
  };
  wake();
} catch (error) {
  stop(); status.textContent = 'Не удалось запустить движение. Исходная иллюстрация сохранена на экране.'; root.dataset.error = String(error); console.error(error);
}
