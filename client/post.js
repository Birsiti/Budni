// изменено 2026-09-19 15:10
// ============================================================
// Будни_BY client — вкладка «Разместить»: подача вакансии работодателем,
// список «Мои вакансии» (снять с публикации / опубликовать снова),
// автоподстановка имени/телефона из листа КОНТАКТЫ, продление по ссылке.
// Глобалы из app.js: apiPost (client.html), haptic, escapeHtml, alertAsync,
//   confirmAsync, telegramUser, SECTORS, bindPhoneMask, formatPhoneTail.
// Глобалы из deck.js: BY_CITIES, BY_POSITIONS, bindSuggest.
// Экспортирует: initPost, loadMyVacancies, prefillFromContact, handleRenewParam.
// ============================================================

var postSelectedSector = '';
var postPhoneInput = null;
var SECTOR_EMOJI_MAP = {};
SECTORS.forEach(function (s) { SECTOR_EMOJI_MAP[s[0]] = s[1]; });

function initPost() {
  postPhoneInput = document.getElementById('fPhone');

  const el = document.getElementById('fSector');
  el.innerHTML = SECTORS.map(function (s, i) {
    return '<label class="chip"><input type="radio" name="sector" value="' + s[0] + '"' + (i === 0 ? ' checked' : '') + '>' +
      '<span>' + s[1] + ' ' + s[0] + '</span></label>';
  }).join('');
  postSelectedSector = SECTORS[0][0];
  el.querySelectorAll('input').forEach(function (inp) {
    inp.addEventListener('change', function () { postSelectedSector = inp.value; haptic('light'); renderPostPreview(); });
  });

  bindPhoneMask(postPhoneInput);
  bindSuggest(document.getElementById('fCity'), document.getElementById('fCitySuggest'), BY_CITIES, 'prefix');
  bindSuggest(document.getElementById('fPosition'), document.getElementById('fPositionSuggest'), BY_POSITIONS, 'contains');

  // предпросмотр — обновляется по вводу в любом поле, влияющем на текст поста
  ['fPosition', 'fCity', 'fSalary', 'fCompany', 'fDescription', 'fPhone'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', renderPostPreview);
  });
  renderPostPreview();

  // автосфера по должности — только подсказка, выбор всегда можно поменять
  // руками (клик по другой плитке ничем не ограничен). Срабатывает и по
  // мере набора текста (точное совпадение), и после выбора из подсказки
  // (клик по пункту не поднимает 'input' — ловим на blur).
  const posInput = document.getElementById('fPosition');
  posInput.addEventListener('input', function () { applyAutoSector(posInput.value); });
  posInput.addEventListener('blur', function () { applyAutoSector(posInput.value); });

  document.getElementById('postSubmitBtn').addEventListener('click', submitVacancy);
}

// точное совпадение (без учёта регистра) по POS_SECTOR (deck.js) — переключает
// плитку сферы программно, если должность узнана. Молча ничего не делает,
// если совпадения нет (не гадаем на неизвестных формулировках).
function applyAutoSector(positionValue) {
  const sector = POS_SECTOR[positionValue.trim().toLowerCase()];
  if (!sector || sector === postSelectedSector) return;
  const radio = document.querySelector('#fSector input[value="' + CSS.escape(sector) + '"]');
  if (!radio) return;
  radio.checked = true;
  postSelectedSector = sector;
  renderPostPreview();
}

// та же структура текста, что build_clean_text() на бэкенде (api/format.py) —
// держать в паре при правках формата поста, иначе предпросмотр разойдётся
// с тем, что реально уйдёт в группу
function renderPostPreview() {
  const box = document.getElementById('postPreview');
  const position = document.getElementById('fPosition').value.trim();
  const city = document.getElementById('fCity').value.trim();
  const salary = document.getElementById('fSalary').value.trim();
  const company = document.getElementById('fCompany').value.trim();
  const description = document.getElementById('fDescription').value.trim();
  const phoneDigits = postPhoneInput.value.replace(/\D/g, '');

  if (!position && !city && !salary && !company && !description && phoneDigits.length !== 9) {
    box.innerHTML = '<span class="preview-empty">Заполните поля выше — здесь появится текст объявления, как его увидят в группе</span>';
    return;
  }

  const lines = [];
  lines.push((SECTOR_EMOJI_MAP[postSelectedSector] || '') + ' ' + postSelectedSector);
  lines.push('⭐ Подано напрямую через бота'); // все вакансии из этой формы — source=employer
  lines.push('🇧🇾' + (city ? ' · #' + city.replace(/\s+/g, '_') : ''));
  if (company) lines.push('🏢 ' + company);

  const job = [];
  if (position) job.push('📋 ' + position);
  if (salary) job.push('💰 ' + salary);
  if (job.length) { lines.push(''); lines.push.apply(lines, job); }

  if (description) { lines.push(''); lines.push('Условия:'); lines.push('• ' + description); }

  if (phoneDigits.length === 9) { lines.push(''); lines.push('📞 +375' + phoneDigits); }

  box.textContent = lines.join('\n');
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
