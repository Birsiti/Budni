// ============================================================
// Будни_BY client — подписки («город + ключевое слово» → уведомление в бот)
// и краудсорсинг источников (предложить канал/группу для парсинга).
// Живут во вкладке «Анкета» под формой анкеты.
// Глобалы из app.js: apiPost (client.html), haptic, escapeHtml, alertAsync.
// Экспортирует: loadSubscriptions, initSubscriptions.
// ============================================================

async function loadSubscriptions() {
  const el = document.getElementById('subsList');
  el.innerHTML = '<div class="empty">Загрузка…</div>';
  let res;
  try { res = await apiPost({ action: 'list_subscriptions' }); }
  catch (e) { res = { ok: false }; }
  if (!res.ok) { el.innerHTML = '<div class="empty">Не получилось загрузить</div>'; return; }
  const subs = res.subscriptions || [];
  if (subs.length === 0) {
    el.innerHTML = '<div class="empty">Подписок пока нет</div>';
    return;
  }
  el.innerHTML = subs.map(function (s) {
    const label = [s.city, s.keyword].filter(Boolean).join(' · ');
    return '<div class="fav-card" style="display:flex; align-items:center; justify-content:space-between;">' +
      '<span>' + escapeHtml(label) + '</span>' +
      '<button class="round-btn skip" style="flex:none; min-height:36px; padding:0 14px;" data-remove-sub="' + escapeHtml(s.id) + '">✕</button>' +
    '</div>';
  }).join('');
  el.querySelectorAll('[data-remove-sub]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      haptic('light');
      btn.disabled = true;
      await apiPost({ action: 'remove_subscription', id: btn.getAttribute('data-remove-sub') }).catch(function () {});
      loadSubscriptions();
    });
  });
}

function initSubscriptions() {
  document.getElementById('subAddBtn').addEventListener('click', async function () {
    const btn = this;
    const city = document.getElementById('subCity').value.trim();
    const keyword = document.getElementById('subKeyword').value.trim();
    if (!city && !keyword) { await alertAsync('Укажите город и/или ключевое слово'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    const res = await apiPost({ action: 'add_subscription', city: city, keyword: keyword }).catch(function () { return { ok: false }; });
    btn.disabled = false;
    btn.textContent = 'Подписаться';

    if (!res.ok) { haptic('error'); await alertAsync('Не получилось подписаться'); return; }
    haptic('success');
    document.getElementById('subCity').value = '';
    document.getElementById('subKeyword').value = '';
    loadSubscriptions();
  });

  // ---------- предложить источник (канал/группа) ----------
  document.getElementById('srcSubmitBtn').addEventListener('click', async function () {
    const btn = this;
    const link = document.getElementById('srcLink').value.trim();
    const city = document.getElementById('srcCity').value.trim();
    const platform = document.querySelector('input[name="srcPlatform"]:checked').value;
    if (!link) { await alertAsync('Вставьте ссылку на канал или группу'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    const res = await apiPost({ action: 'suggest_source', link: link, platform: platform, city: city })
      .catch(function () { return { ok: false }; });
    btn.disabled = false;
    btn.textContent = 'Предложить источник';

    if (!res.ok) { haptic('error'); await alertAsync('Не получилось отправить'); return; }
    haptic('success');
    document.getElementById('srcLink').value = '';
    document.getElementById('srcCity').value = '';
    await alertAsync(res.duplicate ? 'Такой источник уже предложен' : 'Спасибо! Проверим и добавим в парсинг');
  });
}
