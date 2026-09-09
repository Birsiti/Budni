// изменено 2026-09-09 17:40
// ============================================================
// Будни_BY admin — главный экран (admin.html): пульт владельца.
// Статус публикации + ключевые числа + темп + статистика по сферам/
// каналам/городам + свайп-аналитика + навигация в Очередь / Источники.
// Модерация убрана. Рендерит в #view (кроме шапки-статуса-навигации в HTML).
// Глобалы из app.js/admin-core.js: apiGet, apiPost, escapeHtml, haptic,
// alertAsync, confirmAsync, initTelegram, initSettings, getToken, saveToken.
// ============================================================

var RATE_OPTIONS = [1, 2, 3, 5, 8, 12];
var LIMIT_OPTIONS = [0, 30, 50, 100, 200, 400];

var D = {};          // состояние экрана
var _paused = false;

// прогреваем запросы сразу, потребляем один раз каждый
var _pfMain = null, _pfSwipes = null, _pfSources = null;

function prefetch() {
  _pfMain = apiGet('admin_data').catch(function () { return { ok: false }; });
  _pfSwipes = apiPost({ action: 'get_swipe_stats' }).catch(function () { return { ok: false }; });
  _pfSources = apiPost({ action: 'list_sources' }).catch(function () { return { ok: false }; });
}

async function loadDashboard() {
  const main = await (_pfMain || apiGet('admin_data'));
  _pfMain = null;
  const view = document.getElementById('view');
  if (!main.ok) { view.innerHTML = '<div class="empty">Ошибка: ' + escapeHtml(main.error || 'нет связи') + '</div>'; return; }

  D.stats = main.stats || {};
  D.publishBatch = main.publishBatch || 1;
  D.publishDailyLimit = main.publishDailyLimit || 0;
  renderPause(!!main.paused);

  const s = D.stats;
  setNum('stVac', totalOf(s.bySector));
  setNum('stQueue', s.queueLength || 0);
  setNum('stToday', s.publishedToday || 0);
  setNum('navQueue', s.queueLength || 0);

  renderBody();
  loadSwipeInto();     // фоном
  loadSourcesInto();   // фоном
}

