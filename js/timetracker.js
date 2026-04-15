/* ================================================================
   THE HOUSE — timetracker.js
   Timer, gestion des tâches (avec client), export Fin de journée
   ================================================================ */

'use strict';

window.TimeTracker = (() => {

  /* ── État du timer ──────────────────────────────────────────── */
  let _interval    = null;
  let _running     = false;
  let _paused      = false;
  let _startTs     = null;
  let _accumulated = 0;
  let _currentId   = null;

  /* ── Éléments DOM ───────────────────────────────────────────── */
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

  /* ── Calcul du temps écoulé ─────────────────────────────────── */
  function elapsed() {
    if (!_running || _paused) return _accumulated;
    return _accumulated + Math.floor((Date.now() - _startTs) / 1000);
  }

  /* ── Mise à jour de l'affichage du clock ────────────────────── */
  function _tick() {
    dom.display.textContent = App.fmtClock(elapsed());
  }

  /* ── Peupler le select client ───────────────────────────────── */
  function populateClientSelect() {
    const sel = dom.clientSelect;
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Aucun client —</option>' +
      App.CLIENTS.map(c =>
        `<option value="${c.id}"${c.id === current ? ' selected' : ''}>${escHtml(c.name)}</option>`
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

      const clientId = dom.clientSelect?.value || null;
      const tasks    = App.load(App.KEYS.TASKS, []);
      tasks.push({
        id:            _currentId,
        name:          name,
        clientId:      clientId || null,
        startedAt:     new Date().toISOString(),
        date:          App.today(),
        totalDuration: 0,
        sessions:      [],
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
    dom.statusLabel.textContent = '⏱ Timer en cours…';
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

    if (!_paused) {
      _accumulated += Math.floor((Date.now() - _startTs) / 1000);
    }
    _paused  = false;
    _running = false;

    _updateTaskName();
    _saveSession();

    _currentId   = null;
    _accumulated = 0;
    _startTs     = null;

    dom.display.textContent     = '00:00:00';
    dom.nameInput.value         = '';
    dom.nameInput.disabled      = false;
    dom.startBtn.style.display  = 'inline-flex';
    dom.pauseBtn.style.display  = 'none';
    dom.resumeBtn.style.display = 'none';
    dom.stopBtn.style.display   = 'none';
    dom.statusLabel.textContent = '';

    renderTable();
    Dashboard.refresh();
  }

  /* ── Mise à jour du nom de tâche ────────────────────────────── */
  function _updateTaskName() {
    if (!_currentId) return;
    const newName = dom.nameInput.value.trim();
    if (!newName) return;
    const tasks = App.load(App.KEYS.TASKS, []);
    const task  = tasks.find(t => t.id === _currentId);
    if (task) { task.name = newName; App.save(App.KEYS.TASKS, tasks); }
  }

  /* ── Sauvegarde session (durée) ─────────────────────────────── */
  function _saveSession() {
    if (!_currentId) return;
    const tasks = App.load(App.KEYS.TASKS, []);
    const task  = tasks.find(t => t.id === _currentId);
    if (task) { task.totalDuration = _accumulated; App.save(App.KEYS.TASKS, tasks); }
  }

  /* ── Badge client (inline) ──────────────────────────────────── */
  function _clientBadge(clientId) {
    if (!clientId) return '';
    const c = App.getClient(clientId);
    if (!c) return '';
    return `<span style="display:inline-flex;align-items:center;font-size:.68rem;font-weight:500;
            color:${c.color};background:${c.color}22;border-radius:4px;
            padding:1px 6px;margin-left:6px;vertical-align:middle">${escHtml(c.name)}</span>`;
  }

  /* ── Rendu du tableau des tâches ────────────────────────────── */
  function renderTable() {
    populateClientSelect();

    const tbody  = dom.tableBody;
    const totBar = dom.totalBar;
    const totVal = dom.totalVal;
    if (!tbody) return;

    const today = App.today();
    const tasks = App.load(App.KEYS.TASKS, []).filter(t => t.date === today);

    if (tasks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Aucune tâche pour aujourd\'hui.</td></tr>';
      if (totBar) totBar.style.display = 'none';
      return;
    }

    tbody.innerHTML = tasks.map(t => {
      const started  = new Date(t.startedAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
      const dur      = App.fmtDur(t.totalDuration || 0);
      const isActive = t.id === _currentId;
      return `
        <tr${isActive ? ' class="active-row"' : ''}>
          <td style="font-weight:600">
            ${escHtml(t.name)}${_clientBadge(t.clientId)}
            ${isActive ? ' <span style="font-size:.7rem;color:var(--primary);font-weight:500">● En cours</span>' : ''}
          </td>
          <td style="color:var(--text-3)">${started}</td>
          <td style="font-variant-numeric:tabular-nums">${isActive ? `<span id="live-dur-${t.id}">${dur}</span>` : dur}</td>
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

    const total = tasks.reduce((s, t) => s + (t.totalDuration || 0), 0);
    if (totBar) totBar.style.display = 'flex';
    if (totVal) totVal.textContent   = App.fmtDur(total);
  }

  /* ── Édition d'une tâche ────────────────────────────────────── */
  function openEdit(id) {
    const tasks = App.load(App.KEYS.TASKS, []);
    const task  = tasks.find(t => t.id === id);
    if (!task) return;

    document.getElementById('editTaskName').value = task.name;
    document.getElementById('editTaskId').value   = id;

    /* Peupler et pré-sélectionner le client */
    const sel = document.getElementById('editTaskClient');
    if (sel) {
      sel.innerHTML = '<option value="">— Aucun client —</option>' +
        App.CLIENTS.map(c =>
          `<option value="${c.id}"${c.id === task.clientId ? ' selected' : ''}>${escHtml(c.name)}</option>`
        ).join('');
    }

    App.openModal('modal-editTask');
  }

  function _confirmEdit() {
    const id        = document.getElementById('editTaskId').value;
    const newName   = document.getElementById('editTaskName').value.trim();
    const clientSel = document.getElementById('editTaskClient');
    const clientId  = clientSel ? (clientSel.value || null) : undefined;
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
    if (id === _currentId) {
      App.toast('Terminez la tâche en cours avant de la supprimer.', 'warning');
      return;
    }
    App.confirm('Supprimer cette tâche ?', () => {
      let tasks = App.load(App.KEYS.TASKS, []);
      tasks = tasks.filter(t => t.id !== id);
      App.save(App.KEYS.TASKS, tasks);
      renderTable();
      Dashboard.refresh();
    });
  }

  /* ── Fin de journée ─────────────────────────────────────────── */
  function _openEndOfDay() {
    const today = App.today();
    const tasks = App.load(App.KEYS.TASKS, []).filter(t => t.date === today);

    if (tasks.length === 0) { alert('Aucune tâche enregistrée aujourd\'hui.'); return; }
    if (_running && !_paused) stop();

    const total    = tasks.reduce((s, t) => s + (t.totalDuration || 0), 0);
    const summaryEl = document.getElementById('eodSummary');
    if (summaryEl) {
      const rows = tasks.map(t => {
        const c = t.clientId ? App.getClient(t.clientId) : null;
        const badge = c ? `<span style="font-size:.68rem;color:${c.color};font-weight:500;margin-left:4px">${escHtml(c.name)}</span>` : '';
        return `<div class="eod-row"><span>${escHtml(t.name)}${badge}</span><strong>${App.fmtDur(t.totalDuration || 0)}</strong></div>`;
      }).join('');
      summaryEl.innerHTML = rows + `<div class="eod-total"><span>Total</span><span>${App.fmtDur(total)}</span></div>`;
    }
    App.openModal('modal-endOfDay');
  }

  function _confirmEndOfDay() {
    const today   = App.today();
    const tasks   = App.load(App.KEYS.TASKS, []).filter(t => t.date === today);
    const total   = tasks.reduce((s, t) => s + (t.totalDuration || 0), 0);
    const dateFmt = App.fmtDateLong(new Date());

    /* Lignes tâches */
    const taskRows = tasks.map(t => {
      const c = t.clientId ? App.getClient(t.clientId) : null;
      return `| ${t.name} | ${c ? c.name : '—'} | ${App.fmtDur(t.totalDuration || 0)} |`;
    }).join('\n');

    /* Répartition par client */
    const byClient = {};
    tasks.forEach(t => {
      const key = t.clientId || '__none__';
      byClient[key] = (byClient[key] || 0) + (t.totalDuration || 0);
    });
    const clientRows = Object.entries(byClient).map(([cid, secs]) => {
      const name = cid === '__none__' ? 'Sans client' : (App.getClient(cid)?.name || cid);
      return `| ${name} | ${App.fmtDur(secs)} |`;
    }).join('\n');

    const md = `# Récapitulatif de journée — The House

**Date :** ${dateFmt}

---

## ⏱ Tâches du jour

| Tâche | Client | Durée |
|-------|--------|-------|
${taskRows}

---

**Total :** ${App.fmtDur(total)}

## Répartition par client

| Client | Durée |
|--------|-------|
${clientRows}
`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `the-house_${today}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    let allTasks = App.load(App.KEYS.TASKS, []);
    allTasks = allTasks.filter(t => t.date !== today);
    App.save(App.KEYS.TASKS, allTasks);

    App.closeModal('modal-endOfDay');
    renderTable();
    Dashboard.refresh();
  }

  /* ── Wiring des boutons ─────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('timerStartBtn') ?.addEventListener('click', start);
    document.getElementById('timerPauseBtn') ?.addEventListener('click', pause);
    document.getElementById('timerResumeBtn')?.addEventListener('click', resume);
    document.getElementById('timerStopBtn')  ?.addEventListener('click', stop);
    document.getElementById('endOfDayBtn')   ?.addEventListener('click', _openEndOfDay);
    document.getElementById('confirmEndOfDayBtn')?.addEventListener('click', _confirmEndOfDay);
    document.getElementById('confirmEditTaskBtn') ?.addEventListener('click', _confirmEdit);

    document.getElementById('taskNameInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') start();
    });
  });

  /* ── API publique ───────────────────────────────────────────── */
  return { renderTable, openEdit, deleteTask, populateClientSelect };

})();
