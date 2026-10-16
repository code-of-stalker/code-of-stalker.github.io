/* Web release checks run on launch, resume, reconnect and once a minute. */
(function () {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
  var build = document.getElementById('watcher-graphics-cache')?.dataset.release;
  var registration, checking = false, lastCheck = 0, pending = false, reloading = false, idleTimer, mixedRelease = false, identification = 0;
  var interactedAt = Date.now();
  function notify() {
    window.dispatchEvent(new CustomEvent('watcher-graphics-update', { detail: { available: pending } }));
  }
  function message(type, values) {
    return new Promise(function (resolve) {
      var worker = navigator.serviceWorker.controller;
      if (!worker) { resolve(null); return; }
      var channel = new MessageChannel();
      var timeout = window.setTimeout(function () { channel.port1.close(); resolve(null); }, 3000);
      channel.port1.onmessage = function (event) { window.clearTimeout(timeout); channel.port1.close(); resolve(event.data); };
      worker.postMessage(Object.assign({ type: type }, values), [channel.port2]);
    });
  }
  function safe() {
    return document.visibilityState === 'visible' && document.documentElement.dataset.watcherUpdateReady === 'true'
      && document.documentElement.dataset.watcherUpdateBusy !== 'true'
      && !document.querySelector('[role="dialog"],[data-testid="device-optimization"]')
      && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  }
  function apply(manual) {
    window.clearTimeout(idleTimer);
    if (!pending || reloading) return;
    if (!safe()) {
      // A sheet may release its state guard before its closing animation removes
      // the dialog node. Recheck pending work after that transition or input blur.
      idleTimer = window.setTimeout(function () { apply(false); }, 1000);
      return;
    }
    var wait = manual ? 0 : Math.max(0, 2000 - (Date.now() - interactedAt));
    idleTimer = window.setTimeout(function () {
      if (!pending || reloading) return;
      if (!safe()) { apply(false); return; }
      reloading = true;
      // Current pathname/query and persisted product state survive this reload.
      window.location.reload();
    }, wait);
  }
  async function identify() {
    var sequence = ++identification, controller = navigator.serviceWorker.controller;
    // The old worker understands STATUS, but not client routing. A fresh entry
    // can load the new shell while the old worker still serves engine URLs;
    // reload once after the new snapshot activates to align all runtime files.
    var status = await message('WATCHER_GRAPHICS_CACHE_STATUS');
    if (!status) return;
    if (status.version !== build && status.clientRouting !== true) mixedRelease = true;
    if (status.clientRouting === true) await message('WATCHER_GRAPHICS_CLIENT_RELEASE', { version: build });
    if (sequence !== identification || controller !== navigator.serviceWorker.controller) return;
    pending = !!build && status.clientRouting === true && (status.version !== build || mixedRelease);
    notify(); apply(false);
  }
  async function check(force) {
    if (checking || document.visibilityState !== 'visible' || navigator.onLine === false) return;
    if (!force && Date.now() - lastCheck < 15000) return;
    checking = true; lastCheck = Date.now();
    try {
      var abort = new AbortController();
      var requestTimer = window.setTimeout(function () { abort.abort(); }, 10000);
      var response, remote;
      try {
        response = await fetch('/graphics-cache-version.json?check=' + lastCheck, { cache: 'no-store', credentials: 'same-origin', signal: abort.signal });
        remote = response.ok ? await response.json() : null;
      }
      finally { window.clearTimeout(requestTimer); }
      // Discovery is immediate, but pin the running shell before activating
      // another worker so its engine/assets cannot switch halfway through use.
      await initialStatus;
      await identify();
      registration = registration || await navigator.serviceWorker.getRegistration('/');
      var version = remote?.version || build;
      if (version) {
        var url = '/graphics-cache-worker.js?release=' + encodeURIComponent(version);
        // Keep one scope and registration, but bypass stale script caches in
        // embedded browsers with an explicit version in the request address.
        if (!registration || registration.active?.scriptURL !== new URL(url, location.href).href) {
          registration = await navigator.serviceWorker.register(url, { scope: '/', updateViaCache: 'none' });
        } else if (!remote) await registration.update();
      }
      await identify();
      await message('WATCHER_GRAPHICS_CACHE_CLEANUP');
    } catch { /* Offline: keep the complete installed snapshot and retry on resume. */ }
    finally { checking = false; }
  }
  function interaction() { interactedAt = Date.now(); apply(false); }
  window.watcherGraphicsUpdates = { check: function () { return check(true); }, apply: function () { apply(true); }, available: function () { return pending; } };
  var initialStatus = message('WATCHER_GRAPHICS_CACHE_STATUS').then(function (status) {
    if (status && status.version !== build && status.clientRouting !== true) mixedRelease = true;
  });
  window.addEventListener('watcher-update-safety', function () { apply(false); });
  ['pointerdown', 'keydown', 'input', 'wheel', 'touchmove'].forEach(function (name) { window.addEventListener(name, interaction, { passive: true }); });
  navigator.serviceWorker.addEventListener('controllerchange', function () { void identify(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { apply(false); void check(true); } });
  ['focus', 'pageshow', 'online'].forEach(function (name) { window.addEventListener(name, function () { void check(true); }); });
  async function start() {
    try {
      // Start the no-store version request immediately. Slow assets and the
      // legacy worker handshake must not postpone discovering a release.
      await check(true);
      await initialStatus;
      await identify();
    } catch { /* Private browsing or unsupported webviews use normal network loading. */ }
    finally { window.setInterval(function () { void check(false); }, 60000); }
  }
  void start();
})();

