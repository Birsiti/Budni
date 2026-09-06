// ============================================================
// Будни_BY client — анкета соискателя как пошаговый мастер (3 шага) +
// карточка-сводка заполненной анкеты. Вкладка «Анкета».
// Мастер — оверлей #anketaWizard поверх всего, с прогресс-баром и
// нативной tg.BackButton. Открывается сам при первом входе (✕ на шаге 1
// закрывает — вакансии можно листать без регистрации).
// Бэкенд не меняется: get_profile / save_profile.
// Глобалы: apiPost (client.html), haptic, escapeHtml, alertAsync, tg,
//   telegramUser, SECTORS, bindPhoneMask, formatPhoneTail,
//   applyProfileToFilter (deck.js).
// Экспортирует: initProfile, loadProfile, openWizard.
// ============================================================

var EMPLOYMENT_OPTIONS = ['Любая', 'Подработка', 'Постоянная', 'Вахта'];
var WIZ_TOTAL = 3;
var DISMISS_KEY = 'budni_anketa_dismissed';

var profileExists = false;
var wizStep = 1;
var WIZ = { name: '', phone: '', city: '', sectors: [], employment: 'Любая', about: '', publish: false };

function initProfile() {
  document.getElementById('profileStartBtn').addEventListener('click', function () { openWizard(); });
  document.getElementById('wizNav').addEventListener('click', wizardBack);
  document.getElementById('wizNext').addEventListener('click', wizardNext);
}

// ---------- мастер ----------
function openWizard() {
  wizStep = 1;
  renderWizardStep();
  document.getElementById('anketaWizard').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  bindTgBack(true);
}

function closeWizard() {
  document.getElementById('anketaWizard').classList.add('hidden');
  document.body.style.overflow = '';
  bindTgBack(false);
}

function bindTgBack(show) {
  if (!tg || !tg.BackButton) return;
  try {
    tg.BackButton.offClick(wizardBack); // не копить обработчики при повторном открытии
    if (show) { tg.BackButton.onClick(wizardBack); tg.BackButton.show(); }
    else { tg.BackButton.hide(); }
  } catch (e) {}
}

function wizardBack() {
  haptic('light');
  if (wizStep === 1) {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
    closeWizard();
    return;
  }
  collectStep(); // сохраняем что ввели, без валидации — назад можно всегда
  wizStep--;
  renderWizardStep();
}

function wizardNext() {
  if (!collectStep(true)) return; // валидируем текущий шаг
  if (wizStep < WIZ_TOTAL) {
    wizStep++;
    renderWizardStep();
    haptic('light');
    return;
  }
  finishWizard();
}

