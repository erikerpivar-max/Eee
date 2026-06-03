/* ================================================================
   THE HOUSE — dezoom.js
   Vue globale par projet : En process + En stock
   Sélection des subdivisions (A1, A2…) → envoi pubcal
   ================================================================ */

'use strict';

window.Dezoom = (() => {

  const KEY_PROG = 'th_dezoom_prog'; /* { projectId: ['A1','A2',...] } */

  const PROCESS_STAGES = new Set([
    'rushs','brouillon','verif-draft','corrections',
    'attente-validation','montage-final','verif-final',
  ]);

  /* ── Persistance ─────────────────────────────────────────────── */
  function _loadProg()    { return App.load(KEY_PROG, {}); }
  function _saveProg(d)   { App.save(KEY_PROG, d); }

  function _getProgrammed(projectId) { return _loadProg()[projectId] || []; }

  function _markProgrammed(projectId, videos) {
    const all  = _loadProg();
    const prev = all[projectId] || [];
    all[projectId] = [...new Set([...prev, ...videos])];
    _saveProg(all);
  }

  /* ── Subdivisions A1 A2 A3… ─────────────────────────────────── */
  function _getSubs(project) {
    const letter = (project.letter || '').trim().toUpperCase();
    const count  = parseInt(project.videoCount, 10) || 0;
    if (!letter || count <= 0) return [];
    return Array.from({ length: count }, (_, i) => `${letter}${i + 1}`);
  }

  /* ── Rendu principal ─────────────────────────────────────────── */
  function renderView() {
    const wrap = document.getElementById('dezoom-board');
    if (!wrap) return;

    const processItems = [];
    const stockItems   = [];

    App.CLIENTS.forEach(client => {
      const projects = App.load(`${App.KEYS.PROJECTS}_${client.id}`, []);
      projects.forEach(p => {
        if (PROCESS_STAGES.has(p.stage))  processItems.push({ project: p, client });
        else if (p.stage === 'stock')      stockItems.push({ project: p, client });
      });
    });

    wrap.innerHTML = `
      <div class="dz-section">
        <div class="dz-section-head">
          <span class="dz-section-dot" style="background:#8B5CF6"></span>
          <span class="dz-section-label">En process</span>
          <span class="dz-section-count">${processItems.length} projet(s)</span>
        </div>
        <div class="dz-process-grid">
          ${processItems.length
            ? processItems.map(({ project, client }) => _buildProcessCard(project, client)).join('')
            : '<p class="dz-empty">Aucun projet en cours de production.</p>'}
        </div>
      </div>

      <div class="dz-section">
        <div class="dz-section-head">
          <span class="dz-section-dot" style="background:#06B6D4"></span>
          <span class="dz-section-label">En stock</span>
          <span class="dz-section-count">${stockItems.length} projet(s)</span>
        </div>
        <div class="dz-stock-list">
          ${stockItems.length
            ? stockItems.map(({ project, client }) => _buildStockCard(project, client)).join('')
            : '<p class="dz-empty">Aucun projet en stock — les projets arrivent ici après Vérif final.</p>'}
        </div>
      </div>`;

    _wireStockCards();
  }

  /* ── Carte "En process" ──────────────────────────────────────── */
  function _buildProcessCard(project, client) {
    const stage      = App.STAGES.find(s => s.id === project.stage);
    const stageName  = stage ? stage.label : project.stage;
    const stageColor = stage ? stage.color : '#9CA3AF';
    const countBadge = (project.videoCount > 0)
      ? `<span class="dz-vcount" style="border-color:${client.color};color:${client.color}">${project.videoCount}V${project.letter ? ' · Lot ' + escHtml(project.letter) : ''}</span>`
      : '';
    return `
      <div class="dz-process-card">
        <div class="dz-client-bar" style="background:${client.color}"></div>
        <div class="dz-card-body">
          <div class="dz-client-name" style="color:${client.color}">${escHtml(client.name)}</div>
          <div class="dz-project-name">${escHtml(project.name)}</div>
          ${countBadge}
          <div class="dz-stage-badge" style="background:${stageColor}18;color:${stageColor}">${escHtml(stageName)}</div>
        </div>
      </div>`;
  }

  /* ── Carte "En stock" ────────────────────────────────────────── */
  function _buildStockCard(project, client) {
    const subs       = _getSubs(project);
    const programmed = _getProgrammed(project.id);
    const remaining  = subs.filter(v => !programmed.includes(v)).length;
    const hasSubs    = subs.length > 0;
    const allDone    = hasSubs && remaining === 0;

    const chipsHTML = hasSubs
      ? subs.map(v => {
          const done = programmed.includes(v);
          return `<button
            class="dz-chip${done ? ' dz-chip--done' : ''}"
            data-video="${escHtml(v)}"
            data-project="${project.id}"
            data-client="${client.id}"
            style="${done ? '' : `--chip-color:${client.color}`}"
            ${done ? 'disabled' : ''}>${escHtml(v)}</button>`;
        }).join('')
      : `<span style="font-size:.8rem;color:var(--text-3)">Pas de lot défini (lettre + nombre de vidéos requis)</span>`;

    const remainingLabel = !hasSubs ? '' : allDone
      ? `<span class="dz-remaining" style="color:#10B981">Tout programmé</span>`
      : `<span class="dz-remaining" style="color:#F59E0B">${remaining} restante(s)</span>`;

    return `
      <div class="dz-stock-card" id="dz-stock-${project.id}">
        <div class="dz-client-bar" style="background:${client.color}"></div>
        <div class="dz-stock-card-body">
          <div class="dz-stock-card-head">
            <span class="dz-client-name" style="color:${client.color}">${escHtml(client.name)}</span>
            <span class="dz-project-name">${escHtml(project.name)}</span>
            ${project.letter ? `<span class="dz-lot-badge">Lot ${escHtml(project.letter)}</span>` : ''}
            ${remainingLabel}
          </div>
          <div class="dz-chips-wrap" data-project="${project.id}" data-client="${client.id}">
            ${chipsHTML}
          </div>
          ${hasSubs && !allDone ? `
          <div class="dz-stock-actions" id="dz-actions-${project.id}" style="display:none">
            <button class="btn btn-primary btn-sm dz-program-btn" data-project="${project.id}" data-client="${client.id}">
              Programmer la sélection
            </button>
            <button class="btn btn-ghost btn-sm dz-clear-sel" data-project="${project.id}">Désélectionner</button>
          </div>` : ''}
        </div>
      </div>`;
  }

  /* ── Wiring des chips ────────────────────────────────────────── */
  function _wireStockCards() {
    document.querySelectorAll('.dz-chip:not(.dz-chip--done)').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('dz-chip--selected');
        const projectId  = chip.dataset.project;
        const actionsEl  = document.getElementById(`dz-actions-${projectId}`);
        if (!actionsEl) return;
        const anySelected = !!document.querySelector(`.dz-chip[data-project="${projectId}"].dz-chip--selected`);
        actionsEl.style.display = anySelected ? 'flex' : 'none';
      });
    });

    document.querySelectorAll('.dz-program-btn').forEach(btn => {
      btn.addEventListener('click', () => _openProgramPopup(btn.dataset.project, btn.dataset.client));
    });

    document.querySelectorAll('.dz-clear-sel').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`.dz-chip[data-project="${btn.dataset.project}"].dz-chip--selected`)
          .forEach(c => c.classList.remove('dz-chip--selected'));
        const actionsEl = document.getElementById(`dz-actions-${btn.dataset.project}`);
        if (actionsEl) actionsEl.style.display = 'none';
      });
    });
  }

  /* ── Popup : choisir la date ─────────────────────────────────── */
  function _openProgramPopup(projectId, clientId) {
    const selected = [...document.querySelectorAll(`.dz-chip[data-project="${projectId}"].dz-chip--selected`)]
      .map(c => c.dataset.video);
    if (!selected.length) return;

    const client   = App.CLIENTS.find(c => c.id === clientId);
    const projects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
    const project  = projects.find(p => p.id === projectId);
    if (!project || !client) return;

    const today    = new Date().toISOString().slice(0, 10);
    const backdrop = document.createElement('div');
    backdrop.className  = 'modal-backdrop';
    backdrop.style.display = 'flex';
    backdrop.innerHTML  = `
      <div class="modal modal-sm">
        <div class="modal-head">
          <h3>Programmer la sélection</h3>
          <button class="modal-close-btn" id="_dz-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size:.88rem;color:var(--text-2);margin-bottom:14px">
            <strong style="color:${client.color}">${escHtml(client.name)}</strong> · ${escHtml(project.name)}<br>
            <span style="font-size:.8rem;color:var(--text-3)">Vidéos sélectionnées : ${escHtml(selected.join(', '))}</span>
          </p>
          <label class="form-label">Date de programmation</label>
          <input type="date" id="_dz-date" class="form-input" value="${today}" />
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="_dz-cancel">Annuler</button>
          <button class="btn btn-primary" id="_dz-confirm">Programmer</button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('visible')));

    const close = () => {
      backdrop.classList.remove('visible');
      setTimeout(() => backdrop.remove(), 200);
    };
    backdrop.querySelector('#_dz-close').addEventListener('click', close);
    backdrop.querySelector('#_dz-cancel').addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

    backdrop.querySelector('#_dz-confirm').addEventListener('click', () => {
      const date = backdrop.querySelector('#_dz-date').value;
      if (!date) { backdrop.querySelector('#_dz-date').focus(); return; }
      close();
      _programVideos(projectId, clientId, selected, date);
    });
  }

  /* ── Enregistrement dans pubcal + vérification tout programmé ── */
  function _programVideos(projectId, clientId, videos, date) {
    const client   = App.CLIENTS.find(c => c.id === clientId);
    const projects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
    const project  = projects.find(p => p.id === projectId);
    if (!project || !client) return;

    const entries = App.load('th_pubcal_entries', []);
    videos.forEach(v => {
      entries.push({
        id:       App.uid(),
        date,
        clientId,
        category: 'programmation',
        label:    `${v} — ${escHtml(project.name)}`,
        projectId,
        videoRef: v,
      });
    });
    App.save('th_pubcal_entries', entries);

    _markProgrammed(projectId, videos);

    const subs    = _getSubs(project);
    const nowDone = _getProgrammed(projectId);
    if (subs.length > 0 && subs.every(v => nowDone.includes(v))) {
      Kanban.moveProject(clientId, projectId, 'publie');
    }

    renderView();
    if (window.Dashboard) Dashboard.refresh();
  }

  /* ── Toggle appelé directement par onclick dans le HTML ──────── */
  function toggle() {
    const btn      = document.getElementById('dezoomToggleBtn');
    const kanbanBd = document.getElementById('kanban-board');
    const dezoomBd = document.getElementById('dezoom-board');
    if (!btn || !kanbanBd || !dezoomBd) return;

    const isActive = btn.classList.toggle('active');
    kanbanBd.style.display = isActive ? 'none' : '';
    dezoomBd.style.display = isActive ? 'block' : 'none';
    if (isActive) renderView();
  }

  return { renderView, toggle };

})();
