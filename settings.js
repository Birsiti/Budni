// изменено 2026-09-30 23:50
// ============================================================
// Будни_BY — переключатель темы в шапке (client.html и admin.html): одна кнопка без меню.
// На тёмной теме горит солнце (тап → светлая), на светлой — луна (тап → тёмная).
// Первый запуск следует теме Telegram/системы; после тапа выбор запоминается (PREFS.theme).
// Вибрация включена всегда — отдельной настройки больше нет.
// Требует в разметке кнопку #settingsBtn с двумя SVG (.ico-sun и .ico-moon — переключаются
// CSS по data-theme, см. theme.css).
// Глобалы из app.js: PREFS, savePrefs, applyTelegramTheme, haptic.
// Экспортирует: initSettings.
// ============================================================

function initSettings() {
  const btn = document.getElementById('settingsBtn');
  if (!btn) return;

  function refresh() {
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    btn.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
    btn.setAttribute('aria-pressed', dark ? 'false' : 'true');
  }

  btn.addEventListener('click', function () {
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    PREFS.theme = dark ? 'light' : 'dark';
    savePrefs();
    applyTelegramTheme();
    refresh();
    haptic('light');
  });

  refresh();
}