function totalOf(obj) {
  return Object.keys(obj || {}).reduce(function (a, k) { return a + (obj[k] || 0); }, 0);
}
function setNum(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

// ---------- статус публикации ----------
function renderPause(p) {
  _paused = p;
  const card = document.getElementById('pauseToggle');
  card.classList.toggle('is-paused', p);
  document.getElementById('pauseLabel').textContent = p ? 'Публикация на паузе' : 'Публикация идёт';
  document.getElementById('pauseSub').textContent = p
    ? 'вакансии копятся в очереди, в группу не уходят'
    : 'нажми, чтобы поставить на паузу';
}

// ---------- тело: темп + сферы + свайпы + каналы/города ----------
function renderBody() {
  const s = D.stats;
  document.getElementById('view').innerHTML =
    rateControl() +
    '<div class="section-title">По сферам</div>' +
    '<div class="card">' + sectorTable(s) + '</div>' +
    '<div id="swipeBox"><div class="section-title">Свайпы</div><div class="card"><div class="empty">Загрузка…</div></div></div>' +
    '<button class="btn btn-approve wide-btn" id="enqueueAllBtn">Залить весь бэклог в очередь</button>' +
    '<details class="more"><summary>Каналы и города</summary>' +
      '<div class="section-title">По каналам</div><div class="card">' + breakdown(s.byChannel, 20) + '</div>' +
      '<div class="section-title">По городам</div><div class="card">' + breakdown(s.byCity, 20) + '</div>' +
    '</details>';

  document.querySelectorAll('.rate-opt[data-batch]').forEach(function (b) {
    b.addEventListener('click', function () { setRate('set_publish_batch', +b.dataset.batch, 'publishBatch', 'batch'); });
  });
  document.querySelectorAll('.rate-opt[data-limit]').forEach(function (b) {
    b.addEventListener('click', function () { setRate('set_publish_daily_limit', +b.dataset.limit, 'publishDailyLimit', 'limit'); });
  });
  document.getElementById('enqueueAllBtn').addEventListener('click', enqueueAll);
}

function rateControl() {
  const b = D.publishBatch, lim = D.publishDailyLimit;
  const rate = RATE_OPTIONS.map(function (n) {
    return '<button class="rate-opt' + (n === b ? ' is-on' : '') + '" data-batch="' + n + '">' + n + '</button>';
  }).join('');
  const limits = LIMIT_OPTIONS.map(function (n) {
    return '<button class="rate-opt' + (n === lim ? ' is-on' : '') + '" data-limit="' + n + '">' + (n === 0 ? '∞' : n) + '</button>';
  }).join('');
  return '<div class="section-title" style="margin-top:4px">Темп публикации в группу</div>' +
    '<div class="card">' +
      '<p class="rate-note">За один тик (раз в 5 мин), по кругу из разных сфер. ' +
      'Сейчас <b>' + b + '</b> → ~' + (b * 12) + '/час' +
      (lim > 0 ? ', но не больше <b>' + lim + '</b>/сутки' : '') + '.</p>' +
      '<div class="rate-row">' + rate + '</div>' +
      '<p class="rate-note" style="margin:14px 0 8px">Дневной лимит (∞ — без лимита):</p>' +
      '<div class="rate-row">' + limits + '</div>' +
    '</div>';
}

function sectorTable(s) {
  const total = s.bySector || {}, queued = s.queuedBySector || {}, published = s.publishedBySector || {};
  const names = Object.keys(total).sort(function (a, b) { return (total[b] || 0) - (total[a] || 0); });
  if (!names.length) return '<div class="empty">Нет данных</div>';
  let tq = 0, tp = 0, ta = 0;
  const rows = names.map(function (n) {
    const q = queued[n] || 0, p = published[n] || 0, a = total[n] || 0;
    tq += q; tp += p; ta += a;
    const pct = a ? Math.round(p / a * 100) : 0;
    return '<div class="brow">' +
      '<div class="brow-top"><span>' + escapeHtml(n) + '</span>' +
      '<span class="brow-num mono">' + q + ' / ' + p + ' <span class="dim">(' + a + ')</span></span></div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div></div>';
  }).join('');
  return rows +
    '<div class="brow brow-total"><div class="brow-top"><span>Итого</span>' +
    '<span class="brow-num mono">' + tq + ' / ' + tp + ' <span class="dim">(' + ta + ')</span></span></div></div>';
}

function breakdown(obj, limit) {
  const keys = Object.keys(obj || {}).sort(function (a, b) { return obj[b] - obj[a]; }).slice(0, limit);
  if (!keys.length) return '<div class="empty">Нет данных</div>';
  const max = obj[keys[0]] || 1;
  return keys.map(function (k) {
    return '<div class="brow"><div class="brow-top"><span>' + escapeHtml(k) + '</span>' +
      '<span class="brow-num mono">' + obj[k] + '</span></div>' +
      '<div class="bar"><i style="width:' + Math.round(obj[k] / max * 100) + '%"></i></div></div>';
  }).join('');
}

async function setRate(action, value, stateKey, resKey) {
  if (value === D[stateKey]) return;
  haptic('light');
  document.querySelectorAll('.rate-opt').forEach(function (b) { b.disabled = true; });
  const p = {}; p.action = action; p.n = value;
  const res = await apiPost(p);
  if (res.ok) { D[stateKey] = res[resKey]; haptic('success'); renderBody(); loadSwipeInto(); }
  else { haptic('error'); await alertAsync('Не получилось: ' + (res.error || '')); document.querySelectorAll('.rate-opt').forEach(function (b) { b.disabled = false; }); }
}

async function enqueueAll() {
  const btn = document.getElementById('enqueueAllBtn');
  if (!(await confirmAsync('Добавить в очередь ВСЕ активные вакансии, которых там ещё нет? Публиковаться будут по текущему темпу.'))) return;
  btn.disabled = true; btn.textContent = 'Заливаю…';
  const res = await apiPost({ action: 'enqueue_all_backlog' });
  if (res.ok) { haptic('success'); await alertAsync('Добавлено в очередь: ' + (res.added || 0)); prefetch(); loadDashboard(); }
  else { haptic('error'); btn.disabled = false; btn.textContent = 'Залить весь бэклог в очередь'; await alertAsync('Не получилось: ' + (res.error || '')); }
}

// ---------- свайп-аналитика ----------
async function loadSwipeInto() {
  const res = await (_pfSwipes || apiPost({ action: 'get_swipe_stats' }));
  _pfSwipes = null;
  const box = document.getElementById('swipeBox');
  if (!box) return;
  if (!res.ok || !res.swipes) { box.innerHTML = '<div class="section-title">Свайпы</div><div class="card"><div class="empty">Свайпов пока нет</div></div>'; return; }
  const sw = res.swipes;
  setNum('stUsers', sw.users || 0);

  const secRows = Object.keys(sw.bySector || {})
    .sort(function (a, b) { return (sw.bySector[b].like + sw.bySector[b].skip) - (sw.bySector[a].like + sw.bySector[a].skip); })
    .map(function (n) {
      const d = sw.bySector[n], t = d.like + d.skip;
      const rate = t ? Math.round(d.like / t * 100) : 0;
      return '<div class="brow"><div class="brow-top"><span>' + escapeHtml(n) + '</span>' +
        '<span class="brow-num mono">♥ ' + d.like + ' · ✕ ' + d.skip + ' <span class="dim">' + rate + '%</span></span></div>' +
        '<div class="bar bar-like"><i style="width:' + rate + '%"></i></div></div>';
    }).join('') || '<div class="empty">Свайпов по сферам нет</div>';

  const top = (sw.topLiked || []).map(function (v) {
    return '<div class="brow"><div class="brow-top"><span>' + escapeHtml(v.position || '(?)') +
      (v.city ? ' · ' + escapeHtml(v.city) : '') + '</span><span class="brow-num mono">♥ ' + v.likes + '</span></div></div>';
  }).join('') || '<div class="empty">—</div>';

  box.innerHTML =
    '<div class="section-title">Свайпы</div>' +
    '<div class="card">' +
      '<div class="likebar"><i class="likebar-like" style="width:' + (sw.likeRate || 0) + '%"></i></div>' +
      '<p class="rate-note" style="margin:10px 0 0">' +
        '<b>' + (sw.likeRate || 0) + '%</b> лайков · ' + (sw.likes || 0) + ' ♥ / ' + (sw.skips || 0) + ' ✕ · ' + (sw.users || 0) + ' чел.</p>' +
    '</div>' +
    '<div class="section-title">Свайпы по сферам</div><div class="card">' + secRows + '</div>' +
    '<div class="section-title">Топ вакансий по лайкам</div><div class="card">' + top + '</div>';
}

// ---------- счётчик источников на рассмотрении ----------
async function loadSourcesInto() {
  const res = await (_pfSources || apiPost({ action: 'list_sources' }));
  _pfSources = null;
  if (!res.ok) return;
  const list = res.sources || [];
  setNum('navSrc', list.filter(function (x) { return x.status === 'approved'; }).length);
  const pending = list.filter(function (x) { return x.status === 'pending'; }).length;
  const badge = document.getElementById('navSrcBadge');
  if (pending) { badge.textContent = pending; badge.classList.remove('hidden'); }
}

// ---------- пауза ----------
document.getElementById('pauseToggle').addEventListener('click', async function () {
  haptic('light');
  const res = await apiPost({ action: 'set_publish_pause', paused: !_paused });
  if (res.ok) { renderPause(!!res.paused); haptic(_paused ? 'warning' : 'success'); }
  else { await alertAsync('Не удалось: ' + (res.error || '')); }
});

// ---------- старт ----------
function dashboardBoot() {
  initTelegram();
  initSettings();
  if (tg && tg.BackButton) {
    try { tg.BackButton.hide(); } catch (e) {}   // на пульте — только нативный ✕ закрыть
  }
  if (!getToken()) {
    document.getElementById('gate').classList.remove('hidden');
    document.getElementById('tokenSave').addEventListener('click', function () {
      const v = document.getElementById('tokenInput').value.trim();
      if (!v) return;
      saveToken(v);
      document.getElementById('gate').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      prefetch(); loadDashboard();
    });
    return;
  }
  document.getElementById('app').classList.remove('hidden');
  prefetch();
  loadDashboard();
}
