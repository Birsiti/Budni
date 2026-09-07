// изменено 2026-09-07 11:03
// ============================================================
// Будни_BY admin — страница «Статистика» (admin-stats.html): темп публикации,
// дневной лимит, «залить бэклог», очередь/опубл./всего по сферам, каналы,
// города, свайп-аналитика. Рендерит в #view.
// Глобалы: STATE, apiGet, apiPost, escapeHtml, haptic, alertAsync, confirmAsync.
// ============================================================

var RATE_OPTIONS = [1, 2, 3, 5, 8, 12];

async function loadStats() {
  const el = document.getElementById('view');
  el.innerHTML = '<div class="empty">Загрузка…</div>';
  const res = await apiGet('admin_data');
  if (!res.ok) { el.innerHTML = '<div class="empty">Ошибка: ' + escapeHtml(res.error || '') + '</div>'; return; }
  STATE.stats = res.stats;
  STATE.publishBatch = res.publishBatch || 1;
  STATE.publishDailyLimit = res.publishDailyLimit || 0;
  renderStats();
  loadSwipeStats(); // фоном, отдельным запросом
}

function renderBreakdown(obj, limit) {
  const keys = Object.keys(obj || {}).sort(function (a, b) { return obj[b] - obj[a]; });
  const shown = limit ? keys.slice(0, limit) : keys;
  if (shown.length === 0) return '<div class="empty">Нет данных</div>';
  return shown.map(function (key) {
    return '<div class="sector-row"><span>' + escapeHtml(key) + '</span>' +
      '<span class="sector-count">' + obj[key] + '</span></div>';
  }).join('');
}

// По сферам: «в очереди / опубликовано (всего в базе)» + строка «Итого».
function renderSectorTable(s) {
  const bySector = s.bySector || {};
  const queued = s.queuedBySector || {};
  const published = s.publishedBySector || {};
  const names = Object.keys(bySector).sort(function (a, b) { return (bySector[b] || 0) - (bySector[a] || 0); });
  if (names.length === 0) return '<div class="empty">Нет данных</div>';

  let tq = 0, tp = 0, ta = 0;
  const rows = names.map(function (name) {
    const q = queued[name] || 0, p = published[name] || 0, a = bySector[name] || 0;
    tq += q; tp += p; ta += a;
    return '<div class="sector-row"><span>' + escapeHtml(name) + '</span>' +
      '<span class="sector-count">' + q + ' / ' + p + ' <span class="dim">(' + a + ')</span></span></div>';
  }).join('');
  return '<div class="sector-row sector-head"><span>сфера</span>' +
    '<span class="sector-count">очередь / опубл. <span class="dim">(всего)</span></span></div>' +
    rows +
    '<div class="sector-row sector-total"><span>Итого</span>' +
    '<span class="sector-count">' + tq + ' / ' + tp + ' <span class="dim">(' + ta + ')</span></span></div>';
}

var LIMIT_OPTIONS = [0, 30, 50, 100, 200, 400];

function renderRateControl() {
  const b = STATE.publishBatch || 1;
  const lim = STATE.publishDailyLimit || 0;
  const rateOpts = RATE_OPTIONS.map(function (n) {
    return '<button class="rate-opt' + (n === b ? ' is-on' : '') + '" data-batch="' + n + '">' + n + '</button>';
  }).join('');
  const limOpts = LIMIT_OPTIONS.map(function (n) {
    return '<button class="rate-opt' + (n === lim ? ' is-on' : '') + '" data-limit="' + n + '">' + (n === 0 ? '∞' : n) + '</button>';
  }).join('');
  return '<div class="section-title" style="margin-top:0;">Темп публикации в группу</div>' +
    '<div class="card">' +
      '<p class="rate-note">За один тик (раз в 5 минут), по кругу из разных сфер. ' +
      'Сейчас: <b>' + b + '</b> → ~' + (b * 12) + '/час' +
      (lim > 0 ? ', но не больше <b>' + lim + '</b>/сутки' : '') + '.</p>' +
      '<div class="rate-row">' + rateOpts + '</div>' +
      '<p class="rate-note" style="margin:14px 0 8px;">Дневной лимит в группу (∞ — без лимита):</p>' +
      '<div class="rate-row">' + limOpts + '</div>' +
    '</div>';
}

