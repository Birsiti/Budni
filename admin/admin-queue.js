// изменено 2026-09-09 22:55
// ============================================================
// Будни_BY admin — страница «Очередь» (admin-queue.html): что вот-вот
// опубликуется. Убрать / вверх / опубликовать сейчас / сменить сферу /
// поправить текст / забанить канал-источник. Сверху — блок «На проверке»
// (подозрительные вакансии: одобрить / убрать). Рендерит в #view.
// Глобалы: STATE, apiPost, escapeHtml, haptic, confirmAsync, alertAsync, SECTORS.
// ============================================================

async function loadQueue() {
  const el = document.getElementById('view');
  el.innerHTML = '<div class="empty">Загрузка…</div>';
  const res = await apiPost({ action: 'get_queue', limit: 80 });
  if (!res.ok) { el.innerHTML = '<div class="empty">Не получилось: ' + escapeHtml(res.error || '') + '</div>'; return; }
  STATE.queue = res.queue || [];
  STATE.review = res.review || [];
  STATE.queueSectors = res.sectors || SECTORS.map(function (s) { return s[0]; });
  renderQueue();
}

function renderReview() {
  const s = STATE.review || [];
  if (!s.length) return '';
  return '<div class="review-box">' +
    '<div class="section-title" style="margin-top:0">⚠ На проверке <span class="count">' + s.length + '</span></div>' +
    '<p class="rate-note" style="margin:0 0 10px;">Помечены как возможный скам — в группу не уходят, пока не решишь.</p>' +
    s.map(function (v, i) {
      const meta = [v.city, v.channel].filter(Boolean).join(' · ');
      return '<div class="qcard">' +
        '<div class="qpos">' + escapeHtml(v.position || '(без должности)') + '</div>' +
        (meta ? '<div class="qmeta">' + escapeHtml(meta) + '</div>' : '') +
        (v.suspicious_reason ? '<div class="card-reason">' + escapeHtml(v.suspicious_reason) + '</div>' : '') +
        '<button class="qtoggle" data-rv-toggle="' + i + '">текст объявления ▾</button>' +
        '<div class="qdetail" id="rvd-' + i + '"><pre class="rv-text">' + escapeHtml(v.clean_text || '—') + '</pre></div>' +
        '<div class="qactions">' +
          '<button class="qbtn ok" data-rv-ok="' + i + '">✓ Одобрить</button>' +
          '<button class="qbtn danger" data-rv-no="' + i + '">✕ Убрать</button>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

function renderQueue() {
  const el = document.getElementById('view');
  const q = STATE.queue;
  const c = document.getElementById('pageCount');
  if (c) c.textContent = q.length;

  const queueHtml = q.length === 0
    ? '<div class="empty">Очередь пуста</div>'
    : ('<p class="rate-note" style="margin:0 0 12px;">Порядок сверху вниз — так и публикуется (по кругу из разных сфер). Первые ' + q.length + '.</p>' +
    q.map(function (v, i) {
      if (v.missing) {
        return '<div class="qcard"><div class="qtop"><div class="qpos">— вакансия удалена из базы —</div>' +
          '<button class="icon-btn btn-reject" data-q-remove="' + escapeHtml(v.id) + '">✕</button></div>' +
          '<div class="qmeta">' + escapeHtml(v.sector) + '</div></div>';
      }
      const meta = [v.company, v.city, v.salary_text].filter(Boolean).join(' · ');
      return '<div class="qcard" data-i="' + i + '">' +
        '<div class="qtop">' +
          '<div><div class="qpos">' + (i + 1) + '. ' + escapeHtml(v.position || '(без должности)') + '</div>' +
          (meta ? '<div class="qmeta">' + escapeHtml(meta) + '</div>' : '') + '</div>' +
          (v.suspicious ? '<span class="badge badge-viber">⚠️</span>' : '') +
        '</div>' +
        '<div class="qmeta2">' +
          '<span class="badge">' + escapeHtml(v.sector) + '</span>' +
          (v.channel ? '<span class="badge">' + escapeHtml(v.channel) + '</span>' : '') +
          (v.source === 'employer' ? '<span class="badge badge-employer">прямая</span>' : '') +
        '</div>' +
        '<button class="qtoggle" data-q-toggle="' + i + '">текст / сфера ▾</button>' +
        '<div class="qdetail" id="qd-' + i + '">' +
          '<textarea class="qtext" id="qt-' + i + '">' + escapeHtml(v.clean_text || '') + '</textarea>' +
          '<div class="qrow">' +
            '<select class="qsel" id="qs-' + i + '">' +
              STATE.queueSectors.map(function (s) {
                return '<option' + (s === v.sector ? ' selected' : '') + '>' + escapeHtml(s) + '</option>';
              }).join('') +
            '</select>' +
            '<button class="qbtn" data-q-save="' + i + '">Сохранить</button>' +
          '</div>' +
          (v.channel ? '<button class="qbtn danger" data-q-ban="' + escapeHtml(v.channel) + '">Забанить канал ' + escapeHtml(v.channel) + '</button>' : '') +
        '</div>' +
        '<div class="qactions">' +
          '<button class="qbtn" data-q-bump="' + escapeHtml(v.id) + '">▲ вверх</button>' +
          '<button class="qbtn ok" data-q-now="' + i + '">➤ сейчас</button>' +
          '<button class="qbtn danger" data-q-remove="' + escapeHtml(v.id) + '">✕ убрать</button>' +
        '</div>' +
      '</div>';
    }).join(''));

  el.innerHTML = renderReview() + queueHtml;
  bindQueue(el);
  bindReview(el);
}

function bindReview(el) {
  el.querySelectorAll('[data-rv-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.getElementById('rvd-' + b.getAttribute('data-rv-toggle')).classList.toggle('open');
      haptic('light');
    });
  });
  el.querySelectorAll('[data-rv-ok]').forEach(function (b) {
    b.addEventListener('click', async function () {
      const v = STATE.review[+b.getAttribute('data-rv-ok')];
      if (!v) return;
      if (!(await confirmAsync('Одобрить «' + (v.position || '') + '»? Уйдёт в очередь на публикацию.'))) return;
      qAction(b, { action: 'approve_vacancy', id: v.id, sector: v.sector });
    });
  });
  el.querySelectorAll('[data-rv-no]').forEach(function (b) {
    b.addEventListener('click', async function () {
      const v = STATE.review[+b.getAttribute('data-rv-no')];
      if (!v) return;
      if (!(await confirmAsync('Убрать «' + (v.position || '') + '»? Не будет опубликовано.'))) return;
      qAction(b, { action: 'reject_vacancy', id: v.id, sector: v.sector });
    });
  });
}

