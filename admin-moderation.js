// ============================================================
// Будни_BY admin — вкладка «Модерация»: подозрительные вакансии,
// одобрить (в очередь публикации) / отклонить.
// Глобалы: STATE, apiPost (admin.js), haptic, escapeHtml, confirmAsync, alertAsync.
// ============================================================

function renderModeration() {
  const el = document.getElementById('viewModeration');
  if (STATE.suspicious.length === 0) {
    el.innerHTML = '<div class="empty">Нет вакансий на проверке 👍</div>';
    return;
  }
  el.innerHTML = STATE.suspicious.map(function (v, i) {
    const meta = [v.city, v.salary_text].filter(Boolean).join(' · ');
    return '<div class="card" data-idx="' + i + '">' +
      '<div class="card-top">' +
        '<div class="card-position">' + escapeHtml(v.position || '(без должности)') + '</div>' +
        '<div class="card-sector">' + escapeHtml(v.sector) + '</div>' +
      '</div>' +
      (meta ? '<div class="card-meta">' + escapeHtml(meta) + '</div>' : '') +
      '<div class="card-reason">⚠️ ' + escapeHtml(v.suspicious_reason || 'без причины') + '</div>' +
      '<button class="card-toggle" data-toggle="' + i + '">Показать полный текст ▾</button>' +
      '<div class="card-text" id="text-' + i + '">' + escapeHtml(v.clean_text || '') + '</div>' +
      '<div class="card-actions">' +
        '<button class="btn btn-approve" data-approve="' + i + '">✓ Одобрить</button>' +
        '<button class="btn btn-reject" data-reject="' + i + '">✕ Отклонить</button>' +
      '</div>' +
    '</div>';
  }).join('');

  el.querySelectorAll('[data-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const idx = btn.getAttribute('data-toggle');
      document.getElementById('text-' + idx).classList.toggle('open');
      haptic('light');
    });
  });
  el.querySelectorAll('[data-approve]').forEach(function (btn) {
    btn.addEventListener('click', function () { handleDecision(btn, 'approve'); });
  });
  el.querySelectorAll('[data-reject]').forEach(function (btn) {
    btn.addEventListener('click', function () { handleDecision(btn, 'reject'); });
  });
}

async function handleDecision(btn, kind) {
  const idx = parseInt(btn.getAttribute('data-approve') || btn.getAttribute('data-reject'), 10);
  const item = STATE.suspicious[idx];
  if (!item) return;

  const question = kind === 'approve'
    ? 'Одобрить и поставить в очередь публикации?'
    : 'Отклонить эту вакансию?';
  const ok = await confirmAsync(question);
  if (!ok) return;

  const card = btn.closest('.card');
  card.querySelectorAll('.btn').forEach(function (b) { b.setAttribute('disabled', 'true'); });
  btn.innerHTML = '<span class="spinner"></span>';

  const action = kind === 'approve' ? 'approve_vacancy' : 'reject_vacancy';
  const res = await apiPost({ action: action, id: item.id, sector: item.sector });

  if (res.ok) {
    haptic('success');
    STATE.suspicious.splice(idx, 1);
    renderModeration();
    document.getElementById('modCount').textContent = STATE.suspicious.length;
  } else {
    haptic('error');
    await alertAsync('Не получилось: ' + (res.error || 'неизвестная ошибка'));
    card.querySelectorAll('.btn').forEach(function (b) { b.removeAttribute('disabled'); });
    renderModeration();
  }
}
