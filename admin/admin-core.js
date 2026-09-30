// изменено 2026-09-30 23:50
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

// ---------- слово не влезло — шрифт меньше, а не перенос посреди слова (Денис, 2026-09-30) ----------
// Перенос между словами обычный; если одно слово шире плитки (scrollWidth > clientWidth) —
// уменьшаем шрифт именно этого элемента по 0.5px, не ниже 70% исходного. Тот же приём — в хабе Spihki.
(function(){
  var FIT_SEL = '.status-title, .stat-label, .stat-value, .seg button, .qbtn';
  var queued = false;
  function fit(){
    queued = false;
    document.querySelectorAll(FIT_SEL).forEach(function(el){
      el.style.fontSize = '';
      if (!el.clientWidth) return;
      var fs = parseFloat(getComputedStyle(el).fontSize), min = fs * 0.7, guard = 0;
      while (el.scrollWidth > el.clientWidth + 1 && fs > min && guard++ < 30) {
        fs -= 0.5; el.style.fontSize = fs + 'px';
      }
    });
  }
  function queue(){ if (!queued) { queued = true; requestAnimationFrame(fit); } }
  function start(){
    new MutationObserver(queue).observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', queue);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queue);
    queue();
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