function renderStats() {
  const el = document.getElementById('view');
  if (!STATE.stats) { el.innerHTML = '<div class="empty">Нет данных</div>'; return; }
  const s = STATE.stats;

  el.innerHTML =
    renderRateControl() +
    '<div class="stat-grid">' +
      '<div class="stat-tile"><div class="stat-value mono">' + s.queueLength + '</div><div class="stat-label">в очереди на публикацию</div></div>' +
      '<div class="stat-tile"><div class="stat-value mono">' + s.publishedToday + '</div><div class="stat-label">опубликовано сегодня</div></div>' +
      '<div class="stat-tile"><div class="stat-value mono">' + s.publishedTotal + '</div><div class="stat-label">опубликовано всего</div></div>' +
    '</div>' +
    '<button class="btn btn-approve" id="enqueueAllBtn" style="width:100%; margin-bottom:16px;">Залить весь бэклог в очередь</button>' +
    '<div class="section-title">По сферам</div>' +
    '<div class="card">' + renderSectorTable(s) + '</div>' +
    '<div id="swipeStatsBox"></div>' +
    '<div class="section-title">По каналам</div>' +
    '<div class="card">' + renderBreakdown(s.byChannel, 15) + '</div>' +
    '<div class="section-title">По городам</div>' +
    '<div class="card">' + renderBreakdown(s.byCity, 15) + '</div>';

  el.querySelectorAll('.rate-opt[data-batch]').forEach(function (btn) {
    btn.addEventListener('click', function () { setPublishSetting(el, 'set_publish_batch', 'n', parseInt(btn.getAttribute('data-batch'), 10), 'publishBatch', 'batch'); });
  });
  el.querySelectorAll('.rate-opt[data-limit]').forEach(function (btn) {
    btn.addEventListener('click', function () { setPublishSetting(el, 'set_publish_daily_limit', 'n', parseInt(btn.getAttribute('data-limit'), 10), 'publishDailyLimit', 'limit'); });
  });
  document.getElementById('enqueueAllBtn').addEventListener('click', async function () {
    const btn = this;
    if (!(await confirmAsync('Добавить в очередь ВСЕ активные вакансии, которых там ещё нет? Публиковаться будут по текущему темпу.'))) return;
    btn.disabled = true; btn.textContent = 'Заливаю…';
    const res = await apiPost({ action: 'enqueue_all_backlog' });
    if (res.ok) { haptic('success'); await alertAsync('Добавлено в очередь: ' + (res.added || 0)); loadStats(); }
    else { haptic('error'); btn.disabled = false; btn.textContent = 'Залить весь бэклог в очередь'; await alertAsync('Не получилось: ' + (res.error || '')); }
  });

  renderSwipeStats();
}

async function setPublishSetting(el, action, key, value, stateKey, resKey) {
  if (value === STATE[stateKey]) return;
  haptic('light');
  el.querySelectorAll('.rate-opt').forEach(function (b) { b.disabled = true; });
  const payload = {}; payload.action = action; payload[key] = value;
  const res = await apiPost(payload);
  if (res.ok) { STATE[stateKey] = res[resKey]; haptic('success'); renderStats(); }
  else { haptic('error'); await alertAsync('Не получилось: ' + (res.error || '')); el.querySelectorAll('.rate-opt').forEach(function (b) { b.disabled = false; }); }
}

// ---------- свайп-аналитика ----------
async function loadSwipeStats() {
  const res = await apiPost({ action: 'get_swipe_stats' });
  if (res.ok) { STATE.swipes = res.swipes; renderSwipeStats(); }
}

function renderSwipeStats() {
  const box = document.getElementById('swipeStatsBox');
  if (!box) return;
  const sw = STATE.swipes;
  if (!sw) { box.innerHTML = '<div class="section-title">Свайпы</div><div class="card"><div class="empty">Загрузка…</div></div>'; return; }

  const secRows = Object.keys(sw.bySector || {})
    .sort(function (a, b) { return (sw.bySector[b].like + sw.bySector[b].skip) - (sw.bySector[a].like + sw.bySector[a].skip); })
    .map(function (name) {
      const d = sw.bySector[name];
      const rate = (d.like + d.skip) ? Math.round(d.like / (d.like + d.skip) * 100) : 0;
      return '<div class="sector-row"><span>' + escapeHtml(name) + '</span>' +
        '<span class="sector-count">♥ ' + d.like + ' / ✕ ' + d.skip + ' <span class="dim">(' + rate + '%)</span></span></div>';
    }).join('') || '<div class="empty">Свайпов пока нет</div>';

  const topRows = (sw.topLiked || []).map(function (v) {
    return '<div class="sector-row"><span>' + escapeHtml(v.position || '(?)') + (v.city ? ' · ' + escapeHtml(v.city) : '') + '</span>' +
      '<span class="sector-count">♥ ' + v.likes + '</span></div>';
  }).join('') || '<div class="empty">—</div>';

  box.innerHTML =
    '<div class="section-title">Свайпы</div>' +
    '<div class="stat-grid">' +
      '<div class="stat-tile"><div class="stat-value mono">' + sw.users + '</div><div class="stat-label">пользователей свайпали</div></div>' +
      '<div class="stat-tile"><div class="stat-value mono">' + sw.likeRate + '%</div><div class="stat-label">лайков из всех свайпов</div></div>' +
      '<div class="stat-tile"><div class="stat-value mono">' + sw.likes + '</div><div class="stat-label">лайков всего</div></div>' +
      '<div class="stat-tile"><div class="stat-value mono">' + sw.skips + '</div><div class="stat-label">скипов всего</div></div>' +
    '</div>' +
    '<div class="section-title">Свайпы по сферам</div>' +
    '<div class="card">' + secRows + '</div>' +
    '<div class="section-title">Топ вакансий по лайкам</div>' +
    '<div class="card">' + topRows + '</div>';
}
