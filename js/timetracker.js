/* ================================================================
   THE HOUSE — timetracker.js
   Timer, gestion des tâches, Vue Journée / Semaine style Google Calendar
   ================================================================ */

'use strict';

window.TimeTracker = (() => {

  /* ── Constantes calendrier ──────────────────────────────────── */
  const CAL_START  = 7;
  const CAL_END    = 22;
  const PX_H       = 80;   /* pixels par heure */
  const PX_M       = PX_H / 60;
  const DAYS_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const DAYS_LONG  = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const MONTHS_FR  = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

  /* ── État calendrier ────────────────────────────────────────── */
  let _calView = 'day';
  let _calDate = new Date();

  /* ── État timer ─────────────────────────────────────────────── */
  let _interval    = null;
  let _running     = false;
  let _paused      = false;
  let _startTs     = null;
  let _accumulated = 0;
  let _currentId   = null;

  /* ── DOM helpers ────────────────────────────────────────────── */
  function $id(id) { return document.getElementById(id); }

  const dom = {
    get nameInput()    { return $id('taskNameInput'); },
    get clientSelect() { return $id('taskClientSelect'); },
    get display()      { return $id('timerDisplay'); },
    get startBtn()     { return $id('timerStartBtn'); },
    get pauseBtn()     { return $id('timerPauseBtn'); },
    get resumeBtn()    { return $id('timerResumeBtn'); },
    get stopBtn()      { return $id('timerStopBtn'); },
    get statusLabel()  { return $id('timerStatusLabel'); },
    get tableBody()    { return $id('tasksTableBody'); },
    get totalBar()     { return $id('dailyTotalBar'); },
    get totalVal()     { return $id('dailyTotalValue'); },
  };

  /* ── Utils date ─────────────────────────────────────────────── */
  function _iso(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function _weekStart(d) {
    const day  = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const s    = new Date(d);
    s.setDate(d.getDate() + diff);
    s.setHours(0,0,0,0);
    return s;
  }

  /* ── Calcul temps écoulé ────────────────────────────────────── */
  function elapsed() {
    if (!_running || _paused) return _accumulated;
    return _accumulated + Math.floor((Date.now() - _startTs) / 1000);
  }

  function _tick() { dom.display.textContent = App.fmtClock(elapsed()); }

  /* ── Selects ────────────────────────────────────────────────── */
  function populateClientSelect() {
    const sel = dom.clientSelect;
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Aucun client —</option>' +
      App.CLIENTS.map(c =>
        `<option value="${c.id}"${c.id === cur ? ' selected' : ''}>${escHtml(c.name)}</option>`
      ).join('') +
      `<option value="${App.AUTRE_CLIENT_ID}"${App.AUTRE_CLIENT_ID === cur ? ' selected' : ''}>Autre</option>`;
  }

  function populateKanbanSelect() {
    const sel = $id('taskKanbanSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Choisir une étape —</option>' +
      App.STAGES.map(s =>
        `<option value="${escHtml(s.label)}">${escHtml(s.label)}</option>`
      ).join('');
  }

  /* ── Démarrer ───────────────────────────────────────────────── */
  function start() {
    const name = dom.nameInput.value.trim();
    if (!name) {
      dom.nameInput.focus();
      dom.nameInput.classList.add('input-error');
      setTimeout(() => dom.nameInput.classList.remove('input-error'), 800);
      return;
    }
    if (_running && !_paused) return;

    if (!_currentId) {
      _currentId   = App.uid();
      _accumulated = 0;
      const clientId  = dom.clientSelect?.value || null;
      const ks        = $id('taskKanbanSelect');
      const projectId = ks?.dataset.selectedProjectId || null;
      const tasks     = App.load(App.KEYS.TASKS, []);
      tasks.push({
        id: _currentId, name, clientId: clientId || null,
        startedAt: new Date().toISOString(), date: App.today(),
        totalDuration: 0, sessions: [],
        sourceType: projectId ? 'kanban' : 'free', projectId,
      });
      App.save(App.KEYS.TASKS, tasks);
    }

    _paused  = false;
    _running = true;
    _startTs = Date.now();
    _interval = setInterval(_tick, 1000);
    _tick();

    dom.startBtn.style.display  = 'none';
    dom.pauseBtn.style.display  = 'inline-flex';
    dom.resumeBtn.style.display = 'none';
    dom.stopBtn.style.display   = 'inline-flex';
    dom.nameInput.disabled      = false;
    dom.statusLabel.textContent = 'Timer en cours…';
  }

  /* ── Pause ──────────────────────────────────────────────────── */
  function pause() {
    if (!_running || _paused) return;
    clearInterval(_interval);
    _interval    = null;
    _accumulated += Math.floor((Date.now() - _startTs) / 1000);
    _paused      = true;
    _saveSession();
    dom.pauseBtn.style.display  = 'none';
    dom.resumeBtn.style.display = 'inline-flex';
    dom.statusLabel.textContent = '⏸ Timer en pause.';
  }

  /* ── Reprendre ──────────────────────────────────────────────── */
  function resume() {
    if (!_running || !_paused) return;
    _updateTaskName();
    start();
  }

  /* ── Terminer ───────────────────────────────────────────────── */
  function stop() {
    if (!_running) return;
    clearInterval(_interval);
    _interval = null;
    if (!_paused) _accumulated += Math.floor((Date.now() - _startTs) / 1000);
    _paused  = false;
    _running = false;
    _updateTaskName();
    _saveSession();
    _currentId = null; _accumulated = 0; _startTs = null;

    dom.display.textContent     = '00:00:00';
    dom.nameInput.value         = '';
    dom.nameInput.disabled      = false;
    const ks = $id('taskKanbanSelect');
    if (ks) { ks.value = ''; delete ks.dataset.selectedProjectId; }
    dom.startBtn.style.display  = 'inline-flex';
    dom.pauseBtn.style.display  = 'none';
    dom.resumeBtn.style.display = 'none';
    dom.stopBtn.style.display   = 'none';
    dom.statusLabel.textContent = '';

    renderTable();
    Dashboard.refresh();
  }

  function _updateTaskName() {
    if (!_currentId) return;
    const n = dom.nameInput.value.trim();
    if (!n) return;
    const tasks = App.load(App.KEYS.TASKS, []);
    const t = tasks.find(t => t.id === _currentId);
    if (t) { t.name = n; App.save(App.KEYS.TASKS, tasks); }
  }

  function _saveSession() {
    if (!_currentId) return;
    const tasks = App.load(App.KEYS.TASKS, []);
    const t = tasks.find(t => t.id === _currentId);
    if (t) { t.totalDuration = _accumulated; App.save(App.KEYS.TASKS, tasks); }
  }

  /* ── Badge client ───────────────────────────────────────────── */
  function _clientBadge(clientId) {
    if (!clientId) return '';
    const c = App.getClient(clientId);
    if (!c) return '';
    return `<span style="display:inline-flex;align-items:center;font-size:.68rem;font-weight:500;
            color:${c.color};background:${c.color}22;border-radius:4px;
            padding:1px 6px;margin-left:6px;vertical-align:middle">${escHtml(c.name)}</span>`;
  }

  /* ── Tableau des tâches ─────────────────────────────────────── */
  function renderTable() {
    populateClientSelect();
    populateKanbanSelect();

    const tbody  = dom.tableBody;
    const totBar = dom.totalBar;
    const totVal = dom.totalVal;
    if (!tbody) return;

    const today = App.today();
    const tasks = App.load(App.KEYS.TASKS, []).filter(t => t.date === today);

    if (tasks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Aucune tâche pour aujourd\'hui.</td></tr>';
      if (totBar) totBar.style.display = 'none';
      const ab = $id('autreTotalBar'); if (ab) ab.style.display = 'none';
      renderCalendar();
      return;
    }

    tbody.innerHTML = tasks.map(t => {
      const started = new Date(t.startedAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
      const dur     = App.fmtDur(t.totalDuration || 0);
      const isAct   = t.id === _currentId;
      return `<tr${isAct ? ' class="active-row"' : ''}>
        <td style="font-weight:600">
          ${escHtml(t.name)}${_clientBadge(t.clientId)}
          ${isAct ? ' <span style="font-size:.7rem;color:var(--primary);font-weight:500">● En cours</span>' : ''}
        </td>
        <td style="color:var(--text-3)">${started}</td>
        <td style="font-variant-numeric:tabular-nums">${isAct ? `<span id="live-dur-${t.id}">${dur}</span>` : dur}</td>
        <td>
          <div class="task-actions">
            <button class="btn btn-icon" title="Modifier" onclick="TimeTracker.openEdit('${t.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-icon" title="Supprimer" onclick="TimeTracker.deleteTask('${t.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');

    const totalP = tasks.filter(t => t.clientId !== App.AUTRE_CLIENT_ID).reduce((s,t) => s+(t.totalDuration||0), 0);
    const totalA = tasks.filter(t => t.clientId === App.AUTRE_CLIENT_ID).reduce((s,t) => s+(t.totalDuration||0), 0);
    if (totBar) totBar.style.display = 'flex';
    if (totVal) totVal.textContent   = App.fmtDur(totalP);
    const ab = $id('autreTotalBar'); const av = $id('autreTotalValue');
    if (ab) { ab.style.display = totalA > 0 ? 'flex' : 'none'; if (av) av.textContent = App.fmtDur(totalA); }

    renderCalendar();
  }

  /* ================================================================
     CALENDRIER — Jour / Semaine
     ================================================================ */

  function _navTitle() {
    if (_calView === 'day') {
      const d = _calDate;
      return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
    }
    const ws = _weekStart(_calDate);
    const we = new Date(ws); we.setDate(ws.getDate() + 6);
    const sameMonth = ws.getMonth() === we.getMonth();
    if (sameMonth) return `${ws.getDate()} – ${we.getDate()} ${MONTHS_FR[ws.getMonth()]} ${ws.getFullYear()}`;
    return `${ws.getDate()} ${MONTHS_FR[ws.getMonth()]} – ${we.getDate()} ${MONTHS_FR[we.getMonth()]} ${ws.getFullYear()}`;
  }

  function renderCalendar() {
    const calEl    = $id('tt-day-calendar');
    const headerEl = $id('tt-cal-colheader');
    const titleEl  = $id('tt-cal-title');
    if (!calEl || !headerEl || !titleEl) return;

    titleEl.textContent = _navTitle();
    $id('tt-view-day')?.classList.toggle('tt-active', _calView === 'day');
    $id('tt-view-week')?.classList.toggle('tt-active', _calView === 'week');

    const today = App.today();
    let days;

    if (_calView === 'day') {
      days = [_iso(_calDate)];
    } else {
      const ws = _weekStart(_calDate);
      days = Array.from({length:7}, (_,i) => {
        const d = new Date(ws); d.setDate(ws.getDate() + i); return _iso(d);
      });
    }

    _renderColHeader(headerEl, days, today);
    _renderGrid(calEl, days, today);
  }

  function _renderColHeader(el, days, today) {
    el.innerHTML =
      `<div class="tt-cal-colheader-spacer"></div>` +
      days.map(ds => {
        const d   = new Date(ds + 'T00:00:00');
        const isT = ds === today;
        return `<div class="tt-cal-colheader-day${isT ? ' tt-today' : ''}">
          <div class="tt-cal-colheader-day-name">${DAYS_SHORT[d.getDay()]}</div>
          <div class="tt-cal-colheader-day-num">${d.getDate()}</div>
        </div>`;
      }).join('');
  }

  function _renderGrid(el, days, today) {
    const totalPx   = (CAL_END - CAL_START) * PX_H;
    const allTasks  = App.load(App.KEYS.TASKS, []);

    /* ── Colonne heure (labels) ── */
    let timeCol = '';
    for (let h = CAL_START; h <= CAL_END; h++) {
      const top = (h - CAL_START) * PX_H;
      timeCol += `<div style="position:absolute;top:${top}px;right:0;transform:translateY(-50%);
                              padding-right:10px;font-size:.62rem;color:var(--text-3,#9ca3af);
                              text-align:right;white-space:nowrap;pointer-events:none">
                    ${String(h).padStart(2,'0')}h</div>`;
    }

    /* ── Lignes horizontales (grille) ── */
    let gridLines = '';
    for (let h = CAL_START; h <= CAL_END; h++) {
      const top = (h - CAL_START) * PX_H;
      gridLines += `<div style="position:absolute;left:0;right:0;top:${top}px;
                                height:1px;background:var(--border,#e5e7eb);pointer-events:none"></div>`;
      /* demi-heure en pointillé */
      if (h < CAL_END) {
        const mid = top + PX_H / 2;
        gridLines += `<div style="position:absolute;left:0;right:0;top:${mid}px;
                                  height:1px;background:var(--border,#e5e7eb);opacity:.5;
                                  pointer-events:none;border-top:1px dashed var(--border,#e5e7eb);background:none"></div>`;
      }
    }

    /* ── Ligne heure actuelle ── */
    let nowLine = '';
    const nowDate = new Date();
    const nowIso  = _iso(nowDate);
    if (days.includes(nowIso)) {
      const nowMin = (nowDate.getHours() - CAL_START) * 60 + nowDate.getMinutes();
      if (nowMin >= 0 && nowMin <= (CAL_END - CAL_START) * 60) {
        const nowPx  = nowMin * PX_M;
        /* en semaine : commence à la colonne d'aujourd'hui */
        const todayIdx  = days.indexOf(nowIso);
        const leftPct   = (todayIdx / days.length) * 100;
        nowLine = `<div class="tt-cal-nowline" style="top:${nowPx}px;left:${leftPct}%;right:0"></div>`;
      }
    }

    /* ── Colonnes de jours ── */
    const dayCols = days.map(ds => {
      const isToday  = ds === today;
      const dayTasks = allTasks.filter(t => t.date === ds);

      /* Créneaux vides cliquables (1 par heure) */
      let slots = '';
      for (let h = CAL_START; h < CAL_END; h++) {
        const top = (h - CAL_START) * PX_H;
        slots += `<div class="tt-cal-slot" style="position:absolute;left:0;right:0;top:${top}px;height:${PX_H}px"
                       onclick="TimeTracker.openSlot(${h},'${ds}')"></div>`;
      }

      /* Blocs de tâches */
      const blocks = dayTasks.map(t => {
        const start    = new Date(t.startedAt);
        const sMin     = (start.getHours() - CAL_START) * 60 + start.getMinutes();
        const dMin     = Math.round((t.totalDuration || 0) / 60);
        const maxMin   = (CAL_END - CAL_START) * 60;
        if (sMin + Math.max(dMin,1) <= 0 || sMin >= maxMin) return '';
        const cs = Math.max(0, sMin);
        const ce = Math.min(maxMin, sMin + Math.max(dMin, 1));
        const top    = cs * PX_M;
        const height = Math.max((ce - cs) * PX_M, 24);
        const c      = t.clientId ? App.getClient(t.clientId) : null;
        const color  = c ? c.color : '#6B7280';
        const isAct  = t.id === _currentId;
        return `<div class="tt-cal-task${isAct ? ' tt-cal-task--active' : ''}"
                     style="position:absolute;top:${top}px;height:${height}px;left:2px;right:2px;
                            border-left:3px solid ${color};background:${color}18;
                            border-radius:0 4px 4px 0;padding:2px 7px;overflow:hidden;z-index:2;pointer-events:none">
          <div style="font-size:.72rem;font-weight:600;color:var(--text-1,#111827);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(t.name)}</div>
          ${c ? `<div style="font-size:.62rem;font-weight:500;color:${color}">${escHtml(c.name)}</div>` : ''}
          <div style="font-size:.62rem;color:var(--text-3,#9ca3af)">${App.fmtDur(t.totalDuration||0)}</div>
          ${isAct ? `<div style="font-size:.62rem;color:var(--primary,#3B82F6);font-weight:700">● En cours</div>` : ''}
        </div>`;
      }).join('');

      const todayBg = isToday ? 'background:rgba(59,130,246,.03)' : '';
      return `<div style="flex:1;position:relative;height:${totalPx}px;
                          border-left:1px solid var(--border,#e5e7eb);${todayBg}">
                ${slots}${blocks}
              </div>`;
    }).join('');

    el.innerHTML = `
      <div style="display:flex;height:${totalPx}px">
        <!-- Colonne heure -->
        <div style="width:52px;flex-shrink:0;position:relative;height:${totalPx}px">${timeCol}</div>
        <!-- Zone jours -->
        <div style="flex:1;position:relative;height:${totalPx}px">
          ${gridLines}
          ${nowLine}
          <div style="display:flex;height:100%">${dayCols}</div>
        </div>
      </div>`;
  }

  /* ── Navigation calendrier ──────────────────────────────────── */
  function _calNav(dir) {
    if (_calView === 'day') {
      _calDate = new Date(_calDate);
      _calDate.setDate(_calDate.getDate() + dir);
    } else {
      _calDate = new Date(_calDate);
      _calDate.setDate(_calDate.getDate() + dir * 7);
    }
    renderCalendar();
  }

  function _calToday() {
    _calDate = new Date();
    renderCalendar();
  }

  /* ── Ouvrir modale depuis un créneau ────────────────────────── */
  function openSlot(h, dateStr) {
    _openAddManual();
    const timeEl = $id('manualTaskStart');
    if (timeEl) timeEl.value = `${String(h).padStart(2,'0')}:00`;
    const dateEl = $id('manualTaskDate');
    if (dateEl && dateStr) dateEl.value = dateStr;
  }

  /* ── Chips prédéfinies dans la modale ───────────────────────── */
  function _populatePresetChips() {
    const el = $id('manualPresetChips');
    if (!el) return;
    el.innerHTML = App.STAGES.map(s =>
      `<button type="button" class="tt-preset-chip"
               style="border-color:${s.color};color:${s.color}"
               data-label="${escHtml(s.label)}">${escHtml(s.label)}</button>`
    ).join('');
    el.querySelectorAll('.tt-preset-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const nameEl = $id('manualTaskName');
        if (nameEl) nameEl.value = btn.dataset.label;
        el.querySelectorAll('.tt-preset-chip').forEach(b => {
          b.classList.remove('selected');
          b.style.background = 'transparent';
          b.style.color = b.style.borderColor;
        });
        btn.classList.add('selected');
        btn.style.background = btn.style.borderColor;
        btn.style.color = '#fff';
      });
    });
  }

  /* ── Édition tâche ──────────────────────────────────────────── */
  function openEdit(id) {
    const tasks = App.load(App.KEYS.TASKS, []);
    const task  = tasks.find(t => t.id === id);
    if (!task) return;
    $id('editTaskName').value = task.name;
    $id('editTaskId').value   = id;
    const sel = $id('editTaskClient');
    if (sel) {
      sel.innerHTML = '<option value="">— Aucun client —</option>' +
        App.CLIENTS.map(c =>
          `<option value="${c.id}"${c.id === task.clientId ? ' selected' : ''}>${escHtml(c.name)}</option>`
        ).join('') +
        `<option value="${App.AUTRE_CLIENT_ID}"${App.AUTRE_CLIENT_ID === task.clientId ? ' selected' : ''}>Autre</option>`;
    }
    App.openModal('modal-editTask');
  }

  function _confirmEdit() {
    const id      = $id('editTaskId').value;
    const newName = $id('editTaskName').value.trim();
    const sel     = $id('editTaskClient');
    const clientId = sel ? (sel.value || null) : undefined;
    if (!newName) return;
    const tasks = App.load(App.KEYS.TASKS, []);
    const task  = tasks.find(t => t.id === id);
    if (task) {
      task.name = newName;
      if (clientId !== undefined) task.clientId = clientId;
      App.save(App.KEYS.TASKS, tasks);
    }
    if (id === _currentId && dom.nameInput) dom.nameInput.value = newName;
    App.closeModal('modal-editTask');
    renderTable();
    Dashboard.refresh();
  }

  /* ── Suppression ────────────────────────────────────────────── */
  function deleteTask(id) {
    if (id === _currentId) { App.toast('Terminez la tâche en cours avant de la supprimer.', 'warning'); return; }
    App.confirm('Supprimer cette tâche ?', () => {
      let tasks = App.load(App.KEYS.TASKS, []);
      tasks = tasks.filter(t => t.id !== id);
      App.save(App.KEYS.TASKS, tasks);
      renderTable();
      Dashboard.refresh();
    });
  }

  /* ── Ajout manuel ───────────────────────────────────────────── */
  function _openAddManual() {
    const sel = $id('manualTaskClient');
    if (sel) {
      sel.innerHTML = '<option value="">— Aucun client —</option>' +
        App.CLIENTS.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('') +
        `<option value="${App.AUTRE_CLIENT_ID}">Autre</option>`;
    }
    const today = App.today();
    const dateEl = $id('manualTaskDate'); if (dateEl) dateEl.value = today;
    const now    = new Date();
    const timeEl = $id('manualTaskStart');
    if (timeEl) timeEl.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const nameEl = $id('manualTaskName'); if (nameEl) nameEl.value = '';
    const hEl    = $id('manualTaskHours'); if (hEl) hEl.value = '0';
    const mEl    = $id('manualTaskMinutes'); if (mEl) mEl.value = '0';
    _populatePresetChips();
    App.openModal('modal-addManualTask');
  }

  function _confirmAddManual() {
    const nameEl = $id('manualTaskName');
    const name   = (nameEl?.value || '').trim();
    if (!name) {
      nameEl?.classList.add('input-error');
      setTimeout(() => nameEl?.classList.remove('input-error'), 800);
      return;
    }
    const clientId      = $id('manualTaskClient')?.value || null;
    const dateVal       = $id('manualTaskDate')?.value || App.today();
    const timeVal       = $id('manualTaskStart')?.value || '00:00';
    const hours         = Math.max(0, parseInt($id('manualTaskHours')?.value || '0', 10) || 0);
    const minutes       = Math.max(0, Math.min(59, parseInt($id('manualTaskMinutes')?.value || '0', 10) || 0));
    const totalDuration = hours * 3600 + minutes * 60;
    const startedAt     = new Date(`${dateVal}T${timeVal}:00`).toISOString();

    const tasks = App.load(App.KEYS.TASKS, []);
    tasks.push({ id: App.uid(), name, clientId: clientId || null, startedAt, date: dateVal,
                 totalDuration, sessions: [], sourceType: 'manual', projectId: null });
    App.save(App.KEYS.TASKS, tasks);
    App.closeModal('modal-addManualTask');
    renderTable();
    Dashboard.refresh();
    App.toast('Tâche ajoutée manuellement.', 'success');
  }

  /* ── Fin de journée ─────────────────────────────────────────── */
  function _openEndOfDay() {
    const today = App.today();
    const tasks = App.load(App.KEYS.TASKS, []).filter(t => t.date === today);
    if (tasks.length === 0) { alert('Aucune tâche enregistrée aujourd\'hui.'); return; }
    if (_running && !_paused) stop();
    const totalP = tasks.filter(t => t.clientId !== App.AUTRE_CLIENT_ID).reduce((s,t)=>s+(t.totalDuration||0),0);
    const totalA = tasks.filter(t => t.clientId === App.AUTRE_CLIENT_ID).reduce((s,t)=>s+(t.totalDuration||0),0);
    const sumEl  = $id('eodSummary');
    if (sumEl) {
      const rows = tasks.map(t => {
        const c = t.clientId ? App.getClient(t.clientId) : null;
        const badge = c ? `<span style="font-size:.68rem;color:${c.color};font-weight:500;margin-left:4px">${escHtml(c.name)}</span>` : '';
        return `<div class="eod-row"><span>${escHtml(t.name)}${badge}</span><strong>${App.fmtDur(t.totalDuration||0)}</strong></div>`;
      }).join('');
      sumEl.innerHTML = rows +
        (totalA>0 ? `<div class="eod-total" style="opacity:.7"><span>↳ Autre</span><span>${App.fmtDur(totalA)}</span></div>` : '') +
        `<div class="eod-total"><span>Total réel</span><span>${App.fmtDur(totalP)}</span></div>`;
    }
    App.openModal('modal-endOfDay');
  }

  function _confirmEndOfDay() {
    const today  = App.today();
    const tasks  = App.load(App.KEYS.TASKS, []).filter(t => t.date === today);
    const totalP = tasks.filter(t => t.clientId !== App.AUTRE_CLIENT_ID).reduce((s,t)=>s+(t.totalDuration||0),0);
    const totalA = tasks.filter(t => t.clientId === App.AUTRE_CLIENT_ID).reduce((s,t)=>s+(t.totalDuration||0),0);
    const dateFmt = App.fmtDateLong(new Date());

    const taskRows = tasks.map(t => {
      const c = t.clientId ? App.getClient(t.clientId) : null;
      return `| ${t.name} | ${c ? c.name : '—'} | ${App.fmtDur(t.totalDuration||0)} |`;
    }).join('\n');

    const byClient = {};
    tasks.forEach(t => {
      if (t.clientId === App.AUTRE_CLIENT_ID) return;
      const k = t.clientId || '__none__';
      byClient[k] = (byClient[k]||0) + (t.totalDuration||0);
    });
    const clientRows = Object.entries(byClient).map(([cid,secs]) => {
      const name = cid === '__none__' ? 'Sans client' : (App.getClient(cid)?.name || cid);
      return `| ${name} | ${App.fmtDur(secs)} |`;
    }).join('\n');

    const md = `# Récapitulatif de journée — The House\n\n**Date :** ${dateFmt}\n\n---\n\n## Tâches du jour\n\n| Tâche | Client | Durée |\n|-------|--------|-------|\n${taskRows}\n\n---\n\n**Total réel :** ${App.fmtDur(totalP)}${totalA>0?`\n**Autre :** ${App.fmtDur(totalA)}`:''}\n\n## Répartition par client\n\n| Client | Durée |\n|--------|-------|\n${clientRows}\n`;

    const blob = new Blob([md], {type:'text/markdown;charset=utf-8'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `the-house_${today}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);

    let all = App.load(App.KEYS.TASKS, []);
    all = all.filter(t => t.date !== today);
    App.save(App.KEYS.TASKS, all);
    App.closeModal('modal-endOfDay');
    renderTable();
    Dashboard.refresh();
  }

  /* ── Wiring ─────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    $id('timerStartBtn') ?.addEventListener('click', start);
    $id('timerPauseBtn') ?.addEventListener('click', pause);
    $id('timerResumeBtn')?.addEventListener('click', resume);
    $id('timerStopBtn')  ?.addEventListener('click', stop);
    $id('endOfDayBtn')              ?.addEventListener('click', _openEndOfDay);
    $id('confirmEndOfDayBtn')       ?.addEventListener('click', _confirmEndOfDay);
    $id('confirmEditTaskBtn')       ?.addEventListener('click', _confirmEdit);
    $id('addManualTaskBtn')         ?.addEventListener('click', _openAddManual);
    $id('confirmAddManualTaskBtn')  ?.addEventListener('click', _confirmAddManual);

    /* Navigation calendrier */
    $id('tt-cal-prev')  ?.addEventListener('click', () => _calNav(-1));
    $id('tt-cal-next')  ?.addEventListener('click', () => _calNav(1));
    $id('tt-cal-today') ?.addEventListener('click', _calToday);
    $id('tt-view-day')  ?.addEventListener('click', () => { _calView = 'day';  renderCalendar(); });
    $id('tt-view-week') ?.addEventListener('click', () => { _calView = 'week'; renderCalendar(); });

    $id('taskNameInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });

    const ks = $id('taskKanbanSelect');
    ks?.addEventListener('change', () => {
      const opt = ks.selectedOptions[0];
      if (!opt?.value) return;
      dom.nameInput.value = opt.value;
      if (opt.dataset.clientId && dom.clientSelect) dom.clientSelect.value = opt.dataset.clientId;
      ks.dataset.selectedProjectId = opt.dataset.projectId || '';
    });
    dom.nameInput?.addEventListener('input', () => {
      if (ks?.value) { ks.value = ''; delete ks.dataset.selectedProjectId; }
    });

    populateKanbanSelect();
    renderCalendar();
  });

  /* ── API publique ───────────────────────────────────────────── */
  return { renderTable, renderCalendar, openEdit, deleteTask, openSlot, populateClientSelect, populateKanbanSelect };

})();
