// изменено 2026-09-07 11:03
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
  const url = APPS_SCRIPT_URL + '?action=' + encodeURIComponent(action) + '&token=' + encodeURIComponent(getToken());
  const res = await fetch(url);
  return res.json();
}

// без явного Content-Type — иначе браузер шлёт preflight OPTIONS,
// который Apps Script веб-апп не обрабатывает
async function apiPost(payload) {
  return apiCall(Object.assign({ token: getToken() }, payload));
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
