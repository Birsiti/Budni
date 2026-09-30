// изменено 2026-09-30 23:55
// ============================================================
// Будни_BY client — заставка при запуске мини-аппа: логотип и счётчик «актуальных объявлений в базе».
// Показывается минимум 3 секунды и максимум 5: закрывается, когда прошло 3 с И лента уже загрузилась
// (client.html зовёт splashDeckReady() после loadDeck()), но не позже 5 с — даже если сеть тормозит.
// Число — public_stats.live (актуальные: живые, свежие, с контактом, копии за одно); если бэкенд ещё
// без него — общее total; если запрос не удался — последнее запомненное или просто логотип.
// Глобалы из app.js: apiCall.
// Экспортирует: splashDeckReady.
// ============================================================

(function () {
  var MIN_MS = 3000, MAX_MS = 5000, COUNT_MS = 1800;
  var el = document.getElementById('splash');
  if (!el) { window.splashDeckReady = function () {}; return; }

  var t0 = Date.now(), deckReady = false, closed = false;
  var numEl = document.getElementById('splashNum');
  var labelEl = document.getElementById('splashLabel');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.style.overflow = 'hidden';

  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0'); }

  var shown = 0, runId = 0;
  // плавно докручивает число от текущего показанного до `to` (новый вызов отменяет предыдущий)
  function count(to, ms) {
    var id = ++runId, from = shown;
    if (reduce) { shown = to; numEl.textContent = fmt(to); return; }
    var start = Date.now();
    (function tick() {
      if (id !== runId || closed) return;
      var p = Math.min(1, (Date.now() - start) / (ms || COUNT_MS));
      var eased = 1 - Math.pow(1 - p, 3);
      shown = from + (to - from) * eased;
      numEl.textContent = fmt(shown);
      if (p < 1) requestAnimationFrame(tick);
    })();
  }

  function close() {
    if (closed) return;
    closed = true;
    el.classList.add('is-hiding');
    document.body.style.overflow = '';
    setTimeout(function () { el.classList.add('hidden'); }, 400);
  }

  function maybeClose() {
    var dt = Date.now() - t0;
    if (dt >= MAX_MS || (dt >= MIN_MS && deckReady)) close();
  }

  window.splashDeckReady = function () { deckReady = true; maybeClose(); };
  setInterval(maybeClose, 100);
  el.addEventListener('click', function () { if (Date.now() - t0 >= MIN_MS) close(); });

  // число: сначала запомненное (мгновенно), потом свежее с бэкенда
  var cached = 0;
  try { cached = parseInt(localStorage.getItem('budni_live_total') || '0', 10) || 0; } catch (e) {}
  if (cached > 0) count(cached);   // не ждём сеть: сразу крутим к запомненному, потом уточним

  var timeout = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 3500); });
  Promise.race([apiCall({ action: 'public_stats' }), timeout]).then(function (res) {
    var n = res && res.ok ? (typeof res.live === 'number' && res.live > 0 ? res.live : res.total) : 0;
    if (n > 0) {
      count(n, cached > 0 ? 800 : COUNT_MS);
      try { localStorage.setItem('budni_live_total', String(n)); } catch (e) {}
    } else if (!cached) {
      numEl.classList.add('hidden');
      labelEl.textContent = 'вакансии и подработка по всей Беларуси';
    }
  }).catch(function () {
    if (!cached) { numEl.classList.add('hidden'); labelEl.textContent = 'вакансии и подработка по всей Беларуси'; }
  });
})();
