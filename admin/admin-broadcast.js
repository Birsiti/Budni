// изменено 2026-10-01 20:30
// ============================================================
// Будни_BY admin — страница «Рассылка» (admin-broadcast.html): посты о вакансиях в чужие группы
// от аккаунта-парсера. Сфера — по кругу, текст собирается из живых чисел базы (api/broadcast.py),
// отправляет парсер (parser/broadcaster.py) раз в минуту по этим настройкам.
// Глобалы: STATE, apiPost, haptic, escapeHtml, alertAsync, confirmAsync.
// ============================================================

var BC_STATUS = {
  ok: ['отправлено', ''],
  no_access: ['нет прав писать', 'badge-viber'],
  slowmode: ['медленный режим', ''],
  error: ['ошибка', 'badge-viber'],
};

async function loadBroadcast() {
  const el = document.getElementById('view');
  if (!STATE.bc) el.innerHTML = '<div class="empty">Загрузка…</div>';
  const res = await apiPost({ action: 'broadcast_get' });
  if (!res.ok) { el.innerHTML = '<div class="empty">Не получилось загрузить: ' + escapeHtml(res.error || '') + '</div>'; return; }
  STATE.bc = res;
  renderBroadcast();
}

// «сегодня 14:20» / «вчера 09:05» / «28.09 18:40»
function bcWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Minsk' });
  const ymd = function (x) { return minskYMD(x).join('-'); };
  const day = ymd(d), today = ymd(new Date()), yest = ymd(new Date(Date.now() - 864e5));
  if (day === today) return 'сегодня ' + hm;
  if (day === yest) return 'вчера ' + hm;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Minsk' }) + ' ' + hm;
}

function bcSeg(key, options, cur, unit) {
  return '<div class="seg" data-bc-seg="' + key + '">' + options.map(function (v) {
    return '<button type="button" data-v="' + v + '" class="' + (Number(cur) === v ? 'is-on' : '') + '">' +
      v + (unit ? ' ' + unit : '') + '</button>';
  }).join('') + '</div>';
}

function bcStatusLine(b) {
  const c = b.cfg;
  const parts = [];
  if (b.parserAge == null || b.parserAge > 300) {
    return { warn: true, text: 'Парсер не отвечает — рассылка не уйдёт, пока он не заработает.' };
  }
  if (b.pauseUntil && new Date(b.pauseUntil) > new Date()) {
    return { warn: true, text: 'Telegram попросил паузу — продолжу после ' + bcWhen(b.pauseUntil) + '.' };
  }
  if (!c.active) return { warn: false, text: 'Выключена. Включите, когда добавите группы.' };
  parts.push('Сегодня ' + (b.sentToday || 0) + ' из ' + c.daily_limit);
  parts.push('с ' + c.hour_from + ':00 до ' + c.hour_to + ':00');
  if (b.lastAt) parts.push('последняя ' + bcWhen(b.lastAt));
  return { warn: false, text: parts.join(' · ') };
}

