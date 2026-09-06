// ============================================================
// Будни_BY client — свайп-лента вакансий + фильтр (город / направление).
// Глобалы из app.js: apiPost (client.html), haptic, escapeHtml, telegramUser, SECTORS.
// Экспортирует: loadDeck, FILTER, filterIsActive, updateFilterSummary, applyProfileToFilter.
// ============================================================

// ================= ФИЛЬТР ЛЕНТЫ =================
var FILTER_KEY = 'budni_filter';
var FILTER = { city: '', sectors: [] };
try { FILTER = Object.assign(FILTER, JSON.parse(localStorage.getItem(FILTER_KEY) || '{}')); } catch (e) {}
if (!Array.isArray(FILTER.sectors)) FILTER.sectors = [];

function filterIsActive() { return !!FILTER.city || FILTER.sectors.length > 0; }

function saveFilter() { try { localStorage.setItem(FILTER_KEY, JSON.stringify(FILTER)); } catch (e) {} }

function updateFilterSummary() {
  const parts = [];
  if (FILTER.city) parts.push(FILTER.city);
  if (FILTER.sectors.length === 1) parts.push(FILTER.sectors[0]);
  else if (FILTER.sectors.length > 1) parts.push(FILTER.sectors.length + ' направл.');
  document.getElementById('filterSummary').textContent = parts.length ? ' · ' + parts.join(', ') : '';
  document.getElementById('filterToggle').classList.toggle('is-active', filterIsActive());
}

