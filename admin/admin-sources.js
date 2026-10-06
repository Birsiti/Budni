// изменено 2026-10-06 13:35
// ============================================================
// Будни_BY admin — страница «Источники» (admin-sources.html).
// Сверху — сводка (каналов / сегодня / молчат / номера), «Публикуем: с какого номера и куда»,
// ниже каналы, сгруппированные по номеру аккаунта, который их парсит. Строка канала сворачивается:
// название + «в ленте (+сегодня)», по тапу — ссылка и «Убрать». Рендерит в #view.
// Глобалы: STATE, apiPost, haptic, escapeHtml, alertAsync, confirmAsync.
// ============================================================

var SRC_UI_KEY = 'budni_src_ui';
var SRC_TOP = 8;                       // сколько строк группы видно до «ещё N»
var SRC_UI = { filter: 'all', q: '', closed: {}, all: {}, pubClosed: false, addOpen: false, viberOpen: false };

try {
  var _saved = JSON.parse(localStorage.getItem(SRC_UI_KEY) || '{}');
  SRC_UI.closed = _saved.closed || {};
  SRC_UI.all = _saved.all || {};
  SRC_UI.pubClosed = !!_saved.pubClosed;
} catch (e) {}

function srcSaveUi() {
  try {
    localStorage.setItem(SRC_UI_KEY, JSON.stringify({ closed: SRC_UI.closed, all: SRC_UI.all, pubClosed: SRC_UI.pubClosed }));
  } catch (e) {}
}

async function loadSources() {
  const el = document.getElementById('view');
  el.innerHTML =
    '<div class="sk-grid"><div class="sk"></div><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>' +
    '<div class="sk sk-wide"></div><div class="sk sk-wide"></div><div class="sk sk-wide"></div>';
  const res = await apiPost({ action: 'list_sources' });
  if (!res || !res.ok) {
    el.innerHTML = '<div class="src-error"><p>Не получилось загрузить источники</p>' +
      '<button class="btn-soft" id="srcRetry">Повторить</button></div>';
    document.getElementById('srcRetry').addEventListener('click', loadSources);
    return;
  }
  STATE.sources = res.sources || [];
  STATE.publishing = res.publishing || [];
  renderSources();
}

