// изменено 2026-09-19 13:40
// ============================================================
// Будни_BY client — свайп-лента вакансий.
// Фильтр (формат рядом/вахта, город, направление, без опыта) — в панели,
// открывается пилюлей-триггером наверху ленты (#filterPillBtn).
// Глобалы из app.js: apiPost (client.html), haptic, escapeHtml, telegramUser,
//   SECTORS, telHref, alertAsync, shareText.
// Глобалы из client.html: setFavCount, flashFavHeart.
// Экспортирует: loadDeck, FILTER, filterIsActive, updateFilterSummary,
//   applyProfileToFilter, applyFilterFromPanel (последняя — таб «Вакансии» в
//   client.html зовёт её при открытой панели, не заставляя листать до низа);
//   BY_CITIES, BY_POSITIONS, bindSuggest — данные и общий дропдаун-компонент
//   подсказки, переиспользуются в profile.js (город) и post.js (город, должность).
// ============================================================

// города РБ + районы/посёлки Минской области — выгружены из реальной базы
// вакансий (город встречается 2+ раз), а не придуманы руками. Обновлять
// через db/suggest_data.py на iMac, если список заметно устарел.
var BY_CITIES = ["Барановичи", "Белоозерск", "Белыничи", "Березино", "Берёза", "Бобруйск",
  "Болбасово", "Большая Берестовица", "Большой Тростенец", "Борисов", "Боровляны", "Браслав",
  "Брест", "Буда-Кошелёво", "Валерьяново", "Великий Камень", "Ветка", "Витебск", "Волковыск",
  "Воложин", "Вороново", "Высокое", "Ганцевичи", "Гатово", "Глубокое", "Гомель", "Горки",
  "Городок", "Гродно", "Дзержинск", "Добруш", "Докшицы", "Дрогичин", "Дубровно", "Дятлово",
  "Ельск", "Жабинка", "Ждановичи", "Житковичи", "Жлобин", "Жодино", "Заславль", "Зельва",
  "Иваново", "Ивацевичи", "Ивье", "Калинковичи", "Каменец", "Каменная Горка", "Кировск",
  "Климовичи", "Кличев", "Кобрин", "Колодищи", "Коммунарка", "Копище", "Кореличи",
  "Костюковичи", "Краснополье", "Кричев", "Лельчицы", "Лепель", "Лида", "Логойск", "Лунинец",
  "Любань", "Ляховичи", "Малорита", "Марьина Горка", "Мачулищи", "Микашевичи", "Минск",
  "Минский район", "Михановичи", "Могилёв", "Мозырь", "Молодечно", "Мстиславль", "Мядель",
  "Нарочь", "Несвиж", "Новогрудок", "Новолукомль", "Новополоцк", "Озерцо", "Орша", "Осиповичи",
  "Островец", "Острошицкий Городок", "Ошмяны", "Пинск", "Полоцк", "Поставы", "Привольное",
  "Привольный", "Прилесье", "Прилуки", "Пружаны", "Радошковичи", "Ратомка", "Речица",
  "Рогачёв", "Ружаны", "Светлогорск", "Сеница", "Сенно", "Скидель", "Славгород", "Слоним",
  "Слуцк", "Смиловичи", "Смолевичи", "Сморгонь", "Солигорск", "Старые Дороги", "Столбцы",
  "Столин", "Тарасово", "Узда", "Уручье", "Ушачи", "Фаниполь", "Ходзеж", "Хойники", "Цнянка",
  "Чаусы", "Червень", "Чечерск", "Чижовка", "Шабаны", "Шклов", "Шумилино", "Щомыслица", "Щучин"];

