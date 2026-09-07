// ============================================================
// Будни_BY client — вкладка «Разместить»: подача вакансии работодателем,
// список «Мои вакансии» (снять с публикации / опубликовать снова),
// автоподстановка имени/телефона из листа КОНТАКТЫ, продление по ссылке.
// Глобалы из app.js: apiPost (client.html), haptic, escapeHtml, alertAsync,
//   confirmAsync, telegramUser, SECTORS, bindPhoneMask, formatPhoneTail.
// Экспортирует: initPost, loadMyVacancies, prefillFromContact, handleRenewParam.
// ============================================================

var postSelectedSector = '';
var postPhoneInput = null;

function initPost() {
  postPhoneInput = document.getElementById('fPhone');

  const el = document.getElementById('fSector');
  el.innerHTML = SECTORS.map(function (s, i) {
    return '<label class="chip"><input type="radio" name="sector" value="' + s[0] + '"' + (i === 0 ? ' checked' : '') + '>' +
      '<span>' + s[1] + ' ' + s[0] + '</span></label>';
  }).join('');
  postSelectedSector = SECTORS[0][0];
  el.querySelectorAll('input').forEach(function (inp) {
    inp.addEventListener('change', function () { postSelectedSector = inp.value; haptic('light'); });
  });

  bindPhoneMask(postPhoneInput);

  document.getElementById('postSubmitBtn').addEventListener('click', submitVacancy);
}

async function submitVacancy() {
  const btn = document.getElementById('postSubmitBtn');
  const position = document.getElementById('fPosition').value.trim();
  const phoneDigits = postPhoneInput.value.replace(/\D/g, '');
  if (!position) { await alertAsync('Укажите должность'); return; }
  if (phoneDigits.length !== 9) { await alertAsync('Проверьте номер телефона'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Отправляем…';
  haptic('light');

  const res = await apiPost({
    action: 'submit_vacancy',
    telegramId: telegramUser.id, username: telegramUser.username || '',
    name: document.getElementById('fName').value.trim(),
    position: position, company: document.getElementById('fCompany').value.trim(),
    sector: postSelectedSector, city: document.getElementById('fCity').value.trim(),
    salaryText: document.getElementById('fSalary').value.trim(),
    phone: '+375' + phoneDigits,
    repostTime: document.getElementById('fRepostTime').value || '09:00',
    description: document.getElementById('fDescription').value.trim(),
  }).catch(function () { return { ok: false }; });

  if (!res.ok) {
    haptic('error');
    btn.disabled = false; btn.innerHTML = 'Разместить вакансию';
    await alertAsync(res.duplicate ? res.error : 'Не получилось отправить, попробуйте ещё раз');
    return;
  }

  haptic('success');
  document.getElementById('postSubmitBar').classList.add('hidden');
  document.getElementById('viewPost').innerHTML =
    '<div class="success-panel">' +
      '<div class="success-icon">✓</div>' +
      '<h2>Вакансия отправлена</h2>' +
      '<p>' + (res.suspicious
        ? 'Уйдёт в публикацию после ручной проверки — обычно это быстро.'
        : 'Уже в общей ленте и будет публиковаться в топике группы каждый день в выбранное время — 7 дней.') + '</p>' +
    '</div>';
}

// ================= МОИ ВАКАНСИИ =================
var MYVAC_STATUS = {
  active:   ['Активна', 'ok'],
  review:   ['На проверке', ''],
  expired:  ['Истекла', ''],
  closed:   ['Снята', ''],
  rejected: ['Отклонена', 'danger'],
};

async function loadMyVacancies() {
  const wrap = document.getElementById('myVacWrap');
  const list = document.getElementById('myVacList');
  let res;
  try { res = await apiPost({ action: 'my_vacancies' }); }
  catch (e) { res = { ok: false }; }
  const items = (res && res.ok && res.vacancies) ? res.vacancies : [];
  if (items.length === 0) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');

  list.innerHTML = items.map(function (v) {
    const st = MYVAC_STATUS[v.status] || MYVAC_STATUS.active;
    const meta = [v.company, v.city, v.salary_text].filter(Boolean).join(' · ');
    let action = '';
    if (v.status === 'active') {
      action = '<button class="myvac-btn danger" data-close="' + escapeHtml(v.id) + '">Снять с публикации</button>';
    } else if (v.status === 'expired' || v.status === 'closed') {
      action = '<button class="myvac-btn ok" data-reopen="' + escapeHtml(v.id) + '">Опубликовать снова</button>';
    }
    return '<div class="myvac-card">' +
      '<div class="myvac-top">' +
        '<div class="myvac-position">' + escapeHtml(v.position || '(без названия)') + '</div>' +
        '<span class="myvac-badge ' + st[1] + '">' + st[0] + '</span>' +
      '</div>' +
      (meta ? '<div class="myvac-meta">' + escapeHtml(meta) + '</div>' : '') +
      (v.status === 'active' && v.repost_time
        ? '<div class="myvac-meta">Публикуется каждый день в ' + escapeHtml(v.repost_time) + '</div>' : '') +
      action +
    '</div>';
  }).join('');

  list.querySelectorAll('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { changeMyVacancy(btn, 'close_vacancy', btn.getAttribute('data-close')); });
  });
  list.querySelectorAll('[data-reopen]').forEach(function (btn) {
    btn.addEventListener('click', function () { changeMyVacancy(btn, 'renew_vacancy', btn.getAttribute('data-reopen')); });
  });
}

async function changeMyVacancy(btn, action, id) {
  if (action === 'close_vacancy') {
    const ok = await confirmAsync('Снять эту вакансию с публикации? Ежедневные репосты прекратятся, из ленты она пропадёт.');
    if (!ok) return;
  }
  const label = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  const res = await apiPost({ action: action, id: id }).catch(function () { return { ok: false }; });
  if (!res.ok) {
    haptic('error');
    btn.disabled = false; btn.textContent = label;
    await alertAsync('Не получилось: ' + (res.error || 'попробуйте ещё раз'));
    return;
  }
  haptic('success');
  if (action === 'renew_vacancy') await alertAsync('Вакансия снова в ленте — будет публиковаться 7 дней ✓');
  loadMyVacancies();
}

// ---------- КОНТАКТЫ: визит + автоподстановка имени/телефона в форму подачи ----------
async function prefillFromContact() {
  if (!telegramUser || !telegramUser.id) return;
  try {
    const res = await apiPost({ action: 'visit', telegramId: telegramUser.id, username: telegramUser.username || '' });
    if (!res || !res.ok) return;
    const nameEl = document.getElementById('fName');
    let filled = false;
    if (res.name && !nameEl.value.trim()) { nameEl.value = res.name; filled = true; }
    if (res.known && res.phone && postPhoneInput && !postPhoneInput.value.trim()) {
      const tail = formatPhoneTail(res.phone);
      if (tail) { postPhoneInput.value = tail; filled = true; }
    }
    if (filled) document.getElementById('prefillHint').classList.remove('hidden');
  } catch (e) {}
}

// ---------- продление по ссылке из уведомления «истёк срок» ----------
async function handleRenewParam() {
  const params = new URLSearchParams(window.location.search);
  const renewId = params.get('renew');
  if (!renewId) return;
  const res = await apiPost({ action: 'renew_vacancy', id: renewId }).catch(function () { return { ok: false }; });
  await alertAsync(res.ok ? 'Вакансия продлена ещё на 7 дней ✓' : ('Не получилось продлить: ' + (res.error || '')));
}
