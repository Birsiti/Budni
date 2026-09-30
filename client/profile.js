// изменено 2026-09-30 15:40
// ============================================================
// Будни_BY client — анкета соискателя как пошаговый мастер (3 шага) +
// карточка-сводка заполненной анкеты. Вкладка «Анкета».
// Мастер — оверлей #anketaWizard поверх всего, с прогресс-баром и
// нативной tg.BackButton. Сам НЕ открывается и анкету не навязывает: она нужна
// только тому, кто хочет опубликовать своё объявление «Ищу подработку».
// Телефон спрашиваем только на шаге 3 и только при включённой публикации.
// Бэкенд не меняется: get_profile / save_profile.
// Глобалы: apiPost (client.html), haptic, escapeHtml, alertAsync, tg,
//   telegramUser, SECTORS, bindPhoneMask, formatPhoneTail,
//   applyProfileToFilter, BY_CITIES, bindSuggest (deck.js).
// Экспортирует: initProfile, loadProfile, openWizard.
// ============================================================

var EMPLOYMENT_OPTIONS = ['Любая', 'Подработка', 'Постоянная', 'Вахта'];
var WIZ_TOTAL = 3;

var profileExists = false;
var wizStep = 1;
var WIZ = { name: '', birth: '', phone: '', city: '', sectors: [], employment: 'Любая', about: '', publish: false };

function birthBound(yearsAgo) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  return d.toISOString().slice(0, 10);
}
function updateAgeHint() {
  const el = document.getElementById('wAgeHint');
  const bi = document.getElementById('wBirth');
  if (!el || !bi) return;
  const a = ageFromISO(bi.value);
  el.textContent = a ? plYears(a) : '';
}

function initProfile() {
  document.getElementById('profileStartBtn').addEventListener('click', function () { openWizard(); });
  document.getElementById('wizNav').addEventListener('click', wizardBack);
  document.getElementById('wizNext').addEventListener('click', wizardNext);
}

// ---------- мастер ----------
// step — с какого шага открыть (3 — когда надо только добавить телефон для публикации)
function openWizard(step) {
  wizStep = step || 1;
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
  const nav = document.getElementById('wizNav');
  nav.textContent = wizStep === 1 ? '✕' : '‹';
  nav.setAttribute('aria-label', wizStep === 1 ? 'Закрыть' : 'Назад');
  document.getElementById('wizNext').textContent = wizStep === WIZ_TOTAL ? 'Готово' : 'Далее';

  if (wizStep === 1) {
    body.innerHTML =
      '<h2>Как вас зовут?</h2>' +
      '<p class="wsub">Имя увидит работодатель, если вы опубликуете анкету.</p>' +
      '<div class="field"><label for="wName">Имя</label><input type="text" id="wName" placeholder="как к вам обращаться" autocomplete="name"></div>' +
      '<div class="field"><label for="wBirth">Дата рождения <span class="lbl-soft">· необязательно</span></label>' +
        '<input type="date" id="wBirth" max="' + birthBound(14) + '" min="' + birthBound(80) + '">' +
        '<p class="hint" id="wAgeHint" style="color:var(--ink-soft)"></p></div>' +
      '<div class="field suggest-field"><label for="wCity">Город</label>' +
        '<input type="text" id="wCity" placeholder="например, Минск" autocomplete="off">' +
        '<div class="city-suggest hidden" id="wCitySuggest"></div></div>';
    document.getElementById('wName').value = WIZ.name;
    document.getElementById('wCity').value = WIZ.city;
    bindSuggest(document.getElementById('wCity'), document.getElementById('wCitySuggest'), BY_CITIES, 'prefix');
    const bi = document.getElementById('wBirth');
    bi.value = WIZ.birth || '';
    bi.addEventListener('change', function () { WIZ.birth = bi.value; updateAgeHint(); });
    updateAgeHint();
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
      '<div class="field' + (WIZ.publish ? '' : ' hidden') + '" id="wPhoneField">' +
        '<label for="wPhone">Телефон для связи</label>' +
        '<div class="phone-field"><span class="phone-prefix">+375</span>' +
        '<input type="tel" class="phone-input" id="wPhone" inputmode="numeric" placeholder="29-123-45-67" maxlength="12" autocomplete="tel-national"></div>' +
        '<p class="profile-note">Номер увидят работодатели в группе. Если не хотите его показывать — снимите галочку выше: анкета сохранится только у вас.</p>' +
      '</div>';
    document.getElementById('wAbout').value = WIZ.about;
    const ph = document.getElementById('wPhone');
    ph.value = formatPhoneTail(WIZ.phone) || '';
    bindPhoneMask(ph);
    const pub = document.getElementById('wPublish');
    pub.addEventListener('change', function () {
      document.getElementById('wPhoneField').classList.toggle('hidden', !pub.checked);
      haptic('light');
    });
  }
}

