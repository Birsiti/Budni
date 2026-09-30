// изменено 2026-09-30 15:20
// ============================================================
// Будни_BY client — заставка при запуске мини-аппа: логотип и счётчик «актуальных объявлений в базе».
// Число докручивается до итога и ЗАВИСАЕТ на HOLD_MS (1,8 с), чтобы его успели прочитать; закрывается,
// когда прошло не меньше 3 с, число досчитано и выдержало паузу, и лента уже загрузилась
// (client.html зовёт splashDeckReady() после loadDeck()) — но не позже 6,5 с, даже если сеть тормозит.
// Число — public_stats.recent (уникальные объявления за 2 месяца, копии за одно); если бэкенд ещё без
// него — live (актуальные сейчас), затем total; если запрос не удался — запомненное или просто логотип.
// Глобалы из app.js: apiCall.
// Экспортирует: splashDeckReady.
// ============================================================

(function () {
  var MIN_MS = 3000, MAX_MS = 6500, COUNT_MS = 1800, HOLD_MS = 1800;
  var el = document.getElementById('splash');
  if (!el) { window.splashDeckReady = function () {}; return; }

  var t0 = Date.now(), deckReady = false, closed = false, finalAt = 0;
  var numEl = document.getElementById('splashNum');
  var labelEl = document.getElementById('splashLabel');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.style.overflow = 'hidden';

  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0'); }

  var shown = 0, runId = 0;
  // плавно докручивает число от текущего показанного до `to` (новый вызов отменяет предыдущий)
  // final=true — это итоговое число: когда оно досчитано, запускаем паузу «повисеть» (HOLD_MS)
  function count(to, ms, final) {
    var id = ++runId, from = shown;
    if (reduce) { shown = to; numEl.textContent = fmt(to); if (final) finalAt = Date.now(); return; }
    var start = Date.now();
    (function tick() {
      if (id !== runId || closed) return;
      var p = Math.min(1, (Date.now() - start) / (ms || COUNT_MS));
      var eased = 1 - Math.pow(1 - p, 3);
      shown = from + (to - from) * eased;
      numEl.textContent = fmt(shown);
      if (p < 1) requestAnimationFrame(tick);
      else if (final) finalAt = Date.now();
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
    if (dt >= MAX_MS || (dt >= MIN_MS && deckReady && finalAt && Date.now() - finalAt >= HOLD_MS)) close();
  }

  window.splashDeckReady = function () { deckReady = true; maybeClose(); };
  setInterval(maybeClose, 100);
  el.addEventListener('click', function () { if (Date.now() - t0 >= MIN_MS) close(); });

  // число: сначала запомненное (мгновенно), потом свежее с бэкенда
  var cached = 0;
  try {
    cached = parseInt(localStorage.getItem('budni_live_total') || '0', 10) || 0;
    var cachedLabel = localStorage.getItem('budni_live_label');
    if (cached > 0 && cachedLabel) labelEl.textContent = cachedLabel;
  } catch (e) {}
  if (cached > 0) count(cached, COUNT_MS, false);   // не ждём сеть: сразу крутим к запомненному, потом уточним

  var timeout = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 3500); });
  Promise.race([apiCall({ action: 'public_stats' }), timeout]).then(function (res) {
    var ok = res && res.ok;
    var n = 0, label = 'актуальных объявлений в базе';
    if (ok && typeof res.recent === 'number' && res.recent > 0) {
      n = res.recent;
      label = 'объявлений за последние 2 месяца';
    } else if (ok) {
      n = (typeof res.live === 'number' && res.live > 0) ? res.live : res.total;
    }
    if (n > 0) {
      labelEl.textContent = label;
      count(n, cached > 0 ? 800 : COUNT_MS, true);
      try { localStorage.setItem('budni_live_total', String(n)); localStorage.setItem('budni_live_label', label); } catch (e) {}
    } else noNumber();
  }).catch(noNumber);

  // число получить не удалось: если есть запомненное — оно и остаётся (пауза считается от него), иначе только логотип
  function noNumber() {
    if (cached > 0) { count(cached, 400, true); return; }
    numEl.classList.add('hidden');
    labelEl.textContent = 'вакансии и подработка по всей Беларуси';
    finalAt = Date.now();
  }
})();
