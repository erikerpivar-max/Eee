/* ================================================================
   THE HOUSE — procedures.js
   Module Procédures : flowchart interactif avec branches,
   sous-étapes, gamification
   ================================================================ */

'use strict';

window.Procedures = (() => {

  const KEY = 'th_procedures';
  const KEY_LOGS = 'th_procedures_logs';

  /* ── Catégories ─────────────────────────────────────────────────── */
  const CATEGORIES = [
    { id: 'vision',      label: 'Vision',      icon: '🎯', color: '#6366F1' },
    { id: 'client',      label: 'Client',      icon: '🤝', color: '#8B5CF6' },
    { id: 'production',  label: 'Production',  icon: '🎬', color: '#EF4444' },
    { id: 'admin',       label: 'Admin',       icon: '📋', color: '#3B82F6' },
    { id: 'competences', label: 'Compétences', icon: '🧠', color: '#F59E0B' },
  ];

  /* ── Niveaux de maîtrise ────────────────────────────────────────── */
  const LEVELS = [
    { id: 'nouveau',       label: 'Nouveau',          icon: '🌱', threshold: 0  },
    { id: 'apprentissage', label: 'En apprentissage', icon: '🌿', threshold: 3  },
    { id: 'maitrise',      label: 'Maîtrisé',        icon: '🌳', threshold: 7  },
  ];

  /* ── Data helpers ───────────────────────────────────────────────── */
  function _load() { return App.load(KEY, []); }
  function _save(data) { App.save(KEY, data); }
  function _loadLogs() { return App.load(KEY_LOGS, []); }
  function _saveLogs(logs) { App.save(KEY_LOGS, logs); }

  function _getLevel(execCount) {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (execCount >= LEVELS[i].threshold) return LEVELS[i];
    }
    return LEVELS[0];
  }

  function _getExecCount(procId) {
    return _loadLogs().filter(l => l.procId === procId).length;
  }

  function _getMonthCount(procId) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    return _loadLogs().filter(l => l.procId === procId && l.date >= monthStart).length;
  }

  function _getGlobalScore() {
    const procs = _load();
    if (procs.length === 0) return 0;
    const mastered = procs.filter(p => _getExecCount(p.id) >= LEVELS[2].threshold).length;
    return Math.round((mastered / procs.length) * 100);
  }

  /* Compte total de noeuds (étapes + sous-étapes) */
  function _countNodes(steps) {
    let count = 0;
    steps.forEach(s => {
      count++;
      if (s.children) count += s.children.length;
    });
    return count;
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDER PRINCIPAL (liste des procédures)
     ══════════════════════════════════════════════════════════════════ */
  function renderView() {
    const container = document.getElementById('procedures-container');
    if (!container) return;

    const procs = _load();
    const score = _getGlobalScore();

    let html = '';

    // Topbar
    html += `
      <div class="proc-topbar">
        <div class="proc-score">
          <div class="proc-score-circle" style="--pct:${score}">
            <span class="proc-score-val">${score}%</span>
          </div>
          <div class="proc-score-text">
            <span class="proc-score-label">Maîtrise globale</span>
            <span class="proc-score-hint">${procs.length} procédure${procs.length > 1 ? 's' : ''}</span>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" id="proc-add-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nouvelle procédure
        </button>
      </div>`;

    // Filtres
    html += `<div class="proc-filters">
      <button class="proc-filter-btn active" data-cat="all">Tout</button>
      ${CATEGORIES.map(c => `<button class="proc-filter-btn" data-cat="${c.id}" style="--fc:${c.color}">${c.icon} ${c.label}</button>`).join('')}
    </div>`;

    // Liste
    if (procs.length === 0) {
      html += `<div class="proc-empty">
        <div class="proc-empty-icon">📂</div>
        <p class="proc-empty-text">Aucune procédure créée</p>
        <p class="proc-empty-sub">Créez votre première procédure pour structurer vos process</p>
      </div>`;
    } else {
      html += '<div class="proc-list" id="proc-list">';
      procs.forEach(p => {
        const cat = CATEGORIES.find(c => c.id === p.category) || CATEGORIES[0];
        const execCount = _getExecCount(p.id);
        const monthCount = _getMonthCount(p.id);
        const level = _getLevel(execCount);
        const nodeCount = _countNodes(p.steps || []);

        // Mini-preview du flowchart (3 premiers noeuds)
        const previewSteps = (p.steps || []).slice(0, 3);
        const miniFlow = previewSteps.map((s, i) => {
          const isLast = i === previewSteps.length - 1 && (p.steps || []).length <= 3;
          const hasBranch = s.children && s.children.length > 0;
          return `<div class="proc-mini-node">
            <span class="proc-mini-dot" style="background:${cat.color}"></span>
            <span class="proc-mini-label">${escHtml(s.text).substring(0, 25)}${s.text.length > 25 ? '…' : ''}</span>
            ${hasBranch ? `<span class="proc-mini-branch">+${s.children.length}</span>` : ''}
          </div>
          ${!isLast || (p.steps || []).length > 3 ? '<div class="proc-mini-line" style="border-color:' + cat.color + '"></div>' : ''}`;
        }).join('');
        const moreNodes = (p.steps || []).length > 3 ? `<div class="proc-mini-more">+${(p.steps || []).length - 3} étapes</div>` : '';

        html += `
          <div class="proc-card" data-id="${p.id}" data-cat="${p.category}">
            <div class="proc-card-header">
              <div class="proc-card-cat" style="background:${cat.color}22;color:${cat.color}">
                ${cat.icon} ${cat.label}
              </div>
              <div class="proc-card-level" title="Exécuté ${execCount} fois">
                ${level.icon} ${level.label}
              </div>
            </div>
            <h4 class="proc-card-title">${escHtml(p.title)}</h4>
            <div class="proc-mini-flow">${miniFlow}${moreNodes}</div>
            <div class="proc-card-meta">
              <span>${nodeCount} noeud${nodeCount > 1 ? 's' : ''}</span>
              <span class="proc-card-streak">${monthCount > 0 ? `🔥 ${monthCount}x ce mois` : ''}</span>
            </div>
            <div class="proc-card-actions">
              <button class="btn btn-outline btn-xs proc-exec-btn" data-id="${p.id}">✓ Je l'ai fait</button>
              <button class="btn btn-ghost btn-xs proc-view-btn" data-id="${p.id}">Ouvrir</button>
              <button class="btn btn-ghost btn-xs proc-del-btn" data-id="${p.id}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>`;
      });
      html += '</div>';
    }

    container.innerHTML = html;
    _bindList();
  }

  /* ── Bindings liste ─────────────────────────────────────────────── */
  function _bindList() {
    document.getElementById('proc-add-btn')?.addEventListener('click', () => _openEditor(null));

    document.querySelectorAll('.proc-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.proc-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        document.querySelectorAll('.proc-card').forEach(card => {
          card.style.display = (cat === 'all' || card.dataset.cat === cat) ? '' : 'none';
        });
      });
    });

    document.querySelectorAll('.proc-exec-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); _logExecution(btn.dataset.id); });
    });
    document.querySelectorAll('.proc-view-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); _openFlowView(btn.dataset.id); });
    });
    document.querySelectorAll('.proc-del-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); _deleteProc(btn.dataset.id); });
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     FLOWCHART VIEW (vue détaillée d'une procédure)
     ══════════════════════════════════════════════════════════════════ */
  function _openFlowView(procId) {
    const procs = _load();
    const proc = procs.find(p => p.id === procId);
    if (!proc) return;

    const cat = CATEGORIES.find(c => c.id === proc.category) || CATEGORIES[0];
    const execCount = _getExecCount(proc.id);
    const monthCount = _getMonthCount(proc.id);
    const level = _getLevel(execCount);
    const nextLevel = LEVELS.find(l => l.threshold > execCount);

    const overlay = document.createElement('div');
    overlay.className = 'proc-popup-overlay';
    overlay.innerHTML = `
      <div class="proc-popup proc-flow-popup">
        <div class="proc-popup-head">
          <div class="proc-flow-head-left">
            <div class="proc-detail-badge" style="background:${cat.color}22;color:${cat.color}">${cat.icon} ${cat.label}</div>
            <h3>${escHtml(proc.title)}</h3>
          </div>
          <button class="proc-popup-close">&times;</button>
        </div>

        <div class="proc-flow-stats-bar">
          <div class="proc-flow-stat">${level.icon} ${level.label}</div>
          <div class="proc-flow-stat">Exécuté <strong>${execCount}</strong> fois</div>
          ${monthCount > 0 ? `<div class="proc-flow-stat">🔥 ${monthCount}x ce mois</div>` : ''}
          ${nextLevel ? `<div class="proc-flow-stat proc-flow-stat-next">${execCount}/${nextLevel.threshold} → ${nextLevel.icon}</div>` : '<div class="proc-flow-stat">✓ Max</div>'}
        </div>

        <div class="proc-popup-body proc-flow-body">
          <div class="proc-flowchart" id="proc-flowchart" data-color="${cat.color}">
            ${_renderFlowchart(proc.steps || [], cat.color)}
          </div>
        </div>

        <div class="proc-popup-foot">
          <button class="btn btn-ghost proc-popup-cancel">Fermer</button>
          <button class="btn btn-outline btn-sm proc-edit-flow-btn">Modifier</button>
          <button class="btn btn-primary btn-sm proc-exec-flow-btn">✓ Je l'ai fait</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    // Bindings
    overlay.querySelector('.proc-popup-close').addEventListener('click', () => _closeOverlay(overlay));
    overlay.querySelector('.proc-popup-cancel').addEventListener('click', () => _closeOverlay(overlay));
    overlay.addEventListener('click', e => { if (e.target === overlay) _closeOverlay(overlay); });

    overlay.querySelector('.proc-exec-flow-btn').addEventListener('click', () => {
      _closeOverlay(overlay);
      _logExecution(procId);
    });

    overlay.querySelector('.proc-edit-flow-btn').addEventListener('click', () => {
      _closeOverlay(overlay);
      _openEditor(procId);
    });
  }

  /* ── Render flowchart HTML ──────────────────────────────────────── */
  function _renderFlowchart(steps, color) {
    if (!steps || steps.length === 0) return '<p class="proc-flow-empty">Aucune étape</p>';

    let html = '';
    steps.forEach((step, i) => {
      const isLast = i === steps.length - 1;
      const hasBranches = step.children && step.children.length > 0;

      html += `<div class="flow-node">
        <div class="flow-node-main">
          <div class="flow-node-circle" style="background:${color}">
            <span>${i + 1}</span>
          </div>
          <div class="flow-node-content">
            <span class="flow-node-text">${escHtml(step.text)}</span>
            ${step.note ? `<span class="flow-node-note">${escHtml(step.note)}</span>` : ''}
          </div>
        </div>`;

      // Branches (sous-étapes)
      if (hasBranches) {
        html += `<div class="flow-branches">`;
        step.children.forEach((child, ci) => {
          html += `<div class="flow-branch">
            <div class="flow-branch-connector" style="border-color:${color}"></div>
            <div class="flow-branch-node">
              <div class="flow-branch-circle" style="border-color:${color};color:${color}">
                <span>${i + 1}.${ci + 1}</span>
              </div>
              <div class="flow-node-content">
                <span class="flow-node-text">${escHtml(child.text)}</span>
                ${child.note ? `<span class="flow-node-note">${escHtml(child.note)}</span>` : ''}
              </div>
            </div>
          </div>`;
        });
        html += `</div>`;
      }

      // Connecteur vers le noeud suivant
      if (!isLast) {
        html += `<div class="flow-connector" style="border-color:${color}"></div>`;
      }

      html += `</div>`;
    });

    return html;
  }

  /* ══════════════════════════════════════════════════════════════════
     ÉDITEUR (création / modification avec branches)
     ══════════════════════════════════════════════════════════════════ */
  function _openEditor(procId) {
    const isEdit = !!procId;
    let proc = null;
    if (isEdit) {
      proc = _load().find(p => p.id === procId);
      if (!proc) return;
    }

    // Structure steps : [{text, note, children: [{text, note}]}]
    let steps = isEdit ? JSON.parse(JSON.stringify(proc.steps || [])) : [{ text: '', note: '', children: [] }];

    const overlay = document.createElement('div');
    overlay.className = 'proc-popup-overlay';

    function _render() {
      overlay.innerHTML = `
        <div class="proc-popup proc-editor-popup">
          <div class="proc-popup-head">
            <h3>${isEdit ? 'Modifier' : 'Nouvelle procédure'}</h3>
            <button class="proc-popup-close">&times;</button>
          </div>
          <div class="proc-popup-body">
            <label class="form-label">Titre</label>
            <input type="text" class="form-input" id="proc-ed-title" placeholder="Ex: Onboarding nouveau client" value="${isEdit ? escHtml(proc.title) : ''}" />

            <label class="form-label" style="margin-top:14px">Catégorie</label>
            <div class="proc-cat-grid" id="proc-ed-cats">
              ${CATEGORIES.map(c => `
                <button class="proc-cat-btn${(isEdit && proc.category === c.id) ? ' selected' : ''}" data-cat="${c.id}" style="--cc:${c.color}">
                  <span class="proc-cat-icon">${c.icon}</span>
                  <span>${c.label}</span>
                </button>`).join('')}
            </div>

            <label class="form-label" style="margin-top:18px">Flowchart</label>
            <p class="form-hint" style="margin-bottom:10px">Ajoutez des étapes principales et des sous-étapes (branches) pour chacune.</p>

            <div class="proc-ed-flow" id="proc-ed-flow">
              ${steps.map((s, i) => _editorNodeHtml(s, i, steps.length)).join('')}
            </div>

            <button class="btn btn-outline btn-xs" id="proc-ed-add-step" style="margin-top:10px">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Ajouter une étape
            </button>
          </div>
          <div class="proc-popup-foot">
            <button class="btn btn-ghost proc-popup-cancel">Annuler</button>
            <button class="btn btn-primary" id="proc-ed-save">${isEdit ? 'Sauvegarder' : 'Créer'}</button>
          </div>
        </div>`;

      _bindEditor();
    }

    function _editorNodeHtml(step, idx, total) {
      const isLast = idx === total - 1;
      let html = `
        <div class="proc-ed-node" data-idx="${idx}">
          <div class="proc-ed-node-head">
            <div class="proc-ed-node-num">${idx + 1}</div>
            <input type="text" class="form-input proc-ed-node-input" data-idx="${idx}" data-field="text" placeholder="Étape principale…" value="${escHtml(step.text)}" />
            <input type="text" class="form-input proc-ed-node-note" data-idx="${idx}" data-field="note" placeholder="Note (optionnel)" value="${escHtml(step.note || '')}" />
            <button class="proc-ed-del-node" data-idx="${idx}" title="Supprimer">&times;</button>
          </div>`;

      // Sous-étapes (branches)
      if (step.children && step.children.length > 0) {
        html += `<div class="proc-ed-branches">`;
        step.children.forEach((child, ci) => {
          html += `
            <div class="proc-ed-branch" data-idx="${idx}" data-ci="${ci}">
              <div class="proc-ed-branch-line"></div>
              <div class="proc-ed-branch-num">${idx + 1}.${ci + 1}</div>
              <input type="text" class="form-input proc-ed-branch-input" data-idx="${idx}" data-ci="${ci}" data-field="text" placeholder="Sous-étape…" value="${escHtml(child.text)}" />
              <input type="text" class="form-input proc-ed-branch-note" data-idx="${idx}" data-ci="${ci}" data-field="note" placeholder="Note" value="${escHtml(child.note || '')}" />
              <button class="proc-ed-del-branch" data-idx="${idx}" data-ci="${ci}" title="Supprimer">&times;</button>
            </div>`;
        });
        html += `</div>`;
      }

      html += `
          <button class="btn btn-ghost btn-xs proc-ed-add-branch" data-idx="${idx}">+ Sous-étape</button>
          ${!isLast ? '<div class="proc-ed-connector"></div>' : ''}
        </div>`;
      return html;
    }

    function _syncStepsFromDom() {
      const nodes = overlay.querySelectorAll('.proc-ed-node');
      steps = [];
      nodes.forEach((node, idx) => {
        const text = node.querySelector(`.proc-ed-node-input[data-idx="${idx}"]`)?.value || '';
        const note = node.querySelector(`.proc-ed-node-note[data-idx="${idx}"]`)?.value || '';
        const children = [];
        node.querySelectorAll(`.proc-ed-branch[data-idx="${idx}"]`).forEach((br, ci) => {
          const cText = br.querySelector(`.proc-ed-branch-input[data-idx="${idx}"][data-ci="${ci}"]`)?.value || '';
          const cNote = br.querySelector(`.proc-ed-branch-note[data-idx="${idx}"][data-ci="${ci}"]`)?.value || '';
          children.push({ text: cText, note: cNote });
        });
        steps.push({ text, note, children });
      });
    }

    function _bindEditor() {
      overlay.querySelector('.proc-popup-close')?.addEventListener('click', () => _closeOverlay(overlay));
      overlay.querySelector('.proc-popup-cancel')?.addEventListener('click', () => _closeOverlay(overlay));
      overlay.addEventListener('click', e => { if (e.target === overlay) _closeOverlay(overlay); });

      // Cat selection
      overlay.querySelectorAll('.proc-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          overlay.querySelectorAll('.proc-cat-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        });
      });

      // Ajouter étape
      overlay.querySelector('#proc-ed-add-step')?.addEventListener('click', () => {
        _syncStepsFromDom();
        steps.push({ text: '', note: '', children: [] });
        _render();
        // Focus last input
        setTimeout(() => {
          const inputs = overlay.querySelectorAll('.proc-ed-node-input');
          inputs[inputs.length - 1]?.focus();
        }, 50);
      });

      // Ajouter sous-étape
      overlay.querySelectorAll('.proc-ed-add-branch').forEach(btn => {
        btn.addEventListener('click', () => {
          _syncStepsFromDom();
          const idx = parseInt(btn.dataset.idx);
          if (!steps[idx].children) steps[idx].children = [];
          steps[idx].children.push({ text: '', note: '' });
          _render();
          setTimeout(() => {
            const branches = overlay.querySelectorAll(`.proc-ed-branch[data-idx="${idx}"]`);
            const lastBr = branches[branches.length - 1];
            lastBr?.querySelector('.proc-ed-branch-input')?.focus();
          }, 50);
        });
      });

      // Supprimer étape
      overlay.querySelectorAll('.proc-ed-del-node').forEach(btn => {
        btn.addEventListener('click', () => {
          _syncStepsFromDom();
          const idx = parseInt(btn.dataset.idx);
          steps.splice(idx, 1);
          if (steps.length === 0) steps.push({ text: '', note: '', children: [] });
          _render();
        });
      });

      // Supprimer branche
      overlay.querySelectorAll('.proc-ed-del-branch').forEach(btn => {
        btn.addEventListener('click', () => {
          _syncStepsFromDom();
          const idx = parseInt(btn.dataset.idx);
          const ci = parseInt(btn.dataset.ci);
          steps[idx].children.splice(ci, 1);
          _render();
        });
      });

      // Sauvegarder
      overlay.querySelector('#proc-ed-save')?.addEventListener('click', () => {
        _syncStepsFromDom();
        const title = overlay.querySelector('#proc-ed-title').value.trim();
        if (!title) { overlay.querySelector('#proc-ed-title').focus(); return; }

        const selectedCatBtn = overlay.querySelector('.proc-cat-btn.selected');
        if (!selectedCatBtn) { App.toast('Choisissez une catégorie', 'info'); return; }
        const category = selectedCatBtn.dataset.cat;

        // Nettoyage : retirer les étapes vides
        const cleanSteps = steps
          .filter(s => s.text.trim())
          .map(s => ({
            text: s.text.trim(),
            note: (s.note || '').trim(),
            children: (s.children || []).filter(c => c.text.trim()).map(c => ({
              text: c.text.trim(),
              note: (c.note || '').trim(),
            })),
          }));

        if (cleanSteps.length === 0) { App.toast('Ajoutez au moins une étape', 'info'); return; }

        const procs = _load();
        if (isEdit) {
          const idx = procs.findIndex(p => p.id === procId);
          if (idx !== -1) {
            procs[idx].title = title;
            procs[idx].category = category;
            procs[idx].steps = cleanSteps;
          }
        } else {
          procs.push({
            id: App.uid(),
            title,
            category,
            steps: cleanSteps,
            createdAt: App.today(),
          });
        }
        _save(procs);
        _closeOverlay(overlay);
        renderView();
        App.toast(isEdit ? 'Procédure mise à jour' : 'Procédure créée !', 'success');
      });
    }

    document.body.appendChild(overlay);
    _render();
    requestAnimationFrame(() => overlay.classList.add('visible'));
    setTimeout(() => overlay.querySelector('#proc-ed-title')?.focus(), 150);
  }

  /* ══════════════════════════════════════════════════════════════════
     ACTIONS
     ═════════════════════��════════════════════════════════════════════ */
  function _logExecution(procId) {
    const logs = _loadLogs();
    logs.push({ procId, date: App.today(), ts: Date.now() });
    _saveLogs(logs);

    const execCount = logs.filter(l => l.procId === procId).length;
    const level = _getLevel(execCount);
    const prevLevel = _getLevel(execCount - 1);

    if (level.id !== prevLevel.id) {
      App.toast(`${level.icon} Niveau atteint : ${level.label} !`, 'success');
    } else {
      App.toast('✓ Procédure exécutée', 'success');
    }
    renderView();
  }

  function _deleteProc(procId) {
    const procs = _load();
    const proc = procs.find(p => p.id === procId);
    if (!proc) return;
    App.confirm(`Supprimer la procédure "${proc.title}" ?`, () => {
      _save(procs.filter(p => p.id !== procId));
      _saveLogs(_loadLogs().filter(l => l.procId !== procId));
      renderView();
    });
  }

  /* ── Utils ──────────────────────────────────────────────────────── */
  function _closeOverlay(overlay) {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  }

  /* ── API publique ───────────────────────────────────────────────── */
  return { renderView, CATEGORIES };

})();
