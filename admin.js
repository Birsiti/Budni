// ============================================================
// Будни_BY admin — оболочка панели модерации: вход по токену моста,
// обёртки API (token, не initData — это админка), общий STATE, загрузка
// данных, стоп-кран публикации, вкладки, обновление.
// Фичи — в admin-moderation.js / admin-sources.js / admin-stats.js.
// Глобалы из app.js: haptic, initTelegram, alertAsync, confirmAsync, escapeHtml.
// ============================================================

var TOKEN_KEY = 'budni_admin_token';

function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }

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

// ---------- состояние ----------
var STATE = { suspicious: [], stats: null, sources: [], queue: [], swipes: null,
  loading: false, paused: false, publishBatch: 1, publishDailyLimit: 0 };

async function loadData() {
  if (STATE.loading) return;
  STATE.loading = true;
  const res = await apiGet('admin_data');
  STATE.loading = false;
  if (!res.ok) {
    await alertAsync('Ошибка загрузки: ' + (res.error || 'неизвестная'));
    return;
  }
  STATE.suspicious = res.suspicious || [];
  STATE.stats = res.stats;
  STATE.paused = !!res.paused;
  STATE.publishBatch = res.publishBatch || 1;
  STATE.publishDailyLimit = res.publishDailyLimit || 0;
  renderModeration();
  renderStats();
  renderPauseToggle();
  document.getElementById('modCount').textContent = STATE.suspicious.length;
  document.getElementById('queueCount').textContent = (STATE.stats && STATE.stats.queueLength) || 0;
}

// ---------- стоп-кран публикации ----------
function renderPauseToggle() {
  document.getElementById('pauseToggle').classList.toggle('is-paused', STATE.paused);
  document.getElementById('pauseLabel').textContent = STATE.paused ? 'Публикация: на паузе' : 'Публикация: идёт';
}

function initPauseToggle() {
  document.getElementById('pauseToggle').addEventListener('click', async function () {
    haptic('light');
    const next = !STATE.paused;
    const res = await apiPost({ action: 'set_publish_pause', paused: next });
    if (!res.ok) {
      await alertAsync('Не удалось изменить: ' + (res.error || 'неизвестная ошибка'));
      return;
    }
    STATE.paused = !!res.paused;
    renderPauseToggle();
    haptic(STATE.paused ? 'warning' : 'success');
  });
}

// ---------- вкладки ----------
var TABS = ['moderation', 'queue', 'sources', 'stats'];

function switchTab(tab) {
  haptic('light');
  TABS.forEach(function (t) {
    const cap = t.charAt(0).toUpperCase() + t.slice(1);
    document.getElementById('tab' + cap).classList.toggle('active', t === tab);
    document.getElementById('view' + cap).classList.toggle('hidden', t !== tab);
  });
}

function initTabs() {
  document.getElementById('tabModeration').addEventListener('click', function () { switchTab('moderation'); });
  document.getElementById('tabQueue').addEventListener('click', function () { switchTab('queue'); loadQueue(); });
  document.getElementById('tabSources').addEventListener('click', function () { switchTab('sources'); loadSources(); });
  document.getElementById('tabStats').addEventListener('click', function () { switchTab('stats'); loadSwipeStats(); });
  document.getElementById('refreshBtn').addEventListener('click', function () {
    haptic('light');
    loadData();
    if (!document.getElementById('viewQueue').classList.contains('hidden')) loadQueue();
  });
}

// ---------- вход по токену ----------
function boot() {
  initTelegram();
  initSettings();
  initPauseToggle();
  initTabs();

  if (!getToken()) {
    document.getElementById('gate').classList.remove('hidden');
    document.getElementById('tokenSave').addEventListener('click', function () {
      const v = document.getElementById('tokenInput').value.trim();
      if (!v) return;
      localStorage.setItem(TOKEN_KEY, v);
      document.getElementById('gate').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      loadData();
      loadSources();
    });
    return;
  }
  document.getElementById('app').classList.remove('hidden');
  loadData();
  loadSources();
}
