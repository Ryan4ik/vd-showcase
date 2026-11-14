(() => {
  'use strict';
  const root = document.getElementById('vd-world');
  const config = window.VD_CONTENT || {};
  function setArrowLabel(element, label, direction) {
    element.textContent = label;
    if (!direction) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'v-arrow');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('viewBox', '0 0 16 16');
    const use = document.createElementNS(svg.namespaceURI, 'use');
    use.setAttribute('href', '#vd-arrow-' + direction);
    svg.append(use);
    element.append(' ', svg);
  }
  const emblem = root.querySelector('.v-hero .v-orbit');
  if (emblem) {
    const hitArea = document.createElement('div');
    hitArea.className = 'v-orbit v-orbit-hit';
    hitArea.setAttribute('aria-hidden', 'true');
    emblem.after(hitArea);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    function resetTilt() {
      for (const property of ['x', 'y', 'glow-x', 'glow-y', 'glow-opacity']) {
        emblem.style.removeProperty('--emblem-' + property);
      }
    }
    hitArea.addEventListener('pointermove', event => {
      if (reducedMotion.matches || event.pointerType === 'touch') return;
      const bounds = hitArea.getBoundingClientRect();
      const x = 2 * (event.clientX - bounds.left) / bounds.width - 1;
      const y = 2 * (event.clientY - bounds.top) / bounds.height - 1;
      emblem.style.setProperty('--emblem-x', (-y * 16) + 'deg');
      emblem.style.setProperty('--emblem-y', (x * 16) + 'deg');
      emblem.style.setProperty('--emblem-glow-x', (50 + x * 34) + '%');
      emblem.style.setProperty('--emblem-glow-y', (50 + y * 34) + '%');
      emblem.style.setProperty('--emblem-glow-opacity', '.75');
    });
    hitArea.addEventListener('pointerleave', resetTilt);
    reducedMotion.addEventListener('change', resetTilt);
  }
  const zoneData = {
    comfort: { name: 'COMFORT', seats: 'ПК 01–15 · общий зал', copy: '15 игровых станций в общем зале. Приходи один или собирай друзей для совместных матчей.', price: 160 },
    vip: { name: 'SOLO VIP', seats: 'ПК 16–17 · приватные боксы', copy: 'Своё пространство для игры. Приватные боксы с мышью Logitech Superlight 2 и наушниками Logitech G PRO.', price: 220 },
    duo: { name: 'DUO', seats: 'ПК 18–19 · комната для двоих', copy: 'Два компьютера в отдельной комнате. Для парной игры и совместных прохождений.', price: 190 },
    trio: { name: 'TRIO ROOM', seats: 'ПК 20–25 · две комнаты по 3 ПК', copy: 'Собирайтесь втроём. Две отдельные комнаты: места 20–22 и 23–25.', price: 190 },
    boot: { name: 'BOOT CAMP', seats: 'ПК 26–30 · командная комната', copy: 'Пять компьютеров для полного состава команды. Тренировки, общение и игра рядом.', price: 180 },
    ps: { name: 'PS5 PRO', seats: 'Консольная зона · до 4 человек', copy: 'PlayStation 5 Pro и большой экран 65″, 120 Гц. Бронирование консольной зоны — через администратора.', price: 360 }
  };
  const price = new Intl.NumberFormat('ru-RU');
  let selection = { zone: 'comfort', pc: null };
  function choose(zone, pc = null) {
    const data = zoneData[zone];
    if (!data) return;
    selection = { zone, pc };
    root.querySelector('[data-plan-title]').textContent = data.name;
    root.querySelector('[data-plan-meta]').textContent = pc ? 'ВЫБРАН ПК ' + String(pc).padStart(2, '0') : data.seats;
    root.querySelector('[data-plan-copy]').textContent = data.copy;
    const tariffZone = { comfort: 'Comfort', vip: 'Solo VIP', duo: 'Duo / Trio', trio: 'Duo / Trio', boot: 'Boot Camp', ps: 'PS5 Pro' }[zone];
    const packages = root.querySelector('[data-plan-packages]');
    packages.replaceChildren();
    root.querySelectorAll('[data-hours][data-value]').forEach(tariff => {
      if (tariff.dataset.zone !== tariffZone) return;
      const row = document.createElement('div');
      const duration = document.createElement('dt');
      const cost = document.createElement('dd');
      duration.textContent = tariff.dataset.hours;
      cost.textContent = price.format(Number(tariff.dataset.value)) + ' ₽';
      row.append(duration, cost);
      packages.append(row);
    });
    root.querySelector('[data-plan-status]').textContent = pc ? `ПК ${pc}, ${data.name}. Наличие на нужное время подтвердит администратор.` : zone === 'ps' ? 'Назови дату, время и количество гостей при бронировании PS5 Pro.' : 'Выбери место на схеме и сообщи администратору дату и время визита.';
    root.querySelectorAll('[data-plan-zone]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.planZone === zone)));
    root.querySelectorAll('[data-pc-number]').forEach(b => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.pcNumber) === pc));
      b.dataset.zoneActive = String(b.dataset.pcZone === zone);
    });
    root.querySelector('[data-seat-picker]').hidden = zone === 'ps';
    const choices = root.querySelector('[data-seat-choices]');
    choices.replaceChildren();
    root.querySelectorAll(`[data-pc-zone="${zone}"]`).forEach(seat => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = seat.dataset.pcNumber;
      button.setAttribute('aria-label', seat.getAttribute('aria-label'));
      button.setAttribute('aria-pressed', String(Number(seat.dataset.pcNumber) === pc));
      button.addEventListener('click', () => { choose(zone, Number(seat.dataset.pcNumber)); choices.querySelector(`[aria-label="${seat.getAttribute('aria-label')}"]`)?.focus({preventScroll:true}); });
      choices.append(button);
    });
    root.querySelector('[data-copy-choice]').textContent = 'Скопировать выбор';
  }
  root.querySelectorAll('[data-plan-zone]').forEach(b => b.addEventListener('click', () => choose(b.dataset.planZone)));
  root.querySelectorAll('[data-pc-number]').forEach(b => b.addEventListener('click', () => choose(b.dataset.pcZone, Number(b.dataset.pcNumber))));
  choose('comfort');
  root.querySelector('[data-floor-zoom]').addEventListener('click', e => {
    const scroller = root.querySelector('.v-floor-scroll');
    const zoomed = scroller.dataset.zoomed !== 'true';
    scroller.dataset.zoomed = String(zoomed);
    e.currentTarget.setAttribute('aria-pressed', String(zoomed));
    e.currentTarget.textContent = zoomed ? 'Показать целиком' : 'Увеличить +';
    setArrowLabel(root.querySelector('[data-zoom-hint]'), zoomed ? 'Листай схему вбок' : 'Вся схема клуба', zoomed ? 'horizontal' : null);
    if (!zoomed) scroller.scrollLeft = 0;
  });
  root.querySelector('[data-copy-choice]').addEventListener('click', async e => {
    const button = e.currentTarget;
    const text = `Здравствуйте! Хочу забронировать ${selection.pc ? 'ПК ' + selection.pc + ' (' + zoneData[selection.zone].name + ')' : 'зону ' + zoneData[selection.zone].name} в VD на Смоленском переулке, 9.`;
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      button.textContent = 'Выбор скопирован ✓';
      root.querySelector('[data-plan-status]').textContent = 'Сообщение скопировано. Вставь его в переписку с клубом и добавь дату, время и количество гостей.';
    } catch {
      root.querySelector('[data-plan-status]').textContent = text + ' Укажи дату, время и количество гостей в сообщении клубу.';
    }
  });
  const menuButton = root.querySelector('.v-menu-toggle');
  const menu = root.querySelector('.v-links');
  function closeMenu() { menu.dataset.open = 'false'; menuButton.setAttribute('aria-expanded', 'false'); }
  menuButton.addEventListener('click', () => { const open = menu.dataset.open !== 'true'; menu.dataset.open = String(open); menuButton.setAttribute('aria-expanded', String(open)); });
  menu.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.dataset.open === 'true') { closeMenu(); menuButton.focus(); } });
  const mapFrame = root.querySelector('[data-yandex-map]');
  const landmarks = {
    club: { label: 'VD Club · Смоленский переулок, 9', url: 'https://yandex.ru/map-widget/v1/?ll=35.925032%2C56.852515&z=16&ol=biz&oid=170299788452' },
    smolensky: { label: 'Остановка «Смоленский переулок»', url: 'https://yandex.ru/map-widget/v1/?ll=35.926401633%2C56.853783179&z=17&pt=35.926401633%2C56.853783179' },
    college: { label: 'Остановка «Колледж имени Коняева»', url: 'https://yandex.ru/map-widget/v1/?ll=35.923660905%2C56.850935003&z=17&pt=35.923660905%2C56.850935003' }
  };
  root.querySelectorAll('[data-landmark]').forEach(button => button.addEventListener('click', () => {
    const landmark = landmarks[button.dataset.landmark];
    mapFrame.src = landmark.url;
    mapFrame.title = landmark.label + ' — Яндекс Карты';
    root.querySelector('[data-map-caption]').textContent = landmark.label;
    root.querySelectorAll('[data-landmark]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  }));
  if (config.langameBookingUrl && /^https:\/\//.test(config.langameBookingUrl)) {
    root.querySelectorAll('[data-langame-link]').forEach(a => { a.href = config.langameBookingUrl; setArrowLabel(a, 'Выбрать время в LANGAME', 'external'); });
  }
  if (config.cooperationEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.cooperationEmail)) {
    const a = root.querySelector('[data-cooperation-email]');
    a.href = 'mailto:' + config.cooperationEmail;
    setArrowLabel(a, config.cooperationEmail, 'external');
    a.hidden = false;
  }
  const eventList = root.querySelector('[data-events]');
  const publishedEvents = Array.isArray(config.events) ? config.events.filter(e => e.published && e.title && e.date) : [];
  publishedEvents.forEach(event => {
    const article = document.createElement('article'); article.className = 'v-event-entry';
    const time = document.createElement('time'); time.dateTime = event.date;
    const date = new Date(event.date + 'T12:00:00');
    time.textContent = Number.isNaN(date.valueOf()) ? event.date : date.toLocaleDateString('ru-RU', {day:'numeric', month:'long', year:'numeric'});
    const title = document.createElement('h3'); title.textContent = event.title;
    const copy = document.createElement('p'); copy.textContent = event.description || '';
    article.append(time, title, copy);
    if (/^https:\/\//.test(event.url || '')) { const a = document.createElement('a'); a.className = 'v-outline-link'; a.href = event.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; setArrowLabel(a, 'Подробнее', 'external'); article.append(a); }
    eventList.append(article);
  });
  if (publishedEvents.length) root.querySelector('[data-events-empty]').hidden = true;
})();