// должности — топ-450 реально встречавшихся (2+ раза) в структурированных
// вакансиях, для подсказки под полем «Должность». Та же выгрузка, что BY_CITIES.
var BY_POSITIONS = ["Грузчик", "Продавец", "Уборщица", "Продавец-консультант", "Водитель-международник", "Повар", "Подсобный рабочий", "Бухгалтер", "Менеджер по продажам", "Водитель", "Разнорабочий", "Подсобник", "Кассир", "Кладовщик", "Комплектовщик", "Уборщик помещений", "Водитель автомобиля", "Официант", "Водитель такси", "Главный бухгалтер", "Продавец-кассир", "Уборщик", "Автослесарь", "Электрогазосварщик", "Слесарь по ремонту автомобилей", "Дворник", "Бариста", "Администратор", "Электромонтер по ремонту и обслуживанию электрооборудования", "Швея", "Рабочий", "Хозяюшка", "Каменщик", "Электромонтажник", "Контролер-кассир", "Водитель-экспедитор", "Курьер", "Автомойщик", "Водитель погрузчика", "Охранник", "Старший контролер-кассир", "Укладчик-упаковщик", "Помощник воспитателя", "Тракторист", "Слесарь-ремонтник", "Сварщик", "Водитель грузового автомобиля", "Водитель категории се", "Кладовщик-комплектовщик", "Рабочий по комплексному обслуживанию и ремонту зданий и сооружений", "Воспитатель дошкольного образования", "Парикмахер-универсал", "Повар-универсал", "Водитель категории с", "Штукатур", "Юрисконсульт", "Машинист экскаватора", "Работник склада", "Специалист по продажам", "Бармен", "Кухонный рабочий", "Шиномонтажник", "Специалист по работе с клиентами", "Разгрузчик", "Менеджер", "Санитарка", "Водитель-курьер", "Подсобные рабочие", "Отделочник", "Разнорабочий / подсобный рабочий", "Монтажник строительных конструкций", "Менеджер по работе с клиентами", "Ветеринарный врач", "Кондитер", "Специалист пункта выдачи заказов", "Маляр", "Слесарь-сантехник", "Водитель категории c", "Водитель международных перевозок", "Слесарь механосборочных работ", "Слесарь по ремонту грузовых автомобилей", "Водитель международных грузоперевозок", "Упаковщик", "Станочник деревообрабатывающих станков", "Фасадчик", "Подработка", "Пекарь", "Инженер по охране труда", "Водитель категории е", "Горничная", "Электросварщик", "Водитель автомобиля грузового", "Медицинская сестра", "Бухгалтер по заработной плате", "Водитель самосвала", "Парикмахер", "Промоутер", "Рабочий зеленого строительства", "Фасовщица", "Главный инженер", "Бетонщик", "Водитель категории d", "Уборщик территорий", "Дорожный рабочий", "Сотрудник пункта выдачи заказов", "Сантехник", "Производитель работ", "Кухонный работник", "Подсобный рабочий / разнорабочий", "Уборка", "Инженер-проектировщик", "Производитель общестроительных работ (прораб)", "Повар горячего цеха", "Экономист", "Мойщик посуды", "Кассир, продавец, грузчик", "Монтажник", "Администратор-кассир", "Кладовщик-грузчик", "Сварщик-аргонщик", "Токарь", "Рабочий строительных специальностей", "Сторож", "Автомаляр-подготовщик", "Инженер по сметной работе", "Водитель категории b", "Водитель автобуса", "Инженер-конструктор", "Грузчик-разнорабочий", "Инженер-энергетик", "Уборщик территории / дворник", "Заместитель главного бухгалтера", "Автослесарь грузовых автомобилей", "Грузчик-комплектовщик", "Контролёр-кассир", "Инженер пто / инженер-сметчик", "Плиточник", "Водитель-международник категории ce", "Повар-кассир", "Парикмахер (мастер-универсал)", "Продавец непродовольственных товаров", "Инженер-электрик", "Мастер по маникюру и педикюру", "Продавец продовольственных товаров", "Инженер-механик", "Геодезист", "Специалист по организации закупок", "Водитель категории с / е", "Повар-сушист", "Клинер", "Подсобный работник", "Маляр по металлу", "Водитель яндекс.такси", "Водитель категории ce", "Инженер", "Специалист по продаже", "Сортировщик вторичного сырья", "Монтажник связи-кабельщик", "Слесарь аварийно-восстановительных работ", "Водитель категории в", "Инженер пто", "Сборщик мебели", "Слесарь мср", "Стропальщик", "Повар-шаурмист", "Слесарь кипиа", "Врач-стоматолог-терапевт", "Мерчендайзер", "Подсобные работы", "Грузчики", "Тракторист-машинист сельскохозяйственного производства", "Педагог-психолог", "Электросварщик ручной сварки", "Прораб общестроительных работ", "Оператор линии", "Кровельщик", "Уборщик служебных помещений", "Музыкальный руководитель", "Слесарь", "Помощник повара", "Водитель категории в / с", "Столяр-станочник", "Бармен-официант", "Слесарь сантехнических работ", "Электромонтер-линейщик", "Помощник официанта", "Ведущий бухгалтер", "Монтажник наружных трубопроводов", "Работа на складе", "Столяр", "Повар-пиццер", "Специалист по кадрам", "Рабочий на производстве", "Электромонтер опс", "Слесарь-сантехник / монтажник сантехнических систем и оборудования", "Специалист по выдаче заказов", "Мастер", "Автослесарь / автомеханик", "Сборщик заказов", "Массажист", "Электрик", "Педагог социальный", "Продавец (продукты питания)", "Член бригады ресторана", "Логист-экспедитор", "Мойщик автомобилей", "Продавец - консультант", "Мастер ногтевого сервиса", "Швея-портной", "Машинист экскаватора-погрузчика", "Хозяйка", "Инженер-технолог", "Рабочий по комплексному обслуживанию зданий и сооружений", "Учитель-дефектолог", "Электрик / электромонтажник", "Повар шаурмист", "Электромонтер", "Работник автомойки", "Электромонтер охранно-пожарной сигнализации", "Жестянщик", "Инженер-электроник", "Кровельщик, универсал, подсобник", "Рабочий по комплексному обслуживанию зданий", "Оператор машинного доения", "Уборщик территории", "Повар 3-5 разряда", "Педагог дополнительного образования", "Слесарь по ремонту и обслуживанию оборудования", "Помощник", "Тракторист-машинист", "Монтажник санитарно-технических систем и оборудования", "Автоэлектрик", "Сварщик металлоконструкций", "Арматурщик", "Штукатуры", "Монтажник металлоконструкций", "Администратор салона красоты", "Культорганизатор", "Рамщик ленточной пилорамы", "Руководитель по военно-патриотическому воспитанию", "Сборщик", "Наладчик оборудования", "Машинист бульдозера", "Машинист автовышки и автогидроподъемника", "Механик", "Оператор станков с программным управлением", "Мойщик посуды / кухонный рабочий", "Разнорабочий / рабочий на производство", "Офис-менеджер / помощник руководителя", "Сборщик мусора", "Демонтажник", "Строитель-отделочник", "Разнорабочие", "Бухгалтер на первичную документацию", "Работник на шиномонтаж", "Электромонтер по эксплуатации распределительных сетей", "Строитель", "Маркетолог", "Уборщик служебных / производственных помещений", "Фотограф", "Мастер общестроительных работ (прораб)", "Слесарь-инструментальщик", "Администратор ресторана", "Водитель автомобиля такси", "Оператор эвм", "Помощница-хозяюшка", "Упаковщики", "Кладовщик / работник склада", "Плотник", "Сотрудник пункта выдачи", "Водитель манипулятора", "Ветеринарный врач-гинеколог", "Повар холодного цеха", "Водитель-международник / водитель категории с / е", "Системный администратор", "Почтальон", "Машинист буровой установки", "Уборщик производственных помещений", "Врач-стоматолог-ортопед", "Инженер по техническому надзору за строительством", "Автомаляр", "Плотник-бетонщик", "Приемщик товаров", "Повар-кондитер", "Хостес", "Заведующий производством", "Упаковщик, грузчик", "Водитель-международник категории с / е", "Машинист крана автомобильного", "Мастер участка", "Клинер / специалист по уборке", "Помощник администратора", "Кухонная рабочая", "Работник", "Клинер, дежурный клинер", "Ведущий юрисконсульт", "Специалист по закупкам", "Главный зоотехник", "Слесарь-ремонтник морских контейнеров", "Слесарь-электрик по ремонту электрооборудования", "Штукатур-маляр", "Слесарь металлоконструкций", "Торговый представитель", "Сотрудник", "Фрезеровщик", "Курьер-водитель", "Hr-менеджер", "Инженер по пожарной безопасности", "Облицовщик-плиточник", "Продавец-бариста", "Мастер / прораб", "Оператор производственной линии", "Инженер по материально-техническому снабжению", "Комплектовщики, грузчики, кассиры, продавцы, уборщики, подсобные рабочие", "Машинист расфасовочно-упаковочных машин", "Сушист", "Термоотделочник", "Водитель автобуса (маршрутное такси)", "Водитель категории c / е", "Заведующий магазином", "Мастер по ремонту одежды / портной", "Продавец одежды", "Шиномонтажник / съемщик колес", "Менеджер по продажам b2b", "Врач-терапевт", "Помощник по установке концертного оборудования", "Мастер-приемщик", "Парикмахер, парикмахер-универсал", "Обойщик мягкой мебели", "Комплектовщик, грузчик, кассир, продавец, уборщик, повар, подсобный рабочий", "Электромонтер по ремонту и обслуживанию электроборудования", "Работник склада / комплектовщик", "Рамщик", "Маляры", "Делопроизводитель", "Экономист по труду", "Производитель общестроительных работ", "Логист / специалист по грузоперевозкам", "Электромонтер по обслуживанию и ремонту электрооборудования", "Специалист по оказанию розничных банковских услуг", "Мойщица посуды", "Воспитатель", "Тренер", "Учитель русского языка и литературы", "Менеджер пункта выдачи заказов", "Водитель автобуса категории d", "Закройщик швейного производства", "Диспетчер", "Водитель международных перевозок категории ce", "Оператор поломоечной машины", "Токарь-универсал", "Маляр по дереву, сварщик металлоконструкций", "Специалисты и разнорабочие", "Главный инженер по эксплуатации зданий и сооружений", "Специалист пвз", "Монтажник сайдинга", "Упаковщик/ца", "Машинист (кочегар) котельной", "Мастер / прораб общестроительных работ", "Сотрудник на пвз", "Консультант", "Сборщик обуви", "Автомеханик / автослесарь", "Сборщик корпусной мебели", "Риэлтер", "Продавец консультант", "Автослесарь по ремонту легковых автомобилей", "Менеджер по оптовым продажам", "Дворник / уборщик", "Бухгалтер по расчету заработной платы", "Электромонтер по обслуживанию электрооборудования", "Исполнитель художественно-оформительских работ", "Шеф-повар", "Маляр металлоконструкций", "Ведущий инженер-механик", "Менеджер по туризму", "Прораб / мастер", "Машинист экструдера", "Главный бухгалтер / бухгалтер", "Мастер-прораб", "Слесарь по контрольно-измерительным приборам и автоматике", "Водитель категории е / се", "Инженер по техническому надзору", "Smm-специалист", "Мастер-прораб смр", "Бармен, официант", "Швея / термоотделочник", "Уборщица, дворник", "Педагог-организатор", "Инспектор по кадрам", "Каменщик / плиточник / фасадчик", "Работник торгового зала", "Парикмахер-колорист", "Уборщик административных помещений", "Шлифовщик по дереву", "Штукатур-отделочник", "Водитель категории b / c / e", "Прораб", "Инженер-проектировщик / инженер-конструктор", "Фасадчик-отделочник", "Водитель категории be / ce / de", "Инструктор по вождению", "Тестовод", "Рабочий по комплексной уборке и содержанию домовладений", "Мастер сантехнических работ", "Методист", "Специалист по уборке", "Официант-бармен", "Мастер производственного участка", "Врач ультразвуковой диагностики", "Руководитель физического воспитания", "Бетонщик-монолитчик", "Формовщик изделий и конструкций", "Водитель фронтального погрузчика", "Велокурьер", "Главный энергетик", "Работник ресторана", "Сметчик", "Заведующий филиалом", "Оператор call-центра", "Контролер водопроводного хозяйства", "Мастер-прораб общестроительных работ", "Слесарь по ремонту оборудования котельных и пылеприготовительных цехов", "Работник магазина", "Оператор чпу", "Сантехник-монтажник внутренних санитарно-технических систем", "Учитель математики", "Фасовщик-упаковщик", "Smm-менеджер", "Рабочий на стройке", "Сборщик мягкой мебели", "Воспитатель группы продленного дня", "Помощник бариста", "Рабочий на складе", "Овощевод", "Инженер-сметчик / инженер пто", "Маляры, плиточники", "Рабочий на демонтаже", "Пекарь-тестовод", "Фасовщик", "Кассир-администратор", "Бариста-кассир", "Комплектовщик товаров", "Машинист автокрана", "Репетитор", "Столяр-плотник", "Слесарь по сборке металлоконструкций"];

