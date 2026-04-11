/* ================================================================
   THE HOUSE — gantt.js
   Timeline / Diagramme de Gantt par client (vue mensuelle)
   ================================================================ */

'use strict';

window.Gantt = (() => {

  /* État par client (mois affiché) */
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
    const container = document.getElementById(`gantt-${clientId}`);
    if (!container) return;

    const state = _getState(clientId);
    const tasks = App.load(`${App.KEYS.GANTT}_${clientId}`, []);

    container.innerHTML = _buildGantt(clientId, state.year, state.month, tasks);
    _wireGantt(clientId);
  }

  /* ── Construction du Gantt ──────────────────────────────────── */
  function _buildGantt(clientId, year, month, tasks) {
    const monthLabel = new Date(year, month, 1).toLocaleDateString('fr-FR', {
      month: 'long', year: 'numeric'
    });

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const now         = new Date();
    const todayDay    = (now.getFullYear() === year && now.getMonth() === month)
                        ? now.getDate() : -1;

    /* En-têtes des jours */
    const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => {
      const d   = i + 1;
      const cls = d === todayDay ? 'gantt-day-head today' : 'gantt-day-head';
      return `<div class="${cls}">${d}</div>`;
    }).join('');

    /* Légende */
    const legend = App.STAGES.map(s =>
      `<div class="legend-item">
        <span class="legend-dot" style="background:${s.color}"></span>
        ${s.label}
      </div>`
    ).join('');

    /* Rangées de tâches */
    const taskRows = tasks.length === 0
      ? `<div class="gantt-empty">Aucune tâche dans la timeline. Cliquez sur "+ Tâche" pour en ajouter une.</div>`
      : tasks.map(task => _buildTaskRow(task, year, month, daysInMonth, todayDay)).join('');

    /* Colonnes de fond (grille) */
    const bgCols = Array.from({ length: daysInMonth }, (_, i) => {
      const d   = i + 1;
      const pct = ((i) / daysInMonth * 100).toFixed(3);
      const w   = (1 / daysInMonth * 100).toFixed(3);
      const cls = d === todayDay ? 'gantt-day-bg today-bg' : 'gantt-day-bg';
      return `<div class="${cls}" style="left:${pct}%;width:${w}%"></div>`;
    }).join('');

    return `
      <div class="gantt-wrapper">
        <!-- Contrôles -->
        <div class="gantt-controls">
          <button class="btn btn-primary btn-sm" id="gantt-add-${clientId}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tâche
          </button>
          <div class="gantt-nav">
            <button class="cal-nav-btn" id="gantt-prev-${clientId}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="gantt-period-label">${monthLabel}</span>
            <button class="cal-nav-btn" id="gantt-next-${clientId}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>

        <!-- Légende -->
        <div class="gantt-legend">${legend}</div>

        <!-- Tableau -->
        <div class="gantt-scroll">
          <div class="gantt-table">
            <!-- En-tête -->
            <div class="gantt-head-row">
              <div class="gantt-label-col">Tâche</div>
              <div class="gantt-timeline-head">${dayHeaders}</div>
            </div>
            <!-- Corps -->
            <div id="gantt-body-${clientId}">
              ${taskRows.replace(/BGCOLS/g, bgCols)}
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ── Construction d'une rangée de tâche ─────────────────────── */
  function _buildTaskRow(task, year, month, daysInMonth, todayDay) {
    const stage   = App.getStage(task.stage);

    /* Dates */
    const rowStart = new Date(year, month, 1);
    const rowEnd   = new Date(year, month + 1, 0);

    const taskStart = new Date(task.start + 'T12:00:00');
    const taskEnd   = new Date(task.end   + 'T12:00:00');

    /* Intersection avec le mois visible */
    const visStart = taskStart > rowStart ? taskStart : rowStart;
    const visEnd   = taskEnd   < rowEnd   ? taskEnd   : rowEnd;

    let barHTML = '';
    if (visStart <= visEnd) {
      const leftDay  = visStart.getDate() - 1; /* 0-indexed */
      const spanDays = Math.floor((visEnd - visStart) / 86400000) + 1;
      const leftPct  = (leftDay  / daysInMonth * 100).toFixed(3);
      const widthPct = (spanDays / daysInMonth * 100).toFixed(3);
      const label    = spanDays > 3 ? escHtml(task.name) : '';

      barHTML = `<div class="gantt-bar"
                      style="left:${leftPct}%;width:${widthPct}%;background:${stage.color};"
                      title="${escHtml(task.name)} — ${task.start} → ${task.end}">
                   ${label}
                 </div>`;
    }

    /* Colonnes de fond */
    const bgCols = Array.from({ length: daysInMonth }, (_, i) => {
      const d   = i + 1;
      const pct = (i / daysInMonth * 100).toFixed(3);
      const w   = (1 / daysInMonth * 100).toFixed(3);
      const cls = d === todayDay ? 'gantt-day-bg today-bg' : 'gantt-day-bg';
      return `<div class="${cls}" style="left:${pct}%;width:${w}%"></div>`;
    }).join('');

    return `
      <div class="gantt-task-row">
        <div class="gantt-task-label">
          <span class="legend-dot" style="background:${stage.color};flex-shrink:0"></span>
          <span style="overflow:hidden;text-overflow:ellipsis">${escHtml(task.name)}</span>
          <button class="gantt-task-del" onclick="Gantt.deleteTask('${task.clientId || ''}','${task.id}')" title="Supprimer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
        <div class="gantt-timeline-row">
          ${bgCols}
          ${barHTML}
        </div>
      </div>`;
  }

  /* ── Wiring ─────────────────────────────────────────────────── */
  function _wireGantt(clientId) {
    /* Navigation mois */
    document.getElementById(`gantt-prev-${clientId}`)?.addEventListener('click', () => {
      const s = _getState(clientId);
      s.month--;
      if (s.month < 0) { s.month = 11; s.year--; }
      render(clientId);
    });
    document.getElementById(`gantt-next-${clientId}`)?.addEventListener('click', () => {
      const s = _getState(clientId);
      s.month++;
      if (s.month > 11) { s.month = 0; s.year++; }
      render(clientId);
    });
    /* Bouton + Tâche */
    document.getElementById(`gantt-add-${clientId}`)?.addEventListener('click', () => {
      _openAddGantt(clientId);
    });
  }

  /* ── Ouvrir la modale "Ajouter une tâche" ───────────────────── */
  function _openAddGantt(clientId) {
    const state = _getState(clientId);
    const y = state.year;
    const m = String(state.month + 1).padStart(2, '0');
    const today = `${y}-${m}-${String(new Date().getDate()).padStart(2,'0')}`;

    document.getElementById('ganttClient').value = clientId;
    document.getElementById('ganttName').value   = '';
    document.getElementById('ganttStart').value  = today;
    document.getElementById('ganttEnd').value    = today;
    document.getElementById('ganttStage').value  = 'scripting';
    App.openModal('modal-addGantt');
  }

  /* ── Confirmer l'ajout ──────────────────────────────────────── */
  function _confirmAddGantt() {
    const clientId = document.getElementById('ganttClient').value;
    const name     = document.getElementById('ganttName').value.trim();
    const start    = document.getElementById('ganttStart').value;
    const end      = document.getElementById('ganttEnd').value;
    const stage    = document.getElementById('ganttStage').value;

    if (!name || !start || !end) {
      document.getElementById('ganttName').focus();
      return;
    }
    if (end < start) {
      alert('La date de fin doit être après la date de début.');
      return;
    }

    const tasks = App.load(`${App.KEYS.GANTT}_${clientId}`, []);
    tasks.push({ id: App.uid(), clientId, name, start, end, stage });
    App.save(`${App.KEYS.GANTT}_${clientId}`, tasks);

    App.closeModal('modal-addGantt');
    render(clientId);
  }

  /* ── Supprimer une tâche ─────────────────────────────────────── */
  function deleteTask(clientId, taskId) {
    /* clientId peut être vide si ancien format — on cherche dans tous */
    if (!clientId) {
      App.CLIENTS.forEach(c => {
        let tasks = App.load(`${App.KEYS.GANTT}_${c.id}`, []);
        if (tasks.some(t => t.id === taskId)) {
          clientId = c.id;
        }
      });
    }
    if (!clientId) return;
    if (!confirm('Supprimer cette tâche de la timeline ?')) return;
    let tasks = App.load(`${App.KEYS.GANTT}_${clientId}`, []);
    tasks = tasks.filter(t => t.id !== taskId);
    App.save(`${App.KEYS.GANTT}_${clientId}`, tasks);
    render(clientId);
  }

  /* ── Wiring global ──────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('confirmAddGanttBtn')?.addEventListener('click', _confirmAddGantt);
  });

  /* ── API publique ───────────────────────────────────────────── */
  return { render, deleteTask };

})();
