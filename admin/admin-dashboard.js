// изменено 2026-09-09 22:55
// ============================================================
// Будни_BY admin — главный экран (admin.html): пульт владельца.
// Парсинг + публикация (плитки в строку) + общая строка деталей,
// два ключевых числа, график динамики (публикации/свайпы × день/неделя/месяц),
// сворачиваемые списки по сферам/каналам/городам, свайп-аналитика,
// темп публикации, навигация в Очередь / Источники. Модерации нет.
// Рендерит в #view (кроме шапки-статуса-навигации в HTML).
// Глобалы из app.js/admin-core.js: apiGet, apiPost, escapeHtml, haptic,
// alertAsync, confirmAsync, initTelegram, initSettings, getToken, saveToken.
// ============================================================

var RATE_OPTIONS = [1, 2, 3, 5, 8, 12];
var LIMIT_OPTIONS = [0, 30, 50, 100, 200, 400];
var CHART_PERIODS = [['day', '7 дней'], ['week', '4 недели'], ['month', '6 месяцев']];
var TOP_N = 5;   // строк списка видно до раскрытия

var D = {};                 // состояние экрана
var _paused = false;        // публикация на паузе
var _parserPaused = false;  // парсинг на паузе
var _chart = { metric: lsGet('budni_chart_metric') || 'publications',
               period: lsGet('budni_chart_period') || 'day' };

// прогреваем запросы сразу, потребляем один раз каждый
var _pfMain = null, _pfSwipes = null, _pfSources = null;

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

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
  D.publishRateMin = main.publishEveryMin || 30;
  D.publishDailyLimit = main.publishDailyLimit || 0;

  D.parser = main.parser || {};
  D.publisher = main.publisher || {};
  D.parser.stale = D.parser.seenSec == null || D.parser.seenSec > 180;
  D.publisher.stale = D.publisher.seenSec != null &&
    D.publisher.seenSec > Math.max(2400, (D.publishRateMin || 30) * 120);
  renderStatusCards();
  renderStatusLine();

  const s = D.stats;
  setNum('stVac', totalOf(s.bySector));
  setNum('stQueue', s.queueLength || 0);
  setNum('navQueue', s.queueLength || 0);

  const rev = (main.suspicious || []).length;
  const qb = document.getElementById('navQueueBadge');
  if (qb) {
    if (rev) { qb.textContent = rev; qb.classList.remove('hidden'); }
    else qb.classList.add('hidden');
  }

  renderBody();
  loadSwipeInto();     // фоном
  loadSourcesInto();   // фоном
}