// ================= ФИЛЬТР ЛЕНТЫ =================
var FILTER_KEY = 'budni_filter';
var FILTER = { city: '', sectors: [], noExperience: false, jobType: 'рядом' };
try { FILTER = Object.assign(FILTER, JSON.parse(localStorage.getItem(FILTER_KEY) || '{}')); } catch (e) {}
if (!Array.isArray(FILTER.sectors)) FILTER.sectors = [];
if (FILTER.jobType !== 'вахта') FILTER.jobType = 'рядом';

function filterIsActive() { return !!FILTER.city || FILTER.sectors.length > 0 || !!FILTER.noExperience; }

// город не действует для вахты — прячем поле в панели, чтобы не путать
function applyJobTypeUI() {
  var r = document.querySelector('input[name="jobType"][value="' + FILTER.jobType + '"]');
  if (r) r.checked = true;
  document.getElementById('filterCityField').classList.toggle('hidden', FILTER.jobType === 'вахта');
}

function saveFilter() { try { localStorage.setItem(FILTER_KEY, JSON.stringify(FILTER)); } catch (e) {} }

// текст на пилюле-триггере фильтра (после "Фильтр · ..."); пусто, если
// ничего не задано — CSS сам не покажет "· " перед пустой строкой
function updateFilterSummary() {
  const parts = [];
  if (FILTER.jobType === 'вахта') parts.push('Вахта');
  if (FILTER.city) parts.push(FILTER.city);
  if (FILTER.sectors.length) parts.push(FILTER.sectors.length + ' напр.');
  if (FILTER.noExperience) parts.push('без опыта');
  document.getElementById('filterSummaryText').textContent = parts.join(', ');
}

