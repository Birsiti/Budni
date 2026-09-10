// изменено 2026-09-10 17:05
// ============================================================
// Будни_BY client — «Избранное» (свайп вправо). Открывается ❤️ в шапке.
// Тап по карточке — раскрывает полный текст вакансии + «Поделиться».
// ✕ — убрать из избранного. Телефон — ссылкой tel: (тап = позвонить).
// Глобалы из app.js: apiPost (client.html), escapeHtml, haptic, confirmAsync,
//   alertAsync, telHref, shareText.
// Экспортирует: loadFavorites.
// ============================================================

var FAVS = [];

async function loadFavorites() {
  const el = document.getElementById('viewFavorites');
  el.innerHTML = '<div class="empty">Загрузка…</div>';
  let res;
  try { res = await apiPost({ action: 'get_favorites' }); }
  catch (e) { res = { ok: false }; }
  if (!res.ok) { el.innerHTML = '<div class="empty">Не получилось загрузить</div>'; return; }
  FAVS = res.favorites || [];
  setFavCount(FAVS.length);
  if (FAVS.length === 0) {
    el.innerHTML = '<div class="empty">Пока пусто — свайпните вправо понравившуюся вакансию 👉</div>';
    return;
  }

  el.innerHTML = FAVS.map(function (v, i) {
    const meta = [v.company, v.city, v.salary_text].filter(Boolean).join(' · ');
    const tel = telHref(v.phone);
    const otherContact = [v.contact_username, v.email].filter(Boolean).join(' · ');
    return '<div class="fav-card">' +
      '<div class="fav-head" data-toggle="' + i + '">' +
        '<div class="fav-headtext">' +
          '<div class="fav-position">' + escapeHtml(v.position || '(без названия)') + '</div>' +
          (meta ? '<div class="fav-meta">' + escapeHtml(meta) + '</div>' : '') +
        '</div>' +
        '<button class="fav-x" data-remove="' + i + '" aria-label="Убрать из избранного">✕</button>' +
      '</div>' +
      (tel ? '<a class="fav-contact fav-tel" href="tel:' + escapeHtml(tel) + '">📞 ' + escapeHtml(v.phone) + ' — позвонить</a>' : '') +
      (otherContact ? '<div class="fav-contact">' + escapeHtml(otherContact) + '</div>' : '') +
      '<div class="fav-full" id="favFull-' + i + '">' +
        '<div class="fav-fulltext">' + escapeHtml(v.clean_text || v.position || '') + '</div>' +
        '<button class="fav-share" data-share="' + i + '">↗ Поделиться</button>' +
      '</div>' +
    '</div>';
  }).join('');

  el.querySelectorAll('[data-toggle]').forEach(function (head) {
    head.addEventListener('click', function () {
      document.getElementById('favFull-' + head.getAttribute('data-toggle')).classList.toggle('open');
      haptic('light');
    });
  });
  el.querySelectorAll('[data-remove]').forEach(function (btn) {
    btn.addEventListener('click', function (e) { e.stopPropagation(); removeFav(parseInt(btn.getAttribute('data-remove'), 10)); });
  });
  el.querySelectorAll('[data-share]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      haptic('light');
      const v = FAVS[parseInt(btn.getAttribute('data-share'), 10)];
      if (v) shareText(v.clean_text || v.position || '');
    });
  });
}

async function removeFav(i) {
  const v = FAVS[i];
  if (!v) return;
  const ok = await confirmAsync('Убрать «' + (v.position || 'вакансию') + '» из избранного?');
  if (!ok) return;
  haptic('light');
  await apiPost({ action: 'remove_favorite', vacancyId: v.id, sector: v.sector }).catch(function () {});
  loadFavorites();
}
