// ============================================================
// Будни_BY admin — вкладка «Статистика»: очередь/опубликовано + разбивки
// по сферам / каналам / городам. Данные приходят в STATE.stats из admin_data.
// Глобалы: STATE, escapeHtml.
// ============================================================

function renderBreakdown(obj, limit) {
  const keys = Object.keys(obj || {}).sort(function (a, b) { return obj[b] - obj[a]; });
  const shown = limit ? keys.slice(0, limit) : keys;
  if (shown.length === 0) return '<div class="empty">Нет данных</div>';
  return shown.map(function (key) {
    return '<div class="sector-row"><span>' + escapeHtml(key) + '</span>' +
      '<span class="sector-count">' + obj[key] + '</span></div>';
  }).join('');
}

function renderStats() {
  const el = document.getElementById('viewStats');
  if (!STATE.stats) { el.innerHTML = ''; return; }
  const s = STATE.stats;

  el.innerHTML =
    '<div class="stat-grid">' +
      '<div class="stat-tile"><div class="stat-value mono">' + s.queueLength + '</div><div class="stat-label">в очереди на публикацию</div></div>' +
      '<div class="stat-tile"><div class="stat-value mono">' + s.publishedToday + '</div><div class="stat-label">опубликовано сегодня</div></div>' +
      '<div class="stat-tile"><div class="stat-value mono">' + s.publishedTotal + '</div><div class="stat-label">опубликовано всего</div></div>' +
    '</div>' +
    '<div class="section-title">По сферам</div>' +
    '<div class="card">' + renderBreakdown(s.bySector) + '</div>' +
    '<div class="section-title">По каналам</div>' +
    '<div class="card">' + renderBreakdown(s.byChannel, 15) + '</div>' +
    '<div class="section-title">По городам</div>' +
    '<div class="card">' + renderBreakdown(s.byCity, 15) + '</div>';
}