function renderFilterSectorChips() {
  document.getElementById('filterSectors').innerHTML = SECTORS.map(function (s) {
    var on = FILTER.sectors.indexOf(s[0]) !== -1;
    return '<label class="chip"><input type="checkbox" value="' + s[0] + '"' + (on ? ' checked' : '') + '>' +
      '<span>' + s[1] + ' ' + s[0] + '</span></label>';
  }).join('');
}

// вызывается из profile.js после первого сохранения анкеты — подставить
// город/направления в фильтр, но только если пользователь ещё не настраивал
// его вручную (иначе перетрём его выбор)
function applyProfileToFilter(city, sectors) {
  if (localStorage.getItem(FILTER_KEY)) return false;
  FILTER.city = city || '';
  FILTER.sectors = Array.isArray(sectors) ? sectors.slice(0, 5) : [];
  saveFilter();
  document.getElementById('filterCity').value = FILTER.city;
  renderFilterSectorChips();
  updateFilterSummary();
  loadDeck();
  return true;
}

function closeFilterPanel() { document.getElementById('filterPanel').classList.add('hidden'); }

// Подсказка по вводу под текстовым полем — свой дропдаун, не <datalist>
// (в Telegram iOS WebView он ненадёжен/не показывается). Общая для города
// (BY_CITIES) и должности (BY_POSITIONS) — используется в фильтре ленты
// (deck.js), анкете (profile.js, шаг 1 — город) и форме размещения
// (post.js — город и должность). matchMode:
//   'prefix'   — совпадение с начала строки (город: «мин» → Минск + Минский район)
//   'contains' — совпадение в любом месте (должность: «продав» найдёт и
//                «Продавец», и «Продавец-консультант», и «Продавец одежды»)
function bindSuggest(input, box, list, matchMode) {
  if (!input || !box) return;

  function hide() { box.classList.add('hidden'); box.innerHTML = ''; }

  // клавиатура на iOS перекрывает поле/подсказку — как только видимая
  // область экрана реально сжалась (клавиатура выехала), подскроллим
  // поле в центр того, что осталось видно
  input.addEventListener('focus', function () {
    function reveal() { input.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    if (window.visualViewport) window.visualViewport.addEventListener('resize', reveal, { once: true });
    else setTimeout(reveal, 300);
  });

  input.addEventListener('input', function () {
    const q = input.value.trim().toLowerCase();
    if (!q) return hide();
    const matches = list.filter(function (c) {
      const i = c.toLowerCase().indexOf(q);
      return matchMode === 'contains' ? i !== -1 : i === 0;
    }).slice(0, 8);
    if (!matches.length) return hide();
    box.innerHTML = matches.map(function (c) {
      return '<button type="button" class="city-suggest-item">' + escapeHtml(c) + '</button>';
    }).join('');
    box.classList.remove('hidden');
  });
  input.addEventListener('blur', function () { setTimeout(hide, 150); }); // после клика по пункту
  box.addEventListener('click', function (e) {
    const btn = e.target.closest('.city-suggest-item');
    if (!btn) return;
    input.value = btn.textContent;
    hide();
    haptic('light');
  });
}

function initCitySuggest() {
  bindSuggest(document.getElementById('filterCity'), document.getElementById('citySuggest'), BY_CITIES, 'prefix');
}

// собирает поля панели в FILTER, сохраняет, закрывает панель, перегружает
// ленту — вызывается и с «Показать», и с тапа по уже активной вкладке
// «Вакансии» (см. client.html), чтобы не листать панель до самого низа
function applyFilterFromPanel() {
  FILTER.city = document.getElementById('filterCity').value.trim();
  FILTER.sectors = Array.prototype.slice
    .call(document.querySelectorAll('#filterSectors input:checked'))
    .map(function (i) { return i.value; });
  FILTER.noExperience = document.getElementById('filterNoExp').checked;
  const jt = document.querySelector('input[name="jobType"]:checked');
  FILTER.jobType = (jt && jt.value === 'вахта') ? 'вахта' : 'рядом';
  saveFilter();
  updateFilterSummary();
  closeFilterPanel();
  loadDeck();
}

function initFilterUI() {
  renderFilterSectorChips();
  document.getElementById('filterCity').value = FILTER.city;
  document.getElementById('filterNoExp').checked = !!FILTER.noExperience;
  applyJobTypeUI();
  updateFilterSummary();
  initCitySuggest();

  // формат (рядом/вахта) внутри панели — меняет только UI панели, применяется по «Показать»
  document.querySelectorAll('input[name="jobType"]').forEach(function (input) {
    input.addEventListener('change', function () {
      haptic('light');
      FILTER.jobType = input.value;
      applyJobTypeUI();
    });
  });

  document.getElementById('filterPillBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    haptic('light');
    // открыта — тап по пилюле закрывает и сразу сохраняет, как «Показать»;
    // закрыта — просто открываем, сохранять пока нечего
    if (document.getElementById('filterPanel').classList.contains('hidden')) {
      document.getElementById('filterPanel').classList.remove('hidden');
    } else {
      applyFilterFromPanel();
    }
  });
  document.getElementById('filterApply').addEventListener('click', function () {
    haptic('light');
    applyFilterFromPanel();
  });
  document.getElementById('filterReset').addEventListener('click', function () {
    haptic('light');
    FILTER = { city: '', sectors: [], noExperience: false, jobType: 'рядом' };
    saveFilter();
    document.getElementById('filterCity').value = '';
    document.getElementById('filterNoExp').checked = false;
    applyJobTypeUI();
    renderFilterSectorChips();
    updateFilterSummary();
    closeFilterPanel();
    loadDeck();
  });
}

