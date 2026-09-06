// ============================================================
// Будни_BY — поповер настроек (☀️ в шапке): тема + вибрация.
// Общий для client.html и admin.html. Требует в разметке кнопку
// #settingsBtn и пустой контейнер #settingsPop (позиционируется абсолютно
// внутри .topbar с position:relative).
// Глобалы из app.js: PREFS, savePrefs, applyTelegramTheme, haptic.
// Экспортирует: initSettings.
// ============================================================

function initSettings() {
  const btn = document.getElementById('settingsBtn');
  const pop = document.getElementById('settingsPop');
  if (!btn || !pop) return;

  function opt(group, val, label) {
    return '<button class="set-opt" data-group="' + group + '" data-val="' + val + '">' + label + '</button>';
  }

  pop.innerHTML =
    '<div class="set-label">Оформление</div>' +
    '<div class="set-seg" data-group="theme">' +
      opt('theme', '', 'Авто') + opt('theme', 'dark', 'Тёмная') + opt('theme', 'light', 'Светлая') +
    '</div>' +
    '<div class="set-label">Вибрация</div>' +
    '<div class="set-seg" data-group="haptics">' +
      opt('haptics', 'on', 'Вкл') + opt('haptics', 'off', 'Выкл') +
    '</div>';

  function refresh() {
    pop.querySelectorAll('.set-opt').forEach(function (o) {
      const g = o.getAttribute('data-group');
      const v = o.getAttribute('data-val');
      const on = g === 'theme' ? (PREFS.theme === v) : ((v === 'on') === PREFS.haptics);
      o.classList.toggle('is-on', on);
    });
  }

  pop.querySelectorAll('.set-opt').forEach(function (o) {
    o.addEventListener('click', function () {
      const g = o.getAttribute('data-group');
      const v = o.getAttribute('data-val');
      if (g === 'theme') { PREFS.theme = v; savePrefs(); applyTelegramTheme(); }
      else { PREFS.haptics = (v === 'on'); savePrefs(); }
      refresh();
      haptic('light');
    });
  });

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    pop.classList.toggle('hidden');
    haptic('light');
  });
  pop.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function () { pop.classList.add('hidden'); });

  refresh();
}