function renderBroadcast() {
  const b = STATE.bc, c = b.cfg;
  const el = document.getElementById('view');
  const groups = b.groups || [];
  const on = groups.filter(function (g) { return g.on !== false; }).length;
  const pc = document.getElementById('pageCount');
  if (pc) pc.textContent = groups.length || '';
  const st = bcStatusLine(b);

  const status =
    '<div class="status-row bc-status">' +
      '<button class="status-card' + (c.active ? '' : ' is-paused') + '" id="bcToggle" aria-label="Включить или выключить рассылку">' +
        '<span class="status-dot" aria-hidden="true"></span>' +
        '<span class="status-title">' + (c.active ? 'Рассылка включена' : 'Рассылка выключена') + '</span>' +
        '<span class="status-switch" aria-hidden="true"><i></i></span>' +
      '</button>' +
    '</div>' +
    '<div class="status-line' + (st.warn ? ' warn' : '') + '">' + escapeHtml(st.text) + '</div>';

  const rows = groups.length === 0
    ? '<div class="empty" style="padding:20px 8px;">Групп пока нет — вставьте ссылки выше</div>'
    : groups.map(function (g) {
        const sinfo = BC_STATUS[g.status] || null;
        const badges = [];
        if (g.on === false) badges.push('<span class="badge">на паузе</span>');
        if (sinfo) badges.push('<span class="badge ' + sinfo[1] + '">' + sinfo[0] + '</span>');
        if (g.last_at) badges.push('<span class="bc-when">' + escapeHtml(bcWhen(g.last_at)) + '</span>');
        else badges.push('<span class="bc-when">ещё не писали</span>');
        const err = g.error && g.status !== 'ok' ? '<div class="bc-err">' + escapeHtml(g.error) + '</div>' : '';
        const isPending = b.pending && b.pending.chat === g.chat;
        return '<div class="src-row bc-row">' +
          '<div class="src-info">' +
            (g.title ? '<div class="bc-title">' + escapeHtml(g.title) + '</div>' : '') +
            '<div class="src-link">' + escapeHtml(g.chat) + '</div>' +
            '<div class="src-meta">' + badges.join('') + '</div>' + err +
          '</div>' +
          '<div class="src-actions">' +
            '<button class="icon-btn bc-ibtn" data-bc-now="' + escapeHtml(g.chat) + '" aria-label="Отправить сейчас"' + (isPending ? ' disabled' : '') + '>' + (isPending ? '⏳' : '↗') + '</button>' +
            '<button class="icon-btn bc-ibtn" data-bc-pause="' + escapeHtml(g.chat) + '" data-on="' + (g.on === false ? '0' : '1') + '" aria-label="' + (g.on === false ? 'Возобновить' : 'Пауза') + '">' + (g.on === false ? '▶' : '⏸') + '</button>' +
            '<button class="icon-btn btn-reject" data-bc-del="' + escapeHtml(g.chat) + '" aria-label="Удалить">✕</button>' +
          '</div>' +
        '</div>';
      }).join('');

  const groupsCard =
    '<div class="section-title">Группы (' + on + ' из ' + groups.length + ' включены)</div>' +
    '<div class="card">' +
      '<div class="field"><label>Добавить: ссылки или @username, по одной на строку</label>' +
        '<textarea id="bcNew" rows="3" placeholder="@rabota_minsk&#10;https://t.me/+AbCdEf…"></textarea></div>' +
      '<button class="btn btn-approve" id="bcAdd" style="width:100%;">+ Добавить</button>' +
      '<p class="bc-note">Аккаунт должен состоять в группе или сам вступит по ссылке при первой отправке. ↗ — отправить сейчас вне расписания.</p>' +
      rows +
    '</div>';

  const settings =
    '<div class="section-title">Темп</div>' +
    '<div class="card">' +
      '<div class="bc-lbl">В одну группу — не чаще раза в</div>' + bcSeg('every_hours', [24, 48, 72, 168], c.every_hours, 'ч') +
      '<div class="bc-lbl">Между любыми двумя отправками</div>' + bcSeg('gap_min', [10, 20, 30, 60], c.gap_min, 'мин') +
      '<div class="bc-lbl">Не больше в день</div>' + bcSeg('daily_limit', [4, 8, 12, 20], c.daily_limit, '') +
      '<div class="bc-lbl">Часы (по Минску)</div>' +
      '<div class="bc-hours">' +
        '<label>с <input type="number" id="bcFrom" min="0" max="23" inputmode="numeric" value="' + c.hour_from + '"></label>' +
        '<label>до <input type="number" id="bcTo" min="1" max="24" inputmode="numeric" value="' + c.hour_to + '"></label>' +
        '<button class="qbtn ok" id="bcHoursSave">Сохранить</button>' +
      '</div>' +
      '<label class="bc-check"><input type="checkbox" id="bcTrack"' + (c.track ? ' checked' : '') + '>' +
        '<span>Ссылка с меткой — видно на пульте, сколько людей пришло из групп. Выключено — простое @Budni_BY_Bot (так реже удаляют антиспам-боты).</span></label>' +
    '</div>';

  const sectors = (b.sectors || []).map(function (s) {
    return '<span class="badge' + (s.n < 5 ? ' bc-off' : '') + '">' + s.emoji + ' ' + escapeHtml(s.sector) + ' · ' + s.n + '</span>';
  }).join('');
  const preview =
    '<div class="section-title">Текст</div>' +
    '<div class="card">' +
      '<p class="bc-note" style="margin-top:0;">Каждый раз — следующая сфера по кругу: заголовок, частые должности и города из свежих вакансий за 2 недели. Сферы, где меньше 5 вакансий, пропускаются.</p>' +
      '<div class="bc-sectors">' + sectors + '</div>' +
      '<button class="btn" id="bcPreview" style="width:100%; background:var(--surface-2); color:var(--ink);">👀 Пример поста мне в личку</button>' +
      '<div id="bcPreviewText" class="bc-preview" hidden></div>' +
    '</div>';

  const log = (b.log || []);
  const logHtml = log.length === 0 ? '<div class="empty" style="padding:20px 8px;">Пока ничего не отправляли</div>'
    : log.map(function (e) {
        return '<div class="bc-log">' +
          '<span class="bc-log-ic">' + (e.ok ? '✓' : '✕') + '</span>' +
          '<div class="bc-log-body"><div>' + escapeHtml(bcWhen(e.at)) + ' · ' + escapeHtml(e.chat || '') + (e.manual ? ' · вручную' : '') + '</div>' +
          '<div class="bc-log-sub">' + escapeHtml(e.ok ? (e.sector || '') : (e.error || '')) + '</div></div>' +
        '</div>';
      }).join('');

  el.innerHTML = status + groupsCard + preview + settings +
    '<div class="section-title">Журнал</div><div class="card">' + logHtml + '</div>';

  bindBroadcast();
}

