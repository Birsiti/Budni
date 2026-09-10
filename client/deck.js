// изменено 2026-09-10 17:05
// ============================================================
// Будни_BY client — свайп-лента вакансий.
// Фильтр (формат рядом/вахта, город, направление, без опыта) — в панели,
// открывается кнопкой-иконкой в шапке (#filterBtn).
// Глобалы из app.js: apiPost (client.html), haptic, escapeHtml, telegramUser, SECTORS.
// Глобалы из client.html: setFavCount, flashFavHeart.
// Экспортирует: loadDeck, FILTER, filterIsActive, updateFilterSummary, applyProfileToFilter.
// ============================================================

// ================= ФИЛЬТР ЛЕНТЫ =================
var FILTER_KEY = 'budni_filter';
var FILTER = { city: '', sectors: [], noExperience: false, jobType: 'рядом' };
try { FILTER = Object.assign(FILTER, JSON.parse(localStorage.getItem(FILTER_KEY) || '{}')); } catch (e) {}
if (!Array.isArray(FILTER.sectors)) FILTER.sectors = [];
if (FILTER.jobType !== 'вахта') FILTER.jobType = 'рядом';

function filterIsActive() { return !!FILTER.city || FILTER.sectors.length > 0 || !!FILTER.noExperience; }

// город не действует для вахты — прячем поле в панели, чтобы не путать
function applyJobTypeUI() {
  var r = document.querySelector('input[name="jobType"][value="' + FILTER.jobType + '"]');
  if (r) r.checked = true;
  document.getElementById('filterCityField').classList.toggle('hidden', FILTER.jobType === 'вахта');
}

function saveFilter() { try { localStorage.setItem(FILTER_KEY, JSON.stringify(FILTER)); } catch (e) {} }

// индикатор активного фильтра — точка на иконке фильтра в шапке
function updateFilterSummary() {
  document.getElementById('filterDot').classList.toggle('hidden', !filterIsActive());
}

function renderFilterSectorChips() {
  document.getElementById('filterSectors').innerHTML = SECTORS.map(function (s) {
    var on = FILTER.sectors.indexOf(s[0]) !== -1;
    return '<label class="chip"><input type="checkbox" value="' + s[0] + '"' + (on ? ' checked' : '') + '>' +
      '<span>' + s[1] + ' ' + s[0] + '</span></label>';
  }).join('');
}

// вызывается из profile.js после первого сохранения анкеты — подставить
// город/направления в фильтр, но только если пользователь ещё не настраивал
// его вручную (иначе перетрём его выбор)
function applyProfileToFilter(city, sectors) {
  if (localStorage.getItem(FILTER_KEY)) return false;
  FILTER.city = city || '';
  FILTER.sectors = Array.isArray(sectors) ? sectors.slice(0, 5) : [];
  saveFilter();
  document.getElementById('filterCity').value = FILTER.city;
  renderFilterSectorChips();
  updateFilterSummary();
  loadDeck();
  return true;
}

function closeFilterPanel() { document.getElementById('filterPanel').classList.add('hidden'); }

function initFilterUI() {
  renderFilterSectorChips();
  document.getElementById('filterCity').value = FILTER.city;
  document.getElementById('filterNoExp').checked = !!FILTER.noExperience;
  applyJobTypeUI();
  updateFilterSummary();

  // формат (рядом/вахта) внутри панели — меняет только UI панели, применяется по «Показать»
  document.querySelectorAll('input[name="jobType"]').forEach(function (input) {
    input.addEventListener('change', function () {
      haptic('light');
      FILTER.jobType = input.value;
      applyJobTypeUI();
    });
  });

  document.getElementById('filterBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    haptic('light');
    document.getElementById('filterPanel').classList.toggle('hidden');
  });
  document.getElementById('filterApply').addEventListener('click', function () {
    haptic('light');
    FILTER.city = document.getElementById('filterCity').value.trim();
    FILTER.sectors = Array.prototype.slice
      .call(document.querySelectorAll('#filterSectors input:checked'))
      .map(function (i) { return i.value; });
    FILTER.noExperience = document.getElementById('filterNoExp').checked;
    var jt = document.querySelector('input[name="jobType"]:checked');
    FILTER.jobType = (jt && jt.value === 'вахта') ? 'вахта' : 'рядом';
    saveFilter();
    updateFilterSummary();
    closeFilterPanel();
    loadDeck();
  });
  document.getElementById('filterReset').addEventListener('click', function () {
    haptic('light');
    FILTER = { city: '', sectors: [], noExperience: false, jobType: 'рядом' };
    saveFilter();
    document.getElementById('filterCity').value = '';
    document.getElementById('filterNoExp').checked = false;
    applyJobTypeUI();
    renderFilterSectorChips();
    updateFilterSummary();
    closeFilterPanel();
    loadDeck();
  });
}

// ================= СВАЙП-ЛЕНТА =================
var DECK = [];
var DECK_INDEX = 0;

async function loadDeck() {
  const wrap = document.getElementById('deckWrap');
  wrap.innerHTML = '<div class="empty">Загрузка…</div>';
  let res;
  try {
    res = await apiPost({ action: 'get_deck', city: FILTER.city, sectors: FILTER.sectors, noExperience: FILTER.noExperience, jobType: FILTER.jobType });
  } catch (e) { res = { ok: false, error: 'нет связи' }; }
  if (!res.ok) {
    wrap.innerHTML = '<div class="empty">Не получилось загрузить вакансии' +
      (res.error ? '<br><span class="mono" style="font-size:12px;opacity:.7">' + escapeHtml(res.error) + '</span>' : '') +
      '</div>';
    return;
  }
  DECK = res.deck || [];
  DECK_INDEX = 0;
  renderCard();
}

