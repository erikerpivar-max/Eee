/* ================================================================
   THE HOUSE — scriptorga.js
   Sections : Base de données (formats, angles, hooks par angle,
              données time tracking) + Scripting (organisateur)
   ================================================================ */

'use strict';

window.ScriptOrga = (() => {

  const KEY_DB    = 'so_database';
  const KEY_PLAN  = 'so_plan';
  const KEY_NOTES = 'so_notes';

  let _db              = null;
  let _plan            = null;
  let _editingRow      = null; // { gid, rid }
  let _dragGid         = null; // id du groupe en cours de drag
  let _anglePopupTimer = null;

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
      // Mettre les anciens hooks dans un angle "Général" si pas d'angles
      if (old.length > 0) {
        _db.hooks['__general__'] = old;
      }
      _saveDB();
    }
  }
  function _saveDB()   { App.save(KEY_DB,   _db);   }
  function _savePlan() { App.save(KEY_PLAN, _plan); }

  /* ─── Tous les hooks à plat (pour export, etc.) ────────────────── */
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

    // Time tracking stats
    const ttStats = _getTimeTrackingStats();

    el.innerHTML = `
      <div class="so-wrap">

        <!-- Sous-section : Scripting DB -->
        <div class="so-block">
          <div class="section-header">
            <h3 class="section-title">Scripting</h3>
          </div>
          <div class="so-db-grid">
            ${_renderDBCard('formats', 'Formats',  'un format')}
            ${_renderDBCard('angles',  'Angles',   'un angle')}
          </div>
        </div>

        <!-- Sous-section : Hooks par angle -->
        <div class="so-block">
          <div class="section-header">
            <h3 class="section-title">Hooks par angle</h3>
          </div>
          ${_renderHooksByAngle()}
        </div>

        <!-- Sous-section : Données Time Tracking -->
        <div class="so-block">
          <div class="section-header">
            <h3 class="section-title">Données Time Tracking</h3>
          </div>
          ${_renderTimeTrackingData(ttStats)}
        </div>

      </div>`;

    _bindDatabase(el);
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
            ? `<span class="so-db-empty">Aucun élément</span>`
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
          <input class="form-input so-db-input" type="text" placeholder="Nouveau ${addLabel}…" data-type="${type}" />
          <button class="btn btn-primary btn-sm so-db-confirm" data-type="${type}">OK</button>
          <button class="btn btn-ghost btn-sm so-db-cancel" data-for="${type}">✕</button>
        </div>
      </div>`;
  }

  /* ─── Hooks groupés par angle ────────────────────────────────── */
  function _renderHooksByAngle() {
    if (_db.angles.length === 0) {
      return `<p class="empty-hint" style="font-size:.85rem">Ajoutez d'abord des angles pour pouvoir y associer des hooks.</p>`;
    }

    // Inclure aussi __general__ s'il existe
    const sections = [];

    _db.angles.forEach(angle => {
      const hooks = _db.hooks[angle] || [];
      sections.push(_renderHookAngleSection(angle, angle, hooks));
    });

    // Hooks généraux (migrés depuis l'ancien format)
    if (_db.hooks['__general__'] && _db.hooks['__general__'].length > 0) {
      sections.push(_renderHookAngleSection('__general__', 'Général (non classés)', _db.hooks['__general__']));
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
          <input class="form-input so-hook-input" type="text" placeholder="Nouveau hook…" data-angle="${escHtml(angleKey)}" />
          <button class="btn btn-primary btn-sm so-hook-confirm" data-angle="${escHtml(angleKey)}">OK</button>
          <button class="btn btn-ghost btn-sm so-hook-cancel" data-angle="${escHtml(angleKey)}">✕</button>
        </div>
      </div>`;
  }

  /* ─── Données Time Tracking ──────────────────────────────────── */
  function _getTimeTrackingStats() {
    const tasks = App.load(App.KEYS.TASKS, []);
    const now = new Date();

    // Cette semaine
    const day = now.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + offset);
    monday.setHours(0, 0, 0, 0);

    const weekTasks = tasks.filter(t => new Date(t.date + 'T00:00:00') >= monday);
    const todayTasks = tasks.filter(t => t.date === App.today());

    // Par client cette semaine
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

    return { byClient, totalWeek, totalToday, weekTaskCount: weekTasks.length, todayTaskCount: todayTasks.length, allTasks: tasks };
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
              <span style="font-size:.72rem;color:var(--text-3);margin-left:6px">${data.count} tâche${data.count > 1 ? 's' : ''}</span>
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
              <div class="stat-label">Tâches cette semaine</div>
            </div>
          </div>
        </div>
        ${clientRows
          ? `<h4 style="font-size:.85rem;font-weight:600;margin-bottom:10px;color:var(--text-2)">Répartition par client (semaine)</h4>${clientRows}`
          : `<p class="empty-hint">Aucune donnée de temps enregistrée cette semaine.</p>`}
      </div>`;
  }

  /* ─── Bind events (Base de données) ────────────────────────────── */
  function _bindDatabase(el) {
    // Formats & Angles — add
    el.querySelectorAll('.so-db-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
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
      btn.addEventListener('click', () => {
        _db[btn.dataset.type].splice(parseInt(btn.dataset.idx), 1);
        _saveDB();
        renderDatabase();
      });
    });

    // Hooks par angle — add
    el.querySelectorAll('.so-hook-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
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
      btn.addEventListener('click', () => {
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
    if (_db.hooks[angleKey].includes(val)) { App.toast('Déjà dans la liste', 'warning'); return; }
    _db.hooks[angleKey].push(val);
    _saveDB();
    renderDatabase();
  }

  /* ═══════════════════════════════════════════════════════════════
     VUE 2 : SCRIPTING (Organisateur)
     ═══════════════════════════════════════════════════════════════ */
  function renderScripting() {
    _loadDB();
    _plan = App.load(KEY_PLAN, { clientId: null, groups: [] });

    const el = document.getElementById('scripting-container');
    if (!el) return;

    el.innerHTML = `
      <div class="so-wrap">
        <div class="so-block so-block--orga">
          <div class="section-header">
            <h3 class="section-title">Organisateur</h3>
            <span class="so-notes-hint">Notes : <kbd class="so-notes-kbd">Ctrl</kbd>+<kbd class="so-notes-kbd">4</kbd></span>
          </div>
          <div id="so-orga">${_renderOrga()}</div>
        </div>
      </div>`;

    _bindScripting(el);
  }

  /* ─── Organisateur ────────────────────────────────────────────── */
  function _renderOrga() {
    return `
      <div class="so-orga-bar">
        <select class="form-select so-client-sel" id="so-client-sel">
          <option value="">— Choisir un client —</option>
          ${App.CLIENTS.map(c => `
            <option value="${c.id}" ${_plan.clientId === c.id ? 'selected' : ''}>
              ${escHtml(c.name)}
            </option>`).join('')}
        </select>
        <button class="btn btn-primary" id="so-start-btn">Commencer</button>
      </div>
      <div id="so-plan-area">${_plan.clientId ? _renderPlan() : ''}</div>`;
  }

  /* ─── Plan ─────────────────────────────────────────────────────── */
  function _renderPlan() {
    if (_plan.groups.length === 0) {
      return `
        <div class="so-picker-box" id="so-init-picker">
          <p class="so-picker-lbl">Choisir un format pour commencer :</p>
          ${_renderFormatPills()}
        </div>`;
    }
    const client = App.getClient(_plan.clientId);

    // Compteur de scripts
    const totalRows   = _plan.groups.reduce((s, g) => s + g.rows.length, 0);
    const doneScripts = _plan.groups.reduce((s, g) => s + g.rows.filter(r => r.script && r.script.trim()).length, 0);
    const allDone     = doneScripts === totalRows && totalRows > 0;

    return `
      <div class="so-plan">
        <div class="so-plan-bar">
          <div class="so-plan-client">
            <span class="so-plan-dot" style="background:${client?.color || '#999'}"></span>
            <span>${escHtml(client?.name || 'Client')}</span>
          </div>
          <div class="so-plan-actions">
            <button class="btn btn-outline btn-sm" id="so-export-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Exporter .md
            </button>
            <button class="btn btn-danger-outline btn-sm" id="so-reset-btn">Nouveau plan</button>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="data-table so-table">
            <thead>
              <tr>
                <th style="width:28px"></th>
                <th style="width:150px">Format</th>
                <th>Angle</th>
                <th>Hook</th>
                <th style="width:120px">Script</th>
                <th style="width:36px"></th>
              </tr>
            </thead>
            <tbody id="so-tbody">${_renderTableBody()}</tbody>
          </table>
        </div>

        <!-- Format picker inline (caché par défaut) -->
        ${allDone
          ? `<div class="so-extra-picker" id="so-extra-picker" style="display:none">
               <p class="so-picker-lbl">Choisir un format :</p>
               ${_renderFormatPills('extra')}
             </div>`
          : `<div class="so-format-locked" id="so-extra-picker">
               <p class="so-locked-msg">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px">
                   <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                 </svg>
                 Terminez tous les scripts du format en cours avant d'en ajouter un nouveau.
               </p>
             </div>`}

        <!-- Compteur de scripts -->
        <div class="so-counter">
          <svg class="so-counter-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span class="so-counter-label">Scripts rédigés :</span>
          <span class="so-counter-val ${allDone ? 'so-counter-val--done' : ''}">${doneScripts} / ${totalRows}</span>
          ${allDone
            ? `<span class="so-counter-badge">✓ Tous complétés !</span>`
            : ''}
        </div>
      </div>`;
  }

  /* ─── Table body ──────────────────────────────────────────────── */
  function _renderTableBody() {
    return _plan.groups.map(g => _renderGroup(g)).join('');
  }

  /* ─── Groupe (format + lignes) ────────────────────────────────── */
  function _renderGroup(group) {
    // Vérifier si tous les scripts du groupe sont faits
    const groupDone = group.rows.every(r => r.script && r.script.trim());

    let html = group.rows.map((row, i) => {
      const done = !!(row.script && row.script.trim());
      const angleHooks = _hooksForAngle(row.angle);
      return `
        <tr class="so-row" data-gid="${group.id}" data-rid="${row.id}" data-rowidx="${i}">
          <td class="so-drag-cell" ${i === 0 ? `draggable="true" data-drag-gid="${group.id}"` : ''}>
            ${i === 0 ? `
              <svg class="so-drag-handle" width="12" height="12" viewBox="0 0 24 24" fill="none">
                <circle cx="9"  cy="6"  r="1.5" fill="currentColor"/>
                <circle cx="15" cy="6"  r="1.5" fill="currentColor"/>
                <circle cx="9"  cy="12" r="1.5" fill="currentColor"/>
                <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
                <circle cx="9"  cy="18" r="1.5" fill="currentColor"/>
                <circle cx="15" cy="18" r="1.5" fill="currentColor"/>
              </svg>` : ''}
          </td>
          <td class="so-fmt-cell">
            ${i === 0
              ? `<span class="so-fmt-badge">${escHtml(group.format)}</span>`
              : `<span class="so-fmt-bar"></span>`}
          </td>
          <td class="so-sel-cell">
            <select class="form-select so-sel-angle" data-gid="${group.id}" data-rid="${row.id}" data-rowidx="${i}">
              <option value="">— Angle —</option>
              ${_db.angles.map(a => `<option value="${escHtml(a)}" ${row.angle === a ? 'selected' : ''}>${escHtml(a)}</option>`).join('')}
            </select>
          </td>
          <td class="so-sel-cell">
            <select class="form-select so-sel-hook" data-gid="${group.id}" data-rid="${row.id}" ${!row.angle ? 'disabled' : ''}>
              <option value="">${row.angle ? '— Hook —' : '— Choisir un angle d\'abord —'}</option>
              ${angleHooks.map(h => `<option value="${escHtml(h)}" ${row.hook === h ? 'selected' : ''}>${escHtml(h)}</option>`).join('')}
            </select>
          </td>
          <td style="padding:8px 12px">
            <button class="btn ${done ? 'btn-primary' : 'btn-outline'} btn-sm so-script-btn"
                    data-gid="${group.id}" data-rid="${row.id}">
              ${done ? '✎ Modifier' : '+ Écrire'}
            </button>
          </td>
          <td style="padding:8px;text-align:center">
            <button class="so-row-del" data-gid="${group.id}" data-rid="${row.id}" title="Supprimer">×</button>
          </td>
        </tr>`;
    }).join('');

    /* Ligne drop-target entre groupes */
    html += `
      <tr class="so-group-drop-row" data-drop-gid="${group.id}">
        <td colspan="6" class="so-group-drop-cell"></td>
      </tr>`;

    /* Ligne footer du groupe */
    html += `
      <tr class="so-group-foot">
        <td colspan="6">
          <button class="btn btn-ghost btn-sm so-add-row" data-gid="${group.id}">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            +
          </button>
          <button class="btn btn-ghost btn-sm so-add-fmt-btn" ${!groupDone ? 'disabled title="Finissez les scripts de ce format d\'abord"' : ''}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ajouter format
          </button>
        </td>
      </tr>`;
    return html;
  }

  function _renderFormatPills(suffix) {
    if (_db.formats.length === 0) {
      return `<p class="empty-hint" style="font-size:.85rem;margin:0">
        Aucun format dans la base de données. Ajoutez-en d'abord dans Base de données.
      </p>`;
    }
    const attr = suffix ? `data-src="${suffix}"` : '';
    return `<div class="so-pills">
      ${_db.formats.map(f => `
        <button class="so-pill" data-format="${escHtml(f)}" ${attr}>${escHtml(f)}</button>
      `).join('')}
    </div>`;
  }

  /* ─── Bind events (Scripting) ──────────────────────────────────── */
  function _bindScripting(el) {
    el.querySelector('#so-start-btn')?.addEventListener('click', () => {
      const sel = el.querySelector('#so-client-sel');
      if (!sel?.value) { App.toast('Choisissez un client', 'warning'); return; }
      if (_plan.clientId !== sel.value) {
        _plan = { clientId: sel.value, groups: [] };
        _savePlan();
      }
      _rerenderPlan(el);
    });

    _bindPlan(el);
  }

  function _bindPlan(el) {
    el.querySelectorAll('#so-init-picker .so-pill').forEach(pill => {
      pill.addEventListener('click', () => _addGroup(el, pill.dataset.format));
    });

    el.querySelector('#so-export-btn')?.addEventListener('click', _exportMd);

    el.querySelector('#so-reset-btn')?.addEventListener('click', () => {
      App.confirm('Effacer le plan en cours ?', () => {
        _plan = { clientId: null, groups: [] };
        _savePlan();
        renderScripting();
      });
    });

    el.querySelectorAll('.so-add-fmt-btn').forEach(btn => {
      if (btn.disabled) return;
      btn.addEventListener('click', () => {
        // Vérifier que tous les scripts sont écrits
        const allScriptsDone = _plan.groups.every(g =>
          g.rows.every(r => r.script && r.script.trim())
        );
        if (!allScriptsDone) {
          App.toast('Terminez tous les scripts avant d\'ajouter un nouveau format', 'warning');
          return;
        }
        const picker = el.querySelector('#so-extra-picker');
        if (!picker) return;
        const isOpen = picker.style.display !== 'none';
        picker.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) {
          picker.querySelectorAll('.so-pill').forEach(pill => {
            pill.onclick = () => {
              picker.style.display = 'none';
              _addGroup(el, pill.dataset.format);
            };
          });
        }
      });
    });

    el.querySelectorAll('.so-add-row').forEach(btn => {
      btn.addEventListener('click', () => _addRow(el, btn.dataset.gid));
    });

    el.querySelectorAll('.so-row-del').forEach(btn => {
      btn.addEventListener('click', () => _deleteRow(el, btn.dataset.gid, btn.dataset.rid));
    });

    /* Angle — popup sur la 1ère ligne seulement + rafraîchir les hooks */
    el.querySelectorAll('.so-sel-angle').forEach(sel => {
      sel.addEventListener('change', () => {
        const rowIdx = parseInt(sel.dataset.rowidx);
        const row    = _findRow(sel.dataset.gid, sel.dataset.rid);
        if (row) {
          row.angle = sel.value;
          // Réinitialiser le hook quand l'angle change (puisque les hooks dépendent de l'angle)
          row.hook = '';
          _savePlan();
          if (rowIdx === 0 && sel.value) {
            _showAngleApplyPopup(el, sel, sel.dataset.gid, sel.value);
          }
          _rerenderPlan(el);
        }
      });
    });

    el.querySelectorAll('.so-sel-hook').forEach(sel => {
      sel.addEventListener('change', () => {
        const row = _findRow(sel.dataset.gid, sel.dataset.rid);
        if (row) { row.hook = sel.value; _savePlan(); }
      });
    });

    el.querySelectorAll('.so-script-btn').forEach(btn => {
      btn.addEventListener('click', () => _openScriptModal(btn.dataset.gid, btn.dataset.rid));
    });

    /* Drag & drop de groupes entiers */
    _bindGroupDragDrop(el);
  }

  /* ─── Drag & Drop — groupes entiers ──────────────────────────── */
  function _bindGroupDragDrop(el) {
    el.querySelectorAll('[data-drag-gid]').forEach(handle => {
      handle.addEventListener('dragstart', e => {
        _dragGid = handle.dataset.dragGid;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', _dragGid);
        el.querySelectorAll(`[data-gid="${_dragGid}"]`).forEach(tr => {
          tr.classList.add('so-group--dragging');
        });
      });
      handle.addEventListener('dragend', () => {
        el.querySelectorAll('.so-group--dragging').forEach(tr => tr.classList.remove('so-group--dragging'));
        el.querySelectorAll('.so-group-drop-cell--over').forEach(td => td.classList.remove('so-group-drop-cell--over'));
        _dragGid = null;
      });
    });

    el.querySelectorAll('.so-group-drop-row').forEach(dropRow => {
      const cell = dropRow.querySelector('.so-group-drop-cell');
      dropRow.addEventListener('dragover', e => {
        if (!_dragGid) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.querySelectorAll('.so-group-drop-cell--over').forEach(td => td.classList.remove('so-group-drop-cell--over'));
        cell.classList.add('so-group-drop-cell--over');
      });
      dropRow.addEventListener('dragleave', e => {
        if (!dropRow.contains(e.relatedTarget)) cell.classList.remove('so-group-drop-cell--over');
      });
      dropRow.addEventListener('drop', e => {
        e.preventDefault();
        if (!_dragGid) return;
        cell.classList.remove('so-group-drop-cell--over');
        const targetGid = dropRow.dataset.dropGid;
        if (_dragGid === targetGid) return;
        const srcIdx = _plan.groups.findIndex(g => g.id === _dragGid);
        const dstIdx = _plan.groups.findIndex(g => g.id === targetGid);
        if (srcIdx === -1 || dstIdx === -1) return;
        const [moved] = _plan.groups.splice(srcIdx, 1);
        const newDst  = _plan.groups.findIndex(g => g.id === targetGid);
        _plan.groups.splice(newDst + 1, 0, moved);
        _savePlan();
        _rerenderPlan(el);
      });
    });

    const tbody = el.querySelector('#so-tbody');
    if (tbody && _plan.groups.length > 0) {
      tbody.addEventListener('dragover', e => {
        if (!_dragGid) return;
        const firstRow = tbody.querySelector('.so-row');
        if (!firstRow) return;
        const rect = firstRow.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          e.preventDefault();
          el.querySelectorAll('.so-group-drop-cell--over').forEach(td => td.classList.remove('so-group-drop-cell--over'));
        }
      });
    }
  }

  /* ─── Popup "Appliquer l'angle aux autres lignes" ─────────────── */
  function _showAngleApplyPopup(el, selectEl, gid, angle) {
    document.querySelector('.so-angle-popup')?.remove();
    clearTimeout(_anglePopupTimer);

    const group = _plan.groups.find(g => g.id === gid);
    if (!group || group.rows.length <= 1) return;

    const otherCount = group.rows.length - 1;
    const popup = document.createElement('div');
    popup.className = 'so-angle-popup';
    popup.innerHTML = `
      <span class="so-angle-popup-text">Appliquer aux ${otherCount} autre${otherCount > 1 ? 's' : ''} ?</span>
      <button class="so-angle-popup-btn">Oui</button>
    `;

    const rect = selectEl.getBoundingClientRect();
    popup.style.cssText = `position:fixed;top:${rect.bottom + 6}px;left:${rect.left}px;z-index:1500;`;
    document.body.appendChild(popup);

    requestAnimationFrame(() => popup.classList.add('so-angle-popup--visible'));

    let applied = false;

    popup.querySelector('.so-angle-popup-btn').addEventListener('click', () => {
      applied = true;
      clearTimeout(_anglePopupTimer);
      group.rows.forEach((row, i) => {
        if (i !== 0) { row.angle = angle; row.hook = ''; }
      });
      _savePlan();
      popup.classList.remove('so-angle-popup--visible');
      setTimeout(() => popup.remove(), 200);
      _rerenderPlan(el);
      App.toast('Angle appliqué à toutes les lignes', 'success');
    });

    _anglePopupTimer = setTimeout(() => {
      if (!applied) {
        popup.classList.remove('so-angle-popup--visible');
        setTimeout(() => popup.remove(), 200);
      }
    }, 1500);
  }

  /* ─── Opérations DB ───────────────────────────────────────────── */
  function _confirmAddDB(el, type, view) {
    const row = el.querySelector(`.so-db-inline[data-for="${type}"]`);
    const inp = row?.querySelector('input');
    const val = inp?.value.trim();
    if (!val) { inp?.focus(); return; }
    if (_db[type].includes(val)) { App.toast('Déjà dans la liste', 'warning'); return; }
    _db[type].push(val);
    _saveDB();
    if (view === 'database') renderDatabase();
    else renderScripting();
  }

  /* ─── Opérations Plan ─────────────────────────────────────────── */
  function _addGroup(el, format) {
    _plan.groups.push({
      id:   App.uid(),
      format,
      rows: [
        { id: App.uid(), angle: '', hook: '', script: '' },
        { id: App.uid(), angle: '', hook: '', script: '' },
        { id: App.uid(), angle: '', hook: '', script: '' },
        { id: App.uid(), angle: '', hook: '', script: '' },
        { id: App.uid(), angle: '', hook: '', script: '' },
      ],
    });
    _savePlan();
    _rerenderPlan(el);
  }

  function _addRow(el, gid) {
    const g = _plan.groups.find(g => g.id === gid);
    if (!g) return;
    g.rows.push({ id: App.uid(), angle: '', hook: '', script: '' });
    _savePlan();
    _rerenderPlan(el);
  }

  function _deleteRow(el, gid, rid) {
    const g = _plan.groups.find(g => g.id === gid);
    if (!g) return;
    if (g.rows.length <= 1) {
      App.confirm('Supprimer ce format et ses lignes ?', () => {
        _plan.groups = _plan.groups.filter(x => x.id !== gid);
        _savePlan();
        _rerenderPlan(el);
      });
    } else {
      g.rows = g.rows.filter(r => r.id !== rid);
      _savePlan();
      _rerenderPlan(el);
    }
  }

  function _findRow(gid, rid) {
    return _plan.groups.find(g => g.id === gid)?.rows.find(r => r.id === rid);
  }

  function _rerenderPlan(el) {
    const area = el.querySelector('#so-plan-area');
    if (!area) return;
    area.innerHTML = _plan.clientId ? _renderPlan() : '';
    _bindPlan(el);
  }

  /* ─── Modal Script ────────────────────────────────────────────── */
  function _openScriptModal(gid, rid) {
    const group = _plan.groups.find(g => g.id === gid);
    const row   = group?.rows.find(r => r.id === rid);
    if (!row) return;

    _editingRow = { gid, rid };

    document.getElementById('so-modal-format').textContent = group.format;
    document.getElementById('so-modal-angle').textContent  = row.angle || '—';

    const ta = document.getElementById('so-script-ta');
    if (row.script) {
      ta.value = row.script;
    } else if (row.hook) {
      ta.value = row.hook + '\n\n';
    } else {
      ta.value = '';
    }

    App.openModal('so-script-modal');
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 150);
  }

  function _saveScript() {
    if (!_editingRow) return;
    const row = _findRow(_editingRow.gid, _editingRow.rid);
    if (row) {
      row.script = document.getElementById('so-script-ta').value;
      _savePlan();
    }
    App.closeModal('so-script-modal');
    _editingRow = null;
    const el = document.getElementById('scripting-container');
    if (el) _rerenderPlan(el);
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
              placeholder="Tes notes ici… idées, rappels, références…"></textarea>
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
        App.toast('Notes sauvegardées', 'success');
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
          App.toast('Notes sauvegardées', 'success');
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
    if (!_plan.clientId || !_plan.groups.length) {
      App.toast('Aucun contenu à exporter', 'warning');
      return;
    }
    const clientName = App.getClient(_plan.clientId)?.name || 'Client';
    const date = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    let md = `# Scripts — ${clientName}\n*Généré le ${date}*\n\n---\n\n`;

    _plan.groups.forEach(g => {
      md += `## Format : ${g.format}\n\n`;
      g.rows.forEach((row, i) => {
        md += `### Vidéo ${i + 1}\n\n`;
        if (row.angle) md += `**Angle :** ${row.angle}  \n`;
        if (row.hook)  md += `**Hook :** ${row.hook}  \n`;
        md += '\n';
        md += row.script && row.script.trim() ? row.script.trim() + '\n' : '*Script non rédigé*\n';
        md += '\n---\n\n';
      });
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `scripts-${clientName.toLowerCase().replace(/\s+/g, '-')}-${App.today()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    App.toast('Export .md téléchargé !', 'success');
  }

  /* ─── Init ───────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('so-save-script-btn')
      ?.addEventListener('click', _saveScript);

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