function bindQueue(el) {
  el.querySelectorAll('[data-q-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.getElementById('qd-' + b.getAttribute('data-q-toggle')).classList.toggle('open');
      haptic('light');
    });
  });
  el.querySelectorAll('[data-q-remove]').forEach(function (b) {
    b.addEventListener('click', function () { qAction(b, { action: 'queue_remove', id: b.getAttribute('data-q-remove') }); });
  });
  el.querySelectorAll('[data-q-bump]').forEach(function (b) {
    b.addEventListener('click', function () { qAction(b, { action: 'queue_bump', id: b.getAttribute('data-q-bump') }); });
  });
  el.querySelectorAll('[data-q-now]').forEach(function (b) {
    b.addEventListener('click', async function () {
      const v = STATE.queue[+b.getAttribute('data-q-now')];
      if (!v) return;
      if (!(await confirmAsync('Опубликовать «' + (v.position || '') + '» в группу сейчас?'))) return;
      qAction(b, { action: 'queue_publish_now', id: v.id, sector: v.sector });
    });
  });
  el.querySelectorAll('[data-q-save]').forEach(function (b) {
    b.addEventListener('click', async function () {
      const i = +b.getAttribute('data-q-save');
      const v = STATE.queue[i];
      if (!v) return;
      const newText = document.getElementById('qt-' + i).value;
      const newSector = document.getElementById('qs-' + i).value;
      b.disabled = true; b.textContent = '…';
      let ok = true;
      if (newText !== (v.clean_text || '')) {
        const r = await apiPost({ action: 'queue_edit_text', id: v.id, sector: v.sector, text: newText });
        ok = ok && r.ok;
      }
      if (newSector !== v.sector) {
        const r = await apiPost({ action: 'queue_set_sector', id: v.id, fromSector: v.sector, toSector: newSector });
        ok = ok && r.ok;
      }
      if (ok) { haptic('success'); loadQueue(); }
      else { haptic('error'); b.disabled = false; b.textContent = 'Сохранить'; await alertAsync('Не всё сохранилось'); }
    });
  });
  el.querySelectorAll('[data-q-ban]').forEach(function (b) {
    b.addEventListener('click', async function () {
      const ch = b.getAttribute('data-q-ban');
      if (!(await confirmAsync('Забанить канал ' + ch + '? Он снимется с парсинга, все его вакансии уйдут из очереди.'))) return;
      b.disabled = true;
      const r = await apiPost({ action: 'ban_source', channel: ch });
      if (r.ok) { haptic('success'); await alertAsync('Готово: из очереди убрано ' + (r.removed || 0)); loadQueue(); }
      else { haptic('error'); b.disabled = false; await alertAsync('Не получилось: ' + (r.error || '')); }
    });
  });
}

async function qAction(btn, payload) {
  btn.disabled = true;
  const res = await apiPost(payload);
  if (res.ok) { haptic('success'); loadQueue(); }
  else { haptic('error'); btn.disabled = false; await alertAsync('Не получилось: ' + (res.error || '')); }
}
