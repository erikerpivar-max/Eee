/* ================================================================
   THE HOUSE — pubcal.js
   Calendrier de publication : vue semaine (par défaut) ou mensuelle
   Tous les jours sont cochables (clients) et acceptent des entrées.
   ================================================================ */

'use strict';

window.PubCal = (() => {

  /* ── Constantes ─────────────────────────────────────────────── */
  const KEY           = 'th_pubcal';           // cases clients
  const KEY_ENTRIES   = 'th_pubcal_entries';
  const KEY_VIEW_MODE = 'th_pubcal_view_mode'; // 'week' | 'month'

  const MONTHS_BACK    = 2;
  const MONTHS_FORWARD = 6;

  const CATEGORIES = [
    { id: 'programmation', label: 'Programmation', color: '#22C55E' },
    { id: 'tournage',      label: 'Tournage',      color: '#8B5CF6' },
    { id: 'script',        label: 'Script',         color: '#3B82F6' },
    { id: 'montage',       label: 'Montage',        color: '#F59E0B' },
    { id: 'autre',         label: 'Autre',          color: '#6B7280' },
  ];

  /* ── État ────────────────────────────────────────────────────── */
  const _origin = new Date();
  let _year  = _origin.getFullYear();
  let _month = _origin.getMonth();
  let _weekOffset = 0; // semaines depuis la semaine courante
  let _viewMode   = App.load(KEY_VIEW_MODE, 'week');
  let _popupDate  = null;

  /* ── Helpers ────────────────────────────────────────────────── */
  function _loadEntries()      { return App.load(KEY_ENTRIES, []); }
  function _saveEntries(d)     { App.save(KEY_ENTRIES, d); }
  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function _getCategoryInfo(catId) {
    return CATEGORIES.find(c => c.id === catId) || { id: catId, label: catId, color: '#6B7280' };
  }
  function _dateToISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function _weekStart(refDate) {
    const d  = new Date(refDate);
    d.setHours(0,0,0,0);
    const dow = d.getDay();
    const offset = dow === 0 ? -6 : 1 - dow; // lundi
    d.setDate(d.getDate() + offset);
    return d;
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
    const entries = _loadEntries();
    const pubData = App.load(KEY, {});

    /* Toolbar : sélecteur de vue */
    const toolbarHTML = `
      <div class="pubcal-toolbar">
        <div class="pcal-legend">
          ${App.CLIENTS.map(c =>
            `<span class="pcal-legend-item">
               <span class="pcal-legend-dot" style="background:${c.color}"></span>
               ${escHtml(c.name)}
             </span>`).join('')}
        </div>
        <div class="pcal-view-switch">
          <button class="pcal-view-btn${_viewMode === 'week' ? ' active' : ''}" data-mode="week">Semaine</button>
          <button class="pcal-view-btn${_viewMode === 'month' ? ' active' : ''}" data-mode="month">Mois</button>
        </div>
      </div>
      <div class="pcal-type-legend">
        ${CATEGORIES.map(c =>
          `<span class="pcal-type-legend-item">
             <span class="pcal-type-dot" style="background:${c.color}"></span>
             ${c.label}
           </span>`).join('')}
      </div>`;

    const calendarHTML = _viewMode === 'week'
      ? _buildWeekView(entries, pubData)
      : _buildMonthView(entries, pubData);

    return `
      ${toolbarHTML}
      <div style="margin-top:16px">
        ${calendarHTML}
        <p style="font-size:.75rem;color:var(--text-3);margin-top:8px;text-align:center">
          Cliquez sur un jour pour ajouter une tâche de publication
        </p>
      </div>

      <!-- Popup ajout / détail -->
      <div class="pcal-popup-overlay" id="pcal-popup-overlay" style="display:none">
        <div class="pcal-popup" id="pcal-popup">
          <div class="pcal-popup-header">
            <span class="pcal-popup-title" id="pcal-popup-title">Nouvelle entrée</span>
            <button class="pcal-popup-close" id="pcal-popup-close">&times;</button>
          </div>
          <div class="pcal-popup-body" id="pcal-popup-body"></div>
        </div>
      </div>`;
  }

  /* ── Vue mensuelle ──────────────────────────────────────────── */
  function _buildMonthView(entries, pubData) {
    const originYM  = _origin.getFullYear() * 12 + _origin.getMonth();
    const currentYM = _year * 12 + _month;
    const canPrev   = currentYM > originYM - MONTHS_BACK;
    const canNext   = currentYM < originYM + MONTHS_FORWARD;

    const monthLabel = new Date(_year, _month, 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const cells = _buildMonthCells();
    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const today = App.today();

    const cellsHTML = cells.map(cell => {
      if (!cell.current) {
        return `<div class="cal-day pcal-day other-month">
                  <div class="cal-day-num" style="opacity:.35">${cell.day}</div>
                </div>`;
      }
      return _renderDayCell(cell.dateStr, cell.day, entries, pubData, today === cell.dateStr);
    }).join('');

    return `
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

  /* ── Vue semaine (liste agenda) ─────────────────────────────── */
  function _buildWeekView(entries, pubData) {
    const refMonday = _weekStart(new Date());
    refMonday.setDate(refMonday.getDate() + _weekOffset * 7);

    const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const today    = App.today();

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(refMonday);
      d.setDate(refMonday.getDate() + i);
      days.push(d);
    }

    const endDay = days[6];
    const sameMonth = refMonday.getMonth() === endDay.getMonth();
    const weekLabel = sameMonth
      ? `${refMonday.getDate()} – ${endDay.getDate()} ${endDay.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}`
      : `${refMonday.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} – ${endDay.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}`;

    const canPrev = _weekOffset > -MONTHS_BACK * 4;
    const canNext = _weekOffset <  MONTHS_FORWARD * 4;

    const rowsHTML = days.map((d, i) => {
      const dateStr = _dateToISO(d);
      const isToday = dateStr === today;
      const dayEntries = entries.filter(e => e.date === dateStr);

      const checksHTML = App.CLIENTS.map(client => {
        const checked = !!(pubData[dateStr]?.[client.id]);
        return `<button
                  class="pcal-check${checked ? ' checked' : ''}"
                  style="${checked
                    ? `background:${client.color};border-color:${client.color}`
                    : `border-color:${client.color}`}"
                  title="${escHtml(client.name)}"
                  data-date="${dateStr}"
                  data-client="${client.id}"
                  data-color="${client.color}">
                  ${checked
                    ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>'
                    : ''}
                </button>`;
      }).join('');

      const entriesHTML = dayEntries.length === 0
        ? '<span class="pcal-week-empty">Aucune tâche</span>'
        : dayEntries.map(entry => {
            const cat    = _getCategoryInfo(entry.category);
            const client = App.CLIENTS.find(c => c.id === entry.clientId);
            const label  = entry.category === 'autre' ? (entry.customLabel || 'Autre') : cat.label;
            const statusClass = entry.status === 'termine' ? 'pcal-entry-done' : 'pcal-entry-draft';
            return `<div class="pcal-entry ${statusClass}" style="--cat-color:${cat.color}"
                         data-entry-id="${entry.id}" title="${label}${client ? ' — ' + client.name : ''}">
                      <span class="pcal-entry-dot" style="background:${cat.color}"></span>
                      <span class="pcal-entry-label">${escHtml(label)}</span>
                      ${client ? `<span class="pcal-entry-client" style="color:${client.color}">${escHtml(client.initials || client.name.slice(0,2))}</span>` : ''}
                    </div>`;
          }).join('');

      return `
        <div class="pcal-week-row${isToday ? ' today' : ''}" data-date="${dateStr}">
          <div class="pcal-week-date">
            <span class="pcal-week-dayname">${dayNames[i]}</span>
            <span class="pcal-week-daynum">${d.getDate()}</span>
          </div>
          <div class="pcal-week-checks">${checksHTML}</div>
          <div class="pcal-week-entries">${entriesHTML}</div>
          <button class="pcal-week-add" data-date="${dateStr}" title="Ajouter une tâche">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>`;
    }).join('');

    return `
      <div class="calendar-wrapper">
        <div class="calendar-nav">
          <button class="cal-nav-btn" id="pcal-prev" ${!canPrev ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="calendar-month-label">${weekLabel}</span>
          <button class="cal-nav-btn" id="pcal-next" ${!canNext ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div class="pcal-week-list">
          ${rowsHTML}
        </div>
      </div>`;
  }

  /* ── Cellule d'un jour (vue mois) ─────────────────────────── */
  function _renderDayCell(dateStr, dayNum, entries, pubData, isToday) {
    const dayEntries = entries.filter(e => e.date === dateStr);

    const checksHTML = '<div class="pcal-checks">' +
      App.CLIENTS.map(client => {
        const checked = !!(pubData[dateStr]?.[client.id]);
        return `<button
                  class="pcal-check${checked ? ' checked' : ''}"
                  style="${checked
                    ? `background:${client.color};border-color:${client.color}`
                    : `border-color:${client.color}`}"
                  title="${escHtml(client.name)}"
                  data-date="${dateStr}"
                  data-client="${client.id}"
                  data-color="${client.color}">
                  ${checked
                    ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>'
                    : ''}
                </button>`;
      }).join('') +
    '</div>';

    let entriesHTML = '';
    if (dayEntries.length > 0) {
      entriesHTML = '<div class="pcal-entries">' +
        dayEntries.map(entry => {
          const cat    = _getCategoryInfo(entry.category);
          const client = App.CLIENTS.find(c => c.id === entry.clientId);
          const clientLabel = client ? client.name : '';
          const label  = entry.category === 'autre' ? (entry.customLabel || 'Autre') : cat.label;
          const statusClass = entry.status === 'termine' ? 'pcal-entry-done' : 'pcal-entry-draft';
          return `<div class="pcal-entry ${statusClass}" style="--cat-color:${cat.color}"
                       data-entry-id="${entry.id}" title="${label} — ${clientLabel}">
                    <span class="pcal-entry-dot" style="background:${cat.color}"></span>
                    <span class="pcal-entry-label">${escHtml(label)}</span>
                    ${client ? `<span class="pcal-entry-client" style="color:${client.color}">${escHtml(client.initials || client.name.slice(0,2))}</span>` : ''}
                  </div>`;
        }).join('') +
      '</div>';
    }

    return `
      <div class="cal-day pcal-day current-month pub-day${isToday ? ' today' : ''}"
           data-date="${dateStr}">
        <div class="cal-day-num">${dayNum}</div>
        ${checksHTML}
        ${entriesHTML}
      </div>`;
  }

  /* ── Génération des cellules du mois ─────────────────────────── */
  function _buildMonthCells() {
    const firstDay  = new Date(_year, _month, 1);
    const lastDay   = new Date(_year, _month + 1, 0);
    const daysCount = lastDay.getDate();

    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const cells = [];
    const prevLast = new Date(_year, _month, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      cells.push({ day: prevLast - i, current: false });
    }
    for (let d = 1; d <= daysCount; d++) {
      const dateStr = `${_year}-${String(_month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push({ day: d, current: true, dateStr });
    }
    const rem = cells.length % 7;
    if (rem > 0) {
      for (let d = 1; d <= 7 - rem; d++) {
        cells.push({ day: d, current: false });
      }
    }
    return cells;
  }

  /* ── Popup : Étape 1 — Choix de catégorie ───────────────────── */
  function _showCategoryPopup(dateStr) {
    _popupDate = dateStr;
    const overlay = document.getElementById('pcal-popup-overlay');
    const title   = document.getElementById('pcal-popup-title');
    const body    = document.getElementById('pcal-popup-body');

    const d = new Date(dateStr + 'T12:00:00');
    title.textContent = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    body.innerHTML = `
      <div class="pcal-popup-step-label">Choisir une catégorie :</div>
      <div class="pcal-cat-grid">
        ${CATEGORIES.map(cat => `
          <button class="pcal-cat-btn" data-cat="${cat.id}" style="--cat-color:${cat.color}">
            <span class="pcal-cat-dot" style="background:${cat.color}"></span>
            ${cat.label}
          </button>
        `).join('')}
      </div>
    `;

    overlay.style.display = 'flex';

    body.querySelectorAll('.pcal-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.dataset.cat;
        if (catId === 'autre') _showCustomInput(dateStr);
        else                   _showClientStep(dateStr, catId, null);
      });
    });
  }

  function _showCustomInput(dateStr) {
    const body = document.getElementById('pcal-popup-body');
    body.innerHTML = `
      <div class="pcal-popup-step-label">Nom de la tâche :</div>
      <input type="text" class="form-input pcal-custom-input" id="pcal-custom-name"
             placeholder="Ex: Réunion, Brainstorm..." autofocus />
      <button class="btn-primary pcal-custom-confirm" id="pcal-custom-ok">Valider</button>
    `;

    const input = document.getElementById('pcal-custom-name');
    const okBtn = document.getElementById('pcal-custom-ok');
    const confirm = () => {
      const val = input.value.trim();
      if (val) _showClientStep(dateStr, 'autre', val);
    };
    okBtn.addEventListener('click', confirm);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); });
    setTimeout(() => input.focus(), 50);
  }

  function _showClientStep(dateStr, catId, customLabel) {
    const body = document.getElementById('pcal-popup-body');
    const cat = _getCategoryInfo(catId);
    const labelText = customLabel || cat.label;

    body.innerHTML = `
      <div class="pcal-popup-step-label">
        <span class="pcal-cat-dot" style="background:${cat.color};display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px"></span>
        ${escHtml(labelText)} — Choisir le(s) client(s) :
      </div>
      <div class="pcal-client-list">
        ${App.CLIENTS.map(client => `
          <label class="pcal-client-option" data-client-id="${client.id}">
            <input type="checkbox" class="pcal-client-cb" value="${client.id}" />
            <span class="pcal-client-dot" style="background:${client.color}"></span>
            <span class="pcal-client-name">${escHtml(client.name)}</span>
          </label>
        `).join('')}
      </div>
      <button class="btn-primary pcal-confirm-btn" id="pcal-confirm-add">Ajouter</button>
    `;

    document.getElementById('pcal-confirm-add').addEventListener('click', () => {
      const checked = body.querySelectorAll('.pcal-client-cb:checked');
      if (checked.length === 0) return;
      const entries = _loadEntries();
      checked.forEach(cb => {
        entries.push({
          id: _uid(),
          date: dateStr,
          category: catId,
          customLabel: customLabel || null,
          clientId: cb.value,
          status: 'brouillon',
        });
      });
      _saveEntries(entries);
      _closePopup();
      renderView();
    });
  }

  function _showEntryDetail(entryId) {
    const entries = _loadEntries();
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const overlay = document.getElementById('pcal-popup-overlay');
    const title   = document.getElementById('pcal-popup-title');
    const body    = document.getElementById('pcal-popup-body');

    const cat    = _getCategoryInfo(entry.category);
    const client = App.CLIENTS.find(c => c.id === entry.clientId);
    const label  = entry.category === 'autre' ? (entry.customLabel || 'Autre') : cat.label;
    const d      = new Date(entry.date + 'T12:00:00');
    title.textContent = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    const isDone = entry.status === 'termine';

    body.innerHTML = `
      <div class="pcal-detail">
        <div class="pcal-detail-header">
          <span class="pcal-cat-dot" style="background:${cat.color}"></span>
          <span class="pcal-detail-cat">${escHtml(label)}</span>
          ${client ? `<span class="pcal-detail-client" style="color:${client.color}">${escHtml(client.name)}</span>` : ''}
        </div>
        <div class="pcal-detail-status">
          <span class="pcal-status-label">Statut :</span>
          <button class="pcal-status-btn ${isDone ? 'done' : 'draft'}" id="pcal-toggle-status">
            ${isDone ? 'Terminé' : 'Brouillon'}
          </button>
        </div>
        <div class="pcal-detail-actions">
          <button class="pcal-delete-btn" id="pcal-delete-entry">Supprimer</button>
        </div>
      </div>
    `;

    overlay.style.display = 'flex';

    document.getElementById('pcal-toggle-status').addEventListener('click', () => {
      const ents = _loadEntries();
      const e = ents.find(x => x.id === entryId);
      if (e) {
        e.status = e.status === 'termine' ? 'brouillon' : 'termine';
        _saveEntries(ents);
        _showEntryDetail(entryId);
      }
    });

    document.getElementById('pcal-delete-entry').addEventListener('click', () => {
      const ents = _loadEntries();
      const idx = ents.findIndex(x => x.id === entryId);
      if (idx >= 0) { ents.splice(idx, 1); _saveEntries(ents); }
      _closePopup();
      renderView();
    });
  }

  function _closePopup() {
    const overlay = document.getElementById('pcal-popup-overlay');
    if (overlay) overlay.style.display = 'none';
    _popupDate = null;
  }

  /* ── Wiring ──────────────────────────────────────────────────── */
  function _wire() {
    /* Bascule de vue */
    document.querySelectorAll('.pcal-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === _viewMode) return;
        _viewMode = mode;
        App.save(KEY_VIEW_MODE, mode);
        if (mode === 'month') {
          _year  = _origin.getFullYear();
          _month = _origin.getMonth();
        } else {
          _weekOffset = 0;
        }
        renderView();
      });
    });

    /* Navigation */
    document.getElementById('pcal-prev')?.addEventListener('click', () => {
      if (_viewMode === 'month') {
        _month--;
        if (_month < 0) { _month = 11; _year--; }
      } else {
        _weekOffset--;
      }
      renderView();
    });
    document.getElementById('pcal-next')?.addEventListener('click', () => {
      if (_viewMode === 'month') {
        _month++;
        if (_month > 11) { _month = 0; _year++; }
      } else {
        _weekOffset++;
      }
      renderView();
    });

    /* Clics sur les jours/cases */
    const root = document.getElementById('pubcal-container');
    root?.addEventListener('click', e => {
      const checkBtn = e.target.closest('.pcal-check');
      if (checkBtn) {
        e.stopPropagation();
        _toggleCheck(checkBtn.dataset.date, checkBtn.dataset.client, checkBtn);
        return;
      }

      const entryEl = e.target.closest('.pcal-entry');
      if (entryEl) {
        e.stopPropagation();
        _showEntryDetail(entryEl.dataset.entryId);
        return;
      }

      const dayEl = e.target.closest('[data-date]');
      if (!dayEl) return;
      const dateStr = dayEl.dataset.date;
      if (!dateStr) return;
      _showCategoryPopup(dateStr);
    });

    /* Fermer popup */
    document.getElementById('pcal-popup-close')?.addEventListener('click', _closePopup);
    document.getElementById('pcal-popup-overlay')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) _closePopup();
    });
  }

  /* ── Toggle case client (système de coches publication) ──────── */
  function _toggleCheck(dateStr, clientId, btnEl) {
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

    if (typeof Dashboard !== 'undefined') Dashboard.refresh();
  }

  /* ── Calcul de l'avance de contenu (pour le dashboard) ──────── */
  function getDaysAdvance(clientId) {
    const data    = App.load(KEY, {});
    const entries = App.load(KEY_ENTRIES, []);
    const today   = new Date();
    today.setHours(0, 0, 0, 0);

    let lastChecked = null;

    /* Cases cochées (vue Publication) */
    Object.entries(data).forEach(([dateStr, clients]) => {
      if (clients[clientId]) {
        const d = new Date(dateStr + 'T12:00:00');
        d.setHours(0, 0, 0, 0);
        if (!lastChecked || d > lastChecked) lastChecked = d;
      }
    });

    /* Entrées créées (vue Publication + Agenda) */
    entries.forEach(e => {
      if (e.clientId === clientId) {
        const d = new Date(e.date + 'T12:00:00');
        d.setHours(0, 0, 0, 0);
        if (!lastChecked || d > lastChecked) lastChecked = d;
      }
    });

    if (!lastChecked) return null;
    return Math.round((lastChecked - today) / 86_400_000);
  }

  /* ── API publique : cocher/décocher un jour pour un client ─────── */
  function setCheck(dateStr, clientId, value) {
    const data = App.load(KEY, {});
    if (!data[dateStr]) data[dateStr] = {};
    if (value) data[dateStr][clientId] = true;
    else       delete data[dateStr][clientId];
    if (!Object.values(data[dateStr] || {}).some(Boolean)) delete data[dateStr];
    App.save(KEY, data);
    if (App.currentView === 'publication') renderView();
    if (typeof Dashboard !== 'undefined') Dashboard.refresh();
  }

  /* ── API publique ───────────────────────────────────────────── */
  return { renderView, getDaysAdvance, setCheck };

})();