function renderFilterSectorChips() {
  document.getElementById('filterSectors').innerHTML = SECTORS.map(function (s) {
    const on = FILTER.sectors.indexOf(s[0]) !== -1;
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

function initFilterUI() {
  renderFilterSectorChips();
  document.getElementById('filterCity').value = FILTER.city;
  updateFilterSummary();

  document.getElementById('filterToggle').addEventListener('click', function () {
    haptic('light');
    document.getElementById('filterPanel').classList.toggle('hidden');
  });
  document.getElementById('filterApply').addEventListener('click', function () {
    haptic('light');
    FILTER.city = document.getElementById('filterCity').value.trim();
    FILTER.sectors = Array.prototype.slice
      .call(document.querySelectorAll('#filterSectors input:checked'))
      .map(function (i) { return i.value; });
    saveFilter();
    updateFilterSummary();
    document.getElementById('filterPanel').classList.add('hidden');
    loadDeck();
  });
  document.getElementById('filterReset').addEventListener('click', function () {
    haptic('light');
    FILTER = { city: '', sectors: [] };
    try { localStorage.removeItem(FILTER_KEY); } catch (e) {}
    document.getElementById('filterCity').value = '';
    renderFilterSectorChips();
    updateFilterSummary();
    document.getElementById('filterPanel').classList.add('hidden');
    loadDeck();
  });
}

// ================= СВАЙП-ЛЕНТА =================
var DECK = [];
var DECK_INDEX = 0;
var deckLiked = false; // раскрыт ли контакт на текущей карточке

async function loadDeck() {
  const wrap = document.getElementById('deckWrap');
  wrap.innerHTML = '<div class="empty">Загрузка…</div>';
  let res;
  try {
    res = await apiPost({ action: 'get_deck', city: FILTER.city, sectors: FILTER.sectors });
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
  deckLiked = false;
  if (DECK_INDEX >= DECK.length) {
    wrap.innerHTML = DECK.length === 0 && filterIsActive()
      ? '<div class="empty">Под фильтр ничего не нашлось — измените город или направление ⚙</div>'
      : '<div class="empty">Пока вакансий больше нет — загляните позже 👋</div>';
    document.getElementById('deckActions').classList.add('hidden');
    return;
  }
  document.getElementById('deckActions').classList.remove('hidden');
  const v = DECK[DECK_INDEX];
  wrap.innerHTML =
    '<div class="card" id="activeCard">' +
      '<div class="swipe-tag like" id="tagLike">НРАВИТСЯ</div>' +
      '<div class="swipe-tag skip" id="tagSkip">СКИП</div>' +
      '<div class="card-badges">' +
        (v.source === 'employer' ? '<span class="badge badge-employer">✓ Прямая вакансия</span>' : '') +
        '<span class="badge">' + escapeHtml(v.city || '') + '</span>' +
        (v.salary_text ? '<span class="badge">' + escapeHtml(v.salary_text) + '</span>' : '') +
      '</div>' +
      '<h2>' + escapeHtml(v.position || '(без названия)') + '</h2>' +
      (v.company ? '<div class="card-company">' + escapeHtml(v.company) + '</div>' : '') +
      '<div class="card-body">' + escapeHtml(v.clean_text || '') + '</div>' +
      '<div class="card-contact" id="cardContact">' +
        '<div>📞 ' + escapeHtml(v.phone || 'контакт в тексте выше') + '</div>' +
      '</div>' +
    '</div>';
  bindCardGestures(document.getElementById('activeCard'));
}

function bindCardGestures(card) {
  let startX = 0, startY = 0, dx = 0, dragging = false, startTime = 0;

  card.addEventListener('pointerdown', function (e) {
    if (deckLiked) return; // после лайка не даём утащить карточку, ждём "Дальше"
    dragging = true; startX = e.clientX; startY = e.clientY; startTime = Date.now();
    card.setPointerCapture(e.pointerId);
  });
  card.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    dx = e.clientX - startX;
    const dy = e.clientY - startY;
    card.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx / 18) + 'deg)';
    document.getElementById('tagLike').style.opacity = Math.max(0, dx / 100);
    document.getElementById('tagSkip').style.opacity = Math.max(0, -dx / 100);
  });
  card.addEventListener('pointerup', function () {
    if (!dragging) return;
    dragging = false;
    const elapsed = Math.max(1, Date.now() - startTime);
    const velocity = Math.abs(dx) / elapsed; // px/мс
    // засчитываем и медленный осознанный драг (по расстоянию), и короткий
    // быстрый флик пальцем (по скорости) — иначе обычный флик "как в
    // Тиндере" не дотягивает до порога по одной лишь дистанции и его
    // приходится повторять несколько раз
    const isSwipe = Math.abs(dx) > 90 || (Math.abs(dx) > 24 && velocity > 0.35);
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
  });
}

function finishSwipe(decision, card, dxAtRelease) {
  haptic(decision === 'like' ? 'success' : 'light');
  const v = DECK[DECK_INDEX];
  apiPost({
    action: 'record_swipe', telegramId: telegramUser.id, username: telegramUser.username || '',
    vacancyId: v.id, sector: v.sector, decision: decision,
  }).catch(function () {});

  if (decision === 'skip') {
    const flyX = (dxAtRelease >= 0 ? 1 : -1) * 600;
    card.style.transition = 'transform .25s ease-out';
    card.style.transform = 'translate(' + flyX + 'px, 0) rotate(' + (flyX / 18) + 'deg)';
    setTimeout(function () { DECK_INDEX++; renderCard(); }, 220);
    return;
  }

  // like — раскрываем контакт на месте, не перелистываем сразу
  deckLiked = true;
  card.style.transition = 'transform .2s';
  card.style.transform = '';
  document.getElementById('cardContact').classList.add('show');
  document.getElementById('tagLike').style.opacity = 1;
  document.getElementById('skipBtn').classList.add('hidden');
  document.getElementById('likeBtn').textContent = 'Дальше →';
  document.getElementById('likeBtn').onclick = function () {
    document.getElementById('likeBtn').textContent = '♥ Нравится';
    document.getElementById('likeBtn').onclick = null;
    document.getElementById('skipBtn').classList.remove('hidden');
    bindDeckButtons();
    DECK_INDEX++; renderCard();
  };
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