// ================= СВАЙП-ЛЕНТА =================
var DECK = [];
var DECK_INDEX = 0;

async function loadDeck() {
  const wrap = document.getElementById('deckWrap');
  wrap.innerHTML = '<div class="empty">Загрузка…</div>';
  let res;
  try {
    res = await apiPost({ action: 'get_deck', city: FILTER.city, sectors: FILTER.sectors, noExperience: FILTER.noExperience, jobType: FILTER.jobType });
  } catch (e) { res = { ok: false, error: 'нет связи' }; }
  if (!res.ok) {
    wrap.innerHTML = '<div class="empty">Не получилось загрузить вакансии' +
      (res.error ? '<br><span class="mono" style="font-size:12px;opacity:.7">' + escapeHtml(res.error) + '</span>' : '') +
      '</div>';
    return;
  }
  DECK = res.deck || [];
  DECK_INDEX = 0;
  renderCard();
}

// подставляет <a> прямо на телефон/юзернейм внутри уже экранированного
// текста поста — вместо отдельной кнопки-дубля под карточкой. Строковый
// split/join, не regex — номер телефона содержит скобки/дефисы, которые
// пришлось бы экранировать как спецсимволы паттерна.
function linkifyContacts(escapedText, v) {
  var html = escapedText;
  var tel = telHref(v.phone);
  if (v.phone && tel) {
    var escPhone = escapeHtml(v.phone);
    html = html.split(escPhone).join('<a href="tel:' + escapeHtml(tel) + '" class="tel-link" data-tel="' + escapeHtml(v.phone) + '">' + escPhone + '</a>');
  }
  if (v.contact_username) {
    var escUser = escapeHtml(v.contact_username);
    var handle = v.contact_username.replace(/^@/, '');
    html = html.split(escUser).join('<a href="https://t.me/' + escapeHtml(handle) + '" target="_blank" rel="noopener">' + escUser + '</a>');
  }
  return html;
}

