/* ================================================================
   THE HOUSE — timetracker.js
   Timer, gestion des tâches, export Fin de journée
   ================================================================ */

'use strict';

window.TimeTracker = (() => {

  /* ── État du timer ──────────────────────────────────────────── */
  let _interval    = null;
  let _running     = false;   // true = en cours de décompte
  let _paused      = false;   // true = mis en pause
  let _startTs     = null;    // timestamp de (re)démarrage
  let _accumulated = 0;       // secondes accumulées des sessions précédentes
  let _currentId   = null;    // ID de la tâche en cours

  /* ── Éléments DOM ───────────────────────────────────────────── */
  function $id(id) { return document.getElementById(id); }

  const dom = {
    get nameInput()   { return $id('taskNameInput'); },
    get display()     { return $id('timerDisplay'); },
    get startBtn()    { return $id('timerStartBtn'); },
    get pauseBtn()    { return $id('timerPauseBtn'); },
    get resumeBtn()   { return $id('timerResumeBtn'); },
    get stopBtn()     { return $id('timerStopBtn'); },
    get statusLabel() { return $id('timerStatusLabel'); },
    get tableBody()   { return $id('tasksTableBody'); },
    get totalBar()    { return $id('dailyTotalBar'); },
    get totalVal()    { return $id('dailyTotalValue'); },
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

  /* ── Démarrer ───────────────────────────────────────────────── */
  function start() {
    const name = dom.nameInput.value.trim();
    if (!name) {
      dom.nameInput.focus();
      dom.nameInput.classList.add('input-error');
      setTimeout(() => dom.nameInput.classList.remove('input-error'), 800);
      return;
    }

    if (_running && !_paused) return; /* déjà en cours */

    if (!_currentId) {
      /* Nouvelle tâche */
      _currentId = App.uid();
      _accumulated = 0;

      const tasks = App.load(App.KEYS.TASKS, []);
      tasks.push({
        id:            _currentId,
        name:          name,
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

    /* UI */
    dom.startBtn.style.display  = 'none';
    dom.pauseBtn.style.display  = 'inline-flex';
    dom.resumeBtn.style.display = 'none';
    dom.stopBtn.style.display   = 'inline-flex';
    dom.nameInput.disabled = false; /* on peut encore modifier le nom */
    dom.statusLabel.textContent = '⏱ Timer en cours…';
  }

  /* ── Pause ──────────────────────────────────────────────────── */
  function pause() {
    if (!_running || _paused) return;
    clearInterval(_interval);
    _interval = null;
    _accumulated += Math.floor((Date.now() - _startTs) / 1000);
    _paused = true;

    /* Sauvegarde la session en cours */
    _saveSession();

    dom.pauseBtn.style.display  = 'none';
    dom.resumeBtn.style.display = 'inline-flex';
    dom.statusLabel.textContent = '⏸ Timer en pause.';
  }

  /* ── Reprendre ──────────────────────────────────────────────── */
  function resume() {
    if (!_running || !_paused) return;
    /* Met à jour le nom si modifié */
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

    /* Sauvegarde finale */
    _updateTaskName();
    _saveSession();

    /* Reset UI */
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
    if (task) {
      task.name = newName;
      App.save(App.KEYS.TASKS, tasks);
    }
  }

  /* ── Sauvegarde session (durée) ─────────────────────────────── */
  function _saveSession() {
    if (!_currentId) return;
    const tasks = App.load(App.KEYS.TASKS, []);
    const task  = tasks.find(t => t.id === _currentId);
    if (task) {
      task.totalDuration = _accumulated;
      App.save(App.KEYS.TASKS, tasks);
    }
  }

  /* ── Rendu du tableau des tâches ────────────────────────────── */
  function renderTable() {
    const tbody  = dom.tableBody;
    const totBar = dom.totalBar;
    const totVal = dom.totalVal;
    if (!tbody) return;

    const today  = App.today();
    const tasks  = App.load(App.KEYS.TASKS, []).filter(t => t.date === today);

    if (tasks.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Aucune tâche pour aujourd\'hui.</td></tr>';
      if (totBar) totBar.style.display = 'none';
      return;
    }

    tbody.innerHTML = tasks.map(t => {
      const started = new Date(t.startedAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
      const dur     = App.fmtDur(t.totalDuration || 0);
      const isActive = t.id === _currentId;
      return `
        <tr${isActive ? ' class="active-row"' : ''}>
          <td style="font-weight:600">${escHtml(t.name)}${isActive ? ' <span style="font-size:.7rem;color:var(--primary);font-weight:500">● En cours</span>' : ''}</td>
          <td style="color:var(--text-3)">${started}</td>
          <td style="font-variant-numeric:tabular-nums">${isActive ? `<span id="live-dur-${t.id}">${dur}</span>` : dur}</td>
          <td>
            <div class="task-actions">
              <button class="btn btn-icon" title="Modifier le nom" onclick="TimeTracker.openEdit('${t.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn-icon" title="Supprimer" onclick="TimeTracker.deleteTask('${t.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    /* Total */
    const total = tasks.reduce((s, t) => s + (t.totalDuration || 0), 0);
    if (totBar) totBar.style.display = 'flex';
    if (totVal) totVal.textContent = App.fmtDur(total);
  }

  /* ── Édition du nom d'une tâche ─────────────────────────────── */
  function openEdit(id) {
    const tasks = App.load(App.KEYS.TASKS, []);
    const task  = tasks.find(t => t.id === id);
    if (!task) return;
    document.getElementById('editTaskName').value = task.name;
    document.getElementById('editTaskId').value   = id;
    App.openModal('modal-editTask');
  }

  function _confirmEdit() {
    const id      = document.getElementById('editTaskId').value;
    const newName = document.getElementById('editTaskName').value.trim();
    if (!newName) return;

    const tasks = App.load(App.KEYS.TASKS, []);
    const task  = tasks.find(t => t.id === id);
    if (task) {
      task.name = newName;
      App.save(App.KEYS.TASKS, tasks);
    }
    /* Si c'est la tâche active, mise à jour de l'input */
    if (id === _currentId && dom.nameInput) {
      dom.nameInput.value = newName;
    }
    App.closeModal('modal-editTask');
    renderTable();
    Dashboard.refresh();
  }

  /* ── Suppression ────────────────────────────────────────────── */
  function deleteTask(id) {
    if (id === _currentId) {
      alert('Impossible de supprimer une tâche en cours. Terminez-la d\'abord.');
      return;
    }
    if (!confirm('Supprimer cette tâche ?')) return;
    let tasks = App.load(App.KEYS.TASKS, []);
    tasks = tasks.filter(t => t.id !== id);
    App.save(App.KEYS.TASKS, tasks);
    renderTable();
    Dashboard.refresh();
  }

  /* ── Fin de journée ─────────────────────────────────────────── */
  function _openEndOfDay() {
    const today = App.today();
    const tasks = App.load(App.KEYS.TASKS, []).filter(t => t.date === today);

    if (tasks.length === 0) {
      alert('Aucune tâche enregistrée aujourd\'hui.');
      return;
    }
    /* Si timer actif : avertir */
    if (_running && !_paused) {
      if (!confirm('Un timer est en cours. Le stopper avant de télécharger ?')) return;
      stop();
    }

    /* Aperçu dans la modale */
    const total = tasks.reduce((s, t) => s + (t.totalDuration || 0), 0);
    const summaryEl = document.getElementById('eodSummary');
    if (summaryEl) {
      const rows = tasks.map(t =>
        `<div class="eod-row"><span>${escHtml(t.name)}</span><strong>${App.fmtDur(t.totalDuration || 0)}</strong></div>`
      ).join('');
      summaryEl.innerHTML = rows + `<div class="eod-total"><span>Total</span><span>${App.fmtDur(total)}</span></div>`;
    }
    App.openModal('modal-endOfDay');
  }

  function _confirmEndOfDay() {
    const today  = App.today();
    const tasks  = App.load(App.KEYS.TASKS, []).filter(t => t.date === today);
    const total  = tasks.reduce((s, t) => s + (t.totalDuration || 0), 0);
    const dateFmt = App.fmtDateLong(new Date());

    /* ── Génération du fichier .md ── */
    const rows = tasks.map(t =>
      `| ${t.name} | ${App.fmtDur(t.totalDuration || 0)} |`
    ).join('\n');

    const md = `# Récapitulatif de journée — The House

**Date :** ${dateFmt}

---

## ⏱ Tâches du jour

| Tâche | Durée |
|-------|-------|
${rows}

---

**Total :** ${App.fmtDur(total)}
`;

    /* ── Téléchargement ── */
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `the-house_${today}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    /* ── Réinitialisation ── */
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

    /* Enter dans le champ de tâche = Démarrer */
    document.getElementById('taskNameInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') start();
    });
  });

  /* ── API publique ───────────────────────────────────────────── */
  return { renderTable, openEdit, deleteTask };

})();
