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
var STATE = { suspicious: [], stats: null, sources: [], loading: false, paused: false };

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
  renderModeration();
  renderStats();
  renderPauseToggle();
  document.getElementById('modCount').textContent = STATE.suspicious.length;
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
function switchTab(tab) {
  haptic('light');
  document.getElementById('tabModeration').classList.toggle('active', tab === 'moderation');
  document.getElementById('tabSources').classList.toggle('active', tab === 'sources');
  document.getElementById('tabStats').classList.toggle('active', tab === 'stats');
  document.getElementById('viewModeration').classList.toggle('hidden', tab !== 'moderation');
  document.getElementById('viewSources').classList.toggle('hidden', tab !== 'sources');
  document.getElementById('viewStats').classList.toggle('hidden', tab !== 'stats');
}

function initTabs() {
  document.getElementById('tabModeration').addEventListener('click', function () { switchTab('moderation'); });
  document.getElementById('tabSources').addEventListener('click', function () { switchTab('sources'); loadSources(); });
  document.getElementById('tabStats').addEventListener('click', function () { switchTab('stats'); });
  document.getElementById('refreshBtn').addEventListener('click', function () { haptic('light'); loadData(); });
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