async function bcSave(patch, btn) {
  if (btn) btn.disabled = true;
  const res = await apiPost({ action: 'broadcast_save', cfg: patch });
  if (btn) btn.disabled = false;
  if (!res.ok) { haptic('error'); await alertAsync('Не получилось: ' + (res.error || '')); return; }
  haptic('success');
  STATE.bc.cfg = res.cfg;
  renderBroadcast();
}

function bindBroadcast() {
  const el = document.getElementById('view');

  document.getElementById('bcToggle').addEventListener('click', async function () {
    const c = STATE.bc.cfg;
    if (!c.active) {
      const n = (STATE.bc.groups || []).filter(function (g) { return g.on !== false; }).length;
      if (!n) { await alertAsync('Сначала добавьте хотя бы одну группу.'); return; }
      const ok = await confirmAsync('Включить рассылку в ' + n + ' гр.? Пишет аккаунт парсера — при жалобах Telegram может ограничить номер.');
      if (!ok) return;
    }
    bcSave({ active: !c.active }, this);
  });

  document.getElementById('bcAdd').addEventListener('click', async function () {
    const val = document.getElementById('bcNew').value.trim();
    if (!val) { await alertAsync('Вставьте ссылку на группу'); return; }
    this.disabled = true;
    const res = await apiPost({ action: 'broadcast_add_groups', chats: val });
    this.disabled = false;
    if (!res.ok) { haptic('error'); await alertAsync('Не получилось: ' + (res.error || '')); return; }
    haptic(res.added.length ? 'success' : 'warning');
    if (res.bad && res.bad.length) await alertAsync('Не похоже на группу: ' + res.bad.join(', '));
    else if (!res.added.length) await alertAsync('Эти группы уже в списке.');
    loadBroadcast();
  });

  el.querySelectorAll('[data-bc-del]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const chat = btn.getAttribute('data-bc-del');
      if (!(await confirmAsync('Убрать ' + chat + ' из рассылки?'))) return;
      btn.disabled = true;
      const res = await apiPost({ action: 'broadcast_remove_group', chat: chat });
      if (!res.ok) { haptic('error'); btn.disabled = false; return; }
      haptic('success');
      loadBroadcast();
    });
  });

  el.querySelectorAll('[data-bc-pause]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      btn.disabled = true;
      const res = await apiPost({ action: 'broadcast_toggle_group', chat: btn.getAttribute('data-bc-pause'),
                                  on: btn.getAttribute('data-on') !== '1' });
      if (!res.ok) { haptic('error'); btn.disabled = false; return; }
      haptic('light');
      loadBroadcast();
    });
  });

  el.querySelectorAll('[data-bc-now]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const chat = btn.getAttribute('data-bc-now');
      if (!(await confirmAsync('Отправить пост в ' + chat + ' сейчас?'))) return;
      btn.disabled = true;
      const res = await apiPost({ action: 'broadcast_send_now', chat: chat });
      if (!res.ok) { haptic('error'); btn.disabled = false; await alertAsync('Не получилось: ' + (res.error || '')); return; }
      haptic('success');
      await alertAsync('Уйдёт в течение минуты — итог появится в журнале.');
      loadBroadcast();
      setTimeout(loadBroadcast, 75000);
    });
  });

  el.querySelectorAll('[data-bc-seg]').forEach(function (seg) {
    seg.addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b || b.classList.contains('is-on')) return;
      const patch = {};
      patch[seg.getAttribute('data-bc-seg')] = Number(b.getAttribute('data-v'));
      bcSave(patch, null);
    });
  });

  document.getElementById('bcHoursSave').addEventListener('click', function () {
    bcSave({ hour_from: Number(document.getElementById('bcFrom').value),
             hour_to: Number(document.getElementById('bcTo').value) }, this);
  });
  document.getElementById('bcTrack').addEventListener('change', function () {
    bcSave({ track: this.checked }, null);
  });

  document.getElementById('bcPreview').addEventListener('click', async function () {
    this.disabled = true;
    const res = await apiPost({ action: 'broadcast_preview' });
    this.disabled = false;
    const box = document.getElementById('bcPreviewText');
    if (res.text) {
      box.hidden = false;
      // текст поста — HTML от бэкенда (экранированный + ссылка); показываем как есть, без тегов
      const tmp = document.createElement('div');
      tmp.innerHTML = res.text;
      box.textContent = tmp.textContent;
    }
    if (!res.ok) { haptic('error'); await alertAsync('Не получилось: ' + (res.error || '')); return; }
    haptic('success');
  });
}
