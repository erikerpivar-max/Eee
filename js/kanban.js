/* ================================================================
   THE HOUSE — kanban.js
   Kanban unifié tous clients — drag & drop HTML5
   ================================================================ */

'use strict';

window.Kanban = (() => {

  /* ── État ────────────────────────────────────────────────────── */
  let _dragProjectId = null;
  let _dragClientId  = null;
  let _currentAddStage = null;

  /* ── Rendu principal ────────────────────────────────────────── */
  function renderView() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = App.STAGES.map(stage => _buildColumn(stage)).join('');
    _wireBoard();
  }

  /* ── Construction d'une colonne ──────────────────────────────── */
  function _buildColumn(stage) {
    const cards = [];
    App.CLIENTS.forEach(client => {
      const projects = App.load(`${App.KEYS.PROJECTS}_${client.id}`, []);
      projects
        .filter(p => p.stage === stage.id)
        .forEach(p => cards.push({ project: p, client }));
    });

    const cardsHTML = cards.length
      ? cards.map(({ project, client }) => _buildCard(project, client)).join('')
      : `<p class="col-empty-hint">Vide</p>`;

    return `
      <div class="pipeline-col kanban-col"
           data-stage="${stage.id}"
           ondragover="event.preventDefault(); this.classList.add('drag-target')"
           ondragleave="this.classList.remove('drag-target')"
           ondrop="this.classList.remove('drag-target'); Kanban.drop('${stage.id}')">
        <div class="pipeline-col-head">
          <span class="stage-dot" style="background:${stage.color}"></span>
          <span class="stage-label-text" style="color:${stage.color}">${stage.label}</span>
          <span class="col-count">${cards.length}</span>
        </div>
        <div class="pipeline-col-body" id="col-body-${stage.id}">
          ${cardsHTML}
        </div>
        <div class="pipeline-col-foot">
          <button class="add-project-btn" data-stage="${stage.id}">+ Ajouter</button>
        </div>
      </div>`;
  }

  /* ── Construction d'une carte ────────────────────────────────── */
  function _buildCard(project, client) {
    const stageIdx = App.STAGES.findIndex(s => s.id === project.stage);
    const prevStage = stageIdx > 0 ? App.STAGES[stageIdx - 1] : null;
    const nextStage = stageIdx < App.STAGES.length - 1 ? App.STAGES[stageIdx + 1] : null;

    return `
      <div class="project-card kanban-card"
           id="card-${project.id}"
           draggable="true"
           ondragstart="Kanban.dragStart('${client.id}','${project.id}')"
           ondragend="Kanban.dragEnd()">
        <div class="kanban-client-bar" style="background:${client.color}"></div>
        <div class="kanban-card-body">
          <div class="kanban-client-label" style="color:${client.color}">${escHtml(client.name)}</div>
          <div class="project-card-name">${escHtml(project.name)}</div>
          <div class="project-card-actions">
            ${prevStage ? `<button class="project-move-btn" title="← ${prevStage.label}" onclick="Kanban.moveProject('${client.id}','${project.id}','${prevStage.id}')">← ${prevStage.label.slice(0,4)}.</button>` : ''}
            ${nextStage ? `<button class="project-move-btn" title="${nextStage.label} →" onclick="Kanban.moveProject('${client.id}','${project.id}','${nextStage.id}')">${nextStage.label.slice(0,4)}. →</button>` : ''}
            <button class="btn btn-icon" style="margin-left:auto" title="Supprimer" onclick="Kanban.deleteProject('${client.id}','${project.id}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  }

  /* ── Wiring ──────────────────────────────────────────────────── */
  function _wireBoard() {
    document.querySelectorAll('.add-project-btn[data-stage]').forEach(btn => {
      btn.addEventListener('click', () => _openAddProject(btn.dataset.stage));
    });
  }

  /* ── Modale ajout projet ─────────────────────────────────────── */
  function _openAddProject(stageId) {
    _currentAddStage = stageId;
    document.getElementById('newProjectName').value  = '';
    document.getElementById('newProjectStage').value = stageId;
    document.getElementById('newProjectClient').value = App.CLIENTS[0].id;
    App.openModal('modal-addProject');
    /* Focus après animation */
    setTimeout(() => document.getElementById('newProjectName').focus(), 120);
  }

  function _confirmAddProject() {
    const name     = document.getElementById('newProjectName').value.trim();
    const stage    = document.getElementById('newProjectStage').value;
    const clientId = document.getElementById('newProjectClient').value;
    if (!name) { document.getElementById('newProjectName').focus(); return; }

    const projects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
    projects.push({ id: App.uid(), name, stage, createdAt: App.today() });
    App.save(`${App.KEYS.PROJECTS}_${clientId}`, projects);

    App.closeModal('modal-addProject');
    renderView();
    Dashboard.refresh();
  }

  /* ── Déplacer un projet ──────────────────────────────────────── */
  function moveProject(clientId, projectId, newStage) {
    const projects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
    const project  = projects.find(p => p.id === projectId);
    if (!project) return;
    project.stage = newStage;
    App.save(`${App.KEYS.PROJECTS}_${clientId}`, projects);
    renderView();
    Dashboard.refresh();
  }

  /* ── Supprimer un projet ─────────────────────────────────────── */
  function deleteProject(clientId, projectId) {
    App.confirm('Supprimer ce projet ?', () => {
      let projects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
      projects = projects.filter(p => p.id !== projectId);
      App.save(`${App.KEYS.PROJECTS}_${clientId}`, projects);
      renderView();
      Dashboard.refresh();
    });
  }

  /* ── Drag & Drop ─────────────────────────────────────────────── */
  function dragStart(clientId, projectId) {
    _dragClientId  = clientId;
    _dragProjectId = projectId;
    /* Légère opacité sur la carte draguée */
    requestAnimationFrame(() => {
      document.getElementById(`card-${projectId}`)?.classList.add('dragging');
    });
  }

  function dragEnd() {
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.drag-target').forEach(el => el.classList.remove('drag-target'));
    _dragClientId  = null;
    _dragProjectId = null;
  }

  function drop(stageId) {
    if (!_dragProjectId || !_dragClientId) return;
    moveProject(_dragClientId, _dragProjectId, stageId);
  }

  /* ── Wiring global (modale) ─────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('confirmAddProjectBtn')
      ?.addEventListener('click', _confirmAddProject);

    /* Enter dans le champ nom */
    document.getElementById('newProjectName')
      ?.addEventListener('keydown', e => { if (e.key === 'Enter') _confirmAddProject(); });
  });

  /* ── API publique ───────────────────────────────────────────── */
  return { renderView, moveProject, deleteProject, dragStart, dragEnd, drop };

})();