function renderCard() {
  const wrap = document.getElementById('deckWrap');
  if (DECK_INDEX >= DECK.length) {
    wrap.innerHTML = DECK.length === 0 && filterIsActive()
      ? '<div class="empty">Под фильтр ничего не нашлось — измените город или направление в фильтре</div>'
      : '<div class="empty">Пока вакансий больше нет — загляните позже 👋</div>';
    document.getElementById('deckActions').classList.add('hidden');
    return;
  }
  document.getElementById('deckActions').classList.remove('hidden');
  const v = DECK[DECK_INDEX];

  // на карточке — только «сигнальные» бейджи, которых нет в тексте поста
  const badges = [
    v.source === 'employer' ? '<span class="badge badge-employer">✓ Прямая</span>' : '',
    v.job_type === 'вахта' ? '<span class="badge">🧳 ' + escapeHtml(v.country || 'Вахта') + '</span>' : '',
    v.no_experience ? '<span class="badge">🆕 Без опыта</span>' : '',
  ].filter(Boolean).join('');

  wrap.innerHTML =
    '<div class="card" id="activeCard">' +
      '<div class="swipe-tag like" id="tagLike">НРАВИТСЯ</div>' +
      '<div class="swipe-tag skip" id="tagSkip">ПРОПУСТИТЬ</div>' +
      (badges ? '<div class="card-badges">' + badges + '</div>' : '') +
      '<div class="card-body">' + escapeHtml(v.clean_text || v.position || '') + '</div>' +
    '</div>';
  bindCardGestures(document.getElementById('activeCard'));
}

// направленный жест: горизонталь → свайп карточки, вертикаль → отдаём
// нативному скроллу текста поста. Ось определяется по первым ~8px движения.
function bindCardGestures(card) {
  let startX = 0, startY = 0, dx = 0, startTime = 0, axis = null, active = false;

  card.addEventListener('pointerdown', function (e) {
    active = true; axis = null; dx = 0;
    startX = e.clientX; startY = e.clientY; startTime = Date.now();
  });

  card.addEventListener('pointermove', function (e) {
    if (!active) return;
    const mx = e.clientX - startX, my = e.clientY - startY;
    if (axis === null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      if (Math.abs(my) > Math.abs(mx)) { active = false; return; } // вертикаль — скролл текста
      axis = 'x';
      try { card.setPointerCapture(e.pointerId); } catch (err) {}
    }
    dx = mx;
    card.style.transform = 'translate(' + dx + 'px,0) rotate(' + (dx / 20) + 'deg)';
    document.getElementById('tagLike').style.opacity = Math.max(0, dx / 90);
    document.getElementById('tagSkip').style.opacity = Math.max(0, -dx / 90);
  });

  function release() {
    if (axis !== 'x') { active = false; axis = null; return; }
    active = false; axis = null;
    const elapsed = Math.max(1, Date.now() - startTime);
    const velocity = Math.abs(dx) / elapsed; // px/мс
    // засчитываем и медленный осознанный драг (по расстоянию), и короткий
    // быстрый флик пальцем (по скорости)
    const isSwipe = Math.abs(dx) > 90 || (Math.abs(dx) > 36 && velocity > 0.35);
    if (isSwipe) {
      finishSwipe(dx > 0 ? 'like' : 'skip', card, dx);
    } else {
      card.style.transition = 'transform .2s';
      card.style.transform = '';
      setTimeout(function () { card.style.transition = ''; }, 200);
      document.getElementById('tagLike').style.opacity = 0;
      document.getElementById('tagSkip').style.opacity = 0;
    }
    dx = 0;
  }
  card.addEventListener('pointerup', release);
  card.addEventListener('pointercancel', release);
}

function finishSwipe(decision, card, dxAtRelease) {
  haptic(decision === 'like' ? 'success' : 'light');
  const v = DECK[DECK_INDEX];
  apiPost({
    action: 'record_swipe', telegramId: telegramUser.id, username: telegramUser.username || '',
    vacancyId: v.id, sector: v.sector, decision: decision,
  }).catch(function () {});

  if (decision === 'like') {
    flashFavHeart();
    var cur = parseInt(document.getElementById('favCount').textContent, 10) || 0;
    setFavCount(cur + 1);
  }

  // и лайк, и скип — карточка улетает и сразу следующая (без промежуточного шага)
  const flyX = (dxAtRelease && dxAtRelease < 0 ? -1 : (dxAtRelease > 0 ? 1 : (decision === 'like' ? 1 : -1))) * 640;
  card.style.transition = 'transform .26s ease-out';
  card.style.transform = 'translate(' + flyX + 'px,0) rotate(' + (flyX / 20) + 'deg)';
  setTimeout(function () { DECK_INDEX++; renderCard(); }, 240);
}

function bindDeckButtons() {
  document.getElementById('skipBtn').onclick = function () {
    const card = document.getElementById('activeCard');
    if (card) finishSwipe('skip', card, -1);
  };
  document.getElementById('likeBtn').onclick = function () {
    const card = document.getElementById('activeCard');
    if (card) finishSwipe('like', card, 1);
  };
}
