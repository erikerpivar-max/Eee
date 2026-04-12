/* ================================================================
   THE HOUSE — pubcal.js
   Calendrier de publication Lun/Mer/Ven par client
   Persistance localStorage — navigation -2 / +6 mois
   ================================================================ */

'use strict';

window.PubCal = (() => {

  /* ── Constantes ─────────────────────────────────────────────── */
  const KEY      = 'th_pubcal';
  const PUB_DAYS = new Set([1, 3, 5]); /* getDay() : 1=Lun 3=Mer 5=Ven */
  const MONTHS_BACK    = 2;  /* passé : 2 mois max */
  const MONTHS_FORWARD = 6;  /* futur : 6 mois max */

  /* ── État ────────────────────────────────────────────────────── */
  const _origin = new Date();
  let _year  = _origin.getFullYear();
  let _month = _origin.getMonth();

  /* ── Rendu principal ────────────────────────────────────────── */
  function renderView() {
    const container = document.getElementById('pubcal-container');
    if (!container) return;
    container.innerHTML = _buildPage();
    _wire();
  }

  /* ── Construction de la page ─────────────────────────────────── */
  function _buildPage() {
    const data = App.load(KEY, {});

    /* Limites de navigation */
    const originYM  = _origin.getFullYear() * 12 + _origin.getMonth();
    const currentYM = _year * 12 + _month;
    const canPrev   = currentYM > originYM - MONTHS_BACK;
    const canNext   = currentYM < originYM + MONTHS_FORWARD;

    const monthLabel = new Date(_year, _month, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

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

      const isToday  = cell.dateStr === today;
      const isPubDay = cell.isPubDay;

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
                      onclick="PubCal.toggle('${cell.dateStr}','${client.id}')">
                      ${checked
                        ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>'
                        : ''}
                    </button>`;
          }).join('') +
        '</div>';
      }

      return `
        <div class="cal-day pcal-day${isToday ? ' today' : ''}${isPubDay ? ' pub-day' : ''}">
          <div class="cal-day-num">${cell.day}</div>
          ${isPubDay ? '<div class="pub-day-dot"></div>' : ''}
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

    return `
      <div class="pubcal-toolbar">
        <div class="pcal-legend">${legendHTML}</div>
      </div>

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
      </div>`;
  }

  /* ── Génération des cellules du mois ─────────────────────────── */
  function _buildCells() {
    const firstDay  = new Date(_year, _month, 1);
    const lastDay   = new Date(_year, _month + 1, 0);
    const daysCount = lastDay.getDate();

    let startDow = firstDay.getDay() - 1; /* 0 = Lundi */
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
      const dow     = new Date(_year, _month, d).getDay();
      cells.push({ day: d, current: true, dateStr, isPubDay: PUB_DAYS.has(dow) });
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
  }

  /* ── Toggle d'une case ───────────────────────────────────────── */
  function toggle(dateStr, clientId) {
    const data = App.load(KEY, {});
    if (!data[dateStr]) data[dateStr] = {};
    data[dateStr][clientId] = !data[dateStr][clientId];
    /* Nettoyage si tout est false */
    if (!Object.values(data[dateStr]).some(Boolean)) delete data[dateStr];
    App.save(KEY, data);
    renderView();
    Dashboard.refresh();
  }

/* ── Calcul de l'avance de contenu (pour le dashboard) ──────── */
  function getDaysAdvance(clientId) {
    const data = App.load(KEY, {});

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    /* Date la plus lointaine cochée pour ce client */
    let lastChecked = null;
    Object.entries(data).forEach(([dateStr, clients]) => {
      if (clients[clientId]) {
        const d = new Date(dateStr + 'T12:00:00');
        d.setHours(0, 0, 0, 0);
        if (!lastChecked || d > lastChecked) lastChecked = d;
      }
    });

    if (!lastChecked) return null;

    /* Delta en jours (positif = dans le futur) */
    return Math.round((lastChecked - today) / 86_400_000);
  }

  /* ── API publique ───────────────────────────────────────────── */
  return { renderView, toggle, getDaysAdvance };

})();
