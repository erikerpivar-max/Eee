/* ================================================================
   THE HOUSE — pubcal.js
   Calendrier de publication avec popup de catégorie + client
   ================================================================ */

'use strict';

window.PubCal = (() => {

  /* ── Constantes ─────────────────────────────────────────────── */
  const KEY_ENTRIES  = 'th_pubcal_entries';
  const KEY_SETTINGS = 'th_pubcal_settings';

  const MONTHS_BACK    = 2;
  const MONTHS_FORWARD = 6;

  const CATEGORIES = [
    { id: 'programmation', label: 'Programmation', color: '#22C55E' },
    { id: 'tournage',      label: 'Tournage',      color: '#8B5CF6' },
    { id: 'script',        label: 'Script',         color: '#3B82F6' },
    { id: 'montage',       label: 'Montage',        color: '#F59E0B' },
    { id: 'autre',         label: 'Autre',          color: '#6B7280' },
  ];

  const DAY_NAMES_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  /* ── État ────────────────────────────────────────────────────── */
  const _origin = new Date();
  let _year  = _origin.getFullYear();
  let _month = _origin.getMonth();
  let _popupDate = null; // date currently showing popup

  /* ── Helpers ────────────────────────────────────────────────── */
  function _loadSettings() {
    return App.load(KEY_SETTINGS, { startDate: App.today(), pubDays: [1, 3, 5] });
  }

  function _loadEntries() {
    return App.load(KEY_ENTRIES, []);
  }

  function _saveEntries(entries) {
    App.save(KEY_ENTRIES, entries);
  }

  function _isPubDay(dateStr) {
    const settings = _loadSettings();
    if (dateStr < settings.startDate) return false;
    const d = new Date(dateStr + 'T12:00:00');
    return settings.pubDays.includes(d.getDay());
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function _getCategoryInfo(catId) {
    return CATEGORIES.find(c => c.id === catId) || { id: catId, label: catId, color: '#6B7280' };
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
    const entries   = _loadEntries();
    const settings  = _loadSettings();

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
    const today = App.today();

    const cellsHTML = cells.map(cell => {
      if (!cell.current) {
        return `<div class="cal-day pcal-day other-month">
                  <div class="cal-day-num" style="opacity:.35">${cell.day}</div>
                </div>`;
      }

      const isToday  = cell.dateStr === today;
      const isPubDay = _isPubDay(cell.dateStr);
      const dayEntries = entries.filter(e => e.date === cell.dateStr);

      let entriesHTML = '';
      if (dayEntries.length > 0) {
        entriesHTML = '<div class="pcal-entries">' +
          dayEntries.map(entry => {
            const cat = _getCategoryInfo(entry.category);
            const client = App.CLIENTS.find(c => c.id === entry.clientId);
            const clientLabel = client ? client.name : '';
            const label = entry.category === 'autre' ? (entry.customLabel || 'Autre') : cat.label;
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
        <div class="cal-day pcal-day current-month${isToday ? ' today' : ''}${isPubDay ? ' pub-day' : ''}"
             data-date="${cell.dateStr}">
          <div class="cal-day-num">${cell.day}</div>
          ${isPubDay ? '<div class="pub-day-dot"></div>' : ''}
          ${entriesHTML}
        </div>`;
    }).join('');

    /* Légende catégories */
    const catLegendHTML = CATEGORIES.map(c =>
      `<span class="pcal-type-legend-item">
         <span class="pcal-type-dot" style="background:${c.color}"></span>
         ${c.label}
       </span>`
    ).join('');

    /* Légende clients */
    const legendHTML = App.CLIENTS.map(c =>
      `<span class="pcal-legend-item">
         <span class="pcal-legend-dot" style="background:${c.color}"></span>
         ${escHtml(c.name)}
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
          <div class="pcal-type-legend">${catLegendHTML}</div>
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
        </div>

        <p style="font-size:.75rem;color:var(--text-3);margin-top:8px;text-align:center">
          Cliquez sur un jour pour ajouter une t\u00e2che de publication
        </p>
      </div>

      <!-- Popup ajout (caché par défaut) -->
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
    const dateLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    title.textContent = dateLabel;

    body.innerHTML = `
      <div class="pcal-popup-step-label">Choisir une cat\u00e9gorie :</div>
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

    // Wire category buttons
    body.querySelectorAll('.pcal-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.dataset.cat;
        if (catId === 'autre') {
          _showCustomInput(dateStr);
        } else {
          _showClientStep(dateStr, catId, null);
        }
      });
    });
  }

  /* ── Popup : Étape intermédiaire — Input "Autre" ────────────── */
  function _showCustomInput(dateStr) {
    const body = document.getElementById('pcal-popup-body');
    body.innerHTML = `
      <div class="pcal-popup-step-label">Nom de la t\u00e2che :</div>
      <input type="text" class="form-input pcal-custom-input" id="pcal-custom-name"
             placeholder="Ex: R\u00e9union, Brainstorm..." autofocus />
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

  /* ── Popup : Étape 2 — Choix du client ──────────────────────── */
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

  /* ── Popup : Detail d'une entrée existante ──────────────────── */
  function _showEntryDetail(entryId) {
    const entries = _loadEntries();
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const overlay = document.getElementById('pcal-popup-overlay');
    const title   = document.getElementById('pcal-popup-title');
    const body    = document.getElementById('pcal-popup-body');

    const cat = _getCategoryInfo(entry.category);
    const client = App.CLIENTS.find(c => c.id === entry.clientId);
    const label = entry.category === 'autre' ? (entry.customLabel || 'Autre') : cat.label;

    const d = new Date(entry.date + 'T12:00:00');
    const dateLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    title.textContent = dateLabel;

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
        _showEntryDetail(entryId); // refresh detail
        // Also refresh calendar behind
        const container = document.getElementById('pubcal-container');
        if (container) {
          const popup = document.getElementById('pcal-popup-overlay');
          // We'll re-render after close
        }
      }
    });

    document.getElementById('pcal-delete-entry').addEventListener('click', () => {
      const ents = _loadEntries();
      const idx = ents.findIndex(x => x.id === entryId);
      if (idx >= 0) {
        ents.splice(idx, 1);
        _saveEntries(ents);
      }
      _closePopup();
      renderView();
    });
  }

  /* ── Popup : Fermer ─────────────────────────────────────────── */
  function _closePopup() {
    const overlay = document.getElementById('pcal-popup-overlay');
    if (overlay) overlay.style.display = 'none';
    _popupDate = null;
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

    /* Clic sur le calendrier */
    document.querySelector('.pcal-grid')?.addEventListener('click', e => {
      // Clic sur une entrée existante
      const entryEl = e.target.closest('.pcal-entry');
      if (entryEl) {
        e.stopPropagation();
        _showEntryDetail(entryEl.dataset.entryId);
        return;
      }

      // Clic sur un jour → ouvrir popup catégorie
      const dayEl = e.target.closest('.cal-day.current-month');
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

  /* ── Calcul de l'avance de contenu (pour le dashboard) ──────── */
  function getDaysAdvance(clientId) {
    const entries = _loadEntries();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let lastDone = null;
    entries.forEach(entry => {
      if (entry.clientId === clientId && entry.status === 'termine') {
        const d = new Date(entry.date + 'T12:00:00');
        d.setHours(0, 0, 0, 0);
        if (!lastDone || d > lastDone) lastDone = d;
      }
    });

    if (!lastDone) return null;
    return Math.round((lastDone - today) / 86_400_000);
  }

  /* ── API publique ───────────────────────────────────────────── */
  return { renderView, getDaysAdvance };

})();
