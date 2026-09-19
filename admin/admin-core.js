// изменено 2026-09-20 02:10
// ============================================================
// Будни_BY admin — общее ядро всех страниц админки (admin*.html).
// Токен моста, обёртки API, настройки, кнопка «назад», общий STATE.
// Грузится после app.js, до конкретного модуля страницы.
// ============================================================

var TOKEN_KEY = 'budni_admin_token';
var STATE = {};   // страница-локальное состояние (каждый loadX заполняет своё)

function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function saveToken(v) { try { localStorage.setItem(TOKEN_KEY, v); } catch (e) {} }

async function apiGet(action) {
  const url = APPS_SCRIPT_URL + '?action=' + encodeURIComponent(action);
  const res = await fetch(url, { headers: { 'X-Admin-Token': getToken() } });
  return res.json();
}

// токен — в заголовке X-Admin-Token (api/main.py::_token его и предпочитает),
// не в query/body — не оседает в логах туннеля и истории браузера. Бэкенд —
// FastAPI с CORS allow_headers=["*"], preflight OPTIONS обрабатывает сам.
async function apiPost(payload) {
  return apiCall(payload, { 'X-Admin-Token': getToken() });
}

// на суб-странице: нет токена — уводим на хаб
function requireToken() {
  if (getToken()) return true;
  location.href = 'admin.html';
  return false;
}

// общий старт суб-страницы: тема, настройки, нативная «назад» → хаб, затем loadFn()
function adminPageBoot(loadFn) {
  initTelegram();
  if (typeof initSettings === 'function') initSettings();
  if (tg && tg.BackButton) {
    try {
      tg.BackButton.onClick(function () { location.href = 'admin.html'; });
      tg.BackButton.show();
    } catch (e) {}
  }
  if (!requireToken()) return;
  loadFn();
}