// собирает поля текущего шага в WIZ. validate=true → проверяет обязательные.
function collectStep(validate) {
  if (wizStep === 1) {
    const el = document.getElementById('wName');
    if (!el) return true;
    WIZ.name = el.value.trim();
    WIZ.birth = document.getElementById('wBirth').value || '';
    WIZ.city = document.getElementById('wCity').value.trim();
    if (validate && !WIZ.name) { alertAsync('Как к вам обращаться?'); el.focus(); return false; }
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
    const digits = document.getElementById('wPhone').value.replace(/\D/g, '');
    if (WIZ.publish) {
      // телефон нужен только для публикации в группе — иначе работодателю не связаться
      if (validate && digits.length !== 9) { alertAsync('Чтобы показать анкету в группе, укажите телефон — или снимите галочку'); document.getElementById('wPhone').focus(); return false; }
      if (digits.length === 9) WIZ.phone = '+375' + digits;
    }
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
    name: WIZ.name, birth: WIZ.birth, phone: WIZ.phone, city: WIZ.city,
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

  if (!profileExists) {
    cta.classList.remove('hidden');
    sum.classList.add('hidden');
    return;
  }
  cta.classList.add('hidden');
  sum.classList.remove('hidden');

  const sectorsLine = WIZ.sectors.length ? WIZ.sectors.join(', ') : '—';
  const ageA = ageFromISO(WIZ.birth);
  const ageLine = ageA ? plYears(ageA) : '';
  sum.innerHTML =
    '<div class="psum">' +
      '<div class="psum-name">' + escapeHtml(WIZ.name || 'Анкета') + '</div>' +
      '<div class="psum-row">' + escapeHtml([WIZ.city, ageLine, WIZ.employment].filter(Boolean).join(' · ')) + '</div>' +
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
  // включаем публикацию, а телефона нет — сначала спросим его (шаг 3 мастера)
  if (!WIZ.publish && !WIZ.phone) { openWizard(3); return; }
  const btn = document.getElementById('psumToggle');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  const res = await apiPost({
    action: 'save_profile',
    telegramId: telegramUser.id, username: telegramUser.username || '',
    name: WIZ.name, birth: WIZ.birth, phone: WIZ.phone, city: WIZ.city,
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
    WIZ.birth = p.birth || '';
    WIZ.phone = p.phone ? ('+' + String(p.phone).replace(/^\+/, '')) : '';
    WIZ.city = p.city || '';
    WIZ.sectors = Array.isArray(p.sectors) ? p.sectors : [];
    WIZ.employment = p.employment || EMPLOYMENT_OPTIONS[0];
    WIZ.about = p.about || '';
    WIZ.publish = !!p.published;
  }
  renderProfileView();
  // мастер НЕ открываем сам и анкету нигде не навязываем — она нужна только
  // тому, кто хочет разместить своё объявление; кнопка — на вкладке «Профиль».
}
