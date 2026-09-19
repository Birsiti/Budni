// изменено 2026-09-20 01:30
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

var RATE_OPTIONS = [5, 10, 20, 50, 100];
var EVERY_MIN_OPTIONS = [1, 2, 5, 10, 15, 30];
var LIMIT_OPTIONS = [0, 30, 50, 100, 200, 400];
var CHART_PERIODS = [['day', '7 дней'], ['week', '4 недели'], ['month', '6 месяцев']];
var TOP_N = 5;   // строк списка видно до раскрытия

// отдельные населённые пункты Минского района (НЕ районы самого Минска —
// те уже свёрнуты на бэкенде в "#Минск 📍район", см. api.format.MINSK_DISTRICTS).
// Список сверен с Денисом 2026-09-14, дополнять по мере находок.
var MINSK_RAION = ['Колодищи', 'Боровляны', 'Мачулищи', 'Озерцо', 'Валерьяново',
  'Ждановичи', 'Привольный', 'Королёв Стан', 'Большой Тростенец', 'Михановичи',
  'Острошицкий Городок', 'Ратомка', 'Большевик', 'Лесковка', 'Сеница',
  'Крупица', 'Прилесье', 'Тарасово', 'Луговая Слобода', 'Новая Боровая',
  'Богатырево', 'Ярково', 'Семково', 'Юзуфово'];

// города/посёлки России — сверено с Денисом 2026-09-14 (Подмосковье — тоже сюда),
// Алдан/Ковров дополнены 2026-09-17.
// "Королёв" (Моск. обл.) — не путать с "Королёв Стан" (Минский район) выше.
var RF_CITIES = ['Москва', 'Санкт-петербург', 'Дмитров', 'Солнечногорск', 'Яхрома',
  'Астрахань', 'Благовещенск', 'Гагарин', 'Домодедово', 'Дорохово', 'Кандалакша',
  'Кимры', 'Королёв', 'Красногорск', 'Мурманск', 'Нижний Новгород', 'Подмосковье',
  'Подольск', 'Ростов-на-дону', 'Чехов', 'Пересвет', 'Сосновый Бор', 'Коммунарка',
  'Алдан', 'Ковров'];

// районы САМОГО Минска — синхронизировано с api.format.MINSK_DISTRICTS
// (в отличие от MINSK_RAION выше это не отдельные посёлки, а части города).
var MINSK_DISTRICTS_GROUP = ['Шабаны', 'Уручье', 'Каменная Горка', 'Лошица',
  'Сухарево', 'Копище', 'Колядичи', 'Чижовка'];