function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text); return; }
  } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (e) {}
}

// tel: в этой обёртке Telegram WebView, похоже, не открывает набор номера
// (у @юзернейма ссылка https://t.me/... открывается нормально, у tel: —
// нет, хотя оба вставлены одинаково через linkifyContacts) — гарантированный
// фолбэк: копируем номер и показываем его, tel: всё равно оставлен в href
// на случай, если где-то у пользователя сработает и он сам
document.addEventListener('click', function (e) {
  const a = e.target.closest('.tel-link');
  if (!a) return;
  const num = a.dataset.tel;
  copyToClipboard(num);
  haptic('light');
  alertAsync('Номер скопирован: ' + num);
});

// «поделиться» на карточке — та же shareText(), что и в Избранном
document.addEventListener('click', function (e) {
  if (!e.target.closest('.card-share-btn')) return;
  haptic('light');
  const v = DECK[DECK_INDEX];
  if (v) shareText(v.clean_text || v.position || '');
});

// конечный экран ленты — две ветки: «под фильтр пусто» (сбросить фильтр +
// подписаться на город, чтобы прислали в бот при появлении) и «вакансий
// вообще нет» (без действия, тут предлагать нечего)
function renderEmptyDeck() {
  const wrap = document.getElementById('deckWrap');
  document.getElementById('deckActions').classList.add('hidden');

  if (!filterIsActive()) {
    wrap.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-ico">👋</div>' +
        '<div class="empty-title">Вакансии закончились</div>' +
        '<p class="empty-sub">Загляните чуть позже — мы постоянно добавляем новые.</p>' +
      '</div>';
    return;
  }

  const subLabel = '🔔 Подписаться на «' + FILTER.city + '»';
  wrap.innerHTML =
    '<div class="empty-state">' +
      '<div class="empty-ico">🔍</div>' +
      '<div class="empty-title">Под фильтр ничего не нашлось</div>' +
      '<p class="empty-sub">Попробуйте другой город или направление.</p>' +
      '<button type="button" class="btn-primary" id="emptyResetBtn">Сбросить фильтр</button>' +
      (FILTER.city ? '<button type="button" class="btn-secondary" id="emptySubBtn">' + escapeHtml(subLabel) + '</button>' : '') +
    '</div>';

  document.getElementById('emptyResetBtn').addEventListener('click', function () {
    haptic('light');
    document.getElementById('filterReset').click(); // тот же сброс, что в панели
  });

  const subBtn = document.getElementById('emptySubBtn');
  if (subBtn) {
    subBtn.addEventListener('click', async function () {
      haptic('light');
      subBtn.disabled = true;
      subBtn.textContent = '…';
      const res = await apiPost({ action: 'add_subscription', city: FILTER.city, keyword: '' })
        .catch(function () { return { ok: false }; });
      if (res.ok) {
        haptic('success');
        subBtn.textContent = res.duplicate ? '✓ Уже подписаны' : '✓ Подписались, пришлём в бот';
      } else {
        haptic('error');
        subBtn.disabled = false;
        subBtn.textContent = subLabel;
      }
    });
  }
}

