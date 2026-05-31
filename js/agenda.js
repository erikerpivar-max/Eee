/* ================================================================
   THE HOUSE — agenda.js
   Vue Agenda principale (inspirée Google Agenda)

   Données :
   - th_calendars      : liste des calendriers (TT, Planification, …)
   - th_plan_events    : évènements créés manuellement (Planification)
   - source TT         : tâches du time tracker (lecture seule)

   Vues : Mois, Semaine, Jour.
   Cases à cocher pour chaque calendrier dans la sidebar.
   ================================================================ */

'use strict';

window.Agenda = {

  KEY_CALS:   'th_calendars',
  KEY_EVENTS: 'th_plan_events',
  KEY_PREFS:  'th_agenda_prefs',

  DEFAULT_CALS: [
    { id: 'tt',   name: 'Time Tracking', color: '#3B82F6', visible: true, source: 'timetracker', readonly: true  },
    { id: 'plan', name: 'Planification', color: '#10B981', visible: true, source: 'plan',        readonly: false },
    { id: 'pub',  name: 'Publications',  color: '#F59E0B', visible: true, source: 'pubcal',      readonly: true  },
  ],

  /* Catégories de publication (synchronisées avec pubcal.js) */
  PUB_CATEGORIES: {
    programmation: { label: 'Programmation', short: 'PG', color: '#22C55E' },
    tournage:      { label: 'Tournage',      short: 'TO', color: '#8B5CF6' },
    script:        { label: 'Script',        short: 'SC', color: '#3B82F6' },
    montage:       { label: 'Montage',       short: 'MT', color: '#F59E0B' },
    autre:         { label: 'Autre',         short: '·',  color: '#6B7280' },
  },

  KEY_PUB_FILTER: 'th_agenda_pub_clients',  /* clients visibles dans Publications */

  /* ── État ────────────────────────────────────────────────────── */
  _view:     'month',           // day | week | month
  _date:     null,              // référence courante
  _editId:   null,
  _miniDate: null,

  /* ── Storage ─────────────────────────────────────────────────── */
  loadCals() {
    try {
      const v = localStorage.getItem(this.KEY_CALS);
      if (v === null) {
        localStorage.setItem(this.KEY_CALS, JSON.stringify(this.DEFAULT_CALS));
        return [...this.DEFAULT_CALS];
      }
      const cals = JSON.parse(v);
      /* S'assurer que les calendriers par défaut existent toujours */
      this.DEFAULT_CALS.forEach(def => {
        if (!cals.find(c => c.id === def.id)) cals.push({ ...def });
      });
      return cals;
    } catch { return [...this.DEFAULT_CALS]; }
  },
  saveCals(c) {
    try { localStorage.setItem(this.KEY_CALS, JSON.stringify(c)); } catch(e) {}
  },
  loadEvents() {
    try {
      const v = localStorage.getItem(this.KEY_EVENTS);
      return v !== null ? JSON.parse(v) : [];
    } catch { return []; }
  },
  saveEvents(e) {
    try { localStorage.setItem(this.KEY_EVENTS, JSON.stringify(e)); } catch(e) {}
  },
  loadPrefs() {
    try {
      const v = localStorage.getItem(this.KEY_PREFS);
      return v !== null ? JSON.parse(v) : { view: 'month' };
    } catch { return { view: 'month' }; }
  },
  savePrefs(p) {
    try { localStorage.setItem(this.KEY_PREFS, JSON.stringify(p)); } catch(e) {}
  },

  /* ── Helpers date ────────────────────────────────────────────── */
  _today() { const d = new Date(); d.setHours(0,0,0,0); return d; },
  _sameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth()    === b.getMonth()
        && a.getDate()     === b.getDate();
  },
  _startOfWeek(d) {
    const r = new Date(d);
    const day = (r.getDay() + 6) % 7; /* lundi = 0 */
    r.setDate(r.getDate() - day);
    r.setHours(0,0,0,0);
    return r;
  },
  _endOfWeek(d) {
    const r = this._startOfWeek(d);
    r.setDate(r.getDate() + 6); r.setHours(23,59,59,999);
    return r;
  },
  _startOfMonth(d) {
    const r = new Date(d.getFullYear(), d.getMonth(), 1);
    r.setHours(0,0,0,0); return r;
  },
  _endOfMonth(d) {
    const r = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    r.setHours(23,59,59,999); return r;
  },
  _fmtTime(d) {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  },
  _fmtDateInput(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },
  _esc(s) {
    return window.escHtml ? escHtml(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  },
  _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

  /* ── Source TT : convertit les tâches du time tracker ─────────── */
  _eventsFromTT() {
    if (!window.App || !App.KEYS || !App.KEYS.TASKS) return [];
    const tasks = App.load(App.KEYS.TASKS, []);
    return tasks
      .filter(t => t.startedAt && (t.totalDuration > 0))
      .map(t => {
        const start = new Date(t.startedAt);
        const end   = new Date(start.getTime() + (t.totalDuration * 1000));
        const client = t.clientId && App.CLIENTS
          ? App.CLIENTS.find(c => c.id === t.clientId)
          : null;
        return {
          id:         't_' + t.id,
          calendarId: 'tt',
          title:      t.name || 'Tâche',
          start:      start.toISOString(),
          end:        end.toISOString(),
          allDay:     false,
          color:      client ? client.color : null,
          clientId:   t.clientId,
          projectRef: t.projectId,
          readonly:   true,
          source:     'tt',
        };
      });
  },

  /* Filtres clients pour Publications (par défaut tous visibles) */
  loadPubClientFilters() {
    try {
      const v = localStorage.getItem(this.KEY_PUB_FILTER);
      if (v === null) return {}; /* {} = tous visibles */
      return JSON.parse(v);
    } catch { return {}; }
  },
  savePubClientFilters(f) {
    try { localStorage.setItem(this.KEY_PUB_FILTER, JSON.stringify(f)); } catch(e) {}
  },
  isPubClientVisible(clientId) {
    const f = this.loadPubClientFilters();
    /* défaut = true sauf si explicitement false */
    return f[clientId] !== false;
  },
  togglePubClient(clientId) {
    const f = this.loadPubClientFilters();
    f[clientId] = !this.isPubClientVisible(clientId);
    this.savePubClientFilters(f);
    this.render();
  },
  setAllPubClients(visible) {
    if (!window.App || !App.CLIENTS) return;
    const f = {};
    App.CLIENTS.forEach(c => { f[c.id] = visible; });
    this.savePubClientFilters(f);
    this.render();
  },

  /* ── Source PubCal : convertit les entries publications ───────── */
  _eventsFromPubCal() {
    try {
      const entries = (window.App && App.load) ? App.load('th_pubcal_entries', []) : [];
      return entries
        .filter(e => !e.clientId || this.isPubClientVisible(e.clientId))
        .map(e => {
          const cat = this.PUB_CATEGORIES[e.category] || { label: e.category, short: '·', color: '#6B7280' };
          const label = e.category === 'autre' ? (e.customLabel || 'Autre') : cat.label;
          const client = (e.clientId && window.App && App.CLIENTS)
            ? App.CLIENTS.find(c => c.id === e.clientId) : null;
          const title = client ? `${label} — ${client.name}` : label;
          const start = new Date(e.date + 'T00:00:00');
          const end   = new Date(e.date + 'T23:59:59');
          /* Couleur = couleur du client (sinon couleur catégorie) */
          const color = client ? client.color : cat.color;
          return {
            id:         'p_' + e.id,
            calendarId: 'pub',
            title,
            start:      start.toISOString(),
            end:        end.toISOString(),
            allDay:     true,
            color,
            clientId:   e.clientId,
            readonly:   true,
            source:     'pubcal',
            pubCategory: cat,
            pubLabel:    label,
            clientName:  client ? client.name : '',
            description: e.status === 'termine' ? '✓ Terminée' : 'À publier',
          };
        });
    } catch { return []; }
  },

  /* ── Tous les évènements visibles dans une fenêtre ────────────── */
  _eventsBetween(start, end) {
    const cals = this.loadCals();
    const visibleIds = new Set(cals.filter(c => c.visible).map(c => c.id));
    const all = [
      ...this._eventsFromTT(),
      ...this._eventsFromPubCal(),
      ...this.loadEvents(),
    ];
    return all
      .filter(e => visibleIds.has(e.calendarId))
      .filter(e => {
        const es = new Date(e.start); const ee = new Date(e.end);
        return ee >= start && es <= end;
      });
  },

  /* ── Couleur effective d'un évènement ─────────────────────────── */
  _eventColor(e, cals) {
    if (e.color) return e.color;
    const c = (cals || this.loadCals()).find(c => c.id === e.calendarId);
    return c ? c.color : '#64748B';
  },

  /* ── Rendu : sidebar + main ──────────────────────────────────── */
  render() {
    this._renderSidebar();
    this._renderToolbar();
    this._renderMini();
    if (this._view === 'month') this._renderMonth();
    else if (this._view === 'week')  this._renderWeek();
    else                              this._renderDay();
    /* Boutons de vue */
    document.querySelectorAll('.agenda-view-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === this._view);
    });
  },

  _renderSidebar() {
    const wrap = document.getElementById('agendaCalList');
    if (!wrap) return;
    const cals = this.loadCals();
    const clients = (window.App && App.CLIENTS) ? App.CLIENTS : [];

    wrap.innerHTML = cals.map(c => {
      let html = `<label class="agenda-cal-item" style="--c:${c.color}">
        <input type="checkbox" data-id="${c.id}" ${c.visible ? 'checked' : ''} />
        <span class="agenda-cal-tick"></span>
        <span class="agenda-cal-name">${this._esc(c.name)}</span>
        ${c.id === 'pub' && c.visible ? `<span class="agenda-cal-count" title="Magasins visibles">${clients.filter(cl => this.isPubClientVisible(cl.id)).length}/${clients.length}</span>` : ''}
        ${c.readonly && c.id !== 'pub' ? '<span class="agenda-cal-tag">auto</span>' : ''}
      </label>`;

      /* Sub-list des clients/magasins pour le calendrier Publications */
      if (c.id === 'pub' && c.visible && clients.length > 0) {
        const allOn = clients.every(cl => this.isPubClientVisible(cl.id));
        html += `<div class="agenda-cal-sublist">
          <div class="agenda-cal-sub-actions">
            <button class="agenda-cal-sub-action" data-pub-action="${allOn ? 'none' : 'all'}">
              ${allOn ? 'Tout décocher' : 'Tout cocher'}
            </button>
          </div>` +
          clients.map(cl => `
            <label class="agenda-cal-sub-item" style="--c:${cl.color}">
              <input type="checkbox" data-pub-client="${cl.id}" ${this.isPubClientVisible(cl.id) ? 'checked' : ''} />
              <span class="agenda-cal-tick"></span>
              <span class="agenda-cal-sub-name">${this._esc(cl.name)}</span>
            </label>`).join('')
          + '</div>';
      }
      return html;
    }).join('');
  },

  _renderToolbar() {
    const el = document.getElementById('agendaTitle');
    if (!el) return;
    const d = this._date;
    if (this._view === 'month') {
      el.textContent = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    } else if (this._view === 'week') {
      const s = this._startOfWeek(d); const e = this._endOfWeek(d);
      const sameMonth = s.getMonth() === e.getMonth();
      if (sameMonth) {
        el.textContent = `${s.getDate()} – ${e.getDate()} ${e.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
      } else {
        el.textContent = `${s.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} – ${e.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      }
    } else {
      el.textContent = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    el.textContent = el.textContent.charAt(0).toUpperCase() + el.textContent.slice(1);
  },

  /* ── Mini-calendrier dans la sidebar ──────────────────────────── */
  _renderMini() {
    const wrap = document.getElementById('agendaMini');
    if (!wrap) return;
    const ref = this._miniDate || this._date;
    const first = this._startOfMonth(ref);
    const last  = this._endOfMonth(ref);
    const startGrid = this._startOfWeek(first);
    const endGrid = new Date(this._endOfWeek(last)); endGrid.setHours(0,0,0,0);

    const today = this._today();
    const cur = new Date(startGrid);
    let weeks = '';
    while (cur <= endGrid) {
      let row = '';
      for (let i = 0; i < 7; i++) {
        const inMonth = cur.getMonth() === ref.getMonth();
        const isToday = this._sameDay(cur, today);
        const isSel   = this._sameDay(cur, this._date);
        const cls = ['agenda-mini-day'];
        if (!inMonth) cls.push('out');
        if (isToday)  cls.push('today');
        if (isSel)    cls.push('sel');
        row += `<button class="${cls.join(' ')}" data-date="${this._fmtDateInput(cur)}">${cur.getDate()}</button>`;
        cur.setDate(cur.getDate() + 1);
      }
      weeks += `<div class="agenda-mini-row">${row}</div>`;
    }

    wrap.innerHTML = `
      <div class="agenda-mini-head">
        <button class="agenda-mini-nav" data-mini="-1" aria-label="Mois précédent"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg></button>
        <span class="agenda-mini-title">${ref.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
        <button class="agenda-mini-nav" data-mini="1" aria-label="Mois suivant"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg></button>
      </div>
      <div class="agenda-mini-dow">
        <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
      </div>
      <div class="agenda-mini-grid">${weeks}</div>`;
  },

  /* ── Vue MOIS ────────────────────────────────────────────────── */
  _renderMonth() {
    const wrap = document.getElementById('agendaGrid');
    if (!wrap) return;
    const ref = this._date;
    const first = this._startOfMonth(ref);
    const last  = this._endOfMonth(ref);
    const startGrid = this._startOfWeek(first);
    const endGrid = this._endOfWeek(last);

    const events = this._eventsBetween(startGrid, endGrid);
    const cals = this.loadCals();

    const today = this._today();
    const cur = new Date(startGrid);
    const eventsByDay = {};
    events.forEach(e => {
      const s = new Date(e.start);
      const k = this._fmtDateInput(s);
      (eventsByDay[k] = eventsByDay[k] || []).push(e);
    });
    Object.values(eventsByDay).forEach(arr => arr.sort((a, b) => new Date(a.start) - new Date(b.start)));

    const dows = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    let html = `<div class="agenda-month">
      <div class="agenda-month-head">
        ${dows.map(d => `<div class="agenda-month-dow">${d}</div>`).join('')}
      </div>
      <div class="agenda-month-grid">`;

    while (cur <= endGrid) {
      const k = this._fmtDateInput(cur);
      const items = eventsByDay[k] || [];
      const inMonth = cur.getMonth() === ref.getMonth();
      const isToday = this._sameDay(cur, today);
      const cls = ['agenda-month-cell'];
      if (!inMonth) cls.push('out');
      if (isToday)  cls.push('today');

      const MAX = 3;
      let evHtml = items.slice(0, MAX).map(e => {
        const isPub = e.source === 'pubcal';
        const pubBadge = isPub && e.pubCategory
          ? `<span class="agenda-pub-tag" style="background:${e.pubCategory.color}" title="${this._esc(e.pubCategory.label)}">${e.pubCategory.short}</span>`
          : '<span class="agenda-month-evt-dot"></span>';
        return `<div class="agenda-month-evt${isPub ? ' is-pub' : ''}" style="--c:${this._eventColor(e, cals)}" data-evt="${e.id}" title="${this._esc(e.title)}">
          ${pubBadge}
          ${e.allDay || isPub ? '' : `<span class="agenda-month-evt-time">${this._fmtTime(new Date(e.start))}</span>`}
          <span class="agenda-month-evt-title">${this._esc(isPub ? (e.clientName || e.title) : e.title)}</span>
        </div>`;
      }).join('');
      if (items.length > MAX) {
        evHtml += `<div class="agenda-month-more" data-more="${k}">+ ${items.length - MAX} de plus</div>`;
      }

      html += `<div class="${cls.join(' ')}" data-date="${k}">
        <div class="agenda-month-num">${cur.getDate()}</div>
        <div class="agenda-month-evts">${evHtml}</div>
      </div>`;
      cur.setDate(cur.getDate() + 1);
    }

    html += '</div></div>';
    wrap.innerHTML = html;
  },

  /* ── Vue SEMAINE / JOUR (time grid) ──────────────────────────── */
  _renderWeek() { this._renderTimeGrid(7); },
  _renderDay()  { this._renderTimeGrid(1); },

  _renderTimeGrid(nDays) {
    const wrap = document.getElementById('agendaGrid');
    if (!wrap) return;
    const today = this._today();
    const start = nDays === 7 ? this._startOfWeek(this._date) : new Date(this._date);
    start.setHours(0,0,0,0);
    const days = [];
    for (let i = 0; i < nDays; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      days.push(d);
    }
    const end = new Date(days[days.length - 1]); end.setHours(23,59,59,999);

    const cals = this.loadCals();
    const allEvents = this._eventsBetween(start, end);
    const dayEvents = allEvents.filter(e => !e.allDay);
    const allDayEvents = allEvents.filter(e => e.allDay);

    const HOUR_PX = 48;   /* hauteur d'une heure */
    const HOURS = 24;

    /* En-tête */
    let headHtml = `<div class="agenda-tg-head">
      <div class="agenda-tg-corner"></div>`;
    days.forEach(d => {
      const isT = this._sameDay(d, today);
      headHtml += `<div class="agenda-tg-day-head${isT ? ' today' : ''}">
        <div class="agenda-tg-day-name">${d.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
        <div class="agenda-tg-day-num">${d.getDate()}</div>
      </div>`;
    });
    headHtml += '</div>';

    /* Ligne "toute la journée" */
    let allDayHtml = `<div class="agenda-tg-allday">
      <div class="agenda-tg-allday-label">Toute la<br>journée</div>`;
    days.forEach(d => {
      const k = this._fmtDateInput(d);
      const items = allDayEvents.filter(e => {
        const s = new Date(e.start); const ee = new Date(e.end);
        return s <= new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
            && ee >= new Date(d.getFullYear(), d.getMonth(), d.getDate());
      });
      allDayHtml += `<div class="agenda-tg-allday-col" data-date="${k}">
        ${items.map(e => {
          const isPub = e.source === 'pubcal';
          const pubBadge = isPub && e.pubCategory
            ? `<span class="agenda-pub-tag agenda-pub-tag--solid" style="background:${e.pubCategory.color}" title="${this._esc(e.pubCategory.label)}">${e.pubCategory.short}</span>`
            : '';
          const label = isPub ? (e.clientName || e.title) : e.title;
          return `<div class="agenda-tg-allday-evt${isPub ? ' is-pub' : ''}" style="--c:${this._eventColor(e, cals)}" data-evt="${e.id}" title="${this._esc(e.title)}">${pubBadge}<span class="agenda-tg-allday-evt-text">${this._esc(label)}</span></div>`;
        }).join('')}
      </div>`;
    });
    allDayHtml += '</div>';

    /* Corps : colonne heures + colonnes jours */
    let hoursCol = '<div class="agenda-tg-hours">';
    for (let h = 0; h < HOURS; h++) {
      hoursCol += `<div class="agenda-tg-hour-row" style="height:${HOUR_PX}px">
        <span class="agenda-tg-hour-label">${String(h).padStart(2,'0')}:00</span>
      </div>`;
    }
    hoursCol += '</div>';

    let cols = '';
    days.forEach(d => {
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const dayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      const items = dayEvents.filter(e => {
        const es = new Date(e.start); const ee = new Date(e.end);
        return ee >= dayStart && es <= dayEnd;
      });
      /* Layout avec colonnes pour gérer les chevauchements */
      const positioned = this._layoutEvents(items, dayStart, dayEnd);
      /* Slots cliquables (1 par heure) */
      let slots = '';
      for (let h = 0; h < HOURS; h++) {
        slots += `<div class="agenda-tg-slot" data-date="${this._fmtDateInput(d)}" data-hour="${h}"
                       style="position:absolute;left:0;right:0;top:${h * HOUR_PX}px;height:${HOUR_PX}px"></div>`;
      }
      /* Now line */
      let nowLine = '';
      if (this._sameDay(d, today)) {
        const now = new Date();
        const px = (now.getHours() + now.getMinutes() / 60) * HOUR_PX;
        nowLine = `<div class="agenda-tg-now" style="top:${px}px"></div>`;
      }
      /* Évènements */
      const evts = positioned.map(p => {
        const e = p.event;
        const startMin = Math.max(0, (new Date(e.start) - dayStart) / 60000);
        const endMin   = Math.min(24 * 60, (new Date(e.end)   - dayStart) / 60000);
        const top = (startMin / 60) * HOUR_PX;
        const height = Math.max(20, ((endMin - startMin) / 60) * HOUR_PX);
        const widthPct = 100 / p.cols;
        const leftPct = p.col * widthPct;
        return `<div class="agenda-tg-evt" style="--c:${this._eventColor(e, cals)};top:${top}px;height:${height}px;left:calc(${leftPct}% + 2px);width:calc(${widthPct}% - 4px)" data-evt="${e.id}">
          <div class="agenda-tg-evt-title">${this._esc(e.title)}</div>
          <div class="agenda-tg-evt-time">${this._fmtTime(new Date(e.start))} – ${this._fmtTime(new Date(e.end))}</div>
        </div>`;
      }).join('');

      cols += `<div class="agenda-tg-col" style="height:${HOURS * HOUR_PX}px">
        ${slots}
        ${nowLine}
        ${evts}
      </div>`;
    });

    wrap.innerHTML = `<div class="agenda-tg agenda-tg--${nDays === 7 ? 'week' : 'day'}">
      ${headHtml}
      ${allDayHtml}
      <div class="agenda-tg-body">
        ${hoursCol}
        <div class="agenda-tg-cols" style="grid-template-columns:repeat(${nDays}, 1fr)">${cols}</div>
      </div>
    </div>`;

    /* Scroll initial vers 7h */
    const body = wrap.querySelector('.agenda-tg-body');
    if (body) body.scrollTop = 7 * HOUR_PX;
  },

  /* ── Layout overlaps (algorithme classique : sweep) ──────────── */
  _layoutEvents(events, dayStart, dayEnd) {
    if (events.length === 0) return [];
    const sorted = events.slice().sort((a, b) => new Date(a.start) - new Date(b.start));
    const result = [];
    let group = [];
    let groupEnd = null;

    const flushGroup = () => {
      if (group.length === 0) return;
      const cols = []; /* tableau de fin par colonne */
      group.forEach(e => {
        const s = new Date(e.start); const eend = new Date(e.end);
        let placed = false;
        for (let i = 0; i < cols.length; i++) {
          if (cols[i] <= s) { cols[i] = eend; result.push({ event: e, col: i, cols: 1 }); placed = true; break; }
        }
        if (!placed) { cols.push(eend); result.push({ event: e, col: cols.length - 1, cols: 1 }); }
      });
      const n = cols.length;
      group.forEach(e => {
        const it = result.find(r => r.event === e);
        if (it) it.cols = n;
      });
      group = [];
      groupEnd = null;
    };

    sorted.forEach(e => {
      const s = new Date(e.start); const eend = new Date(e.end);
      if (group.length === 0 || s < groupEnd) {
        group.push(e);
        if (groupEnd === null || eend > groupEnd) groupEnd = eend;
      } else {
        flushGroup();
        group.push(e); groupEnd = eend;
      }
    });
    flushGroup();
    return result;
  },

  /* ── Navigation ──────────────────────────────────────────────── */
  nav(dir) {
    const d = new Date(this._date);
    if (this._view === 'day')  d.setDate(d.getDate() + dir);
    if (this._view === 'week') d.setDate(d.getDate() + 7 * dir);
    if (this._view === 'month') d.setMonth(d.getMonth() + dir);
    this._date = d;
    if (this._view !== 'day') this._miniDate = d;
    this.render();
  },
  goToday() {
    this._date = this._today();
    this._miniDate = this._today();
    this.render();
  },
  setView(v) {
    this._view = v;
    const p = this.loadPrefs(); p.view = v; this.savePrefs(p);
    this.render();
  },
  setDate(dateStr) {
    this._date = new Date(dateStr + 'T00:00:00');
    this.render();
  },
  miniNav(dir) {
    const d = new Date(this._miniDate || this._date);
    d.setMonth(d.getMonth() + dir);
    this._miniDate = d;
    this._renderMini();
  },

  toggleCalendar(id) {
    const cals = this.loadCals();
    const c = cals.find(x => x.id === id);
    if (!c) return;
    c.visible = !c.visible;
    this.saveCals(cals);
    this.render();
  },

  /* ── Modale création / édition d'évènement ───────────────────── */
  openEditor(eventId, prefill) {
    /* prefill = { date: 'YYYY-MM-DD', hour: number } */
    let event = null;
    if (eventId) {
      const all = [...this._eventsFromTT(), ...this.loadEvents()];
      event = all.find(e => e.id === eventId) || null;
      if (!event) return;
    }
    this._editId = eventId;
    this._ensureModal();
    this._fillEditor(event, prefill);
    if (window.App && App.openModal) App.openModal('agendaModal');
    else {
      const m = document.getElementById('agendaModal');
      m.style.display = 'flex';
      requestAnimationFrame(() => requestAnimationFrame(() => m.classList.add('visible')));
    }
    setTimeout(() => { const t = document.getElementById('agendaEvtTitle'); if (t && !t.disabled) t.focus(); }, 120);
  },

  closeEditor() {
    this._editId = null;
    const m = document.getElementById('agendaModal');
    if (!m) return;
    if (window.App && App.closeModal) App.closeModal('agendaModal');
    else {
      m.classList.remove('visible');
      setTimeout(() => { m.style.display = 'none'; }, 200);
    }
  },

  _ensureModal() {
    if (document.getElementById('agendaModal')) return;
    const m = document.createElement('div');
    m.id = 'agendaModal';
    m.className = 'modal-backdrop';
    m.style.display = 'none';
    m.innerHTML = `
      <div class="modal agenda-modal" style="max-width:540px">
        <div class="modal-head">
          <h3 id="agendaModalTitle">Nouvel évènement</h3>
          <button class="modal-close-btn" id="agendaModalClose" aria-label="Fermer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body agenda-modal-body">
          <div class="agenda-form-group">
            <label>Titre</label>
            <input type="text" id="agendaEvtTitle" class="form-input" placeholder="Ex. Tournage IXINA Ath" />
          </div>
          <div class="agenda-form-group">
            <label>Calendrier</label>
            <select id="agendaEvtCal" class="form-select"></select>
          </div>
          <div class="agenda-form-row">
            <label class="agenda-form-checkbox">
              <input type="checkbox" id="agendaEvtAllDay" />
              <span>Toute la journée</span>
            </label>
          </div>
          <div class="agenda-form-grid2">
            <div class="agenda-form-group">
              <label>Début</label>
              <input type="date" id="agendaEvtStartDate" class="form-input" />
              <input type="time" id="agendaEvtStartTime" class="form-input agenda-time-input" />
            </div>
            <div class="agenda-form-group">
              <label>Fin</label>
              <input type="date" id="agendaEvtEndDate" class="form-input" />
              <input type="time" id="agendaEvtEndTime" class="form-input agenda-time-input" />
            </div>
          </div>
          <div class="agenda-form-grid2">
            <div class="agenda-form-group">
              <label>Client</label>
              <select id="agendaEvtClient" class="form-select"></select>
            </div>
            <div class="agenda-form-group">
              <label>Projet Kanban</label>
              <select id="agendaEvtProject" class="form-select"></select>
            </div>
          </div>
          <div class="agenda-form-group">
            <label>Couleur (par défaut : couleur du calendrier)</label>
            <input type="color" id="agendaEvtColor" class="todo-color" />
          </div>
          <div class="agenda-form-group">
            <label>Description</label>
            <textarea id="agendaEvtNotes" class="form-input" rows="3"></textarea>
          </div>
          <div class="agenda-readonly-banner" id="agendaReadonlyBanner" style="display:none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span id="agendaReadonlyMsg">Cet évènement est synchronisé automatiquement et ne peut pas être modifié ici.</span>
          </div>
        </div>
        <div class="modal-foot agenda-modal-foot">
          <button class="btn btn-ghost" id="agendaEvtDel" style="display:none">Supprimer</button>
          <div style="flex:1"></div>
          <button class="btn btn-ghost" id="agendaEvtCancel">Annuler</button>
          <button class="btn btn-primary" id="agendaEvtSave">Enregistrer</button>
        </div>
      </div>`;
    document.body.appendChild(m);

    m.addEventListener('click', e => { if (e.target === m) this.closeEditor(); });
    m.querySelector('#agendaModalClose').addEventListener('click', () => this.closeEditor());
    m.querySelector('#agendaEvtCancel').addEventListener('click', () => this.closeEditor());
    m.querySelector('#agendaEvtSave').addEventListener('click', () => this._saveFromEditor());
    m.querySelector('#agendaEvtDel').addEventListener('click',  () => {
      if (this._editId && confirm('Supprimer cet évènement ?')) this._deleteEditing();
    });
    m.querySelector('#agendaEvtAllDay').addEventListener('change', e => {
      m.querySelectorAll('.agenda-time-input').forEach(el => el.disabled = e.target.checked);
    });
    m.querySelector('#agendaEvtStartDate').addEventListener('change', () => this._ensureEndAfterStart());
    m.querySelector('#agendaEvtStartTime').addEventListener('change', () => this._ensureEndAfterStart());
  },

  _ensureEndAfterStart() {
    const $ = id => document.getElementById(id);
    const sd = $('agendaEvtStartDate').value;
    const st = $('agendaEvtStartTime').value || '00:00';
    const ed = $('agendaEvtEndDate').value;
    const et = $('agendaEvtEndTime').value || '00:00';
    if (!sd || !ed) return;
    const sDT = new Date(`${sd}T${st}`);
    const eDT = new Date(`${ed}T${et}`);
    if (eDT <= sDT) {
      const newEnd = new Date(sDT.getTime() + 60 * 60 * 1000);
      $('agendaEvtEndDate').value = this._fmtDateInput(newEnd);
      $('agendaEvtEndTime').value = `${String(newEnd.getHours()).padStart(2,'0')}:${String(newEnd.getMinutes()).padStart(2,'0')}`;
    }
  },

  _fillEditor(event, prefill) {
    const $ = id => document.getElementById(id);
    const cals = this.loadCals().filter(c => !c.readonly);
    const clients = (window.App && App.CLIENTS) ? App.CLIENTS : [];

    /* Select calendriers */
    $('agendaEvtCal').innerHTML = cals.map(c =>
      `<option value="${c.id}">${this._esc(c.name)}</option>`).join('');

    /* Select clients */
    $('agendaEvtClient').innerHTML = '<option value="">— Aucun —</option>' +
      clients.map(c => `<option value="${c.id}">${this._esc(c.name)}</option>`).join('');

    /* Si édition */
    if (event) {
      const start = new Date(event.start);
      const end   = new Date(event.end);
      $('agendaModalTitle').textContent = event.readonly ? 'Évènement (lecture seule)' : 'Modifier l\'évènement';
      const msg = $('agendaReadonlyMsg');
      if (msg) {
        if (event.source === 'pubcal')      msg.textContent = 'Cette publication provient de la vue Publication et n\'est pas modifiable ici.';
        else if (event.source === 'tt')     msg.textContent = 'Cette tâche provient du Time Tracking et n\'est pas modifiable ici.';
        else                                msg.textContent = 'Cet évènement est synchronisé automatiquement et ne peut pas être modifié ici.';
      }
      $('agendaEvtTitle').value = event.title || '';
      $('agendaEvtCal').value = event.calendarId;
      $('agendaEvtAllDay').checked = !!event.allDay;
      $('agendaEvtStartDate').value = this._fmtDateInput(start);
      $('agendaEvtEndDate').value   = this._fmtDateInput(end);
      $('agendaEvtStartTime').value = `${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`;
      $('agendaEvtEndTime').value   = `${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`;
      $('agendaEvtClient').value = event.clientId || '';
      $('agendaEvtColor').value = event.color || (this.loadCals().find(c => c.id === event.calendarId)?.color || '#10B981');
      $('agendaEvtNotes').value = event.description || '';
      $('agendaEvtDel').style.display = event.readonly ? 'none' : 'inline-flex';
      const banner = $('agendaReadonlyBanner');
      banner.style.display = event.readonly ? 'block' : 'none';
      /* Désactiver champs si readonly */
      ['agendaEvtTitle','agendaEvtCal','agendaEvtAllDay','agendaEvtStartDate','agendaEvtStartTime',
       'agendaEvtEndDate','agendaEvtEndTime','agendaEvtClient','agendaEvtProject','agendaEvtColor','agendaEvtNotes']
        .forEach(id => { $(id).disabled = !!event.readonly; });
      $('agendaEvtSave').style.display = event.readonly ? 'none' : 'inline-flex';
      /* Liste projets selon client */
      this._fillProjectSelect(event.clientId || '', event.projectRef || '');
    } else {
      /* Création */
      $('agendaModalTitle').textContent = 'Nouvel évènement';
      $('agendaEvtTitle').value = '';
      $('agendaEvtCal').value = cals[0]?.id || 'plan';
      $('agendaEvtAllDay').checked = false;
      const base = prefill && prefill.date ? new Date(prefill.date + 'T00:00:00') : new Date(this._date);
      const startD = new Date(base);
      const h = prefill && prefill.hour != null ? prefill.hour : (new Date().getHours() + 1);
      startD.setHours(h, 0, 0, 0);
      const endD = new Date(startD.getTime() + 60 * 60 * 1000);
      $('agendaEvtStartDate').value = this._fmtDateInput(startD);
      $('agendaEvtEndDate').value   = this._fmtDateInput(endD);
      $('agendaEvtStartTime').value = `${String(startD.getHours()).padStart(2,'0')}:00`;
      $('agendaEvtEndTime').value   = `${String(endD.getHours()).padStart(2,'0')}:00`;
      $('agendaEvtClient').value = '';
      $('agendaEvtColor').value = cals[0]?.color || '#10B981';
      $('agendaEvtNotes').value = '';
      $('agendaEvtDel').style.display = 'none';
      $('agendaReadonlyBanner').style.display = 'none';
      $('agendaEvtSave').style.display = 'inline-flex';
      ['agendaEvtTitle','agendaEvtCal','agendaEvtAllDay','agendaEvtStartDate','agendaEvtStartTime',
       'agendaEvtEndDate','agendaEvtEndTime','agendaEvtClient','agendaEvtProject','agendaEvtColor','agendaEvtNotes']
        .forEach(id => { $(id).disabled = false; });
      this._fillProjectSelect('', '');
    }
    /* Quand le client change → recharger les projets */
    $('agendaEvtClient').onchange = () => this._fillProjectSelect($('agendaEvtClient').value, '');
    /* Désactiver heures si allDay */
    document.querySelectorAll('.agenda-time-input').forEach(el => el.disabled = $('agendaEvtAllDay').checked);
  },

  _fillProjectSelect(clientId, selected) {
    const $ = id => document.getElementById(id);
    const sel = $('agendaEvtProject');
    if (!sel) return;
    const projects = (clientId && window.App && App.KEYS)
      ? App.load(`${App.KEYS.PROJECTS}_${clientId}`, [])
      : [];
    sel.innerHTML = '<option value="">— Aucun —</option>' +
      projects.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${this._esc(p.name || '(sans nom)')}</option>`).join('');
  },

  _saveFromEditor() {
    const $ = id => document.getElementById(id);
    const title = $('agendaEvtTitle').value.trim();
    if (!title) { alert('Le titre est requis.'); return; }
    const allDay = $('agendaEvtAllDay').checked;
    const sd = $('agendaEvtStartDate').value;
    const st = allDay ? '00:00' : ($('agendaEvtStartTime').value || '00:00');
    const ed = $('agendaEvtEndDate').value || sd;
    const et = allDay ? '23:59' : ($('agendaEvtEndTime').value || '23:59');
    if (!sd) { alert('La date de début est requise.'); return; }
    const start = new Date(`${sd}T${st}`).toISOString();
    const end   = new Date(`${ed}T${et}`).toISOString();
    const data = {
      title,
      calendarId: $('agendaEvtCal').value,
      start, end, allDay,
      clientId:   $('agendaEvtClient').value || '',
      projectRef: $('agendaEvtProject').value || '',
      color:      $('agendaEvtColor').value || null,
      description:$('agendaEvtNotes').value || '',
    };
    const all = this.loadEvents();
    if (this._editId) {
      const item = all.find(e => e.id === this._editId);
      if (item) Object.assign(item, data);
    } else {
      all.push({ id: this._uid(), ...data, createdAt: new Date().toISOString() });
    }
    this.saveEvents(all);
    this.closeEditor();
    this.render();
  },

  _deleteEditing() {
    if (!this._editId) return;
    const all = this.loadEvents().filter(e => e.id !== this._editId);
    this.saveEvents(all);
    this.closeEditor();
    this.render();
  },

  /* ── Init ────────────────────────────────────────────────────── */
  init() {
    const prefs = this.loadPrefs();
    this._view = prefs.view || 'month';
    this._date = this._today();
    this._miniDate = this._today();
    this.loadCals(); /* ensure defaults */
    this.render();

    const $ = id => document.getElementById(id);

    $('agendaTodayBtn')?.addEventListener('click', () => this.goToday());
    $('agendaPrevBtn')?.addEventListener('click',  () => this.nav(-1));
    $('agendaNextBtn')?.addEventListener('click',  () => this.nav(1));
    $('agendaCreateBtn')?.addEventListener('click',() => this.openEditor(null, { date: this._fmtDateInput(this._date), hour: 9 }));

    document.querySelectorAll('.agenda-view-btn').forEach(b => {
      b.addEventListener('click', () => this.setView(b.dataset.view));
    });

    /* Cases à cocher des calendriers et sous-filtres clients */
    const calListEl = document.getElementById('agendaCalList');
    calListEl?.addEventListener('change', e => {
      const cb = e.target.closest('input[type="checkbox"]');
      if (!cb) return;
      if (cb.dataset.pubClient) this.togglePubClient(cb.dataset.pubClient);
      else if (cb.dataset.id)   this.toggleCalendar(cb.dataset.id);
    });
    calListEl?.addEventListener('click', e => {
      const btn = e.target.closest('[data-pub-action]');
      if (!btn) return;
      e.preventDefault();
      this.setAllPubClients(btn.dataset.pubAction === 'all');
    });

    /* Mini-calendrier */
    document.getElementById('agendaMini')?.addEventListener('click', e => {
      const navBtn = e.target.closest('.agenda-mini-nav');
      if (navBtn) { this.miniNav(parseInt(navBtn.dataset.mini, 10)); return; }
      const day = e.target.closest('.agenda-mini-day');
      if (day) {
        this.setDate(day.dataset.date);
        if (this._view === 'month') this.setView('day');
        else this.render();
      }
    });

    /* Raccourcis clavier (style Google Agenda) — uniquement si la vue est active */
    document.addEventListener('keydown', e => {
      if (App.currentView !== 'agenda') return;
      if (e.target.matches('input, textarea, select')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'm') { this.setView('month'); e.preventDefault(); }
      else if (k === 'w' || k === 's') { this.setView('week'); e.preventDefault(); }
      else if (k === 'd' || k === 'j') { this.setView('day');  e.preventDefault(); }
      else if (k === 't' || k === 'a') { this.goToday();        e.preventDefault(); }
      else if (k === 'n')              { this.openEditor(null, { date: this._fmtDateInput(this._date), hour: 9 }); e.preventDefault(); }
    });

    /* Délégation sur la grille (slots, cellules mois, évènements) */
    document.getElementById('agendaGrid')?.addEventListener('click', e => {
      const evt = e.target.closest('[data-evt]');
      if (evt) { this.openEditor(evt.dataset.evt); return; }
      const more = e.target.closest('[data-more]');
      if (more) { this.setDate(more.dataset.more); this.setView('day'); return; }
      const slot = e.target.closest('.agenda-tg-slot');
      if (slot) {
        this.openEditor(null, { date: slot.dataset.date, hour: parseInt(slot.dataset.hour, 10) });
        return;
      }
      const cell = e.target.closest('.agenda-month-cell');
      if (cell && !e.target.closest('.agenda-month-evt')) {
        this.openEditor(null, { date: cell.dataset.date, hour: 9 });
        return;
      }
    });
  },
};
