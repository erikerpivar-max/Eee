/* ================================================================
   THE HOUSE — scriptorga.js
   Sections : Base de données (formats, angles, hooks par angle,
              données time tracking) + Scripting (pipeline de cartes)
   ================================================================ */

'use strict';

/* ─── Templates par format ────────────────────────────────────────────── */
const SO_TEMPLATES = {
  'Clone vs Clone': {
    accroche: { label: 'Accroche',        placeholder: 'La première phrase choc — question, stat, comparaison directe…', hint: '~3s / 10 mots' },
    corps:    { label: 'Développement',   placeholder: 'Compare les deux options clairement, un angle par camp…', hint: '~45s / 120 mots' },
    cta:      { label: 'Call to action',  placeholder: 'Abonne-toi, enregistre, laisse un commentaire…', hint: '~5s / 15 mots' },
  },
  'White board': {
    accroche: { label: 'Accroche',        placeholder: 'La question ou le problème posé à la craie…', hint: '~5s' },
    corps:    { label: 'Explication',     placeholder: 'Le déroulé pédagogique, étape par étape…', hint: '~60s' },
    cta:      { label: 'Call to action',  placeholder: 'Prochain épisode, lien en bio…', hint: '~5s' },
  },
  'Voix Off': {
    accroche: { label: 'Intro voix',      placeholder: 'Phrase d’entrée, ton posé, ambiance…', hint: '~5s' },
    corps:    { label: 'Script voix',     placeholder: 'Texte complet à lire, rythme naturel…', hint: '~50s' },
    cta:      { label: 'Outro',           placeholder: 'Phrase finale, redirection…', hint: '~5s' },
  },
  _default: {
    accroche: { label: 'Accroche',        placeholder: 'Première phrase choc…', hint: '' },
    corps:    { label: 'Corps du script', placeholder: 'Développement…', hint: '' },
    cta:      { label: 'Call to action',  placeholder: 'Clôture et action attendue…', hint: '' },
  },
};
window.ScriptOrga = (() => {

  const KEY_DB      = 'so_database';
  const KEY_SCRIPTS = 'so_scripts';
  const KEY_PLAN    = 'so_plan';   // ancien plan (migration)
  const KEY_NOTES   = 'so_notes';

  let _db              = null;
  let _editingId       = null;
  let _anglePopupTimer = null;
  let _autoSaveTimer   = null;
  let _savedCardsHTML  = null;

  const STATUSES = [
    { id: 'brouillon', label: 'Brouillon', css: 'status-brouillon' },
    { id: 'termine',   label: 'Termin\u00e9',   css: 'status-termine'   },
  ];

  /* ─── Persistence ─────────────────────────────────────────────── */
  function _loadDB() {
    const s = App.load(KEY_DB, null);
    _db = {
      formats: s?.formats ?? ['Clone vs Clone', 'White board', 'Voix Off'],
      angles:  s?.angles  ?? ['Comparaison', 'Tier list', 'Note sur 10'],
      hooks:   s?.hooks   ?? {},
    };
    // Migration : ancien format hooks (tableau plat) → objet par angle
    if (Array.isArray(_db.hooks)) {
      const old = _db.hooks;
      _db.hooks = {};
      if (old.length > 0) {
        _db.hooks['__general__'] = old;
      }
      _saveDB();
    }
  }
  function _saveDB()      { App.save(KEY_DB, _db); }
  function _loadScripts() { return App.load(KEY_SCRIPTS, []); }
  function _saveScripts(s){ App.save(KEY_SCRIPTS, s); }

  /* ─── Tous les hooks à plat ────────────────────────────────────── */
  function _allHooks() {
    const all = [];
    Object.values(_db.hooks).forEach(arr => arr.forEach(h => {
      if (!all.includes(h)) all.push(h);
    }));
    return all;
  }

  /* ─── Hooks pour un angle donné ────────────────────────────────── */
  function _hooksForAngle(angle) {
    if (!angle) return [];
    return _db.hooks[angle] || [];
  }

  /* ═══════════════════════════════════════════════════════════════
     VUE 1 : BASE DE DONNÉES
     ═══════════════════════════════════════════════════════════════ */
  function renderDatabase() {
    _loadDB();

    const el = document.getElementById('database-container');
    if (!el) return;

    const ttStats = _getTimeTrackingStats();

    el.innerHTML = `
      <div class="so-wrap">

        <!-- Sous-section : Scripting DB (collapsible) -->
        <div class="so-block">
          <div class="section-header collapsible" data-collapse-id="db-scripting">
            <h3 class="section-title">Scripting</h3>
            <span class="collapse-chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
          <div class="collapsible-content" data-collapse-content="db-scripting">
            <div class="so-db-grid">
              ${_renderDBCard('formats', 'Formats',  'un format')}
              ${_renderDBCard('angles',  'Angles',   'un angle')}
            </div>
          </div>
        </div>

        <!-- Sous-section : Hooks par angle (collapsible) -->
        <div class="so-block">
          <div class="section-header collapsible" data-collapse-id="db-hooks">
            <h3 class="section-title">Hooks par angle</h3>
            <span class="collapse-chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
          <div class="collapsible-content" data-collapse-content="db-hooks">
            ${_renderHooksByAngle()}
          </div>
        </div>

        <!-- Sous-section : Données Time Tracking (collapsible) -->
        <div class="so-block">
          <div class="section-header collapsible" data-collapse-id="db-timetracking">
            <h3 class="section-title">Donn\u00e9es Time Tracking</h3>
            <span class="collapse-chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
          <div class="collapsible-content" data-collapse-content="db-timetracking">
            ${_renderTimeTrackingData(ttStats)}
          </div>
        </div>

      </div>`;

    _bindDatabase(el);
    _wireCollapsibles(el);
  }

  /* ─── DB Card (formats & angles) ─────────────────────────────── */
  function _renderDBCard(type, title, addLabel) {
    const items = _db[type];
    return `
      <div class="so-db-card" data-db-type="${type}">
        <div class="so-db-card-head">
          <span class="so-db-card-title">${title}</span>
          <button class="btn btn-outline btn-sm so-db-add-btn" data-type="${type}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ajouter ${addLabel}
          </button>
        </div>
        <div class="so-db-tags">
          ${items.length === 0
            ? `<span class="so-db-empty">Aucun \u00e9l\u00e9ment</span>`
            : items.map((item, i) => `
                <span class="so-tag">
                  ${escHtml(item)}
                  <button class="so-tag-del" data-type="${type}" data-idx="${i}" title="Supprimer">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>`).join('')}
        </div>
        <div class="so-db-inline" data-for="${type}" style="display:none">
          <input class="form-input so-db-input" type="text" placeholder="Nouveau ${addLabel}\u2026" data-type="${type}" />
          <button class="btn btn-primary btn-sm so-db-confirm" data-type="${type}">OK</button>
          <button class="btn btn-ghost btn-sm so-db-cancel" data-for="${type}">\u2715</button>
        </div>
      </div>`;
  }

  /* ─── Hooks groupés par angle ────────────────────────────────── */
  function _renderHooksByAngle() {
    if (_db.angles.length === 0) {
      return `<p class="empty-hint" style="font-size:.85rem">Ajoutez d'abord des angles pour pouvoir y associer des hooks.</p>`;
    }

    const sections = [];

    _db.angles.forEach(angle => {
      const hooks = _db.hooks[angle] || [];
      sections.push(_renderHookAngleSection(angle, angle, hooks));
    });

    if (_db.hooks['__general__'] && _db.hooks['__general__'].length > 0) {
      sections.push(_renderHookAngleSection('__general__', 'G\u00e9n\u00e9ral (non class\u00e9s)', _db.hooks['__general__']));
    }

    return `<div class="so-hooks-by-angle">${sections.join('')}</div>`;
  }

  function _renderHookAngleSection(angleKey, displayName, hooks) {
    return `
      <div class="so-hook-angle-section" data-angle-key="${escHtml(angleKey)}">
        <div class="so-hook-angle-head">
          <span class="so-hook-angle-name">${escHtml(displayName)}</span>
          <span class="so-hook-angle-count">${hooks.length} hook${hooks.length !== 1 ? 's' : ''}</span>
          <button class="btn btn-outline btn-sm so-hook-add-btn" data-angle="${escHtml(angleKey)}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            + Hook
          </button>
        </div>
        <div class="so-db-tags">
          ${hooks.length === 0
            ? `<span class="so-db-empty">Aucun hook</span>`
            : hooks.map((h, i) => `
                <span class="so-tag">
                  ${escHtml(h)}
                  <button class="so-hook-del" data-angle="${escHtml(angleKey)}" data-idx="${i}" title="Supprimer">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>`).join('')}
        </div>
        <div class="so-db-inline so-hook-inline" data-hook-angle="${escHtml(angleKey)}" style="display:none">
          <input class="form-input so-hook-input" type="text" placeholder="Nouveau hook\u2026" data-angle="${escHtml(angleKey)}" />
          <button class="btn btn-primary btn-sm so-hook-confirm" data-angle="${escHtml(angleKey)}">OK</button>
          <button class="btn btn-ghost btn-sm so-hook-cancel" data-angle="${escHtml(angleKey)}">\u2715</button>
        </div>
      </div>`;
  }

  /* ─── Données Time Tracking ──────────────────────────────────── */
  function _getTimeTrackingStats() {
    const tasks = App.load(App.KEYS.TASKS, []);
    const now = new Date();

    const day = now.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + offset);
    monday.setHours(0, 0, 0, 0);

    const weekTasks = tasks.filter(t => new Date(t.date + 'T00:00:00') >= monday);
    const todayTasks = tasks.filter(t => t.date === App.today());

    const byClient = {};
    weekTasks.forEach(t => {
      if (t.clientId === App.AUTRE_CLIENT_ID) return;
      const key = t.clientId || '__none__';
      if (!byClient[key]) byClient[key] = { total: 0, count: 0 };
      byClient[key].total += (t.totalDuration || 0);
      byClient[key].count++;
    });

    const totalWeek = Object.values(byClient).reduce((s, v) => s + v.total, 0);
    const totalToday = todayTasks.filter(t => t.clientId !== App.AUTRE_CLIENT_ID).reduce((s, t) => s + (t.totalDuration || 0), 0);

    return { byClient, totalWeek, totalToday, weekTaskCount: weekTasks.length, todayTaskCount: todayTasks.length };
  }

  function _renderTimeTrackingData(stats) {
    const clientRows = App.CLIENTS
      .filter(c => stats.byClient[c.id])
      .map(c => {
        const data = stats.byClient[c.id];
        const pct = stats.totalWeek > 0 ? ((data.total / stats.totalWeek) * 100).toFixed(1) : 0;
        return `
          <div class="advance-row">
            <div class="advance-client">
              <span class="advance-dot" style="background:${c.color}"></span>
              <span class="advance-name">${escHtml(c.name)}</span>
            </div>
            <div class="advance-bar-wrap">
              <div class="advance-bar-fill" style="width:${pct}%;background:${c.color}"></div>
            </div>
            <div class="advance-right">
              <span class="advance-value" style="color:${c.color}">${App.fmtDur(data.total)}</span>
              <span style="font-size:.72rem;color:var(--text-3);margin-left:6px">${data.count} t\u00e2che${data.count > 1 ? 's' : ''}</span>
            </div>
          </div>`;
      }).join('');

    return `
      <div class="so-tt-stats">
        <div class="stats-grid" style="margin-bottom:20px">
          <div class="stat-card">
            <div class="stat-icon" style="--c:#6366F1;--bg:#EEF2FF">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <div class="stat-value">${stats.totalToday > 0 ? App.fmtDur(stats.totalToday) : '0h 00min'}</div>
              <div class="stat-label">Aujourd'hui</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="--c:#10B981;--bg:#ECFDF5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <div class="stat-value">${stats.totalWeek > 0 ? App.fmtDur(stats.totalWeek) : '0h 00min'}</div>
              <div class="stat-label">Cette semaine</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="--c:#F59E0B;--bg:#FFF7ED">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <div>
              <div class="stat-value">${stats.weekTaskCount}</div>
              <div class="stat-label">T\u00e2ches cette semaine</div>
            </div>
          </div>
        </div>
        ${clientRows
          ? `<h4 style="font-size:.85rem;font-weight:600;margin-bottom:10px;color:var(--text-2)">R\u00e9partition par client (semaine)</h4>${clientRows}`
          : `<p class="empty-hint">Aucune donn\u00e9e de temps enregistr\u00e9e cette semaine.</p>`}
      </div>`;
  }

  /* ─── Bind events (Base de données) ────────────────────────────── */
  function _bindDatabase(el) {
    el.querySelectorAll('.so-db-add-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const row = el.querySelector(`.so-db-inline[data-for="${btn.dataset.type}"]`);
        if (row) { row.style.display = 'flex'; row.querySelector('input')?.focus(); }
      });
    });
    el.querySelectorAll('.so-db-confirm').forEach(btn => {
      btn.addEventListener('click', () => _confirmAddDB(el, btn.dataset.type, 'database'));
    });
    el.querySelectorAll('.so-db-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = el.querySelector(`.so-db-inline[data-for="${btn.dataset.for}"]`);
        if (row) row.style.display = 'none';
      });
    });
    el.querySelectorAll('.so-db-input').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') _confirmAddDB(el, inp.dataset.type, 'database');
      });
    });
    el.querySelectorAll('.so-tag-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _db[btn.dataset.type].splice(parseInt(btn.dataset.idx), 1);
        _saveDB();
        renderDatabase();
      });
    });

    // Hooks par angle
    el.querySelectorAll('.so-hook-add-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const row = el.querySelector(`.so-hook-inline[data-hook-angle="${btn.dataset.angle}"]`);
        if (row) { row.style.display = 'flex'; row.querySelector('input')?.focus(); }
      });
    });
    el.querySelectorAll('.so-hook-confirm').forEach(btn => {
      btn.addEventListener('click', () => _confirmAddHook(el, btn.dataset.angle));
    });
    el.querySelectorAll('.so-hook-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = el.querySelector(`.so-hook-inline[data-hook-angle="${btn.dataset.angle}"]`);
        if (row) row.style.display = 'none';
      });
    });
    el.querySelectorAll('.so-hook-input').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') _confirmAddHook(el, inp.dataset.angle);
      });
    });
    el.querySelectorAll('.so-hook-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const angle = btn.dataset.angle;
        const idx = parseInt(btn.dataset.idx);
        if (_db.hooks[angle]) {
          _db.hooks[angle].splice(idx, 1);
          if (_db.hooks[angle].length === 0) delete _db.hooks[angle];
          _saveDB();
          renderDatabase();
        }
      });
    });
  }

  function _confirmAddHook(el, angleKey) {
    const row = el.querySelector(`.so-hook-inline[data-hook-angle="${angleKey}"]`);
    const inp = row?.querySelector('input');
    const val = inp?.value.trim();
    if (!val) { inp?.focus(); return; }
    if (!_db.hooks[angleKey]) _db.hooks[angleKey] = [];
    if (_db.hooks[angleKey].includes(val)) { App.toast('D\u00e9j\u00e0 dans la liste', 'warning'); return; }
    _db.hooks[angleKey].push(val);
    _saveDB();
    renderDatabase();
  }

  /* ═══════════════════════════════════════════════════════════════
     VUE 2 : SCRIPTING (Pipeline de cartes)
     ═══════════════════════════════════════════════════════════════ */
  function renderScripting() {
    _loadDB();
    const scripts = _loadScripts();

    const el = document.getElementById('scripting-container');
    if (!el) return;

    el.innerHTML = `
      <div class="so-wrap">
        <div class="so-block so-block--orga">
          <div class="section-header">
            <h3 class="section-title">Pipeline</h3>
            <span class="so-notes-hint">Notes : <kbd class="so-notes-kbd">Ctrl</kbd>+<kbd class="so-notes-kbd">4</kbd></span>
          </div>
          ${_renderPipeline(scripts)}
        </div>
      </div>`;

    _bindScripting(el);
  }

  /* ─── Pipeline (cartes) ───────────────────────────────────────── */
  function _renderPipeline(scripts) {
    const counts = { brouillon: 0, termine: 0 };
    scripts.forEach(s => { counts[s.status || 'brouillon']++; });
    const total = scripts.length;
    const pct   = total > 0 ? Math.round((counts.termine / total) * 100) : 0;

    const statsHTML = STATUSES.map(st =>
      `<span class="so-stat-pill stat-${st.id}">
        <span class="so-stat-count">${counts[st.id]}</span> ${st.label}
      </span>`
    ).join('');

    const cardsHTML = scripts.map(s => _renderCard(s)).join('');

    return `
      <div class="so-pipeline-bar">
        <div class="so-pipeline-stats">${statsHTML}</div>
        <button class="btn btn-outline btn-sm" id="so-export-all-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exporter .md
        </button>
      </div>

      ${total > 0 ? `
        <div class="so-progress-bar">
          <div class="so-progress-fill" style="width:${pct}%"></div>
        </div>` : ''}

      <div class="so-cards-grid">
        ${cardsHTML}
        <div class="so-add-card" id="so-add-script-btn">
          <div class="so-add-card-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <span class="so-add-card-text">Nouveau script</span>
        </div>
      </div>`;
  }

  function _renderCard(script) {
    const client = App.getClient(script.clientId);
    const status = STATUSES.find(s => s.id === script.status) || STATUSES[0];
    const hasScript = !!(script.content?.trim()) || !!(script.sections && (script.sections.accroche || script.sections.corps || script.sections.cta));

    const metaTags = [];
    if (script.format) metaTags.push(script.format);
    if (script.angle)  metaTags.push(script.angle);

    return `
      <div class="so-script-card" data-script-id="${script.id}">
        <button class="so-card-del" data-script-id="${script.id}" title="Supprimer">\u00d7</button>
        <div class="so-card-top">
          <div class="so-card-client">
            <span class="so-card-client-dot" style="background:${client?.color || '#9CA3AF'}"></span>
            <span class="so-card-client-name">${escHtml(client?.name || 'Sans client')}</span>
          </div>
          <button class="so-card-status ${status.css}" data-script-id="${script.id}">
            ${status.label}
          </button>
        </div>
        <input class="so-card-title-input" value="${escHtml(script.title || '')}"
               placeholder="Titre du script\u2026" data-script-id="${script.id}" />
        ${metaTags.length > 0 ? `
          <div class="so-card-meta">
            ${metaTags.map(t => `<span class="so-card-tag">${escHtml(t)}</span>`).join('')}
          </div>` : ''}
        <div class="so-card-actions">
          <button class="so-card-btn btn-write" data-script-id="${script.id}">
            ${hasScript ? 'Modifier' : '\u00c9crire'}
          </button>
        </div>
      </div>`;
  }

  /* ─── Bind events (Scripting) ──────────────────────────────────── */
  function _bindScripting(el) {
    /* Ajouter un script */
    el.querySelector('#so-add-script-btn')?.addEventListener('click', () => {
      _addScript();
    });

    /* Cycle statut */
    el.querySelectorAll('.so-card-status[data-script-id]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _cycleStatus(btn.dataset.scriptId);
      });
    });

    /* Titre (auto-save on blur) */
    el.querySelectorAll('.so-card-title-input').forEach(inp => {
      inp.addEventListener('blur', () => {
        _updateScript(inp.dataset.scriptId, { title: inp.value.trim() });
      });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') inp.blur();
      });
    });

    /* Écrire / Modifier */
    el.querySelectorAll('.so-card-btn.btn-write').forEach(btn => {
      btn.addEventListener('click', () => {
        _openDocEditor(btn.dataset.scriptId);
      });
    });

    /* Supprimer */
    el.querySelectorAll('.so-card-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        App.confirm('Supprimer ce script ?', () => {
          _deleteScript(btn.dataset.scriptId);
        });
      });
    });

    /* Export */
    el.querySelector('#so-export-all-btn')?.addEventListener('click', _exportMd);
  }

  /* ─── Opérations DB ───────────────────────────────────────────── */
  function _confirmAddDB(el, type, view) {
    const row = el.querySelector(`.so-db-inline[data-for="${type}"]`);
    const inp = row?.querySelector('input');
    const val = inp?.value.trim();
    if (!val) { inp?.focus(); return; }
    if (_db[type].includes(val)) { App.toast('D\u00e9j\u00e0 dans la liste', 'warning'); return; }
    _db[type].push(val);
    _saveDB();
    if (view === 'database') renderDatabase();
    else renderScripting();
  }

  /* ─── Opérations Scripts ──────────────────────────────────────── */
  function _addScript() {
    const scripts = _loadScripts();
    const defaultClient = App.CLIENTS.length > 0 ? App.CLIENTS[0].id : '';

    scripts.push({
      id:       App.uid(),
      clientId: defaultClient,
      title:    '',
      format:   _db.formats.length > 0 ? _db.formats[0] : '',
      angle:    '',
      hook:     '',
      content:  '',
      status:   'brouillon',
      created:  App.today(),
    });
    _saveScripts(scripts);
    renderScripting();

    setTimeout(() => {
      const inputs = document.querySelectorAll('.so-card-title-input');
      if (inputs.length > 0) inputs[inputs.length - 1].focus();
    }, 100);
  }

  function _updateScript(id, updates) {
    const scripts = _loadScripts();
    const s = scripts.find(s => s.id === id);
    if (!s) return;
    Object.assign(s, updates);
    _saveScripts(scripts);
  }

  function _deleteScript(id) {
    let scripts = _loadScripts();
    scripts = scripts.filter(s => s.id !== id);
    _saveScripts(scripts);
    renderScripting();
  }

  function _cycleStatus(id) {
    const scripts = _loadScripts();
    const s = scripts.find(s => s.id === id);
    if (!s) return;

    const order = ['brouillon', 'termine'];
    const idx = order.indexOf(s.status || 'brouillon');
    s.status = order[(idx + 1) % order.length];
    _saveScripts(scripts);
    renderScripting();
  }

  /* ─── Éditeur document plein écran ───────────────────────────── */
  function _openDocEditor(scriptId) {
    const scripts = _loadScripts();
    const script  = scripts.find(s => s.id === scriptId);
    if (!script) return;

    _editingId = scriptId;

    const container = document.getElementById('scripting-container');
    if (!container) return;

    // Sauvegarder le contenu des cartes pour pouvoir revenir
    _savedCardsHTML = container.innerHTML;

    const clients = App.CLIENTS || [];
    const formats = _db.formats || [];
    const angles  = _db.angles  || [];
    const hooks   = script.angle ? _hooksForAngle(script.angle) : _allHooks();

    container.innerHTML = `
      <div class="so-doc-wrap">

        <!-- Barre de navigation haut -->
        <div class="so-doc-topbar">
          <button class="so-doc-back" id="so-doc-back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Retour
          </button>

          <input class="so-doc-title-input" id="so-doc-title"
                 value="${escHtml(script.title || '')}"
                 placeholder="Titre du script…" />

          <span class="so-doc-save-status" id="so-doc-save-status"></span>
        </div>

        <!-- Barre de métadonnées -->
        <div class="so-doc-metabar">
          <div class="so-doc-meta-field">
            <label class="so-doc-meta-label">Format</label>
            <select class="so-doc-select" id="so-doc-format">
              <option value="">—</option>
              ${formats.map(f => `<option value="${escHtml(f)}" ${script.format === f ? 'selected' : ''}>${escHtml(f)}</option>`).join('')}
            </select>
          </div>
          <div class="so-doc-meta-field">
            <label class="so-doc-meta-label">Angle</label>
            <select class="so-doc-select" id="so-doc-angle">
              <option value="">—</option>
              ${angles.map(a => `<option value="${escHtml(a)}" ${script.angle === a ? 'selected' : ''}>${escHtml(a)}</option>`).join('')}
            </select>
          </div>
          <div class="so-doc-meta-field">
            <label class="so-doc-meta-label">Hook</label>
            <select class="so-doc-select so-doc-select--hook" id="so-doc-hook">
              <option value="">—</option>
              ${hooks.map(h => `<option value="${escHtml(h)}" ${script.hook === h ? 'selected' : ''}>${escHtml(h)}</option>`).join('')}
            </select>
          </div>
          <div class="so-doc-meta-field">
            <label class="so-doc-meta-label">Client</label>
            <select class="so-doc-select" id="so-doc-client">
              <option value="">—</option>
              ${clients.map(c => `<option value="${c.id}" ${script.clientId === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Zone document -->
        <div class="so-doc-area">
          <div class="so-doc-page">
            <textarea class="so-doc-ta" id="so-doc-ta"
              placeholder="Écrire le script ici…">${escHtml(script.content || '')}</textarea>
          </div>
        </div>

      </div>`;

    // Auto-resize initial
    setTimeout(() => {
      const ta = document.getElementById('so-doc-ta');
      if (ta) { _docAutoResize(ta); ta.focus(); }
    }, 50);

    _bindDocEditor();
  }

  function _bindDocEditor() {
    const ta     = document.getElementById('so-doc-ta');
    const title  = document.getElementById('so-doc-title');
    const back   = document.getElementById('so-doc-back-btn');
    const fmtSel = document.getElementById('so-doc-format');
    const angSel = document.getElementById('so-doc-angle');

    // Auto-resize textarea
    ta?.addEventListener('input', () => {
      _docAutoResize(ta);
      _docDebounceSave();
    });

    // Title auto-save
    title?.addEventListener('input', _docDebounceSave);
    title?.addEventListener('blur',  _docSaveNow);

    // Meta fields
    document.getElementById('so-doc-format')?.addEventListener('change', _docDebounceSave);
    document.getElementById('so-doc-client')?.addEventListener('change', _docDebounceSave);

    // Angle change → reload hooks
    angSel?.addEventListener('change', () => {
      const hooks = angSel.value ? _hooksForAngle(angSel.value) : _allHooks();
      const hookSel = document.getElementById('so-doc-hook');
      if (hookSel) {
        const cur = hookSel.value;
        hookSel.innerHTML = '<option value="">—</option>' +
          hooks.map(h => `<option value="${escHtml(h)}" ${cur === h ? 'selected' : ''}>${escHtml(h)}</option>`).join('');
      }
      _docDebounceSave();
    });

    document.getElementById('so-doc-hook')?.addEventListener('change', _docDebounceSave);

    // Retour
    back?.addEventListener('click', () => {
      _docSaveNow();
      document.removeEventListener('keydown', _docCtrlS);
      _editingId    = null;
      _savedCardsHTML = null;
      clearTimeout(_autoSaveTimer);
      renderScripting();
    });

    // Ctrl+S pour forcer la sauvegarde
    document.addEventListener('keydown', _docCtrlS);
  }

  function _docCtrlS(e) {
    if (e.ctrlKey && e.key === 's' && _editingId) {
      e.preventDefault();
      _docSaveNow();
    }
  }

  function _docAutoResize(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.max(ta.scrollHeight, 500) + 'px';
  }

  function _docDebounceSave() {
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(_docSaveNow, 600);
  }

  function _docSaveNow() {
    if (!_editingId) return;
    clearTimeout(_autoSaveTimer);

    const scripts = _loadScripts();
    const s = scripts.find(x => x.id === _editingId);
    if (!s) return;

    const ta     = document.getElementById('so-doc-ta');
    const title  = document.getElementById('so-doc-title');
    const format = document.getElementById('so-doc-format');
    const angle  = document.getElementById('so-doc-angle');
    const hook   = document.getElementById('so-doc-hook');
    const client = document.getElementById('so-doc-client');

    if (ta)     s.content  = ta.value;
    if (title)  s.title    = title.value;
    if (format) s.format   = format.value;
    if (angle)  s.angle    = angle.value;
    if (hook)   s.hook     = hook.value;
    if (client) s.clientId = client.value;

    _saveScripts(scripts);

    const statusEl = document.getElementById('so-doc-save-status');
    if (statusEl) {
      statusEl.textContent = '✓ Sauvegardé';
      statusEl.className   = 'so-doc-save-status so-doc-save-status--ok';
      setTimeout(() => {
        if (statusEl) { statusEl.textContent = ''; statusEl.className = 'so-doc-save-status'; }
      }, 1800);
    }
  }


  /* ─── Notes ───────────────────────────────────────────────────── */
  function _openNotesModal() {
    let modal = document.getElementById('so-notes-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.id        = 'so-notes-modal';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal so-notes-modal-box">
          <div class="modal-head">
            <h3 style="display:flex;align-items:center;gap:8px">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Notes rapides
              <kbd class="so-notes-kbd">Ctrl+4</kbd>
            </h3>
            <button class="modal-close-btn" id="so-notes-close-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="modal-body" style="padding:16px 24px;display:flex;flex-direction:column;flex:1;overflow:hidden">
            <textarea id="so-notes-ta" class="so-notes-ta"
              placeholder="Tes notes ici\u2026 id\u00e9es, rappels, r\u00e9f\u00e9rences\u2026"></textarea>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost" id="so-notes-cancel-btn">Fermer</button>
            <button class="btn btn-primary" id="so-notes-save-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Sauvegarder
            </button>
          </div>
        </div>`;
      document.body.appendChild(modal);

      modal.querySelector('#so-notes-save-btn').addEventListener('click', () => {
        App.save(KEY_NOTES, modal.querySelector('#so-notes-ta').value);
        App.closeModal('so-notes-modal');
        App.toast('Notes sauvegard\u00e9es', 'success');
      });
      modal.querySelector('#so-notes-cancel-btn').addEventListener('click', () => {
        App.closeModal('so-notes-modal');
      });
      modal.querySelector('#so-notes-close-btn').addEventListener('click', () => {
        App.closeModal('so-notes-modal');
      });
      modal.addEventListener('click', e => {
        if (e.target === modal) App.closeModal('so-notes-modal');
      });
      modal.querySelector('#so-notes-ta').addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 's') {
          e.preventDefault();
          App.save(KEY_NOTES, e.target.value);
          App.toast('Notes sauvegard\u00e9es', 'success');
        }
      });
    }

    const saved = App.load(KEY_NOTES, '');
    modal.querySelector('#so-notes-ta').value = saved;

    App.openModal('so-notes-modal');
    setTimeout(() => {
      const ta = modal.querySelector('#so-notes-ta');
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 150);
  }

  /* ─── Export .md ──────────────────────────────────────────────── */
  function _exportMd() {
    const scripts = _loadScripts();
    if (scripts.length === 0) {
      App.toast('Aucun script \u00e0 exporter', 'warning');
      return;
    }

    const date = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    let md = `# Scripts\n*G\u00e9n\u00e9r\u00e9 le ${date}*\n\n---\n\n`;

    const byClient = {};
    scripts.forEach(s => {
      const name = App.getClient(s.clientId)?.name || 'Sans client';
      if (!byClient[name]) byClient[name] = [];
      byClient[name].push(s);
    });

    Object.entries(byClient).forEach(([clientName, clientScripts]) => {
      md += `## ${clientName}\n\n`;
      clientScripts.forEach((s, i) => {
        const statusLabel = STATUSES.find(st => st.id === s.status)?.label || 'Brouillon';
        md += `### ${s.title || `Script ${i + 1}`} [${statusLabel}]\n\n`;
        if (s.format) md += `**Format :** ${s.format}  \n`;
        if (s.angle)  md += `**Angle :** ${s.angle}  \n`;
        if (s.hook)   md += `**Hook :** ${s.hook}  \n`;
        md += '\n';
        md += s.content?.trim()
          ? s.content.trim() + '\n'
          : '*Script non r\u00e9dig\u00e9*\n';
        md += '\n---\n\n';
      });
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `scripts-${App.today()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    App.toast('Export .md t\u00e9l\u00e9charg\u00e9 !', 'success');
  }

  /* ─── Collapsibles ────────────────────────────────────────────── */
  function _wireCollapsibles(el) {
    const collapsed = App.load('th_collapsed_sections', []);
    el.querySelectorAll('.section-header.collapsible').forEach(header => {
      const id = header.dataset.collapseId;
      const content = el.querySelector(`[data-collapse-content="${id}"]`);
      if (!content) return;

      if (collapsed.includes(id)) {
        header.classList.add('collapsed');
        content.classList.add('collapsed');
      }

      header.addEventListener('click', () => {
        const isCollapsed = header.classList.toggle('collapsed');
        content.classList.toggle('collapsed', isCollapsed);

        const stored = App.load('th_collapsed_sections', []);
        if (isCollapsed) {
          if (!stored.includes(id)) stored.push(id);
        } else {
          const i = stored.indexOf(id);
          if (i >= 0) stored.splice(i, 1);
        }
        App.save('th_collapsed_sections', stored);
      });
    });
  }

  /* ─── Init ───────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    // so-save-script-btn kept for legacy modal use

    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === '4') {
        const active = document.activeElement;
        const inInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
        if (!inInput) {
          e.preventDefault();
          _openNotesModal();
        }
      }
    });
  });

  /* ─── Ancien renderView pour compatibilité ─────────────────── */
  function renderView() { renderScripting(); }

  return { renderView, renderDatabase, renderScripting };
})();