function renderCard() {
  const wrap = document.getElementById('deckWrap');
  if (DECK_INDEX >= DECK.length) { renderEmptyDeck(); return; }
  document.getElementById('deckActions').classList.remove('hidden');
  const v = DECK[DECK_INDEX];

  // на карточке — только «сигнальные» бейджи, которых нет в тексте поста.
  // «Без опыта» убран — дублирует и сводку в пилюле фильтра, и «Требования»
  // в самом тексте поста, лишняя строка над карточкой.
  const badges = [
    v.source === 'employer' ? '<span class="badge badge-employer">✓ Прямая</span>' : '',
    v.job_type === 'вахта' ? '<span class="badge">🧳 ' + escapeHtml(v.country || 'Вахта') + '</span>' : '',
  ].filter(Boolean).join('');

  wrap.innerHTML =
    '<div class="card" id="activeCard">' +
      '<div class="swipe-tag like" id="tagLike">НРАВИТСЯ</div>' +
      '<div class="swipe-tag skip" id="tagSkip">ПРОПУСТИТЬ</div>' +
      (badges ? '<div class="card-badges">' + badges + '</div>' : '') +
      '<div class="card-body">' + linkifyContacts(escapeHtml(v.clean_text || v.position || ''), v) + '</div>' +
      '<button type="button" class="card-share-btn" aria-label="Поделиться">↗</button>' +
    '</div>';
  bindCardGestures(document.getElementById('activeCard'));
}

