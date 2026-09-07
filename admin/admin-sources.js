// изменено 2026-09-07 11:03
// ============================================================
// Будни_BY admin — страница «Источники» (admin-sources.html): предложенные
// каналы, одобрить/отклонить/добавить/удалить. Рендерит в #view.
// Глобалы: STATE, apiPost, haptic, escapeHtml, alertAsync.
// ============================================================

async function loadSources() {
  const el = document.getElementById('view');
  el.innerHTML = '<div class="empty">Загрузка…</div>';
  const res = await apiPost({ action: 'list_sources' });
  if (!res.ok) { el.innerHTML = '<div class="empty">Не получилось загрузить</div>'; return; }
  STATE.sources = res.sources || [];
  renderSources();
}

function platformBadge(platform) {
  return platform === 'viber'
    ? '<span class="badge badge-viber">Viber — без парсинга</span>'
    : '<span class="badge">Telegram</span>';
}

function renderSources() {
  const el = document.getElementById('view');
  const pending = STATE.sources.filter(function (s) { return s.status === 'pending'; });
  const approved = STATE.sources.filter(function (s) { return s.status === 'approved'; });
  const c = document.getElementById('pageCount');
  if (c) c.textContent = pending.length;

  const tgApproved = approved.filter(function (s) { return s.platform !== 'viber'; });
  const viberApproved = approved.filter(function (s) { return s.platform === 'viber'; });

  const addForm =
    '<div class="section-title" style="margin-top:0;">Добавить канал для парсинга</div>' +
    '<div class="field"><label>Ссылка или username</label><input type="text" id="srcNewLink" placeholder="t.me/nazvanie_kanala или nazvanie_kanala"></div>' +
    '<div class="field"><label>Платформа</label>' +
      '<div class="chip-group">' +
        '<label class="chip"><input type="radio" name="srcNewPlatform" value="telegram" checked><span>Telegram</span></label>' +
        '<label class="chip"><input type="radio" name="srcNewPlatform" value="viber"><span>Viber</span></label>' +
      '</div>' +
    '</div>' +
    '<div class="field"><label>Город (если канал по одному городу)</label><input type="text" id="srcNewCity" placeholder="например, Слуцк"></div>' +
    '<button class="btn btn-approve" id="srcAddBtn" style="width:100%; margin-bottom:4px;">+ Добавить в парсинг</button>' +
    '<p style="color:var(--ink-faint); font-size:12px; margin:4px 0 0;">Подхватится парсером при следующем запуске.</p>';

  function srcRow(s, actions) {
    const warn = s.platform === 'telegram' && !s.parsed_username
      ? '<span class="badge badge-viber">ссылка не распознана</span>' : '';
    const uname = s.parsed_username ? '<span class="src-uname">→ @' + escapeHtml(s.parsed_username) + '</span>' : '';
    return '<div class="src-row">' +
      '<div class="src-info"><div class="src-link">' + escapeHtml(s.link) + '</div>' +
      '<div class="src-meta">' + platformBadge(s.platform) +
        (s.city ? '<span class="badge">' + escapeHtml(s.city) + '</span>' : '') + warn + uname + '</div></div>' +
      '<div class="src-actions">' + actions + '</div>' +
    '</div>';
  }

  const pendingHtml = pending.length === 0
    ? '<div class="empty">Нет предложений от пользователей</div>'
    : pending.map(function (s) {
        return srcRow(s,
          '<button class="icon-btn btn-approve" data-src-approve="' + escapeHtml(s.id) + '">✓</button>' +
          '<button class="icon-btn btn-reject" data-src-reject="' + escapeHtml(s.id) + '">✕</button>');
      }).join('');

  const parsedHtml = tgApproved.length === 0
    ? '<div class="empty">Пока ни одного канала — добавьте выше или запустите seedSourceChannels()</div>'
    : tgApproved.map(function (s) {
        return srcRow(s, '<button class="icon-btn btn-reject" data-src-remove="' + escapeHtml(s.id) + '">✕</button>');
      }).join('');

  const viberHtml = viberApproved.length === 0
    ? ''
    : '<div class="section-title">Viber — без парсинга (' + viberApproved.length + ')</div><div class="card">' +
      viberApproved.map(function (s) {
        return srcRow(s, '<button class="icon-btn btn-reject" data-src-remove="' + escapeHtml(s.id) + '">✕</button>');
      }).join('') + '</div>';

  el.innerHTML =
    '<div class="card">' + addForm + '</div>' +
    '<div class="section-title">Парсятся сейчас (' + tgApproved.length + ')</div>' +
    '<div class="card">' + parsedHtml + '</div>' +
    '<div class="section-title">Предложения пользователей (' + pending.length + ')</div>' +
    '<div class="card">' + pendingHtml + '</div>' +
    viberHtml;

  document.getElementById('srcAddBtn').addEventListener('click', async function () {
    const btn = this;
    const link = document.getElementById('srcNewLink').value.trim();
    const city = document.getElementById('srcNewCity').value.trim();
    const platform = document.querySelector('input[name="srcNewPlatform"]:checked').value;
    if (!link) { await alertAsync('Укажите ссылку'); return; }
    btn.disabled = true;
    const res = await apiPost({ action: 'add_source', link: link, platform: platform, city: city });
    btn.disabled = false;
    if (!res.ok) { haptic('error'); await alertAsync('Не получилось: ' + (res.error || '')); return; }
    haptic('success');
    loadSources();
  });

  el.querySelectorAll('[data-src-approve]').forEach(function (btn) {
    btn.addEventListener('click', function () { handleSourceAction(btn, 'approve_source', btn.getAttribute('data-src-approve')); });
  });
  el.querySelectorAll('[data-src-reject]').forEach(function (btn) {
    btn.addEventListener('click', function () { handleSourceAction(btn, 'reject_source', btn.getAttribute('data-src-reject')); });
  });
  el.querySelectorAll('[data-src-remove]').forEach(function (btn) {
    btn.addEventListener('click', function () { handleSourceAction(btn, 'remove_source', btn.getAttribute('data-src-remove')); });
  });
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
