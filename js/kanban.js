/* ================================================================
   THE HOUSE — kanban.js
   Kanban unifié tous clients — drag & drop HTML5
   Checklist obligatoire avant passage d'étape
   ================================================================ */

'use strict';

window.Kanban = (() => {

  /* ── État ────────────────────────────────────────────────────── */
  let _dragProjectId = null;
  let _dragClientId  = null;
  let _currentAddStage = null;

  const CHECKLIST_KEY = 'th_kanban_checklists';

  /* ── Persistance checklists ─────────────────────────────────── */
  function _loadChecklists() {
    try {
      const v = localStorage.getItem(CHECKLIST_KEY);
      return v ? JSON.parse(v) : {};
    } catch { return {}; }
  }

  function _saveChecklists(data) {
    try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(data)); } catch(e) {}
  }

  function _getChecklist(stageId) {
    const all = _loadChecklists();
    return all[stageId] || [];
  }

  function _setChecklist(stageId, items) {
    const all = _loadChecklists();
    all[stageId] = items;
    _saveChecklists(all);
  }

  /* ── Rendu principal — groupes par couleur ─────────────────── */
  function renderView() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = App.STAGE_GROUPS.map(group => {
      const stages = App.STAGES.filter(s => s.group === group.id);
      return `
        <div class="stage-group">
          <div class="stage-group-header" style="--group-color:${group.color}">
            <span class="stage-group-dot"></span>
            <span class="stage-group-label">${group.label}</span>
            <span class="stage-group-count">${_countGroupProjects(stages)} projet(s)</span>
          </div>
          <div class="stage-group-cols">
            ${stages.map(stage => _buildColumn(stage)).join('')}
          </div>
        </div>`;
    }).join('');
    _wireBoard();
  }

  function _countGroupProjects(stages) {
    let total = 0;
    stages.forEach(stage => {
      App.CLIENTS.forEach(client => {
        const projects = App.load(`${App.KEYS.PROJECTS}_${client.id}`, []);
        total += projects.filter(p => p.stage === stage.id).length;
      });
    });
    return total;
  }

  /* ── Construction d'une colonne ──────────────────────────────── */
  function _buildColumn(stage) {
    const cards = [];
    const activeFilters = (window.Dezoom && Dezoom.getFilters) ? Dezoom.getFilters() : new Set();
    App.CLIENTS.forEach(client => {
      if (activeFilters.size > 0 && !activeFilters.has(client.id)) return;
      const projects = App.load(`${App.KEYS.PROJECTS}_${client.id}`, []);
      projects
        .filter(p => p.stage === stage.id)
        .forEach(p => cards.push({ project: p, client }));
    });

    const cardsHTML = cards.length
      ? cards.map(({ project, client }) => _buildCard(project, client)).join('')
      : `<p class="col-empty-hint">Vide</p>`;

    const checklist = _getChecklist(stage.id);

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
          <button class="kanban-gear-btn" data-stage="${stage.id}" title="Configurer la checklist (${checklist.length} tâche(s))">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
        <div class="pipeline-col-body" id="col-body-${stage.id}">
          ${cardsHTML}
        </div>
        <div class="pipeline-col-foot">
          <button class="add-project-btn" data-stage="${stage.id}">+ Ajouter</button>
        </div>
      </div>`;
  }

  const _PROCESS_STAGES = new Set([
    'rushs','brouillon','verif-draft','corrections',
    'attente-validation','montage-final','verif-final',
  ]);

  function _cardBg(project, client) {
    if (_PROCESS_STAGES.has(project.stage)) return 'rgba(249,115,22,0.07)';
    if (project.stage === 'stock') {
      try {
        const prog = JSON.parse(localStorage.getItem('th_dezoom_prog') || '{}');
        const done = prog[project.id] || [];
        const letter = (project.letter || '').trim().toUpperCase();
        const count  = parseInt(project.videoCount, 10) || 0;
        if (letter && count > 0) {
          const subs = Array.from({ length: count }, (_, i) => `${letter}${i + 1}`);
          const hasRemaining = subs.some(v => !done.includes(v));
          if (hasRemaining) return client.color + '18';
        }
      } catch(e) {}
    }
    return '';
  }

  /* ── Construction d'une carte ────────────────────────────────── */
  function _buildCard(project, client) {
    const stageIdx = App.STAGES.findIndex(s => s.id === project.stage);
    const prevStage = stageIdx > 0 ? App.STAGES[stageIdx - 1] : null;
    const nextStage = stageIdx < App.STAGES.length - 1 ? App.STAGES[stageIdx + 1] : null;

    const shootingBadge = project.shooting
      ? `<div class="kanban-shooting-badge" title="Tournage : ${escHtml(project.shooting)}">🎬 ${escHtml(project.shooting)}</div>`
      : '';

    const countBadge = (project.videoCount && project.videoCount > 0)
      ? `<span class="kanban-count-badge" title="${project.videoCount} vidéo(s) — lettre ${escHtml(project.letter || '?')}" style="display:inline-block;font-size:.72rem;font-weight:700;padding:2px 7px;border-radius:5px;border:1.5px solid ${client.color};color:${client.color};background:${client.color}15;margin-top:4px">${project.videoCount}V</span>`
      : '';

    const bg = _cardBg(project, client);

    return `
      <div class="project-card kanban-card"
           id="card-${project.id}"
           draggable="true"
           ondragstart="Kanban.dragStart('${client.id}','${project.id}')"
           ondragend="Kanban.dragEnd()"
           ${bg ? `style="background:${bg}"` : ''}>
        <div class="kanban-client-bar" style="background:${client.color}"></div>
        <div class="kanban-card-body">
          <div class="kanban-client-label" style="color:${client.color}">${escHtml(client.name)}</div>
          <div class="project-card-name">${escHtml(project.name)}</div>
          ${countBadge}
          ${shootingBadge}
          <div class="project-card-actions">
            ${prevStage ? `<button class="project-move-btn" title="← ${prevStage.label}" onclick="Kanban.moveProject('${client.id}','${project.id}','${prevStage.id}')">← ${prevStage.label.slice(0,4)}.</button>` : ''}
            ${nextStage ? `<button class="project-move-btn" title="${nextStage.label} →" onclick="Kanban.requestMove('${client.id}','${project.id}','${project.stage}','${nextStage.id}')">${nextStage.label.slice(0,4)}. →</button>` : ''}
            ${project.stage === 'publie' ? `<button class="project-move-btn" title="Reprogrammer" onclick="Kanban.reprogramProject('${client.id}','${project.id}')">📅 Reprog.</button>` : ''}
            <button class="btn btn-icon" style="margin-left:auto" title="Modifier" onclick="Kanban.editProject('${client.id}','${project.id}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-icon" title="Supprimer" onclick="Kanban.deleteProject('${client.id}','${project.id}')">
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
    document.querySelectorAll('.kanban-gear-btn[data-stage]').forEach(btn => {
      btn.addEventListener('click', () => _openChecklistConfig(btn.dataset.stage));
    });
  }

  /* ── Modale ajout projet ─────────────────────────────────────── */
  function _openAddProject(stageId) {
    _currentAddStage = stageId;
    document.getElementById('newProjectName').value     = '';
    const shootingEl = document.getElementById('newProjectShooting');
    if (shootingEl) shootingEl.value = '';
    document.getElementById('newProjectStage').value    = stageId;
    document.getElementById('newProjectClient').value   = App.CLIENTS[0].id;
    App.openModal('modal-addProject');
    setTimeout(() => document.getElementById('newProjectName').focus(), 120);
  }

  function _confirmAddProject() {
    const name     = document.getElementById('newProjectName').value.trim();
    const stage    = document.getElementById('newProjectStage').value;
    const clientId = document.getElementById('newProjectClient').value;
    const shooting = (document.getElementById('newProjectShooting')?.value || '').trim();
    const letter   = (document.getElementById('newProjectLetter')?.value || '').trim().toUpperCase();
    const countRaw = document.getElementById('newProjectCount')?.value;
    const count    = countRaw ? parseInt(countRaw, 10) : 0;
    if (!name) { document.getElementById('newProjectName').focus(); return; }

    const projects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
    const project  = { id: App.uid(), name, stage, createdAt: App.today() };
    if (shooting)               project.shooting   = shooting;
    if (letter)                 project.letter     = letter;
    if (count && count > 0)     project.videoCount = count;
    projects.push(project);
    App.save(`${App.KEYS.PROJECTS}_${clientId}`, projects);

    App.closeModal('modal-addProject');
    renderView();
    Dashboard.refresh();
  }

  /* ── Popup checklist avant passage d'étape ──────────────────── */
  function requestMove(clientId, projectId, currentStageId, newStageId) {
    const checklist = _getChecklist(currentStageId);

    if (checklist.length === 0) {
      /* Pas de checklist configurée → passage direct */
      moveProject(clientId, projectId, newStageId);
      return;
    }

    /* Construire le popup de validation */
    const currentStage = App.getStage(currentStageId);
    const nextStage    = App.getStage(newStageId);

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.display = 'flex';
    backdrop.innerHTML = `
      <div class="modal modal-sm">
        <div class="modal-head">
          <h3>Checklist — ${escHtml(currentStage.label)}</h3>
          <button class="modal-close-btn" id="_cl-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size:.88rem;color:var(--text-2);margin-bottom:14px">
            Avez-vous bien effectué toutes ces tâches avant de passer à <strong>${escHtml(nextStage.label)}</strong> ?
          </p>
          <div class="kanban-cl-items">
            ${checklist.map((item, i) => `
              <label class="kanban-cl-item">
                <input type="checkbox" class="kanban-cl-checkbox" data-idx="${i}" />
                <span>${escHtml(item)}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="_cl-cancel">Annuler</button>
          <button class="btn btn-primary" id="_cl-confirm" disabled>Confirmer le passage</button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('visible')));

    const close = () => {
      backdrop.classList.remove('visible');
      setTimeout(() => backdrop.remove(), 200);
    };

    backdrop.querySelector('#_cl-close').addEventListener('click', close);
    backdrop.querySelector('#_cl-cancel').addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

    const confirmBtn = backdrop.querySelector('#_cl-confirm');
    const checkboxes = backdrop.querySelectorAll('.kanban-cl-checkbox');

    function updateConfirmState() {
      const allChecked = [...checkboxes].every(cb => cb.checked);
      confirmBtn.disabled = !allChecked;
    }

    checkboxes.forEach(cb => cb.addEventListener('change', updateConfirmState));

    confirmBtn.addEventListener('click', () => {
      close();
      moveProject(clientId, projectId, newStageId);
    });
  }

  /* ── Configuration de la checklist (engrenage) ──────────────── */
  function _openChecklistConfig(stageId) {
    const stage     = App.getStage(stageId);
    const checklist = _getChecklist(stageId);

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.display = 'flex';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <h3>Checklist — ${escHtml(stage.label)}</h3>
          <button class="modal-close-btn" id="_clc-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size:.85rem;color:var(--text-2);margin-bottom:14px">
            Ces tâches seront vérifiées avant de pouvoir passer à l'étape suivante.
          </p>
          <div class="kanban-clc-list" id="_clc-list">
            ${checklist.map((item, i) => `
              <div class="kanban-clc-row" data-idx="${i}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" style="flex-shrink:0"><rect x="3" y="3" width="18" height="18" rx="4"/><polyline points="7 13 10 16 17 9"/></svg>
                <span class="kanban-clc-text">${escHtml(item)}</span>
                <button class="kanban-clc-del" data-idx="${i}" title="Supprimer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            `).join('')}
          </div>
          <div class="kanban-clc-add" style="display:flex;gap:8px;margin-top:12px">
            <input type="text" id="_clc-input" class="form-input" placeholder="Nouvelle tâche…" style="flex:1" />
            <button class="btn btn-primary btn-sm" id="_clc-add-btn">Ajouter</button>
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="_clc-cancel">Fermer</button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('visible')));

    let items = [...checklist];

    const close = () => {
      backdrop.classList.remove('visible');
      setTimeout(() => backdrop.remove(), 200);
      renderView();
    };

    backdrop.querySelector('#_clc-close').addEventListener('click', close);
    backdrop.querySelector('#_clc-cancel').addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

    const listEl  = backdrop.querySelector('#_clc-list');
    const inputEl = backdrop.querySelector('#_clc-input');
    const addBtn  = backdrop.querySelector('#_clc-add-btn');

    function refreshList() {
      listEl.innerHTML = items.map((item, i) => `
        <div class="kanban-clc-row" data-idx="${i}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" style="flex-shrink:0"><rect x="3" y="3" width="18" height="18" rx="4"/><polyline points="7 13 10 16 17 9"/></svg>
          <span class="kanban-clc-text">${escHtml(item)}</span>
          <button class="kanban-clc-del" data-idx="${i}" title="Supprimer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `).join('');

      listEl.querySelectorAll('.kanban-clc-del').forEach(btn => {
        btn.addEventListener('click', () => {
          items.splice(parseInt(btn.dataset.idx), 1);
          _setChecklist(stageId, items);
          refreshList();
        });
      });
    }

    function addItem() {
      const val = inputEl.value.trim();
      if (!val) return;
      items.push(val);
      _setChecklist(stageId, items);
      inputEl.value = '';
      inputEl.focus();
      refreshList();
    }

    addBtn.addEventListener('click', addItem);
    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') addItem(); });

    /* Wire delete buttons for initial items */
    listEl.querySelectorAll('.kanban-clc-del').forEach(btn => {
      btn.addEventListener('click', () => {
        items.splice(parseInt(btn.dataset.idx), 1);
        _setChecklist(stageId, items);
        refreshList();
      });
    });

    setTimeout(() => inputEl.focus(), 120);
  }

  /* ── Nettoie les dates programmées (PubCal + projet) ─────────── */
  function _clearScheduledDates(project, clientId) {
    if (project.scheduledDates && project.scheduledDates.length > 0) {
      if (window.PubCal && typeof PubCal.setCheck === 'function') {
        project.scheduledDates.forEach(date => PubCal.setCheck(date, clientId, false));
      }
    }
    delete project.scheduledDates;
  }

  /* ── Reprogrammer un projet déjà dans publie ─────────────────── */
  function reprogramProject(clientId, projectId) {
    if (!window.Programmation) return;
    Programmation.openForProject(clientId, projectId, () => {
      renderView();
      Dashboard.refresh();
    });
  }

  /* ── Déplacer un projet ──────────────────────────────────────── */
  function moveProject(clientId, projectId, newStage) {
    const projects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
    const project  = projects.find(p => p.id === projectId);
    if (!project) return;

    /* Passage en "Programmé / Publié" → ouvre le flow Programmation */
    if (newStage === 'publie' && project.stage !== 'publie' && window.Programmation) {
      Programmation.openForProject(clientId, projectId, () => {
        const ps = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
        const p  = ps.find(x => x.id === projectId);
        if (p) { p.stage = newStage; App.save(`${App.KEYS.PROJECTS}_${clientId}`, ps); }
        renderView();
        Dashboard.refresh();
      });
      return;
    }

    /* Sortie de "publie" → nettoie les dates programmées */
    if (project.stage === 'publie' && newStage !== 'publie') {
      _clearScheduledDates(project, clientId);
    }

    project.stage = newStage;
    App.save(`${App.KEYS.PROJECTS}_${clientId}`, projects);
    renderView();
    Dashboard.refresh();
  }

  /* ── Modifier un projet ──────────────────────────────────────── */
  function editProject(clientId, projectId) {
    const projects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
    const project  = projects.find(p => p.id === projectId);
    if (!project) return;

    const clientOptions = App.CLIENTS.map(c =>
      `<option value="${c.id}"${c.id === clientId ? ' selected' : ''}>${escHtml(c.name)}</option>`
    ).join('');
    const stageOptions = App.STAGES.map(s =>
      `<option value="${s.id}"${s.id === project.stage ? ' selected' : ''}>${escHtml(s.label)}</option>`
    ).join('');

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.display = 'flex';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <h3>Modifier le projet</h3>
          <button class="modal-close-btn" id="_ep-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <label class="form-label">Nom du projet</label>
          <input type="text" id="_ep-name" class="form-input" value="${escHtml(project.name)}" />
          <label class="form-label" style="margin-top:14px">Client</label>
          <select id="_ep-client" class="form-select">${clientOptions}</select>
          <label class="form-label" style="margin-top:14px">Étiquette de tournage <span style="color:var(--text-3);font-weight:400">(optionnel)</span></label>
          <input type="text" id="_ep-shooting" class="form-input" value="${escHtml(project.shooting || '')}" placeholder="Ex : Livraison 25/06…" />
          <div style="display:flex;gap:12px;margin-top:14px">
            <div style="flex:1">
              <label class="form-label">Lettre du lot</label>
              <input type="text" id="_ep-letter" class="form-input" value="${escHtml(project.letter || '')}" maxlength="2" style="text-transform:uppercase" />
            </div>
            <div style="flex:1">
              <label class="form-label">Nombre de vidéos</label>
              <input type="number" id="_ep-count" class="form-input" min="0" max="99" value="${project.videoCount || ''}" />
            </div>
          </div>
          <label class="form-label" style="margin-top:14px">Étape</label>
          <select id="_ep-stage" class="form-select">${stageOptions}</select>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="_ep-cancel">Annuler</button>
          <button class="btn btn-primary" id="_ep-confirm">Enregistrer</button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('visible')));

    const close = () => {
      backdrop.classList.remove('visible');
      setTimeout(() => backdrop.remove(), 200);
    };

    backdrop.querySelector('#_ep-close').addEventListener('click', close);
    backdrop.querySelector('#_ep-cancel').addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    setTimeout(() => backdrop.querySelector('#_ep-name').focus(), 120);

    backdrop.querySelector('#_ep-confirm').addEventListener('click', () => {
      const newName     = backdrop.querySelector('#_ep-name').value.trim();
      const newClientId = backdrop.querySelector('#_ep-client').value;
      const newShooting = backdrop.querySelector('#_ep-shooting').value.trim();
      const newLetter   = backdrop.querySelector('#_ep-letter').value.trim().toUpperCase();
      const newCountRaw = backdrop.querySelector('#_ep-count').value;
      const newCount    = newCountRaw ? parseInt(newCountRaw, 10) : 0;
      const newStage    = backdrop.querySelector('#_ep-stage').value;
      if (!newName) { backdrop.querySelector('#_ep-name').focus(); return; }

      let oldProjects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
      oldProjects = oldProjects.filter(p => p.id !== projectId);
      App.save(`${App.KEYS.PROJECTS}_${clientId}`, oldProjects);

      const newProjects = App.load(`${App.KEYS.PROJECTS}_${newClientId}`, []);
      const updated = { ...project, name: newName, stage: newStage };
      if (newShooting)            updated.shooting   = newShooting; else delete updated.shooting;
      if (newLetter)              updated.letter     = newLetter;   else delete updated.letter;
      if (newCount && newCount>0) updated.videoCount = newCount;    else delete updated.videoCount;
      newProjects.push(updated);
      App.save(`${App.KEYS.PROJECTS}_${newClientId}`, newProjects);

      close();
      renderView();
      Dashboard.refresh();
    });
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
    const projects = App.load(`${App.KEYS.PROJECTS}_${_dragClientId}`, []);
    const project  = projects.find(p => p.id === _dragProjectId);
    if (!project || project.stage === stageId) return;
    requestMove(_dragClientId, _dragProjectId, project.stage, stageId);
  }

  /* ── Wiring global (modale) ─────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('confirmAddProjectBtn')
      ?.addEventListener('click', _confirmAddProject);
    document.getElementById('newProjectName')
      ?.addEventListener('keydown', e => { if (e.key === 'Enter') _confirmAddProject(); });
  });

  /* ── API publique ───────────────────────────────────────────── */
  return { renderView, moveProject, requestMove, reprogramProject, editProject, deleteProject, dragStart, dragEnd, drop };

})();