// направленный жест: горизонталь → свайп карточки, вертикаль → отдаём
// нативному скроллу текста поста. Ось определяется по первым ~8px движения.
function bindCardGestures(card) {
  let startX = 0, startY = 0, dx = 0, startTime = 0, axis = null, active = false;

  card.addEventListener('pointerdown', function (e) {
    // тап начался на ссылке (телефон/юзернейм) или кнопке (поделиться) —
    // не встреваем вообще, иначе даже микро-дрожание пальца может увести
    // axis в 'x' и setPointerCapture перехватит клик
    if (e.target.closest('a, button')) return;
    active = true; axis = null; dx = 0;
    startX = e.clientX; startY = e.clientY; startTime = Date.now();
  });

  card.addEventListener('pointermove', function (e) {
    if (!active) return;
    const mx = e.clientX - startX, my = e.clientY - startY;
    if (axis === null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      if (Math.abs(my) > Math.abs(mx)) { active = false; return; } // вертикаль — скролл текста
      axis = 'x';
      try { card.setPointerCapture(e.pointerId); } catch (err) {}
    }
    dx = mx;
    card.style.transform = 'translate(' + dx + 'px,0) rotate(' + (dx / 20) + 'deg)';
    document.getElementById('tagLike').style.opacity = Math.max(0, dx / 90);
    document.getElementById('tagSkip').style.opacity = Math.max(0, -dx / 90);
  });

  function release() {
    if (axis !== 'x') { active = false; axis = null; return; }
    active = false; axis = null;
    const elapsed = Math.max(1, Date.now() - startTime);
    const velocity = Math.abs(dx) / elapsed; // px/мс
    // засчитываем и медленный осознанный драг (по расстоянию), и короткий
    // быстрый флик пальцем (по скорости)
    const isSwipe = Math.abs(dx) > 90 || (Math.abs(dx) > 36 && velocity > 0.35);
    if (isSwipe) {
      finishSwipe(dx > 0 ? 'like' : 'skip', card, dx);
    } else {
      card.style.transition = 'transform .2s';
      card.style.transform = '';
      setTimeout(function () { card.style.transition = ''; }, 200);
      document.getElementById('tagLike').style.opacity = 0;
      document.getElementById('tagSkip').style.opacity = 0;
    }
    dx = 0;
  }
  card.addEventListener('pointerup', release);
  card.addEventListener('pointercancel', release);
}

function finishSwipe(decision, card, dxAtRelease) {
  haptic(decision === 'like' ? 'success' : 'light');
  const v = DECK[DECK_INDEX];
  apiPost({
    action: 'record_swipe', telegramId: telegramUser.id, username: telegramUser.username || '',
    vacancyId: v.id, sector: v.sector, decision: decision,
  }).catch(function () {});

  if (decision === 'like') {
    flashFavHeart();
    var cur = parseInt(document.getElementById('favCount').textContent, 10) || 0;
    setFavCount(cur + 1);
  }

  // и лайк, и скип — карточка улетает и сразу следующая (без промежуточного шага)
  const flyX = (dxAtRelease && dxAtRelease < 0 ? -1 : (dxAtRelease > 0 ? 1 : (decision === 'like' ? 1 : -1))) * 640;
  card.style.transition = 'transform .26s ease-out';
  card.style.transform = 'translate(' + flyX + 'px,0) rotate(' + (flyX / 20) + 'deg)';
  setTimeout(function () { DECK_INDEX++; renderCard(); }, 240);
}

function bindDeckButtons() {
  document.getElementById('skipBtn').onclick = function () {
    const card = document.getElementById('activeCard');
    if (card) finishSwipe('skip', card, -1);
  };
  document.getElementById('likeBtn').onclick = function () {
    const card = document.getElementById('activeCard');
    if (card) finishSwipe('like', card, 1);
  };
}