// именованные группы для сворачиваемого списка «По городам» (cityRows ниже) —
// каждая своя раскрывающаяся строка, budni_exp_cities_<key> в localStorage.
var CITY_GROUPS = [
  { key: 'minsk', name: 'Минск', cities: MINSK_DISTRICTS_GROUP },
  { key: 'raion', name: 'Минский район', cities: MINSK_RAION },
  { key: 'rf', name: 'РФ', cities: RF_CITIES },
];

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
  setNum('stNew', s.newToday || 0);
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
    collapsibleCard('channels', breakdownRows(s.byChannel, 'brow-channel')) +
    '<div class="section-title">По городам</div>' +
    collapsibleCard('cities', cityRows(s.byCity)) +
    rateControl() +
    '<button class="btn btn-approve wide-btn" id="enqueueAllBtn">Залить весь бэклог в очередь</button>';

  document.querySelectorAll('.rate-opt[data-batch]').forEach(function (b) {
    b.addEventListener('click', function () { setRate('set_publish_batch', +b.dataset.batch, 'publishBatch', 'batch'); });
  });
  document.querySelectorAll('.rate-opt[data-everymin]').forEach(function (b) {
    b.addEventListener('click', function () { setRate('set_publish_every_min', +b.dataset.everymin, 'publishRateMin', 'every_min'); });
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
        '<button type="button" data-m="new"' + (m === 'new' ? ' class="is-on"' : '') + '>Новые</button>' +
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

function breakdownRows(obj, clickClass) {
  const keys = Object.keys(obj || {}).sort(function (a, b) { return obj[b] - obj[a]; });
  if (!keys.length) return [];
  const max = obj[keys[0]] || 1;
  return keys.map(function (k) {
    return '<div class="brow' + (clickClass ? ' ' + clickClass + '" data-channel="' + escapeHtml(k) : '') + '">' +
      '<div class="brow-top"><span>' + escapeHtml(k) + '</span>' +
      '<span class="brow-num mono">' + obj[k] + '</span></div>' +
      '<div class="bar"><i style="width:' + Math.round(obj[k] / max * 100) + '%"></i></div></div>';
  });
}

// как breakdownRows, но города из CITY_GROUPS (Минский район, РФ, ...)
// сворачивает каждый в одну строку-группу — сама раскрывается по тапу,
// показывая разбивку внутри (см. обработчик .brow-toggle в делегировании
// кликов ниже). Город, не попавший ни в одну группу, — обычная строка.
function cityRows(obj) {
  obj = obj || {};
  const rest = {};
  const byGroup = {};   // key -> {city: count, ...}
  Object.keys(obj).forEach(function (k) {
    const g = CITY_GROUPS.find(function (g) { return g.cities.indexOf(k) !== -1; });
    if (!g) { rest[k] = obj[k]; return; }
    (byGroup[g.key] || (byGroup[g.key] = {}))[k] = obj[k];
  });

  const combined = Object.assign({}, rest);
  const groupByLabel = {};   // "Минский район" -> {key, items}
  CITY_GROUPS.forEach(function (g) {
    // если сам город/район тоже встречается как обычная запись (например
    // "Минск" рядом с районами "Шабаны"/"Уручье") — не затираем его счётчик
    // группой, а добавляем как собственную подстроку внутри неё.
    const items = Object.assign({}, byGroup[g.key]);
    const base = rest[g.name];
    if (!Object.keys(items).length && base === undefined) return;
    if (base !== undefined) items[g.name] = base;
    const total = Object.keys(items).reduce(function (a, k) { return a + items[k]; }, 0);
    combined[g.name] = total;
    groupByLabel[g.name] = { key: g.key, items: items };
  });

  const keys = Object.keys(combined).sort(function (a, b) { return combined[b] - combined[a]; });
  if (!keys.length) return [];
  const max = combined[keys[0]] || 1;

  return keys.map(function (k) {
    const grp = groupByLabel[k];
    if (!grp) {
      const clickable = k !== '(без города)';   // не город — фильтровать нечем
      return '<div class="brow' + (clickable ? ' brow-city' : '') + '"' +
          (clickable ? ' data-city="' + escapeHtml(k) + '"' : '') + '>' +
        '<div class="brow-top"><span>' + escapeHtml(k) + '</span>' +
        '<span class="brow-num mono">' + combined[k] + '</span></div>' +
        '<div class="bar"><i style="width:' + Math.round(combined[k] / max * 100) + '%"></i></div></div>';
    }
    const items = grp.items;
    const subKeys = Object.keys(items).sort(function (a, b) { return items[b] - items[a]; });
    const subMax = items[subKeys[0]] || 1;
    const subRow = function (sk) {
      return '<div class="brow-sub brow-city" data-city="' + escapeHtml(sk) + '"><div class="brow-top"><span>' + escapeHtml(sk) + '</span>' +
        '<span class="brow-num mono">' + items[sk] + '</span></div>' +
        '<div class="bar"><i style="width:' + Math.round(items[sk] / subMax * 100) + '%"></i></div></div>';
    };
    let subRows = subKeys.slice(0, TOP_N).map(subRow).join('');
    const subExtra = subKeys.length - TOP_N;
    if (subExtra > 0) {
      const subOpen = lsGet('budni_exp_citiesSub_' + grp.key) === '1';
      subRows += '<div class="list-tail' + (subOpen ? '' : ' hidden') + '">' +
        subKeys.slice(TOP_N).map(subRow).join('') + '</div>';
      subRows += '<button type="button" class="list-more" data-exp="citiesSub_' + grp.key + '">' +
        (subOpen ? 'свернуть' : 'ещё ' + subExtra) + '</button>';
    }
    const open = lsGet('budni_exp_cities_' + grp.key) === '1';
    return '<div class="brow-group">' +
      '<button type="button" class="brow-toggle" data-exp-group="cities_' + grp.key + '">' +
        '<div class="brow-top"><span>' + (open ? '▾' : '▸') + ' ' + escapeHtml(k) + '</span>' +
        '<span class="brow-num mono">' + combined[k] + '</span></div>' +
        '<div class="bar"><i style="width:' + Math.round(combined[k] / max * 100) + '%"></i></div>' +
      '</button>' +
      '<div class="list-tail' + (open ? '' : ' hidden') + '">' + subRows + '</div>' +
    '</div>';
  });
}

function rateControl() {
  const b = D.publishBatch, everyMin = D.publishRateMin || 5, lim = D.publishDailyLimit;
  const perHour = everyMin ? Math.round(b * 60 / everyMin) : 0;
  const rate = RATE_OPTIONS.map(function (n) {
    return '<button class="rate-opt' + (n === b ? ' is-on' : '') + '" data-batch="' + n + '">' + n + '</button>';
  }).join('');
  const everyMinOpts = EVERY_MIN_OPTIONS.map(function (n) {
    return '<button class="rate-opt' + (n === everyMin ? ' is-on' : '') + '" data-everymin="' + n + '">' + n + '</button>';
  }).join('');
  const limits = LIMIT_OPTIONS.map(function (n) {
    return '<button class="rate-opt' + (n === lim ? ' is-on' : '') + '" data-limit="' + n + '">' + (n === 0 ? '∞' : n) + '</button>';
  }).join('');
  return '<div class="section-title" style="margin-top:4px">Темп публикации в группу</div>' +
    '<div class="card">' +
      '<p class="rate-note">За один тик (раз в <b>' + everyMin + '</b> мин), по кругу из разных сфер. ' +
      'Сейчас <b>' + b + '</b> → ~' + perHour + '/час' +
      (lim > 0 ? ', но не больше <b>' + lim + '</b>/сутки' : '') + '.</p>' +
      '<div class="rate-row">' + rate + '</div>' +
      '<p class="rate-note" style="margin:14px 0 8px">Интервал тика, минут:</p>' +
      '<div class="rate-row">' + everyMinOpts + '</div>' +
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

// ---------- шторка «вакансии этого города/канала» ----------
// Один и тот же DOM/бэкенд-паттерн на два ключа фильтра (см. api.admin
// vacancies_by_city/vacancies_by_channel) — отличается только action и
// какое поле не дублировать в meta-строке карточки (город уже в заголовке
// шторки при kind:'city', канал — при kind:'channel').
async function openFilterSheet(kind, value) {
  const backdrop = document.getElementById('citySheetBackdrop');
  const sheet = document.getElementById('citySheet');
  const body = document.getElementById('citySheetBody');
  document.getElementById('citySheetTitle').textContent = value;
  body.innerHTML = '<div class="empty">Загрузка…</div>';
  backdrop.classList.add('open');
  sheet.classList.add('open');
  if (tg && tg.BackButton) {
    try { tg.BackButton.onClick(closeCitySheet); tg.BackButton.show(); } catch (e) {}
  }
  haptic('light');

  const action = kind === 'channel' ? 'vacancies_by_channel' : 'vacancies_by_city';
  const payload = kind === 'channel' ? { action: action, channel: value } : { action: action, city: value };
  const res = await apiPost(payload);
  if (!sheet.classList.contains('open')) return;   // успели закрыть, пока ждали ответ
  if (!res.ok) { body.innerHTML = '<div class="empty">Ошибка: ' + escapeHtml(res.error || 'нет связи') + '</div>'; return; }
  const list = res.vacancies || [];
  if (!list.length) { body.innerHTML = '<div class="empty">Вакансий нет</div>'; return; }
  body.innerHTML = list.map(function (v, i) {
    const metaBits = kind === 'channel' ? [v.city, v.company, v.salary_text] : [v.company, v.salary_text];
    const meta = metaBits.filter(Boolean).join(' · ');
    const src = sourceUrl(v);
    return '<div class="qcard qcard-open" data-i="' + i + '">' +
      '<div class="qtop"><div><div class="qpos">' + escapeHtml(v.position || '(без должности)') + '</div>' +
        (meta ? '<div class="qmeta">' + escapeHtml(meta) + '</div>' : '') + '</div>' +
        (v.suspicious ? '<span class="badge badge-viber">⚠️</span>' : '') + '</div>' +
      (kind !== 'channel' && v.channel ? '<div class="qmeta2"><span class="badge">' + escapeHtml(v.channel) + '</span>' +
        (v.source === 'employer' ? '<span class="badge badge-employer">прямая</span>' : '') + '</div>' : '') +
      '<div class="qdetail" id="csd-' + i + '"><div class="rv-text">' + escapeHtml(v.clean_text || '(нет текста)') + '</div>' +
        (src ? '<a class="src-link" href="' + src + '" target="_blank" rel="noopener">↗ ' + escapeHtml(v.channel) + ' #' + escapeHtml(String(v.msg_id)) + '</a>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

// ссылка на первоисточник — праca.by/rabota.by по msg_id, обычный TG-канал
// по username. Для приватных групп (t.me/+HASH, без public username) msg_id
// есть, но публичной ссылки не построить — тогда не показываем.
function sourceUrl(v) {
  if (!v.msg_id) return '';
  if (v.channel === 'praca.by') return 'https://praca.by/vacancy/' + encodeURIComponent(v.msg_id) + '/';
  if (v.channel === 'rabota.by') return 'https://rabota.by/vacancy/' + encodeURIComponent(v.msg_id);
  if (v.channel && /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(v.channel)) {
    return 'https://t.me/' + v.channel + '/' + encodeURIComponent(v.msg_id);
  }
  return '';
}

function openCitySheet(city) { return openFilterSheet('city', city); }
function openChannelSheet(channel) { return openFilterSheet('channel', channel); }

function closeCitySheet() {
  document.getElementById('citySheetBackdrop').classList.remove('open');
  document.getElementById('citySheet').classList.remove('open');
  if (tg && tg.BackButton) { try { tg.BackButton.hide(); } catch (e) {} }
}

document.getElementById('citySheetBackdrop').addEventListener('click', closeCitySheet);
document.getElementById('citySheetClose').addEventListener('click', closeCitySheet);
document.getElementById('citySheetBody').addEventListener('click', function (e) {
  if (e.target.closest('.src-link')) return;   // не сворачивать деталь при переходе по ссылке
  const card = e.target.closest('.qcard-open');
  if (!card) return;
  const detail = document.getElementById('csd-' + card.dataset.i);
  if (!detail) return;
  detail.classList.toggle('open');
  haptic('light');
});

// ---------- делегирование кликов внутри #view ----------
document.getElementById('view').addEventListener('click', function (e) {
  const cityRow = e.target.closest('.brow-city');
  if (cityRow) { openCitySheet(cityRow.dataset.city); return; }
  const channelRow = e.target.closest('.brow-channel');
  if (channelRow) { openChannelSheet(channelRow.dataset.channel); return; }
  const grp = e.target.closest('.brow-toggle');
  if (grp) {
    const tail = grp.parentElement.querySelector('.list-tail');
    if (!tail) return;
    const willOpen = tail.classList.contains('hidden');
    tail.classList.toggle('hidden', !willOpen);
    const label = grp.querySelector('.brow-top span:first-child');
    if (label) label.textContent = (willOpen ? '▾' : '▸') + label.textContent.slice(1);
    lsSet('budni_exp_' + grp.dataset.expGroup, willOpen ? '1' : '0');
    haptic('light');
    return;
  }
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
  const msg = _paused
    ? 'Снять с паузы? Публикация в группу возобновится.'
    : 'Поставить публикацию на паузу? Вакансии будут копиться в очереди.';
  if (!(await confirmAsync(msg))) return;
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
  const msg = _parserPaused
    ? 'Возобновить парсинг?'
    : 'Остановить парсинг? Новые вакансии перестанут собираться.';
  if (!(await confirmAsync(msg))) return;
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