function renderWizardStep() {
  const body = document.getElementById('wizBody');
  document.getElementById('wizBar').style.width = Math.round((wizStep / WIZ_TOTAL) * 100) + '%';
  document.getElementById('wizStep').textContent = wizStep + ' / ' + WIZ_TOTAL;
  document.getElementById('wizNav').textContent = wizStep === 1 ? '✕' : '‹';
  document.getElementById('wizNext').textContent = wizStep === WIZ_TOTAL ? 'Готово' : 'Далее';

  if (wizStep === 1) {
    body.innerHTML =
      '<h2>Как вас зовут?</h2>' +
      '<p class="wsub">Имя увидит работодатель, если вы опубликуете анкету.</p>' +
      '<div class="field"><label>Имя</label><input type="text" id="wName" placeholder="как к вам обращаться"></div>' +
      '<div class="field"><label>Телефон</label>' +
        '<div class="phone-field"><span class="phone-prefix">+375</span>' +
        '<input type="tel" class="phone-input" id="wPhone" inputmode="numeric" placeholder="29-123-45-67" maxlength="12"></div></div>' +
      '<div class="field"><label>Город</label><input type="text" id="wCity" placeholder="например, Минск"></div>';
    document.getElementById('wName').value = WIZ.name;
    document.getElementById('wCity').value = WIZ.city;
    const ph = document.getElementById('wPhone');
    ph.value = formatPhoneTail(WIZ.phone) || '';
    bindPhoneMask(ph);
  } else if (wizStep === 2) {
    body.innerHTML =
      '<h2>Что ищете?</h2>' +
      '<p class="wsub">Выберите направления и тип занятости — под них подстроим ленту.</p>' +
      '<div class="field"><label>Направления</label><div class="chip-grid" id="wSectors">' +
        SECTORS.map(function (s) {
          const on = WIZ.sectors.indexOf(s[0]) !== -1;
          return '<label class="chip"><input type="checkbox" value="' + s[0] + '"' + (on ? ' checked' : '') + '>' +
            '<span>' + s[1] + ' ' + s[0] + '</span></label>';
        }).join('') +
      '</div></div>' +
      '<div class="field"><label>Тип занятости</label><div class="chip-group" id="wEmployment">' +
        EMPLOYMENT_OPTIONS.map(function (o) {
          return '<label class="chip"><input type="radio" name="wEmployment" value="' + o + '"' +
            (WIZ.employment === o ? ' checked' : '') + '><span>' + o + '</span></label>';
        }).join('') +
      '</div></div>';
  } else {
    body.innerHTML =
      '<h2>Пара слов о себе</h2>' +
      '<p class="wsub">Необязательно. Опыт, график, пожелания — что важно работодателю.</p>' +
      '<div class="field"><label>О себе</label>' +
        '<textarea id="wAbout" placeholder="например: 5 лет за рулём кат. B/C, готов на подработку по выходным"></textarea></div>' +
      '<label class="check-row"><input type="checkbox" id="wPublish"' + (WIZ.publish ? ' checked' : '') + '>' +
        '<span>Показывать мою анкету в группе, топик «Ищу подработку» — работодатели смогут написать первыми</span></label>' +
      '<p class="profile-note">Телефон в группе виден только если включить публикацию. Для отклика на чужую вакансию номер не нужен.</p>';
    document.getElementById('wAbout').value = WIZ.about;
  }
}

// собирает поля текущего шага в WIZ. validate=true → проверяет обязательные.
function collectStep(validate) {
  if (wizStep === 1) {
    const el = document.getElementById('wName');
    if (!el) return true;
    WIZ.name = el.value.trim();
    const digits = document.getElementById('wPhone').value.replace(/\D/g, '');
    WIZ.phone = digits ? '+375' + digits : '';
    WIZ.city = document.getElementById('wCity').value.trim();
    if (validate) {
      if (!WIZ.name) { alertAsync('Как к вам обращаться?'); return false; }
      if (digits.length !== 9) { alertAsync('Проверьте номер телефона'); return false; }
    }
  } else if (wizStep === 2) {
    const grid = document.getElementById('wSectors');
    if (!grid) return true;
    WIZ.sectors = Array.prototype.slice.call(grid.querySelectorAll('input:checked')).map(function (i) { return i.value; });
    const emp = document.querySelector('#wEmployment input:checked');
    WIZ.employment = emp ? emp.value : EMPLOYMENT_OPTIONS[0];
    if (validate && WIZ.sectors.length === 0) { alertAsync('Выберите хотя бы одно направление'); return false; }
  } else {
    const ab = document.getElementById('wAbout');
    if (!ab) return true;
    WIZ.about = ab.value.trim();
    WIZ.publish = document.getElementById('wPublish').checked;
  }
  return true;
}

async function finishWizard() {
  const btn = document.getElementById('wizNext');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Сохраняем…';
  haptic('light');

  const wasFirstTime = !profileExists;
  const res = await apiPost({
    action: 'save_profile',
    telegramId: telegramUser.id, username: telegramUser.username || '',
    name: WIZ.name, phone: WIZ.phone, city: WIZ.city,
    sectors: WIZ.sectors, employment: WIZ.employment,
    about: WIZ.about, publish: WIZ.publish,
  }).catch(function () { return { ok: false }; });

  btn.disabled = false;
  btn.textContent = 'Готово';

  if (!res.ok) {
    haptic('error');
    await alertAsync('Не получилось сохранить: ' + (res.error || 'попробуйте ещё раз'));
    return;
  }

  haptic('success');
  profileExists = true;
  WIZ.publish = !!res.published;
  try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
  closeWizard();
  renderProfileView();

  let applied = false;
  if (wasFirstTime) applied = applyProfileToFilter(WIZ.city, WIZ.sectors);

  await alertAsync(
    (res.published ? 'Анкета сохранена и опубликована в топике «Ищу подработку» ✓' : 'Анкета сохранена ✓') +
    (applied ? '\nЛента отфильтрована под ваш город и направления — поменять можно в «Фильтре».' : '')
  );
}

