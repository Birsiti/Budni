// ============================================================
// Будни_BY — общий рантайм для client.html и admin.html.
// Грузится ПОСЛЕ https://telegram.org/js/telegram-web-app.js и инлайн-скрипта
// установки темы в <head>, но ДО фиче-модулей (deck.js, admin-*.js и т.д.).
//
// Namespace плоский, без IIFE и без сборщиков (конвенция студии) — все
// объявления ниже становятся глобальными и доступны каждому модулю.
// Экспортирует: tg, telegramUser, APPS_SCRIPT_URL, SECTORS, SECTOR_LIST,
// haptic, applyTelegramTheme, initTelegram, alertAsync, confirmAsync,
// escapeHtml, apiCall, bindPhoneMask, formatPhoneTail.
// ============================================================

var tg = window.Telegram ? window.Telegram.WebApp : null;

// ---------- личные настройки посетителя (тема + вибрация), localStorage ----------
// Тема: '' = как в Telegram/системе, 'light'/'dark' = ручной оверрайд.
// Синхронно применяется и в инлайн-скрипте <head> (анти-вспышка) — там своя копия
// логики чтения budni_prefs.theme.
var PREFS = { theme: '', haptics: true };
try {
  var _prefs = JSON.parse(localStorage.getItem('budni_prefs') || '{}');
  PREFS.theme = (_prefs.theme === 'light' || _prefs.theme === 'dark') ? _prefs.theme : '';
  PREFS.haptics = _prefs.haptics !== false;
} catch (e) {}

function savePrefs() {
  try { localStorage.setItem('budni_prefs', JSON.stringify(PREFS)); } catch (e) {}
}

function resolveScheme() {
  if (PREFS.theme) return PREFS.theme;
  return (tg && tg.colorScheme) ? tg.colorScheme
    : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
}

// ВСТАВЬ реальный URL деплоя Apps Script (тот же, что BUDNI_APPS_SCRIPT_URL).
// Одно место на оба мини-аппа — раньше дублировалось в двух HTML.
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyDoUgzfE7NIs1m57RapJbSMPdOMheg-e4I2qoyu6VPoBBQH9cigsGgprdtp00lOnbu/exec';

// сферы — синхронизировано с SECTORS в structurer.py и SECTOR_BUCKETS в Apps Script
var SECTORS = [
  ['Производство и строительство', '🏗️'], ['Транспорт и логистика', '🚚'],
  ['Торговля и услуги', '🛍️'], ['Гостиничный и ресторанный бизнес', '🏨'],
  ['Сельское хозяйство', '🌾'], ['Здравоохранение', '🏥'], ['Образование', '🎓'],
  ['Финансы и бухгалтерия', '📊'], ['IT и разработка', '💻'], ['Охрана и безопасность', '🛡️'],
  ['Офис и администрирование', '🗃️'], ['Клининг и уборка', '🧹'], ['Другое', '🗂️'],
];
var SECTOR_LIST = SECTORS.map(function (s) { return s[0]; });

function haptic(style) {
  if (!PREFS.haptics) return; // выключено в настройках
  if (tg && tg.HapticFeedback) {
    if (['success', 'error', 'warning'].includes(style)) tg.HapticFeedback.notificationOccurred(style);
    else tg.HapticFeedback.impactOccurred(style || 'light');
  }
}

function applyTelegramTheme() {
  const scheme = resolveScheme();
  document.documentElement.setAttribute('data-theme', scheme);
  if (tg) {
    const s = getComputedStyle(document.documentElement);
    try { tg.setHeaderColor(s.getPropertyValue('--surface').trim()); tg.setBackgroundColor(s.getPropertyValue('--bg').trim()); } catch (e) {}
  }
}

// Промис-обёртка над showAlert — внутри Telegram нативный алерт, window.alert
// только как фолбэк вне Telegram. Не звать window.alert напрямую в модулях.
function alertAsync(message) {
  return new Promise((resolve) => {
    if (tg && tg.showAlert && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')) {
      try { tg.showAlert(message, resolve); return; } catch (e) {}
    }
    window.alert(message); resolve();
  });
}

// То же для confirm.
function confirmAsync(message) {
  return new Promise((resolve) => {
    if (tg && tg.showConfirm && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')) {
      try { tg.showConfirm(message, resolve); return; } catch (e) {}
    }
    resolve(window.confirm(message));
  });
}

function initTelegram() {
  if (!tg) return;
  tg.ready(); tg.expand();
  applyTelegramTheme();
  tg.onEvent && tg.onEvent('themeChanged', applyTelegramTheme);
  if (tg.isVersionAtLeast && tg.isVersionAtLeast('7.7')) { try { tg.disableVerticalSwipes(); } catch (e) {} }
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// ---------- пользователь: реальный Telegram ID, либо демо-id для теста вне Telegram ----------
function getOrCreateDemoUser() {
  let id = localStorage.getItem('budni_demo_id');
  if (!id) { id = 'demo-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('budni_demo_id', id); }
  return { id: id, username: 'гость' };
}
var telegramUser = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : getOrCreateDemoUser();

// Низкоуровневый POST на Apps Script. client.html и admin.html оборачивают
// его в свой apiPost со своей авторизацией (initData у клиента, token у
// админки) — без явного Content-Type, иначе браузер шлёт preflight OPTIONS,
// который Apps Script веб-апп не обрабатывает.
async function apiCall(payload) {
  const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
  return res.json();
}

// ---------- маска телефона +375 XX-XXX-XX-XX ----------
function bindPhoneMask(el) {
  el.addEventListener('input', function () {
    const digits = el.value.replace(/\D/g, '').slice(0, 9);
    let out = digits;
    if (digits.length > 2) out = digits.slice(0, 2) + '-' + digits.slice(2);
    if (digits.length > 5) out = digits.slice(0, 2) + '-' + digits.slice(2, 5) + '-' + digits.slice(5);
    if (digits.length > 7) out = digits.slice(0, 2) + '-' + digits.slice(2, 5) + '-' + digits.slice(5, 7) + '-' + digits.slice(7);
    el.value = out;
  });
}

// 9 цифр (или строка с мусором/префиксом) -> "XX-XXX-XX-XX", иначе '' .
function formatPhoneTail(value) {
  let d = String(value || '').replace(/\D/g, '');
  if (d.length > 9 && d.slice(0, 3) === '375') d = d.slice(3);
  d = d.slice(-9);
  if (d.length !== 9) return '';
  return d.slice(0, 2) + '-' + d.slice(2, 5) + '-' + d.slice(5, 7) + '-' + d.slice(7);
}