function totalOf(obj) {
  return Object.keys(obj || {}).reduce(function (a, k) { return a + (obj[k] || 0); }, 0);
}
function setNum(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

function fmtAgo(sec) {
  if (sec == null) return 'нет сигнала';
  if (sec < 90) return sec + ' с назад';
  if (sec < 5400) return Math.round(sec / 60) + ' мин назад';
  return Math.round(sec / 3600) + ' ч назад';
}

// ---------- статус: две плитки + общая строка ----------
function renderStatusCards() {
  const p = D.parser || {}, pub = D.publisher || {};
  _parserPaused = !!p.paused;
  _paused = !!pub.paused;
  const pc = document.getElementById('parserToggle');
  pc.classList.toggle('is-paused', _parserPaused);
  pc.classList.toggle('is-stale', !_parserPaused && !!p.stale);
  const uc = document.getElementById('pauseToggle');
  uc.classList.toggle('is-paused', _paused);
  uc.classList.toggle('is-stale', !_paused && !!pub.stale);
}

function renderStatusLine() {
  const p = D.parser || {}, pub = D.publisher || {};
  const el = document.getElementById('statusLine');
  const probs = [];
  if (_parserPaused) probs.push('парсинг на паузе');
  else if (p.stale) {
    probs.push(p.seenSec == null
      ? 'парсер ещё не отчитывался — проверь iMac'
      : 'парсер молчит ' + fmtAgo(p.seenSec) + ' — проверь iMac');
  }
  if (_paused) probs.push('публикация на паузе');
  else if (pub.stale) probs.push('публикатор молчит ' + fmtAgo(pub.seenSec));

  if (probs.length) {
    el.textContent = '⚠ ' + probs.join(' · ');
    el.classList.add('warn');
    return;
  }
  el.classList.remove('warn');
  el.textContent =
    (p.channels || 0) + ' каналов · тик ' + fmtAgo(p.seenSec) +
    ' · публикация ' + (D.publishBatch || 1) + '/' + (D.publishRateMin || 30) + ' мин';
}

// ---------- тело ----------
function renderBody() {
  const s = D.stats;
  document.getElementById('view').innerHTML =
    chartCard() +
    '<div class="section-title">По сферам <span class="st-note">в очереди / опубликовано (всего)</span></div>' +
    collapsibleCard('sectors', sectorRows(s), sectorTotal(s)) +
    '<div id="swipeBox"><div class="section-title">Свайпы</div><div class="card"><div class="empty">Загрузка…</div></div></div>' +
    '<div class="section-title">По каналам</div>' +
    collapsibleCard('channels', breakdownRows(s.byChannel)) +
    '<div class="section-title">По городам</div>' +
    collapsibleCard('cities', breakdownRows(s.byCity)) +
    rateControl() +
    '<button class="btn btn-approve wide-btn" id="enqueueAllBtn">Залить весь бэклог в очередь</button>';

  document.querySelectorAll('.rate-opt[data-batch]').forEach(function (b) {
    b.addEventListener('click', function () { setRate('set_publish_batch', +b.dataset.batch, 'publishBatch', 'batch'); });
  });
  document.querySelectorAll('.rate-opt[data-limit]').forEach(function (b) {
    b.addEventListener('click', function () { setRate('set_publish_daily_limit', +b.dataset.limit, 'publishDailyLimit', 'limit'); });
  });
  document.getElementById('enqueueAllBtn').addEventListener('click', enqueueAll);

  loadChart();
}

// ---------- график динамики ----------
function chartCard() {
  const m = _chart.metric;
  return '<div class="section-title">Динамика</div>' +
    '<div class="card chart-card">' +
      '<div class="seg" id="chartMetric">' +
        '<button type="button" data-m="publications"' + (m === 'publications' ? ' class="is-on"' : '') + '>Публикации</button>' +
        '<button type="button" data-m="swipes"' + (m === 'swipes' ? ' class="is-on"' : '') + '>Свайпы</button>' +
      '</div>' +
      '<div class="seg seg-sm" id="chartPeriod">' +
        CHART_PERIODS.map(function (p) {
          return '<button type="button" data-p="' + p[0] + '"' + (_chart.period === p[0] ? ' class="is-on"' : '') + '>' + p[1] + '</button>';
        }).join('') +
      '</div>' +
      '<div id="chartArea" class="chart-area"><div class="empty">Загрузка…</div></div>' +
    '</div>';
}

async function loadChart() {
  const area = document.getElementById('chartArea');
  if (!area) return;
  const res = await apiPost({ action: 'get_chart', metric: _chart.metric, period: _chart.period });
  if (!area.isConnected) return;
  if (!res.ok || !res.bars || !res.bars.length) {
    area.innerHTML = '<div class="empty">Нет данных за период</div>';
    return;
  }
  area.innerHTML = chartSvg(res.bars, !!res.stacked);
}

function chartSvg(bars, stacked) {
  const W = 300, H = 104, base = 84, top = 10;
  const tot = bars.map(function (b) { return b.a + b.b; });
  const max = Math.max.apply(null, tot.concat([1]));
  const n = bars.length, slot = W / n, bw = Math.min(34, slot * 0.6);
  const avg = tot.reduce(function (x, y) { return x + y; }, 0) / n;
  const parts = ['<line x1="0" y1="' + base + '" x2="' + W + '" y2="' + base + '" class="chart-base"/>'];
  if (avg > 0.5) {
    const ay = base - (avg / max) * (base - top);
    parts.push('<line x1="0" y1="' + ay.toFixed(1) + '" x2="' + W + '" y2="' + ay.toFixed(1) + '" class="chart-avg"/>');
  }
  bars.forEach(function (b, i) {
    const cx = i * slot + slot / 2, x = cx - bw / 2;
    const hA = (b.a / max) * (base - top), hB = (b.b / max) * (base - top);
    const yA = base - hA - (stacked ? hB : 0);
    if (stacked && hB > 0) {
      parts.push('<rect x="' + x.toFixed(1) + '" y="' + (base - hB).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hB.toFixed(1) + '" rx="2" class="bar-b"/>');
    }
    if (hA > 0) {
      parts.push('<rect x="' + x.toFixed(1) + '" y="' + yA.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hA.toFixed(1) + '" rx="2" class="bar-a"/>');
    }
    if (tot[i] > 0) {
      parts.push('<text x="' + cx.toFixed(1) + '" y="' + Math.max(8, yA - 3).toFixed(1) + '" class="bar-val">' + tot[i] + '</text>');
    }
    parts.push('<text x="' + cx.toFixed(1) + '" y="' + (H - 2) + '" class="bar-lbl">' + escapeHtml(b.label) + '</text>');
  });
  const legend = stacked
    ? '<div class="chart-legend"><span class="lg lg-a">лайки</span><span class="lg lg-b">скипы</span></div>'
    : '';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart-svg' + (stacked ? ' swipes' : '') + '">' + parts.join('') + '</svg>' + legend;
}

// ---------- сворачиваемый список ----------
// rows — массив html-строк (по одной .brow на строку), footerHtml всегда виден
function collapsibleCard(id, rows, footerHtml) {
  const open = lsGet('budni_exp_' + id) === '1';
  const extra = rows.length - TOP_N;
  let h = '<div class="card">';
  if (!rows.length) return '<div class="card"><div class="empty">Нет данных</div></div>';
  h += rows.slice(0, TOP_N).join('');
  if (extra > 0) {
    h += '<div class="list-tail' + (open ? '' : ' hidden') + '">' + rows.slice(TOP_N).join('') + '</div>';
    h += '<button type="button" class="list-more" data-exp="' + id + '">' +
      (open ? 'свернуть' : 'ещё ' + extra) + '</button>';
  }
  if (footerHtml) h += footerHtml;
  h += '</div>';
  return h;
}

function sectorRows(s) {
  const total = s.bySector || {}, queued = s.queuedBySector || {}, published = s.publishedBySector || {};
  const names = Object.keys(total).sort(function (a, b) { return (total[b] || 0) - (total[a] || 0); });
  return names.map(function (n) {
    const q = queued[n] || 0, p = published[n] || 0, a = total[n] || 0;
    const pct = a ? Math.round(p / a * 100) : 0;
    return '<div class="brow">' +
      '<div class="brow-top"><span>' + escapeHtml(n) + '</span>' +
      '<span class="brow-num mono">' + q + ' / ' + p + ' <span class="dim">(' + a + ')</span></span></div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div></div>';
  });
}

function sectorTotal(s) {
  const total = s.bySector || {}, queued = s.queuedBySector || {}, published = s.publishedBySector || {};
  let tq = 0, tp = 0, ta = 0;
  Object.keys(total).forEach(function (n) { tq += queued[n] || 0; tp += published[n] || 0; ta += total[n] || 0; });
  return '<div class="brow brow-total"><div class="brow-top"><span>Итого</span>' +
    '<span class="brow-num mono">' + tq + ' / ' + tp + ' <span class="dim">(' + ta + ')</span></span></div></div>';
}

function breakdownRows(obj) {
  const keys = Object.keys(obj || {}).sort(function (a, b) { return obj[b] - obj[a]; });
  if (!keys.length) return [];
  const max = obj[keys[0]] || 1;
  return keys.map(function (k) {
    return '<div class="brow"><div class="brow-top"><span>' + escapeHtml(k) + '</span>' +
      '<span class="brow-num mono">' + obj[k] + '</span></div>' +
      '<div class="bar"><i style="width:' + Math.round(obj[k] / max * 100) + '%"></i></div></div>';
  });
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

async function setRate(action, value, stateKey, resKey) {
  if (value === D[stateKey]) return;
  haptic('light');
  document.querySelectorAll('.rate-opt').forEach(function (b) { b.disabled = true; });
  const p = {}; p.action = action; p.n = value;
  const res = await apiPost(p);
  if (res.ok) { D[stateKey] = res[resKey]; haptic('success'); renderStatusLine(); renderBody(); loadSwipeInto(); }
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
  if (!res.ok || !res.swipes) {
    box.innerHTML = '<div class="section-title">Свайпы</div><div class="card"><div class="empty">Свайпов пока нет</div></div>';
    return;
  }
  const sw = res.swipes;

  const secRows = Object.keys(sw.bySector || {})
    .sort(function (a, b) { return (sw.bySector[b].like + sw.bySector[b].skip) - (sw.bySector[a].like + sw.bySector[a].skip); })
    .map(function (n) {
      const d = sw.bySector[n], t = d.like + d.skip;
      const rate = t ? Math.round(d.like / t * 100) : 0;
      return '<div class="brow"><div class="brow-top"><span>' + escapeHtml(n) + '</span>' +
        '<span class="brow-num mono">♥ ' + d.like + ' · ✕ ' + d.skip + ' <span class="dim">' + rate + '%</span></span></div>' +
        '<div class="bar bar-like"><i style="width:' + rate + '%"></i></div></div>';
    });

  const topRows = (sw.topLiked || []).map(function (v) {
    return '<div class="brow"><div class="brow-top"><span>' + escapeHtml(v.position || '(?)') +
      (v.city ? ' · ' + escapeHtml(v.city) : '') + '</span><span class="brow-num mono">♥ ' + v.likes + '</span></div></div>';
  });

  box.innerHTML =
    '<div class="section-title">Свайпы</div>' +
    '<div class="card">' +
      '<div class="likebar"><i class="likebar-like" style="width:' + (sw.likeRate || 0) + '%"></i></div>' +
      '<p class="rate-note" style="margin:10px 0 0">' +
        '<b>' + (sw.likeRate || 0) + '%</b> лайков · ' + (sw.likes || 0) + ' ♥ / ' + (sw.skips || 0) + ' ✕ · ' + (sw.users || 0) + ' чел.</p>' +
    '</div>' +
    '<div class="section-title">Свайпы по сферам</div>' + collapsibleCard('swsec', secRows) +
    '<div class="section-title">Топ вакансий по лайкам</div>' + collapsibleCard('swtop', topRows);
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

// ---------- делегирование кликов внутри #view ----------
document.getElementById('view').addEventListener('click', function (e) {
  const more = e.target.closest('.list-more');
  if (more) {
    const tail = more.parentElement.querySelector('.list-tail');
    if (!tail) return;
    const willOpen = tail.classList.contains('hidden');
    tail.classList.toggle('hidden', !willOpen);
    more.textContent = willOpen ? 'свернуть' : ('ещё ' + tail.children.length);
    lsSet('budni_exp_' + more.dataset.exp, willOpen ? '1' : '0');
    haptic('light');
    return;
  }
  const mBtn = e.target.closest('#chartMetric button');
  if (mBtn) {
    _chart.metric = mBtn.dataset.m;
    lsSet('budni_chart_metric', _chart.metric);
    document.querySelectorAll('#chartMetric button').forEach(function (x) { x.classList.toggle('is-on', x === mBtn); });
    document.getElementById('chartArea').innerHTML = '<div class="empty">Загрузка…</div>';
    haptic('light');
    loadChart();
    return;
  }
  const pBtn = e.target.closest('#chartPeriod button');
  if (pBtn) {
    _chart.period = pBtn.dataset.p;
    lsSet('budni_chart_period', _chart.period);
    document.querySelectorAll('#chartPeriod button').forEach(function (x) { x.classList.toggle('is-on', x === pBtn); });
    document.getElementById('chartArea').innerHTML = '<div class="empty">Загрузка…</div>';
    haptic('light');
    loadChart();
  }
});

// ---------- переключатели статуса ----------
document.getElementById('pauseToggle').addEventListener('click', async function () {
  if (!_paused && !(await confirmAsync('Поставить публикацию на паузу? Вакансии будут копиться в очереди.'))) return;
  haptic('light');
  const res = await apiPost({ action: 'set_publish_pause', paused: !_paused });
  if (res.ok) {
    D.publisher = D.publisher || {};
    D.publisher.paused = !!res.paused;
    renderStatusCards();
    renderStatusLine();
    haptic(res.paused ? 'warning' : 'success');
  } else { await alertAsync('Не удалось: ' + (res.error || '')); }
});

document.getElementById('parserToggle').addEventListener('click', async function () {
  if (!_parserPaused && !(await confirmAsync('Остановить парсинг? Новые вакансии перестанут собираться.'))) return;
  haptic('light');
  const res = await apiPost({ action: 'set_parser_pause', paused: !_parserPaused });
  if (res.ok) {
    D.parser = D.parser || {};
    D.parser.paused = !!res.paused;
    renderStatusCards();
    renderStatusLine();
    haptic(res.paused ? 'warning' : 'success');
    setTimeout(function () { prefetch(); loadDashboard(); }, 1200);   // подтянуть свежий heartbeat
  } else { await alertAsync('Не удалось: ' + (res.error || '')); }
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
