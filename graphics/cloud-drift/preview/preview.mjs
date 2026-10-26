// Platform bridge only. Rust owns time, camera, layers, geometry and all pixels.
import init, { CloudDrift } from './pkg/watcher_cloud_drift.js';
const query = new URLSearchParams(location.search);
const manual = query.has('qa');
if (query.has('render')) document.documentElement.classList.add('render');
const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');
const pause = document.querySelector('#pause');
const original = document.querySelector('#original');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let renderer, raf = 0, paused = false, source = false, visible = true, lost = false;
const image = async name => { const element = new Image(); element.src = `./assets/${name}.png`; await element.decode(); return element; };
const tick = now => { raf = 0; renderer.frame(now); wake(); };
const wake = () => { if (!raf && !manual && !paused && !source && !preference.matches && !document.hidden && visible && !lost) raf = requestAnimationFrame(tick); };
const stop = () => { cancelAnimationFrame(raf); raf = 0; renderer?.suspend(); };
try {
  const [, artwork, plate, person] = await Promise.all([init(), image('original'), image('background-clean'), image('hero')]);
  renderer = new CloudDrift(canvas, artwork, plate, person);
  renderer.reduced(preference.matches);
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const ratio = query.has('render') ? 1 : Math.min(devicePixelRatio, innerWidth < 600 ? 1.5 : 2);
    renderer.resize(Math.round(r.width * ratio), Math.round(r.height * ratio));
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  document.querySelector('#stage').classList.add('loaded');
  status.textContent = preference.matches ? 'Движение выключено согласно настройкам устройства.' : 'Наведи курсор для лёгкого изменения глубины. Исходник — для сравнения.';
  pause.onclick = () => { paused = !paused; renderer.pause(paused); pause.textContent = paused ? 'Продолжить' : 'Пауза'; pause.setAttribute('aria-pressed', String(paused)); stop(); wake(); };
  original.onclick = () => { source = !source; renderer.original(source); original.setAttribute('aria-pressed', String(source)); if(source){document.querySelector('#edges').setAttribute('aria-pressed','false');renderer.wireframe(false);} stop(); wake(); };
  const edges=document.querySelector('#edges');
  edges.onclick=()=>{const value=edges.getAttribute('aria-pressed')!=='true';if(value){source=false;original.setAttribute('aria-pressed','false');renderer.original(false);}edges.setAttribute('aria-pressed',String(value));renderer.wireframe(value);stop();wake();};
  document.querySelector('#scan').onclick=()=>{
    paused=false;source=false;pause.setAttribute('aria-pressed','false');pause.textContent='Пауза';original.setAttribute('aria-pressed','false');edges.setAttribute('aria-pressed','false');
    renderer.original(false);renderer.pause(false);renderer.scan();stop();wake();
  };
  document.querySelector('#strength').oninput = event => renderer.strength(Number(event.target.value));
  document.querySelector('#fullscreen').onclick = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector('#stage').requestFullscreen?.();
  };
  canvas.addEventListener('pointermove', event => { if (event.pointerType !== 'mouse') return; const r = canvas.getBoundingClientRect(); renderer.pointer((event.clientX-r.left)/r.width*2-1, (event.clientY-r.top)/r.height*2-1); });
  canvas.addEventListener('pointerleave', () => renderer.pointer(0,0));
  preference.addEventListener('change', event => { renderer.reduced(event.matches); stop(); wake(); });
  document.addEventListener('visibilitychange', () => { stop(); wake(); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; stop(); wake(); }).observe(canvas);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; stop(); status.textContent = 'Графика приостановлена. Обнови страницу для продолжения.'; document.querySelector('#stage').classList.remove('loaded'); });
  window.addEventListener('pagehide', () => { stop(); renderer.dispose(); });
  window.cloudPreview = { renderer, canvas, seek: seconds => renderer.seek(seconds), reset: () => renderer.suspend(), loop: 16 };
  document.documentElement.dataset.ready = 'true';
  wake();
} catch (error) {
  stop();
  status.textContent = 'Не удалось запустить анимацию. Исходная иллюстрация сохранена на экране.';
  document.documentElement.dataset.error = String(error);
  console.error(error);
}
