(() => {
  const svg = document.querySelector('.dream-insert'), kind = svg.dataset.kind;
  const find = selector => svg.querySelector(selector), all = selector => [...svg.querySelectorAll(selector)];
  const source = find('.source'), aura = find('.aura'), innerAura = find('.inner-aura'), spark = find('.spark');
  const points = all('.attention-point');
  const field = find('.attention-field'), paths = find('.attention-paths'), ring = find('.inner-ring'), space = find('.dream-space');
  const systemReduced = matchMedia('(prefers-reduced-motion: reduce)');
  let elapsed = 0, last = null, request = 0, active = false, reduced = false, soft = false, fps = 60, lastPaint = 0, reported = null, loops = 0;
  const duration = 12;
  const ease = (a, b, t) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x*x*x*(x*(x*6-15)+10); };
  const set = (node, key, value) => { if (node) node.setAttribute(key, String(value)); };
  const send = value => { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(value)); else parent.postMessage(value, '*'); };
  const still = () => reduced || systemReduced.matches;
  const running = () => active && !document.hidden && !still();
  function report() {
    const next = running(); svg.dataset.running = String(next);
    if (next !== reported) { reported = next; send({ type: 'watcher-art-activity', running: next }); }
  }
  function paint() {
    const t = still() ? .62 : elapsed / duration;
    const breath = .5 - .5*Math.cos(t*Math.PI*2);
    let light = .35 + .35*breath;
    if (kind === 'dream-inward') {
      const inward = ease(.06,.62,t), vanish = 1-ease(.64,.78,t);
      // Both motes follow the actual Bezier traces all the way to the chest.
      const s = 1-inward;
      for (const point of points) {
        const side = Number(point.dataset.side);
        const x = s*s*s*49 + 3*s*s*inward*55 + 3*s*inward*inward*100 + inward*inward*inward*144;
        const y = s*s*s*91 + 3*s*s*inward*39 + 3*s*inward*inward*22 + inward*inward*inward*50.4;
        set(point, 'transform', `translate(${side < 0 ? x : 288-x} ${y})`);
        set(point, 'opacity', ease(.01,.07,t)*vanish*(soft ? .65 : 1));
      }
      const absorbed = ease(.4,.66,t)*(1-ease(.8,.98,t));
      set(field, 'opacity', 1-absorbed*.65); set(paths, 'opacity', 1-absorbed*.7);
      set(ring, 'r', 4+10*absorbed); set(ring, 'opacity', Math.sin(Math.PI*absorbed)*.34);
      light = .3+.7*absorbed;
    } else {
      set(space, 'opacity', .65+.23*breath);
      // A stationary silhouette and one slow breath, without flicker or spinning.
      light = .5+.4*breath;
    }
    set(source, 'opacity', .5+light*.5);
    set(aura, 'r', 16+light*9); set(aura, 'opacity', (soft ? .62 : .9)*light);
    set(innerAura, 'r', 4+light*3); set(spark, 'r', .65+light*.3);
    svg.dataset.progress = t.toFixed(4); svg.dataset.cycle = String(loops);
    svg.dataset.phase = still() ? 'still' : t < .12 ? 'form' : t < .64 ? 'reveal' : t < .78 ? 'hold' : 'return';
  }
  function schedule() {
    cancelAnimationFrame(request); request = 0; last = null; lastPaint = 0;
    paint(); report(); if (running()) request = requestAnimationFrame(tick);
  }
  function tick(now) {
    request = 0; if (!running()) { report(); return; }
    elapsed += last === null ? 0 : Math.min((now-last)/1000,.06); last = now;
    if (elapsed >= duration) { elapsed %= duration; loops++; }
    if (!lastPaint || now-lastPaint >= 1000/fps-.5) { paint(); lastPaint = now; }
    if (running()) request = requestAnimationFrame(tick); else report();
  }
  function update(props) {
    if (typeof props.active === 'boolean') active = props.active;
    if (typeof props.reducedMotion === 'boolean') reduced = props.reducedMotion;
    if (props.bookPalette) {
      for (const [key,value] of Object.entries(props.bookPalette.colors)) if (/^#[0-9a-f]{6}$/i.test(value)) document.documentElement.style.setProperty('--book-'+key,value);
      soft = props.bookPalette.soft === true; svg.dataset.palette = props.bookPalette.name;
    }
    schedule();
  }
  function message(data) {
    if (data?.type === 'watcher-art') update(data.props || {});
    if (data?.type === 'watcher-art-ready-check') { send({type:'watcher-art-ready'}); reported = null; report(); }
    if (data?.type === 'watcher-quality') fps = Math.max(30, Math.min(120, Number(data.targetFps)||60));
  }
  window.WatcherArt = {update}; window.WatcherEffects = {message};
  window.addEventListener('message', event => { if (event.source === parent) message(event.data); });
  document.addEventListener('visibilitychange', schedule); systemReduced.addEventListener('change', schedule);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(request); request = 0; });
  paint(); send({type:'watcher-art-ready'}); report();
})();
