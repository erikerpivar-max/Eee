/* ================================================================
   THE HOUSE — clients.js
   Vue client : en-tête, pipeline Kanban, tabs Calendar/Gantt
   ================================================================ */

'use strict';

window.Clients = (() => {

  let _currentAddStage  = null; /* stage ciblé lors du clic "+ Ajouter" */
  let _currentClientAdd = null; /* clientId pour la modale ajout projet */

  /* ── Rendu complet de la vue d'un client ────────────────────── */
  function renderView(clientId) {
    const client = App.getClient(clientId);
    if (!client) return;

    const container = document.getElementById(`client-content-${clientId}`);
    if (!container) return;

    container.innerHTML = _buildView(client);

    /* Wiring des boutons de la vue */
    _wireView(clientId);

    /* Render Calendar et Gantt dans leurs panels */
    Calendar.render(clientId);
    Gantt.render(clientId);
  }

  /* ── Construction du HTML de la vue client ──────────────────── */
  function _buildView(client) {
    const stagesHTML = App.STAGES.map(stage => _buildColumn(client.id, stage)).join('');

    return `
      <!-- En-tête client -->
      <div class="client-view-header">
        <div class="client-view-id">
          <div class="client-view-avatar" style="--c:${client.color};--bg:${client.bg}">${client.initials}</div>
          <div>
            <div class="client-view-name">${escHtml(client.name)}</div>
            <div class="client-view-sub">Pipeline de production</div>
          </div>
        </div>
        <button class="btn btn-primary" id="addProjectBtn-${client.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nouveau projet
        </button>
      </div>

      <!-- Pipeline Kanban -->
      <div class="pipeline-board" id="pipeline-${client.id}">
        ${stagesHTML}
      </div>

      <!-- Tabs Calendar / Timeline -->
      <div class="client-tabs" id="tabs-${client.id}">
        <button class="tab-btn active" data-tab="calendar" data-client="${client.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Calendrier
        </button>
        <button class="tab-btn" data-tab="gantt" data-client="${client.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          Timeline
        </button>
      </div>

      <div class="tab-panel active" id="tab-calendar-${client.id}">
        <div id="calendar-${client.id}"></div>
      </div>
      <div class="tab-panel" id="tab-gantt-${client.id}">
        <div id="gantt-${client.id}"></div>
      </div>
    `;
  }

  /* ── Construction d'une colonne Kanban ──────────────────────── */
  function _buildColumn(clientId, stage) {
    const projects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
    const inStage  = projects.filter(p => p.stage === stage.id);

    const cards = inStage.map(p => _buildCard(clientId, p)).join('') ||
      `<p style="font-size:.78rem;color:var(--text-3);text-align:center;padding:12px 0;font-style:italic">Vide</p>`;

    return `
      <div class="pipeline-col" data-stage="${stage.id}" data-client="${clientId}">
        <div class="pipeline-col-head">
          <span class="stage-dot" style="background:${stage.color}"></span>
          <span class="stage-label-text" style="color:${stage.color}">${stage.label}</span>
          <span class="col-count">${inStage.length}</span>
        </div>
        <div class="pipeline-col-body" id="col-body-${clientId}-${stage.id}">
          ${cards}
        </div>
        <div class="pipeline-col-foot">
          <button class="add-project-btn" data-client="${clientId}" data-stage="${stage.id}">
            + Ajouter
          </button>
        </div>
      </div>`;
  }

  /* ── Construction d'une carte projet ────────────────────────── */
  function _buildCard(clientId, project) {
    const stageIdx = App.STAGES.findIndex(s => s.id === project.stage);
    const canLeft  = stageIdx > 0;
    const canRight = stageIdx < App.STAGES.length - 1;

    const prevStage = canLeft  ? App.STAGES[stageIdx - 1] : null;
    const nextStage = canRight ? App.STAGES[stageIdx + 1] : null;

    return `
      <div class="project-card" id="card-${project.id}">
        <div class="project-card-name">${escHtml(project.name)}</div>
        <div class="project-card-actions">
          ${prevStage ? `<button class="project-move-btn" title="← ${prevStage.label}" onclick="Clients.moveProject('${clientId}','${project.id}','${prevStage.id}')">← ${prevStage.label.slice(0,4)}.</button>` : ''}
          ${nextStage ? `<button class="project-move-btn" title="${nextStage.label} →" onclick="Clients.moveProject('${clientId}','${project.id}','${nextStage.id}')">${nextStage.label.slice(0,4)}. →</button>` : ''}
          <button class="btn btn-icon gantt-task-del" style="margin-left:auto" title="Supprimer" onclick="Clients.deleteProject('${clientId}','${project.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>`;
  }

  /* ── Wiring des événements de la vue ────────────────────────── */
  function _wireView(clientId) {
    /* Bouton "Nouveau projet" global */
    const addBtn = document.getElementById(`addProjectBtn-${clientId}`);
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        _openAddProject(clientId, null);
      });
    }

    /* Boutons "+ Ajouter" dans les colonnes */
    const colFootBtns = document.querySelectorAll(`.add-project-btn[data-client="${clientId}"]`);
    colFootBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        _openAddProject(clientId, btn.dataset.stage);
      });
    });

    /* Tabs */
    const tabs = document.querySelectorAll(`#tabs-${clientId} .tab-btn`);
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const cid  = tab.dataset.client;
        const tabId = tab.dataset.tab;
        /* Désactive tous */
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll(`#tab-calendar-${cid}, #tab-gantt-${cid}`)
                .forEach(p => p.classList.remove('active'));
        /* Active */
        tab.classList.add('active');
        document.getElementById(`tab-${tabId}-${cid}`)?.classList.add('active');
        /* Re-render si nécessaire */
        if (tabId === 'gantt') Gantt.render(cid);
        if (tabId === 'calendar') Calendar.render(cid);
      });
    });
  }

  /* ── Ouvrir la modale "Ajouter un projet" ───────────────────── */
  function _openAddProject(clientId, stageId) {
    _currentClientAdd = clientId;
    _currentAddStage  = stageId;
    document.getElementById('newProjectName').value = '';
    if (stageId) {
      document.getElementById('newProjectStage').value = stageId;
    }
    App.openModal('modal-addProject');
  }

  /* ── Confirmer l'ajout d'un projet ─────────────────────────── */
  function _confirmAddProject() {
    const name  = document.getElementById('newProjectName').value.trim();
    const stage = document.getElementById('newProjectStage').value;
    if (!name) { document.getElementById('newProjectName').focus(); return; }

    const clientId = _currentClientAdd;
    const projects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
    projects.push({ id: App.uid(), name, stage, createdAt: App.today() });
    App.save(`${App.KEYS.PROJECTS}_${clientId}`, projects);

    App.closeModal('modal-addProject');
    _refreshPipeline(clientId);
    Dashboard.refresh();
  }

  /* ── Déplacer un projet dans le pipeline ────────────────────── */
  function moveProject(clientId, projectId, newStage) {
    const projects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
    const project  = projects.find(p => p.id === projectId);
    if (project) {
      project.stage = newStage;
      App.save(`${App.KEYS.PROJECTS}_${clientId}`, projects);
      _refreshPipeline(clientId);
      Dashboard.refresh();
    }
  }

  /* ── Supprimer un projet ────────────────────────────────────── */
  function deleteProject(clientId, projectId) {
    if (!confirm('Supprimer ce projet ?')) return;
    let projects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
    projects = projects.filter(p => p.id !== projectId);
    App.save(`${App.KEYS.PROJECTS}_${clientId}`, projects);
    _refreshPipeline(clientId);
    Dashboard.refresh();
  }

  /* ── Rafraîchit uniquement le pipeline (sans rechargement complet) */
  function _refreshPipeline(clientId) {
    const board = document.getElementById(`pipeline-${clientId}`);
    if (!board) return;
    const client = App.getClient(clientId);
    board.innerHTML = App.STAGES.map(stage => _buildColumn(clientId, stage)).join('');
    /* Re-wire les boutons "+ Ajouter" */
    const colFootBtns = document.querySelectorAll(`.add-project-btn[data-client="${clientId}"]`);
    colFootBtns.forEach(btn => {
      btn.addEventListener('click', () => _openAddProject(clientId, btn.dataset.stage));
    });
  }

  /* ── Wiring global (modale) ─────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('confirmAddProjectBtn')?.addEventListener('click', _confirmAddProject);
  });

  /* ── API publique ───────────────────────────────────────────── */
  return { renderView, moveProject, deleteProject };

})();