// ---------- мелкие помощники ----------
function fmtShort(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = function (n) { return (n < 10 ? '0' : '') + n; };
  return p(d.getDate()) + '.' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function srcName(s) { return s.title || (s.parsed_username ? '@' + s.parsed_username : s.link); }

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// ---------- проверка дублей при вводе (зеркалит api.people.extract_tg_username) ----------
var SRC_TG_RE = /(?:t\.me\/|telegram\.me\/|@)([a-zA-Z][a-zA-Z0-9_]{3,31})/;
var SRC_BARE_RE = /^([a-zA-Z][a-zA-Z0-9_]{3,31})$/;

function extractTgUsernameClient(link) {
  const s = String(link || '').trim();
  const m = SRC_TG_RE.exec(s);
  if (m) return m[1].toLowerCase();
  const bare = SRC_BARE_RE.exec(s);
  return bare ? bare[1].toLowerCase() : null;
}

// ищет уже существующий (не отклонённый) источник по ссылке или username —
// та же логика, что и dup-проверка в api.admin.add_source, но локально по
// уже загруженному STATE.sources, без похода на бэкенд.
function findDuplicateSource(link) {
  const s = String(link || '').trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  const uname = extractTgUsernameClient(s);
  return (STATE.sources || []).find(function (x) {
    if (x.status === 'rejected') return false;
    if (String(x.link || '').toLowerCase() === lower) return true;
    if (uname && x.username && String(x.username).toLowerCase() === uname) return true;
    return false;
  }) || null;
}

// ---------- данные для сводки и групп ----------
function srcGroups(approved) {
  // группа = аккаунт, который парсит канал; нет аккаунта (сайты, пока нет heartbeat) — «other»
  const order = ['parser', 'parser2'];
  const map = {};
  approved.forEach(function (s) {
    const acc = (s.accounts && s.accounts[0]) || null;
    const key = acc ? acc.worker : 'other';
    if (!map[key]) map[key] = { key: key, label: acc ? acc.label : 'Свой сборщик (сайты) / без аккаунта',
      alive: acc ? acc.alive : true, rows: [] };
    map[key].rows.push(s);
  });
  return Object.keys(map).sort(function (a, b) {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  }).map(function (k) { return map[k]; });
}

function srcSortRows(rows) {
  return rows.slice().sort(function (a, b) {
    if (!!a.silent !== !!b.silent) return a.silent ? -1 : 1;                 // молчащие — наверх
    return (b.today || 0) - (a.today || 0) || (b.miniappCount || 0) - (a.miniappCount || 0);
  });
}

function srcMatches(s) {
  const q = SRC_UI.q.trim().toLowerCase();
  if (SRC_UI.filter === 'silent' && !s.silent) return false;
  if (!q) return true;
  return [s.title, s.username, s.link, s.city].join(' ').toLowerCase().indexOf(q) >= 0;
}

// ---------- сборка HTML (чистые функции — удобно проверять без браузера) ----------
function srcRowHtml(s) {
  const tone = s.silent ? 'is-silent' : ((s.today || 0) > 0 ? 'is-live' : '');
  const sub = [];
  if (s.parsed_username) sub.push('@' + escapeHtml(s.parsed_username));
  if (s.city) sub.push(escapeHtml(s.city));
  const subHtml = sub.join(' · ');
  const warn = s.silent
    ? '<span class="srow-warn">Нет объявлений 2 дня' + (s.last_msg_at ? ' · последнее ' + escapeHtml(fmtShort(s.last_msg_at)) : '') + '</span>'
    : '';
  const open = s.link && /^https?:/i.test(s.link)
    ? '<a class="btn-soft" href="' + escapeHtml(s.link) + '" target="_blank" rel="noopener">Открыть канал</a>' : '';
  return '<div class="srow ' + tone + '" data-src="' + escapeHtml(s.id) + '">' +
    '<button class="srow-main" type="button" aria-expanded="false">' +
      '<span class="sdot" aria-hidden="true"></span>' +
      '<span class="srow-text"><span class="srow-title">' + escapeHtml(srcName(s)) + '</span>' +
        (subHtml ? '<span class="srow-sub">' + subHtml + '</span>' : '') + warn + '</span>' +
      '<span class="srow-num"><b>' + (s.miniappCount || 0) + '</b><i>(' + ((s.today || 0) > 0 ? '+' : '') + (s.today || 0) + ')</i></span>' +
    '</button>' +
    '<div class="srow-more" hidden>' +
      '<div class="srow-link">' + escapeHtml(s.link || '') + '</div>' +
      '<div class="srow-actions">' + open +
        '<button class="btn-soft btn-danger" type="button" data-src-remove="' + escapeHtml(s.id) + '">Убрать из парсинга</button></div>' +
    '</div>' +
  '</div>';
}

function srcGroupHtml(g) {
  const rows = srcSortRows(g.rows.filter(srcMatches));
  if (!rows.length) return '';
  const today = g.rows.reduce(function (a, s) { return a + (s.today || 0); }, 0);
  const silent = g.rows.filter(function (s) { return s.silent; }).length;
  const forced = SRC_UI.filter === 'silent' || !!SRC_UI.q.trim();          // при поиске/фильтре — показать всё найденное
  const closed = !forced && !!SRC_UI.closed[g.key];
  const showAll = forced || !!SRC_UI.all[g.key];
  const shown = showAll ? rows : rows.slice(0, SRC_TOP);
  const rest = rows.length - shown.length;
  return '<section class="sgroup" data-group="' + escapeHtml(g.key) + '">' +
    '<button class="sgroup-head" type="button" aria-expanded="' + (closed ? 'false' : 'true') + '">' +
      '<span class="sdot ' + (g.alive ? 'ok' : 'bad') + '" aria-hidden="true"></span>' +
      '<span class="sgroup-text"><span class="sgroup-title">' + escapeHtml(g.label) + '</span>' +
        '<span class="sgroup-sub">' + g.rows.length + ' ' + plural(g.rows.length, 'канал', 'канала', 'каналов') +
          ' · сегодня +' + today + (silent ? ' · <span class="txt-danger">молчат ' + silent + '</span>' : '') +
          (g.alive ? '' : ' · <span class="txt-danger">нет связи</span>') + '</span></span>' +
      '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
    '</button>' +
    (closed ? '' : '<div class="sgroup-body">' + shown.map(srcRowHtml).join('') +
      (rest > 0 ? '<button class="sgroup-more" type="button" data-more="' + escapeHtml(g.key) + '">Показать ещё ' + rest + '</button>' : '') +
      (showAll && !forced && rows.length > SRC_TOP ? '<button class="sgroup-more" type="button" data-less="' + escapeHtml(g.key) + '">Свернуть</button>' : '') +
    '</div>') +
  '</section>';
}

function srcListHtml(approved) {
  const html = srcGroups(approved).map(srcGroupHtml).join('');
  return html || '<div class="empty">' + (SRC_UI.filter === 'silent' && !SRC_UI.q ? 'Молчащих каналов нет' : 'Ничего не найдено') + '</div>';
}

function srcStatsHtml(real) {
  const today = real.reduce(function (a, s) { return a + (s.today || 0); }, 0);
  const silent = real.filter(function (s) { return s.silent; }).length;
  const accs = {};
  real.forEach(function (s) { (s.accounts || []).forEach(function (a) { accs[a.worker] = a.alive; }); });
  const accKeys = Object.keys(accs);
  const accAlive = accKeys.filter(function (k) { return accs[k]; }).length;
  function tile(val, label, cls) {
    return '<div class="stile ' + (cls || '') + '"><b>' + val + '</b><span>' + label + '</span></div>';
  }
  return '<div class="sstats">' +
    tile(real.length, 'каналов в парсинге') +
    tile('+' + today, 'объявлений сегодня', 'is-ok') +
    tile(silent, 'молчат 2 дня', silent ? 'is-bad' : '') +
    tile(accAlive + '/' + accKeys.length, 'номеров на связи', accKeys.length && accAlive < accKeys.length ? 'is-bad' : '') +
  '</div>';
}

function pubChatName(g) {
  if (g.title) return g.title;
  return /^https?:\/\/t\.me\/\+/.test(g.chat || '') ? 'Приватная группа' : (g.chat || '');
}

function srcPubHtml() {
  const items = STATE.publishing || [];
  if (!items.length) return '';
  const GL = { ok: '✓', no_access: '×', slowmode: '◷', error: '!', 'new': '·' };
  const TXT = { ok: '', no_access: 'нет прав', slowmode: 'медл. режим', error: 'ошибка', 'new': 'ещё не слали' };
  const rows = items.map(function (p) {
    const pills = (p.to || []).map(function (g) {
      const st = g.status || 'new';
      const when = g.last_at ? ' · ' + escapeHtml(fmtShort(g.last_at)) : '';
      const no = (g.text_no ? ' · №' + g.text_no : '') + (g.sent ? ' · ' + g.sent + ' ' + plural(g.sent, 'раз', 'раза', 'раз') : '');
      if (!g.status) return '<span class="pill">' + escapeHtml(pubChatName(g)) + '</span>';   // бот: статуса отправки нет
      return '<span class="pill pill-' + escapeHtml(st) + '">' + (GL[st] || '·') + ' ' + escapeHtml(pubChatName(g)) +
        (st === 'ok' ? when + no : (TXT[st] ? ' <em>' + TXT[st] + '</em>' : '')) + '</span>';
    }).join('');
    const total = (p.to || []).reduce(function (n, g) { return n + (g.sent || 0); }, 0);
    const sentLine = p.sent_today != null
      ? '<div class="pub-sent"><b>' + total + '</b> ' + plural(total, 'отправка', 'отправки', 'отправок') + ' всего · сегодня <b>' + p.sent_today + '</b></div>' : '';
    const next = p.active && p.next_at
      ? '<div class="pub-next">Следующая отправка ~' + escapeHtml(fmtShort(p.next_at)) +
        (p.next_text ? ' · текст №' + p.next_text : '') + '</div>' : '';
    const log = (p.log && p.log.length)
      ? '<div class="pub-log">' + p.log.map(function (e) {
          return '<div class="pub-log-row' + (e.ok ? '' : ' is-fail') + '"><span>' + escapeHtml(fmtShort(e.at)) + '</span>' +
            '<span>' + (e.ok ? '✓' : '×') + ' ' + escapeHtml(e.chat || '') +
            (e.text_no ? ' · №' + e.text_no : '') + (e.ok ? '' : ' — ' + escapeHtml(e.error || 'ошибка')) + '</span></div>';
        }).join('') + '</div>' : '';
    return '<div class="pub ' + (p.active ? '' : 'is-off') + '">' +
      '<div class="pub-top"><span class="sdot ' + (p.active ? 'ok' : '') + '" aria-hidden="true"></span>' +
        '<span class="pub-from">' + escapeHtml(p.from) + '</span>' +
        '<span class="pub-state">' + (p.active ? 'работает' : 'выключено') + '</span></div>' +
      '<div class="pub-what">' + escapeHtml(p.what) + '</div>' +
      (pills ? '<div class="pub-to">' + pills + '</div>' : '') +
      (p.note ? '<div class="pub-note">' + escapeHtml(p.note) + '</div>' : '') +
      sentLine + next + log +
    '</div>';
  }).join('');
  return '<section class="sblock">' +
    '<button class="sblock-head" type="button" id="pubHead" aria-expanded="' + (SRC_UI.pubClosed ? 'false' : 'true') + '">' +
      '<span>Публикуем: с какого номера и куда</span>' +
      '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
    '</button>' + (SRC_UI.pubClosed ? '' : '<div class="sblock-body">' + rows + '</div>') +
  '</section>';
}

function srcPendingHtml(pending) {
  if (!pending.length) return '';
  return '<div class="section-title">Предложения пользователей (' + pending.length + ')</div><div class="card">' +
    pending.map(function (s) {
      return '<div class="srow"><div class="srow-main srow-static"><span class="srow-text">' +
        '<span class="srow-title">' + escapeHtml(srcName(s)) + '</span>' +
        '<span class="srow-sub">' + escapeHtml(s.link || '') + (s.submitted_by_username ? ' · от @' + escapeHtml(s.submitted_by_username) : '') + '</span></span>' +
        '<span class="srow-btns">' +
          '<button class="icon-btn btn-approve" type="button" aria-label="Одобрить" data-src-approve="' + escapeHtml(s.id) + '">✓</button>' +
          '<button class="icon-btn btn-reject" type="button" aria-label="Отклонить" data-src-reject="' + escapeHtml(s.id) + '">✕</button>' +
        '</span></div></div>';
    }).join('') + '</div>';
}

function srcViberHtml(viber) {
  if (!viber.length) return '';
  return '<section class="sblock"><button class="sblock-head" type="button" id="viberHead" aria-expanded="' + (SRC_UI.viberOpen ? 'true' : 'false') + '">' +
    '<span>Viber — без парсинга (' + viber.length + ')</span>' +
    '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
    (SRC_UI.viberOpen ? '<div class="sblock-body" id="viberBody">' + viber.map(function (s) {
      return '<div class="srow"><div class="srow-main srow-static"><span class="srow-text"><span class="srow-title">' + escapeHtml(srcName(s)) +
        '</span><span class="srow-sub">' + escapeHtml(s.city || 'Viber') + ' · ' + (s.miniappCount || 0) + ' в ленте</span></span>' +
        '<button class="icon-btn btn-reject" type="button" aria-label="Убрать" data-src-remove="' + escapeHtml(s.id) + '">✕</button></div></div>';
    }).join('') + '</div>' : '') + '</section>';
}

function srcAddHtml() {
  return '<button class="btn-soft btn-wide" type="button" id="srcAddToggle" aria-expanded="' + (SRC_UI.addOpen ? 'true' : 'false') + '">' +
      (SRC_UI.addOpen ? 'Закрыть форму' : '+ Добавить канал для парсинга') + '</button>' +
    (SRC_UI.addOpen
      ? '<div class="card sadd">' +
        '<div class="field"><label>Ссылка или username</label>' +
          '<input type="text" id="srcNewLink" placeholder="t.me/nazvanie_kanala или nazvanie_kanala" autocomplete="off" autocapitalize="off">' +
          '<div class="field-hint" id="srcDupHint" hidden></div></div>' +
        '<div class="field"><label>Платформа</label><div class="chip-group">' +
          '<label class="chip"><input type="radio" name="srcNewPlatform" value="telegram" checked><span>Telegram</span></label>' +
          '<label class="chip"><input type="radio" name="srcNewPlatform" value="viber"><span>Viber</span></label></div></div>' +
        '<div class="field"><label>Город (если канал по одному городу)</label><input type="text" id="srcNewCity" placeholder="например, Слуцк"></div>' +
        '<button class="btn-primary" type="button" id="srcAddBtn">Добавить в парсинг</button>' +
        '<p class="sadd-note">Подхватится при ближайшем чтении (до пары часов).</p></div>'
      : '');
}

// ---------- страница ----------
function renderSources() {
  const el = document.getElementById('view');
  const pending = STATE.sources.filter(function (s) { return s.status === 'pending'; });
  const approved = STATE.sources.filter(function (s) { return s.status === 'approved'; });
  const viber = approved.filter(function (s) { return s.platform === 'viber'; });
  const tg = approved.filter(function (s) { return s.platform !== 'viber'; });
  const silentN = tg.filter(function (s) { return s.silent; }).length;
  const c = document.getElementById('pageCount');
  if (c) c.textContent = pending.length ? pending.length : '';

  el.innerHTML =
    srcStatsHtml(tg) +
    srcPubHtml() +
    '<div class="stoolbar">' +
      '<input type="search" id="srcSearch" placeholder="Найти канал" value="' + escapeHtml(SRC_UI.q) + '" autocomplete="off" aria-label="Найти канал">' +
      '<div class="seg" role="tablist">' +
        '<button type="button" class="seg-btn' + (SRC_UI.filter === 'all' ? ' active' : '') + '" data-filter="all">Все</button>' +
        '<button type="button" class="seg-btn' + (SRC_UI.filter === 'silent' ? ' active' : '') + '" data-filter="silent">Молчат' + (silentN ? ' · ' + silentN : '') + '</button>' +
      '</div>' +
    '</div>' +
    '<div class="slegend">в ленте <i>(сегодня)</i></div>' +
    '<div id="srcList">' + srcListHtml(tg) + '</div>' +
    srcPendingHtml(pending) +
    srcViberHtml(viber) +
    '<div class="sadd-wrap">' + srcAddHtml() + '</div>';

  bindSources(tg);
}

function bindSources(tg) {
  const el = document.getElementById('view');

  function rerenderList() {
    document.getElementById('srcList').innerHTML = srcListHtml(tg);
    el.querySelectorAll('.seg-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-filter') === SRC_UI.filter); });
  }

  document.getElementById('srcSearch').addEventListener('input', function () { SRC_UI.q = this.value; rerenderList(); });
  el.querySelectorAll('.seg-btn').forEach(function (b) {
    b.addEventListener('click', function () { SRC_UI.filter = b.getAttribute('data-filter'); haptic('light'); rerenderList(); });
  });

  // делегирование внутри списка (он перерисовывается целиком)
  document.getElementById('srcList').addEventListener('click', async function (e) {
    const head = e.target.closest('.sgroup-head');
    if (head) {
      const key = head.parentNode.getAttribute('data-group');
      SRC_UI.closed[key] = !SRC_UI.closed[key]; srcSaveUi(); haptic('light'); rerenderList(); return;
    }
    const more = e.target.closest('[data-more]');
    if (more) { SRC_UI.all[more.getAttribute('data-more')] = true; srcSaveUi(); rerenderList(); return; }
    const less = e.target.closest('[data-less]');
    if (less) { SRC_UI.all[less.getAttribute('data-less')] = false; srcSaveUi(); rerenderList(); return; }
    const rm = e.target.closest('[data-src-remove]');
    if (rm) { await removeSource(rm); return; }
    const main = e.target.closest('.srow-main');
    if (main && !main.classList.contains('srow-static')) {
      const detail = main.parentNode.querySelector('.srow-more');
      const open = detail.hidden;
      detail.hidden = !open;
      main.setAttribute('aria-expanded', open ? 'true' : 'false');
      main.parentNode.classList.toggle('is-open', open);
      haptic('light');
    }
  });

  const pubHead = document.getElementById('pubHead');
  if (pubHead) pubHead.addEventListener('click', function () { SRC_UI.pubClosed = !SRC_UI.pubClosed; srcSaveUi(); renderSources(); });
  const viberHead = document.getElementById('viberHead');
  if (viberHead) viberHead.addEventListener('click', function () { SRC_UI.viberOpen = !SRC_UI.viberOpen; renderSources(); });

  document.getElementById('srcAddToggle').addEventListener('click', function () { SRC_UI.addOpen = !SRC_UI.addOpen; renderSources(); });

  const linkInput = document.getElementById('srcNewLink');
  if (linkInput) {
    const dupHint = document.getElementById('srcDupHint');
    linkInput.addEventListener('input', function () {
      const dup = findDuplicateSource(linkInput.value);
      if (dup) {
        dupHint.hidden = false;
        dupHint.textContent = 'Уже есть в списке: ' + (dup.title || dup.link || ('@' + dup.username)) +
          (dup.status === 'pending' ? ' (ждёт одобрения)' : '');
      } else {
        dupHint.hidden = true;
      }
    });
    document.getElementById('srcAddBtn').addEventListener('click', async function () {
      const btn = this;
      const link = linkInput.value.trim();
      const city = document.getElementById('srcNewCity').value.trim();
      const platform = document.querySelector('input[name="srcNewPlatform"]:checked').value;
      if (!link) { await alertAsync('Укажите ссылку'); return; }
      if (findDuplicateSource(link)) {
        haptic('warning');
        await alertAsync('Такой источник уже есть в списке — не добавляю повторно.');
        return;
      }
      btn.disabled = true;
      const res = await apiPost({ action: 'add_source', link: link, platform: platform, city: city });
      btn.disabled = false;
      if (!res.ok) { haptic('error'); await alertAsync('Не получилось: ' + (res.error || '')); return; }
      if (res.duplicate) {
        haptic('warning');
        await alertAsync('Такой источник уже есть — не добавлено повторно.');
        loadSources();
        return;
      }
      haptic('success');
      SRC_UI.addOpen = false;
      loadSources();
    });
  }

  el.querySelectorAll('[data-src-approve]').forEach(function (btn) {
    btn.addEventListener('click', function () { handleSourceAction(btn, 'approve_source', btn.getAttribute('data-src-approve')); });
  });
  el.querySelectorAll('[data-src-reject]').forEach(function (btn) {
    btn.addEventListener('click', function () { handleSourceAction(btn, 'reject_source', btn.getAttribute('data-src-reject')); });
  });
  // убрать Viber-источник (в списке Telegram-каналов «Убрать» обрабатывает делегирование выше)
  el.querySelectorAll('#viberBody [data-src-remove]').forEach(function (btn) {
    btn.addEventListener('click', function () { removeSource(btn); });
  });
}

async function removeSource(btn) {
  const id = btn.getAttribute('data-src-remove');
  const s = (STATE.sources || []).find(function (x) { return String(x.id) === String(id); });
  const ok = await confirmAsync('Убрать «' + (s ? srcName(s) : 'источник') + '» из парсинга?');
  if (!ok) return;
  handleSourceAction(btn, 'remove_source', id);
}

async function handleSourceAction(btn, action, id) {
  btn.disabled = true;
  const res = await apiPost({ action: action, id: id });
  if (!res.ok) {
    haptic('error');
    await alertAsync('Не получилось: ' + (res.error || ''));
    btn.disabled = false;
    return;
  }
  haptic('success');
  loadSources();
}
