// ============================================================
// Будни_BY client — вкладка «Избранное» (вакансии со свайпом вправо).
// Глобалы из app.js: apiPost (client.html), escapeHtml.
// Экспортирует: loadFavorites.
// ============================================================

async function loadFavorites() {
  const el = document.getElementById('viewFavorites');
  el.innerHTML = '<div class="empty">Загрузка…</div>';
  let res;
  try { res = await apiPost({ action: 'get_favorites' }); }
  catch (e) { res = { ok: false }; }
  if (!res.ok) { el.innerHTML = '<div class="empty">Не получилось загрузить</div>'; return; }
  const favs = res.favorites || [];
  document.getElementById('favCount').textContent = favs.length ? '(' + favs.length + ')' : '';
  if (favs.length === 0) {
    el.innerHTML = '<div class="empty">Пока пусто — свайпните вправо понравившуюся вакансию 👉</div>';
    return;
  }
  el.innerHTML = favs.map(function (v) {
    const contact = [v.phone, v.contact_username, v.email].filter(Boolean).join(' · ');
    return '<div class="fav-card">' +
      '<div class="fav-top"><div class="fav-position">' + escapeHtml(v.position || '') + '</div>' +
      (v.source === 'employer' ? '<span class="badge badge-employer">✓</span>' : '') + '</div>' +
      '<div class="fav-meta">' + escapeHtml([v.company, v.city, v.salary_text].filter(Boolean).join(' · ')) + '</div>' +
      (contact ? '<div class="fav-contact">' + escapeHtml(contact) + '</div>' : '') +
    '</div>';
  }).join('');
}
