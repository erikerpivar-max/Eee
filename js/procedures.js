/* ================================================================
   THE HOUSE — procedures.js
   Module Procédures : création, suivi, gamification légère
   ================================================================ */

'use strict';

window.Procedures = (() => {

  const KEY = 'th_procedures';
  const KEY_LOGS = 'th_procedures_logs'; // historique des exécutions

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
    { id: 'nouveau',       label: 'Nouveau',        icon: '🌱', threshold: 0  },
    { id: 'apprentissage', label: 'En apprentissage', icon: '🌿', threshold: 3  },
    { id: 'maitrise',      label: 'Maîtrisé',       icon: '🌳', threshold: 7  },
  ];

  /* ── Data ───────────────────────────────────────────────────────── */
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
    const logs = _loadLogs();
    return logs.filter(l => l.procId === procId).length;
  }

  function _getMonthCount(procId) {
    const logs = _loadLogs();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    return logs.filter(l => l.procId === procId && l.date >= monthStart).length;
  }

  function _getGlobalScore() {
    const procs = _load();
    if (procs.length === 0) return 0;
    const mastered = procs.filter(p => _getExecCount(p.id) >= LEVELS[2].threshold).length;
    return Math.round((mastered / procs.length) * 100);
  }

  /* ── Render principal ───────────────────────────────────────────── */
  function renderView() {
    const container = document.getElementById('procedures-container');
    if (!container) return;

    const procs = _load();
    const score = _getGlobalScore();

    let html = '';

    // Score global + bouton ajouter
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

    // Filtres catégories
    html += `<div class="proc-filters">
      <button class="proc-filter-btn active" data-cat="all">Tout</button>
      ${CATEGORIES.map(c => `<button class="proc-filter-btn" data-cat="${c.id}" style="--fc:${c.color}">${c.icon} ${c.label}</button>`).join('')}
    </div>`;

    // Liste des procédures groupées par catégorie
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
        const stepsCount = p.steps ? p.steps.length : 0;

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
            <div class="proc-card-meta">
              <span>${stepsCount} étape${stepsCount > 1 ? 's' : ''}</span>
              <span class="proc-card-streak">${monthCount > 0 ? `🔥 ${monthCount}x ce mois` : ''}</span>
            </div>
            <div class="proc-card-actions">
              <button class="btn btn-outline btn-xs proc-exec-btn" data-id="${p.id}">✓ Je l'ai fait</button>
              <button class="btn btn-ghost btn-xs proc-view-btn" data-id="${p.id}">Voir</button>
              <button class="btn btn-ghost btn-xs proc-del-btn" data-id="${p.id}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>`;
      });
      html += '</div>';
    }

    container.innerHTML = html;
    _bind();
  }

  /* ── Bindings ───────────────────────────────────────────────────── */
  function _bind() {
    document.getElementById('proc-add-btn')?.addEventListener('click', _openCreatePopup);

    // Filtres
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

    // Actions sur cards
    document.querySelectorAll('.proc-exec-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _logExecution(btn.dataset.id);
      });
    });
    document.querySelectorAll('.proc-view-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _openDetailPopup(btn.dataset.id);
      });
    });
    document.querySelectorAll('.proc-del-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _deleteProc(btn.dataset.id);
      });
    });
  }

  /* ── Log d'exécution ────────────────────────────────────────────── */
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
      App.toast('✓ Procédure marquée comme exécutée', 'success');
    }

    renderView();
  }

  /* ── Suppression ────────────────────────────────────────────────── */
  function _deleteProc(procId) {
    const procs = _load();
    const proc = procs.find(p => p.id === procId);
    if (!proc) return;
    App.confirm(`Supprimer la procédure "${proc.title}" ?`, () => {
      _save(procs.filter(p => p.id !== procId));
      // Supprimer les logs associés
      const logs = _loadLogs().filter(l => l.procId !== procId);
      _saveLogs(logs);
      renderView();
    });
  }

  /* ── Popup création ─────────────────────────────────────────────── */
  function _openCreatePopup(editId) {
    const isEdit = typeof editId === 'string';
    let proc = null;
    if (isEdit) {
      proc = _load().find(p => p.id === editId);
      if (!proc) return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'proc-popup-overlay';
    overlay.innerHTML = `
      <div class="proc-popup">
        <div class="proc-popup-head">
          <h3>${isEdit ? 'Modifier la procédure' : 'Nouvelle procédure'}</h3>
          <button class="proc-popup-close">&times;</button>
        </div>
        <div class="proc-popup-body">
          <label class="form-label">Titre</label>
          <input type="text" class="form-input" id="proc-title-input" placeholder="Ex: Onboarding nouveau client" value="${isEdit ? escHtml(proc.title) : ''}" />

          <label class="form-label" style="margin-top:14px">Catégorie</label>
          <div class="proc-cat-grid">
            ${CATEGORIES.map(c => `
              <button class="proc-cat-btn${isEdit && proc.category === c.id ? ' selected' : ''}" data-cat="${c.id}" style="--cc:${c.color}">
                <span class="proc-cat-icon">${c.icon}</span>
                <span>${c.label}</span>
              </button>`).join('')}
          </div>

          <label class="form-label" style="margin-top:14px">Étapes</label>
          <div class="proc-steps-editor" id="proc-steps-editor">
            ${isEdit ? proc.steps.map((s, i) => _stepRowHtml(i, s)).join('') : _stepRowHtml(0, '')}
          </div>
          <button class="btn btn-ghost btn-xs" id="proc-add-step-btn" style="margin-top:6px">+ Ajouter une étape</button>
        </div>
        <div class="proc-popup-foot">
          <button class="btn btn-ghost proc-popup-cancel">Annuler</button>
          <button class="btn btn-primary" id="proc-save-btn">${isEdit ? 'Sauvegarder' : 'Créer'}</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    let selectedCat = isEdit ? proc.category : '';

    // Catégorie selection
    overlay.querySelectorAll('.proc-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.proc-cat-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedCat = btn.dataset.cat;
      });
    });

    // Ajouter étape
    overlay.querySelector('#proc-add-step-btn').addEventListener('click', () => {
      const editor = overlay.querySelector('#proc-steps-editor');
      const idx = editor.querySelectorAll('.proc-step-row').length;
      editor.insertAdjacentHTML('beforeend', _stepRowHtml(idx, ''));
      const inputs = editor.querySelectorAll('.proc-step-input');
      inputs[inputs.length - 1].focus();
    });

    // Supprimer étape (délégation)
    overlay.querySelector('#proc-steps-editor').addEventListener('click', e => {
      const del = e.target.closest('.proc-step-del');
      if (del) del.closest('.proc-step-row').remove();
    });

    // Sauvegarder
    overlay.querySelector('#proc-save-btn').addEventListener('click', () => {
      const title = overlay.querySelector('#proc-title-input').value.trim();
      if (!title) { overlay.querySelector('#proc-title-input').focus(); return; }
      if (!selectedCat) { App.toast('Choisissez une catégorie', 'info'); return; }

      const steps = [];
      overlay.querySelectorAll('.proc-step-input').forEach(inp => {
        const v = inp.value.trim();
        if (v) steps.push(v);
      });
      if (steps.length === 0) { App.toast('Ajoutez au moins une étape', 'info'); return; }

      const procs = _load();
      if (isEdit) {
        const idx = procs.findIndex(p => p.id === editId);
        if (idx !== -1) {
          procs[idx].title = title;
          procs[idx].category = selectedCat;
          procs[idx].steps = steps;
        }
      } else {
        procs.push({
          id: App.uid(),
          title,
          category: selectedCat,
          steps,
          createdAt: App.today(),
        });
      }
      _save(procs);
      _closeOverlay(overlay);
      renderView();
      App.toast(isEdit ? 'Procédure mise à jour' : 'Procédure créée !', 'success');
    });

    // Fermer
    overlay.querySelector('.proc-popup-close').addEventListener('click', () => _closeOverlay(overlay));
    overlay.querySelector('.proc-popup-cancel').addEventListener('click', () => _closeOverlay(overlay));
    overlay.addEventListener('click', e => { if (e.target === overlay) _closeOverlay(overlay); });

    setTimeout(() => overlay.querySelector('#proc-title-input').focus(), 150);
  }

  function _stepRowHtml(idx, value) {
    return `
      <div class="proc-step-row">
        <span class="proc-step-num">${idx + 1}</span>
        <input type="text" class="form-input proc-step-input" placeholder="Décrivez cette étape…" value="${escHtml(value)}" />
        <button class="proc-step-del" title="Supprimer">&times;</button>
      </div>`;
  }

  /* ── Popup détail ───────────────────────────────────────────────── */
  function _openDetailPopup(procId) {
    const procs = _load();
    const proc = procs.find(p => p.id === procId);
    if (!proc) return;

    const cat = CATEGORIES.find(c => c.id === proc.category) || CATEGORIES[0];
    const execCount = _getExecCount(proc.id);
    const monthCount = _getMonthCount(proc.id);
    const level = _getLevel(execCount);
    const nextLevel = LEVELS.find(l => l.threshold > execCount);
    const progressText = nextLevel
      ? `${execCount}/${nextLevel.threshold} exécutions pour ${nextLevel.icon} ${nextLevel.label}`
      : 'Niveau maximum atteint !';

    const overlay = document.createElement('div');
    overlay.className = 'proc-popup-overlay';
    overlay.innerHTML = `
      <div class="proc-popup proc-detail-popup">
        <div class="proc-popup-head">
          <h3>${escHtml(proc.title)}</h3>
          <button class="proc-popup-close">&times;</button>
        </div>
        <div class="proc-popup-body">
          <div class="proc-detail-top">
            <div class="proc-detail-badge" style="background:${cat.color}22;color:${cat.color}">${cat.icon} ${cat.label}</div>
            <div class="proc-detail-level">${level.icon} ${level.label}</div>
          </div>

          <div class="proc-detail-progress">
            <div class="proc-detail-progress-bar">
              <div class="proc-detail-progress-fill" style="width:${nextLevel ? Math.min(100, (execCount / nextLevel.threshold) * 100) : 100}%;background:${cat.color}"></div>
            </div>
            <span class="proc-detail-progress-text">${progressText}</span>
          </div>

          <div class="proc-detail-stats">
            <div class="proc-detail-stat">
              <span class="proc-detail-stat-val">${execCount}</span>
              <span class="proc-detail-stat-label">Total exécutions</span>
            </div>
            <div class="proc-detail-stat">
              <span class="proc-detail-stat-val">${monthCount > 0 ? '🔥 ' + monthCount : '0'}</span>
              <span class="proc-detail-stat-label">Ce mois</span>
            </div>
          </div>

          <h4 class="proc-detail-steps-title">Étapes</h4>
          <ol class="proc-detail-steps">
            ${proc.steps.map(s => `<li>${escHtml(s)}</li>`).join('')}
          </ol>
        </div>
        <div class="proc-popup-foot">
          <button class="btn btn-ghost proc-popup-cancel">Fermer</button>
          <button class="btn btn-outline btn-sm proc-edit-btn">Modifier</button>
          <button class="btn btn-primary btn-sm proc-exec-detail-btn">✓ Je l'ai fait</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    overlay.querySelector('.proc-popup-close').addEventListener('click', () => _closeOverlay(overlay));
    overlay.querySelector('.proc-popup-cancel').addEventListener('click', () => _closeOverlay(overlay));
    overlay.addEventListener('click', e => { if (e.target === overlay) _closeOverlay(overlay); });

    overlay.querySelector('.proc-exec-detail-btn').addEventListener('click', () => {
      _closeOverlay(overlay);
      _logExecution(procId);
    });

    overlay.querySelector('.proc-edit-btn').addEventListener('click', () => {
      _closeOverlay(overlay);
      _openCreatePopup(procId);
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
