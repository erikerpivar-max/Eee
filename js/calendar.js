/* ================================================================
   THE HOUSE — calendar.js
   Calendrier mensuel interactif par client
   ================================================================ */

'use strict';

window.Calendar = (() => {

  /* État par client */
  const _state = {};

  function _getState(clientId) {
    if (!_state[clientId]) {
      const now = new Date();
      _state[clientId] = { year: now.getFullYear(), month: now.getMonth() };
    }
    return _state[clientId];
  }

  /* ── Rendu principal ────────────────────────────────────────── */
  function render(clientId) {
    const container = document.getElementById(`calendar-${clientId}`);
    if (!container) return;

    const state  = _getState(clientId);
    const events = App.load(`${App.KEYS.EVENTS}_${clientId}`, []);

    container.innerHTML = _buildCalendar(clientId, state.year, state.month, events);
    _wireCalendar(clientId);
  }

  /* ── Construction HTML du calendrier ────────────────────────── */
  function _buildCalendar(clientId, year, month, events) {
    const now       = new Date();
    const todayStr  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    const monthLabel = new Date(year, month, 1).toLocaleDateString('fr-FR', {
      month: 'long', year: 'numeric'
    });

    /* Jours du mois */
    const firstDay  = new Date(year, month, 1);
    const lastDay   = new Date(year, month + 1, 0);
    const daysCount = lastDay.getDate();

    /* Décalage : lundi = 0 */
    let startDow = firstDay.getDay() - 1; // 0=Mon … 6=Sun
    if (startDow < 0) startDow = 6;

    const cells = [];

    /* Jours du mois précédent */
    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      cells.push({ day: prevMonthLast - i, current: false, dateStr: null });
    }
    /* Jours du mois courant */
    for (let d = 1; d <= daysCount; d++) {
      const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push({ day: d, current: true, dateStr: ds });
    }
    /* Complète la grille (multiple de 7) */
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        cells.push({ day: d, current: false, dateStr: null });
      }
    }

    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

    const cellsHTML = cells.map(cell => {
      if (!cell.current) {
        return `<div class="cal-day other-month"><div class="cal-day-num" style="color:var(--text-3)">${cell.day}</div></div>`;
      }
      const isToday   = cell.dateStr === todayStr;
      const dayEvents = events.filter(e => e.date === cell.dateStr);
      const evHTML    = dayEvents.map(ev => {
        const stage   = App.getStage(ev.type) || { color:'#6B7280', bg:'#F3F4F6' };
        const bgColor = ev.type === 'autre' ? '#F3F4F6' : stage.bg;
        const txColor = ev.type === 'autre' ? '#6B7280' : stage.color;
        return `<span class="cal-event-chip"
                      style="background:${bgColor};color:${txColor}"
                      title="${escHtml(ev.title)}"
                      onclick="Calendar.deleteEvent('${clientId}','${ev.id}')">
                  ${escHtml(ev.title)}
                </span>`;
      }).join('');

      return `
        <div class="cal-day${isToday ? ' today' : ''}"
             data-date="${cell.dateStr}"
             data-client="${clientId}"
             onclick="Calendar.openAddEvent('${clientId}','${cell.dateStr}')">
          <div class="cal-day-num">${cell.day}</div>
          <div class="cal-events">${evHTML}</div>
        </div>`;
    }).join('');

    return `
      <div class="calendar-wrapper">
        <div class="calendar-nav">
          <button class="cal-nav-btn" id="cal-prev-${clientId}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="calendar-month-label">${monthLabel}</span>
          <button class="cal-nav-btn" id="cal-next-${clientId}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div class="calendar-grid-head">
          ${dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
        </div>
        <div class="calendar-grid">
          ${cellsHTML}
        </div>
      </div>`;
  }

  /* ── Wiring des boutons nav ─────────────────────────────────── */
  function _wireCalendar(clientId) {
    document.getElementById(`cal-prev-${clientId}`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = _getState(clientId);
      s.month--;
      if (s.month < 0) { s.month = 11; s.year--; }
      render(clientId);
    });
    document.getElementById(`cal-next-${clientId}`)?.addEventListener('click', (e) => {
      e.stopPropagation();
      const s = _getState(clientId);
      s.month++;
      if (s.month > 11) { s.month = 0; s.year++; }
      render(clientId);
    });
  }

  /* ── Ouvrir la modale "Ajouter un événement" ────────────────── */
  function openAddEvent(clientId, dateStr) {
    document.getElementById('eventClient').value        = clientId;
    document.getElementById('eventDatePicker').value   = dateStr || App.today();
    document.getElementById('eventTitle').value        = '';
    document.getElementById('eventType').value         = 'scripting';
    App.openModal('modal-addEvent');
  }

  /* ── Confirmer l'ajout ──────────────────────────────────────── */
  function _confirmAddEvent() {
    const clientId = document.getElementById('eventClient').value;
    const title    = document.getElementById('eventTitle').value.trim();
    const date     = document.getElementById('eventDatePicker').value;
    const type     = document.getElementById('eventType').value;

    if (!title || !date) {
      document.getElementById('eventTitle').focus();
      return;
    }

    const events = App.load(`${App.KEYS.EVENTS}_${clientId}`, []);
    events.push({ id: App.uid(), title, date, type });
    App.save(`${App.KEYS.EVENTS}_${clientId}`, events);

    App.closeModal('modal-addEvent');
    render(clientId);
  }

  /* ── Supprimer un événement (clic sur la puce) ──────────────── */
  function deleteEvent(clientId, eventId) {
    if (!confirm('Supprimer cet événement ?')) return;
    let events = App.load(`${App.KEYS.EVENTS}_${clientId}`, []);
    events = events.filter(e => e.id !== eventId);
    App.save(`${App.KEYS.EVENTS}_${clientId}`, events);
    render(clientId);
  }

  /* ── Wiring global ──────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('confirmAddEventBtn')?.addEventListener('click', _confirmAddEvent);
  });

  /* ── API publique ───────────────────────────────────────────── */
  return { render, openAddEvent, deleteEvent };

})();