// ---------- вкладка «Анкета»: сводка или призыв заполнить ----------
function renderProfileView() {
  const cta = document.getElementById('profileCTA');
  const sum = document.getElementById('profileSummary');
  const dot = document.getElementById('profileDot');

  if (!profileExists) {
    cta.classList.remove('hidden');
    sum.classList.add('hidden');
    if (dot) dot.classList.remove('hidden');
    return;
  }
  cta.classList.add('hidden');
  if (dot) dot.classList.add('hidden');
  sum.classList.remove('hidden');

  const sectorsLine = WIZ.sectors.length ? WIZ.sectors.join(', ') : '—';
  sum.innerHTML =
    '<div class="psum">' +
      '<div class="psum-name">' + escapeHtml(WIZ.name || 'Анкета') + '</div>' +
      '<div class="psum-row">' + escapeHtml([WIZ.city, WIZ.employment].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="psum-row">🧭 ' + escapeHtml(sectorsLine) + '</div>' +
      (WIZ.about ? '<div class="psum-row">' + escapeHtml(WIZ.about) + '</div>' : '') +
      '<div class="psum-pub' + (WIZ.publish ? '' : ' off') + '">' +
        (WIZ.publish ? '● Анкета видна в группе «Ищу подработку»' : '○ Анкета не публикуется в группе') + '</div>' +
      '<div class="psum-actions">' +
        '<button class="psum-edit" id="psumEdit">Редактировать</button>' +
        '<button class="psum-toggle" id="psumToggle">' + (WIZ.publish ? 'Скрыть из группы' : 'Показать в группе') + '</button>' +
      '</div>' +
    '</div>';

  document.getElementById('psumEdit').addEventListener('click', function () { openWizard(); });
  document.getElementById('psumToggle').addEventListener('click', togglePublish);
}

async function togglePublish() {
  const btn = document.getElementById('psumToggle');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  const res = await apiPost({
    action: 'save_profile',
    telegramId: telegramUser.id, username: telegramUser.username || '',
    name: WIZ.name, phone: WIZ.phone, city: WIZ.city,
    sectors: WIZ.sectors, employment: WIZ.employment,
    about: WIZ.about, publish: !WIZ.publish,
  }).catch(function () { return { ok: false }; });

  if (!res.ok) {
    haptic('error');
    btn.disabled = false;
    await alertAsync('Не получилось: ' + (res.error || 'попробуйте ещё раз'));
    return;
  }
  haptic('success');
  WIZ.publish = !!res.published;
  renderProfileView();
}

async function loadProfile() {
  let res;
  try { res = await apiPost({ action: 'get_profile' }); }
  catch (e) { res = { ok: false }; }
  const p = (res && res.ok && res.profile) ? res.profile : null;
  profileExists = !!p;

  if (p) {
    WIZ.name = p.name || '';
    WIZ.phone = p.phone ? ('+' + String(p.phone).replace(/^\+/, '')) : '';
    WIZ.city = p.city || '';
    WIZ.sectors = Array.isArray(p.sectors) ? p.sectors : [];
    WIZ.employment = p.employment || EMPLOYMENT_OPTIONS[0];
    WIZ.about = p.about || '';
    WIZ.publish = !!p.published;
  }
  renderProfileView();

  // первый вход, анкеты нет и её ещё не закрывали — открываем мастер сразу
  if (!p) {
    let dismissed = false;
    try { dismissed = !!localStorage.getItem(DISMISS_KEY); } catch (e) {}
    if (!dismissed) openWizard();
  }
}
