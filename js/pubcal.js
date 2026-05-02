/* ================================================================
   THE HOUSE — pubcal.js
   Calendrier de publication avec types de jours cliquables
   + paramètres de publication dynamiques
   ================================================================ */

'use strict';

window.PubCal = (() => {

  /* ── Constantes ─────────────────────────────────────────────── */
  const KEY          = 'th_pubcal';
  const KEY_DAYTYPES = 'th_pubcal_daytypes';
  const KEY_SETTINGS = 'th_pubcal_settings';

  const MONTHS_BACK    = 2;
  const MONTHS_FORWARD = 6;

  const DAY_TYPES = [
    { id: 'programmation', label: 'Prog',     color: '#22C55E' },
    { id: 'tournage',      label: 'Tournage', color: '#8B5CF6' },
    { id: 'scripting',     label: 'Script',   color: '#3B82F6' },
  ];

  const DAY_NAMES_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const DAY_NAMES_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  /* ── État ────────────────────────────────────────────────────── */
  const _origin = new Date();
  let _year  = _origin.getFullYear();
  let _month = _origin.getMonth();

  /* ── Helpers settings ───────────────────────────────────────── */
  function _loadSettings() {
    return App.load(KEY_SETTINGS, { startDate: App.today(), pubDays: [1, 3, 5] });
  }

  function _isPubDay(dateStr) {
    const settings = _loadSettings();
    if (dateStr < settings.startDate) return false;
    const d = new Date(dateStr + 'T12:00:00');
    return settings.pubDays.includes(d.getDay());
  }

  /* ── Rendu principal ────────────────────────────────────────── */
  function renderView() {
    const container = document.getElementById('pubcal-container');
    if (!container) return;
    container.innerHTML = _buildPage();
    _wire();
  }

  /* ── Construction de la page ─────────────────────────────────── */
  function _buildPage() {
    const data      = App.load(KEY, {});
    const dayTypes  = App.load(KEY_DAYTYPES, {});
    const settings  = _loadSettings();

    /* Limites de navigation */
    const originYM  = _origin.getFullYear() * 12 + _origin.getMonth();
    const currentYM = _year * 12 + _month;
    const canPrev   = currentYM > originYM - MONTHS_BACK;
    const canNext   = currentYM < originYM + MONTHS_FORWARD;

    const monthLabel = new Date(_year, _month, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    /* Alerte : jours de publication non entièrement cochés dans les 14 prochains jours */
    const _todayD = new Date();
    _todayD.setHours(0, 0, 0, 0);
    const alertDates = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(_todayD);
      d.setDate(_todayD.getDate() + i);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (!_isPubDay(ds)) continue;
      if (App.CLIENTS.some(c => !data[ds]?.[c.id])) alertDates.push(d.getDate());
    }
    const alertHTML = alertDates.length
      ? `<div class="pcal-alert">
           <span class="pcal-alert-icon">!</span>
           Cases manquantes dans les 14 prochains jours : <strong>${alertDates.join(', ')}</strong>
         </div>`
      : '';

    /* Grille de jours */
    const cells = _buildCells();
    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const today    = App.today();

    const cellsHTML = cells.map(cell => {
      if (!cell.current) {
        return `<div class="cal-day pcal-day other-month">
                  <div class="cal-day-num" style="opacity:.35">${cell.day}</div>
                </div>`;
      }

      const isToday   = cell.dateStr === today;
      const isPubDay  = _isPubDay(cell.dateStr);
      const dayType   = dayTypes[cell.dateStr] || null;
      const typeClass = dayType ? ` day-type-${dayType}` : '';
      const typeInfo  = dayType ? DAY_TYPES.find(t => t.id === dayType) : null;

      let typeLabel = '';
      if (typeInfo) {
        typeLabel = `<div class="pcal-day-type-label type-${dayType}">${typeInfo.label}</div>`;
      }

      let checksHTML = '';
      if (isPubDay) {
        checksHTML = '<div class="pcal-checks">' +
          App.CLIENTS.map(client => {
            const checked = !!(data[cell.dateStr]?.[client.id]);
            return `<button
                      class="pcal-check${checked ? ' checked' : ''}"
                      style="${checked
                        ? `background:${client.color};border-color:${client.color}`
                        : `border-color:${client.color}`}"
                      title="${escHtml(client.name)}"
                      data-date="${cell.dateStr}"
                      data-client="${client.id}"
                      data-color="${client.color}">
                      ${checked
                        ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>'
                        : ''}
                    </button>`;
          }).join('') +
        '</div>';
      }

      return `
        <div class="cal-day pcal-day current-month${isToday ? ' today' : ''}${isPubDay ? ' pub-day' : ''}${typeClass}"
             data-date="${cell.dateStr}">
          <div class="cal-day-num">${cell.day}</div>
          ${isPubDay ? '<div class="pub-day-dot"></div>' : ''}
          ${typeLabel}
          ${checksHTML}
        </div>`;
    }).join('');

    /* Légende clients */
    const legendHTML = App.CLIENTS.map(c =>
      `<span class="pcal-legend-item">
         <span class="pcal-legend-dot" style="background:${c.color}"></span>
         ${escHtml(c.name)}
       </span>`
    ).join('');

    /* Légende types */
    const typeLegendHTML = DAY_TYPES.map(t =>
      `<span class="pcal-type-legend-item">
         <span class="pcal-type-dot" style="background:${t.color}"></span>
         ${t.label}
       </span>`
    ).join('');

    /* Section paramètres */
    const settingsHTML = _buildSettings(settings);

    return `
      <!-- Paramètres (collapsible) -->
      <div class="so-block">
        <div class="section-header collapsible" data-collapse-id="pubcal-settings">
          <h3 class="section-title">Param\u00e8tres de publication</h3>
          <span class="collapse-chevron">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </div>
        <div class="collapsible-content" data-collapse-content="pubcal-settings">
          ${settingsHTML}
        </div>
      </div>

      <!-- Calendrier -->
      <div style="margin-top:20px">
        <div class="pubcal-toolbar">
          <div class="pcal-legend">${legendHTML}</div>
          <div class="pcal-type-legend">${typeLegendHTML}</div>
        </div>

        ${alertHTML}

        <div class="calendar-wrapper">
          <div class="calendar-nav">
            <button class="cal-nav-btn" id="pcal-prev" ${!canPrev ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="calendar-month-label">${monthLabel}</span>
            <button class="cal-nav-btn" id="pcal-next" ${!canNext ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div class="calendar-grid-head">
            ${dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
          </div>
          <div class="calendar-grid pcal-grid">
            ${cellsHTML}
          </div>
        </div>

        <p style="font-size:.75rem;color:var(--text-3);margin-top:8px;text-align:center">
          Cliquez sur un jour pour le marquer : Programmation \u2192 Tournage \u2192 Scripting \u2192 Vide
        </p>
      </div>`;
  }

  /* ── Section Paramètres ─────────────────────────────────────── */
  function _buildSettings(settings) {
    const allDays = [
      { val: 1, label: 'Lun' },
      { val: 2, label: 'Mar' },
      { val: 3, label: 'Mer' },
      { val: 4, label: 'Jeu' },
      { val: 5, label: 'Ven' },
      { val: 6, label: 'Sam' },
      { val: 0, label: 'Dim' },
    ];

    const checksHTML = allDays.map(d =>
      `<button class="pcal-day-check${settings.pubDays.includes(d.val) ? ' active' : ''}"
              data-dayval="${d.val}">
        ${d.label}
      </button>`
    ).join('');

    return `
      <div class="pcal-settings">
        <div class="pcal-settings-grid">
          <div class="pcal-settings-group">
            <span class="pcal-settings-label">\u00c0 partir de</span>
            <input type="date" class="form-input" id="pcal-start-date"
                   value="${settings.startDate}" style="width:180px" />
          </div>
          <div class="pcal-settings-group">
            <span class="pcal-settings-label">Jours de publication</span>
            <div class="pcal-day-checks" id="pcal-pub-days">
              ${checksHTML}
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ── Génération des cellules du mois ─────────────────────────── */
  function _buildCells() {
    const firstDay  = new Date(_year, _month, 1);
    const lastDay   = new Date(_year, _month + 1, 0);
    const daysCount = lastDay.getDate();

    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const cells = [];

    /* Jours du mois précédent */
    const prevLast = new Date(_year, _month, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      cells.push({ day: prevLast - i, current: false });
    }

    /* Jours du mois courant */
    for (let d = 1; d <= daysCount; d++) {
      const dateStr = `${_year}-${String(_month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push({
        day: d,
        current: true,
        dateStr,
      });
    }

    /* Complétion de la grille (multiple de 7) */
    const rem = cells.length % 7;
    if (rem > 0) {
      for (let d = 1; d <= 7 - rem; d++) {
        cells.push({ day: d, current: false });
      }
    }

    return cells;
  }

  /* ── Wiring ──────────────────────────────────────────────────── */
  function _wire() {
    /* Nav */
    document.getElementById('pcal-prev')?.addEventListener('click', () => {
      _month--;
      if (_month < 0) { _month = 11; _year--; }
      renderView();
    });
    document.getElementById('pcal-next')?.addEventListener('click', () => {
      _month++;
      if (_month > 11) { _month = 0; _year++; }
      renderView();
    });

    /* Clic sur les cases du calendrier : toggle type de jour */
    document.querySelector('.pcal-grid')?.addEventListener('click', e => {
      /* Si c'est un bouton client check, traiter le toggle client */
      const btn = e.target.closest('.pcal-check');
      if (btn) {
        e.stopPropagation();
        toggle(btn.dataset.date, btn.dataset.client, btn);
        return;
      }

      /* Sinon, toggle le type de jour */
      const dayEl = e.target.closest('.cal-day.current-month');
      if (!dayEl) return;
      const dateStr = dayEl.dataset.date;
      if (!dateStr) return;

      _cycleDayType(dateStr);
    });

    /* Paramètres : date de début */
    document.getElementById('pcal-start-date')?.addEventListener('change', e => {
      const settings = _loadSettings();
      settings.startDate = e.target.value;
      App.save(KEY_SETTINGS, settings);
      renderView();
    });

    /* Paramètres : jours de publication (toggle) */
    document.getElementById('pcal-pub-days')?.addEventListener('click', e => {
      const btn = e.target.closest('.pcal-day-check');
      if (!btn) return;
      const val = parseInt(btn.dataset.dayval);
      const settings = _loadSettings();
      const idx = settings.pubDays.indexOf(val);
      if (idx >= 0) {
        settings.pubDays.splice(idx, 1);
      } else {
        settings.pubDays.push(val);
      }
      App.save(KEY_SETTINGS, settings);
      renderView();
    });

    /* Sections collapsibles */
    _wireCollapsibles();
  }

  /* ── Cycle type de jour ─────────────────────────────────────── */
  function _cycleDayType(dateStr) {
    const dayTypes = App.load(KEY_DAYTYPES, {});
    const current  = dayTypes[dateStr] || null;

    const order = [null, 'programmation', 'tournage', 'scripting'];
    const idx   = order.indexOf(current);
    const next  = order[(idx + 1) % order.length];

    if (next) {
      dayTypes[dateStr] = next;
    } else {
      delete dayTypes[dateStr];
    }

    App.save(KEY_DAYTYPES, dayTypes);
    renderView();
  }

  /* ── Sections collapsibles ──────────────────────────────────── */
  function _wireCollapsibles() {
    const collapsed = App.load('th_collapsed_sections', []);
    document.querySelectorAll('.section-header.collapsible').forEach(header => {
      const id = header.dataset.collapseId;
      const content = document.querySelector(`[data-collapse-content="${id}"]`);
      if (!content) return;

      if (collapsed.includes(id)) {
        header.classList.add('collapsed');
        content.classList.add('collapsed');
      }

      header.addEventListener('click', () => {
        const isCollapsed = header.classList.toggle('collapsed');
        content.classList.toggle('collapsed', isCollapsed);

        const stored = App.load('th_collapsed_sections', []);
        if (isCollapsed) {
          if (!stored.includes(id)) stored.push(id);
        } else {
          const i = stored.indexOf(id);
          if (i >= 0) stored.splice(i, 1);
        }
        App.save('th_collapsed_sections', stored);
      });
    });
  }

  /* ── Toggle d'une case client — mise à jour in-place ────────── */
  function toggle(dateStr, clientId, btnEl) {
    const data = App.load(KEY, {});
    if (!data[dateStr]) data[dateStr] = {};
    data[dateStr][clientId] = !data[dateStr][clientId];
    if (!Object.values(data[dateStr]).some(Boolean)) delete data[dateStr];
    App.save(KEY, data);

    if (btnEl) {
      const checked = !!(data[dateStr]?.[clientId]);
      const color   = btnEl.dataset.color;
      btnEl.classList.toggle('checked', checked);
      btnEl.style.background  = checked ? color : '';
      btnEl.style.borderColor = color;
      btnEl.innerHTML = checked
        ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>'
        : '';
    }

    Dashboard.refresh();
  }

  /* ── Calcul de l'avance de contenu (pour le dashboard) ──────── */
  function getDaysAdvance(clientId) {
    const data = App.load(KEY, {});
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let lastChecked = null;
    Object.entries(data).forEach(([dateStr, clients]) => {
      if (clients[clientId]) {
        const d = new Date(dateStr + 'T12:00:00');
        d.setHours(0, 0, 0, 0);
        if (!lastChecked || d > lastChecked) lastChecked = d;
      }
    });

    if (!lastChecked) return null;
    return Math.round((lastChecked - today) / 86_400_000);
  }

  /* ── API publique ───────────────────────────────────────────── */
  return { renderView, toggle, getDaysAdvance };

})();
