// ============================================================
// Будни_BY admin — вкладка «Источники»: предложенные пользователями каналы,
// одобрить/отклонить/добавить самому/удалить. Одобренные Telegram-каналы
// подмешиваются в парсер через sheets_bridge.get_approved_channels().
// Глобалы: STATE, apiPost (admin.js), haptic, escapeHtml, alertAsync.
// ============================================================

async function loadSources() {
  const el = document.getElementById('viewSources');
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
  const el = document.getElementById('viewSources');
  const pending = STATE.sources.filter(function (s) { return s.status === 'pending'; });
  const approved = STATE.sources.filter(function (s) { return s.status === 'approved'; });
  document.getElementById('srcCount').textContent = pending.length;

  const addForm =
    '<div class="section-title">Добавить источник самому</div>' +
    '<div class="field"><label>Ссылка</label><input type="text" id="srcNewLink" placeholder="t.me/nazvanie_kanala"></div>' +
    '<div class="field"><label>Платформа</label>' +
      '<div class="chip-group">' +
        '<label class="chip"><input type="radio" name="srcNewPlatform" value="telegram" checked><span>Telegram</span></label>' +
        '<label class="chip"><input type="radio" name="srcNewPlatform" value="viber"><span>Viber</span></label>' +
      '</div>' +
    '</div>' +
    '<div class="field"><label>Город</label><input type="text" id="srcNewCity" placeholder="например, Слуцк"></div>' +
    '<button class="btn btn-approve" id="srcAddBtn" style="width:100%; margin-bottom:8px;">+ Добавить</button>';

  const pendingHtml = pending.length === 0
    ? '<div class="empty">Нет предложенных источников на рассмотрении</div>'
    : pending.map(function (s) {
        return '<div class="src-row">' +
          '<div><div class="src-link">' + escapeHtml(s.link) + '</div>' +
          '<div class="src-meta">' + platformBadge(s.platform) +
            (s.city ? '<span class="badge">' + escapeHtml(s.city) + '</span>' : '') + '</div></div>' +
          '<div class="src-actions">' +
            '<button class="icon-btn btn-approve" data-src-approve="' + escapeHtml(s.id) + '">✓</button>' +
            '<button class="icon-btn btn-reject" data-src-reject="' + escapeHtml(s.id) + '">✕</button>' +
          '</div>' +
        '</div>';
      }).join('');

  const approvedHtml = approved.length === 0
    ? '<div class="empty">Одобренных источников пока нет</div>'
    : approved.map(function (s) {
        return '<div class="src-row">' +
          '<div><div class="src-link">' + escapeHtml(s.link) + '</div>' +
          '<div class="src-meta">' + platformBadge(s.platform) +
            (s.city ? '<span class="badge">' + escapeHtml(s.city) + '</span>' : '') + '</div></div>' +
          '<div class="src-actions">' +
            '<button class="icon-btn btn-reject" data-src-remove="' + escapeHtml(s.id) + '">✕</button>' +
          '</div>' +
        '</div>';
      }).join('');

  el.innerHTML =
    '<div class="card">' + addForm + '</div>' +
    '<div class="section-title">На рассмотрении (' + pending.length + ')</div>' +
    '<div class="card">' + pendingHtml + '</div>' +
    '<div class="section-title">Одобренные — парсятся (' + approved.filter(function (s) { return s.platform !== 'viber'; }).length + ') / Viber без парсинга (' + approved.filter(function (s) { return s.platform === 'viber'; }).length + ')</div>' +
    '<div class="card">' + approvedHtml + '</div>';

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
