/* ================================================================
   THE HOUSE — scriptorga.js
   Section Script Orga : Base de données + Organisateur
   ================================================================ */

'use strict';

window.ScriptOrga = (() => {

  const KEY_DB    = 'so_database';
  const KEY_PLAN  = 'so_plan';
  const KEY_NOTES = 'so_notes';

  let _db         = null;
  let _plan       = null;
  let _editingRow = null; // { gid, rid }
  let _dragState  = null; // { type: 'row', gid, rid }
  let _anglePopupTimer = null;

  /* ─── Persistence ─────────────────────────────────────────────── */
  function _loadDB() {
    const s = App.load(KEY_DB, null);
    _db = {
      formats: s?.formats ?? ['Clone vs Clone', 'White board', 'Voix Off'],
      angles:  s?.angles  ?? ['Comparaison', 'Tier list', 'Note sur 10'],
      hooks:   s?.hooks   ?? [],
    };
  }
  function _saveDB()   { App.save(KEY_DB,   _db);   }
  function _savePlan() { App.save(KEY_PLAN, _plan); }

  /* ─── Entrée principale ──────────────────────────────────────── */
  function renderView() {
    _loadDB();
    _plan = App.load(KEY_PLAN, { clientId: null, groups: [] });

    // Migration : ajouter section aux groupes existants sans section
    _plan.groups.forEach(g => {
      if (!g.section) g.section = 'unknown';
    });

    const el = document.getElementById('scriptorga-container');
    if (!el) return;

    el.innerHTML = `
      <div class="so-wrap">

        <!-- Sous-section 1 : Base de données -->
        <div class="so-block">
          <div class="section-header">
            <h3 class="section-title">Base de données</h3>
          </div>
          <div class="so-db-grid">
            ${_renderDBCard('formats', 'Formats',  'un format')}
            ${_renderDBCard('angles',  'Angles',   'un angle')}
            ${_renderDBCard('hooks',   'Hooks',    'un hook')}
          </div>
        </div>

        <!-- Sous-section 2 : Organisateur -->
        <div class="so-block so-block--orga">
          <div class="section-header">
            <h3 class="section-title">Organisateur</h3>
            <span class="so-notes-hint">Notes : <kbd class="so-notes-kbd">Ctrl</kbd>+<kbd class="so-notes-kbd">.</kbd></span>
          </div>
          <div id="so-orga">${_renderOrga()}</div>
        </div>

      </div>`;

    _bindAll(el);
  }

  /* ─── DB Card ─────────────────────────────────────────────────── */
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
        <div class="so-extra-picker" id="so-extra-picker" style="display:none">
          <p class="so-picker-lbl">Choisir un format :</p>
          ${_renderFormatPills('extra')}
        </div>

        <!-- Compteur de scripts -->
        <div class="so-counter">
          <svg class="so-counter-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span class="so-counter-label">Scripts rédigés :</span>
          <span class="so-counter-val ${doneScripts === totalRows && totalRows > 0 ? 'so-counter-val--done' : ''}">${doneScripts} / ${totalRows}</span>
          ${doneScripts === totalRows && totalRows > 0
            ? `<span class="so-counter-badge">✓ Tous complétés !</span>`
            : ''}
        </div>
      </div>`;
  }

  /* ─── Table body avec séparateur de sections ──────────────────── */
  function _renderTableBody() {
    const todayGroups   = _plan.groups.filter(g => g.section === 'today');
    const unknownGroups = _plan.groups.filter(g => g.section !== 'today');

    let html = '';

    // En-tête section "Aujourd'hui"
    html += `<tr class="so-section-header-row">
      <td colspan="6" class="so-section-label so-section-label--today">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        À faire aujourd'hui
      </td>
    </tr>`;

    if (todayGroups.length === 0) {
      html += `<tr class="so-section-empty-row">
        <td colspan="6" class="so-section-empty-cell" data-droptarget="today">
          Glisse un format ici pour le planifier aujourd'hui
        </td>
      </tr>`;
    } else {
      todayGroups.forEach(g => { html += _renderGroup(g); });
    }

    // Séparateur
    html += `<tr class="so-separator-row">
      <td colspan="6">
        <div class="so-separator-line">
          <span class="so-separator-label">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            À planifier
          </span>
        </div>
      </td>
    </tr>`;

    if (unknownGroups.length === 0) {
      html += `<tr class="so-section-empty-row">
        <td colspan="6" class="so-section-empty-cell" data-droptarget="unknown">
          Glisse un format ici
        </td>
      </tr>`;
    } else {
      unknownGroups.forEach(g => { html += _renderGroup(g); });
    }

    return html;
  }

  function _renderGroup(group) {
    let html = group.rows.map((row, i) => {
      const done = !!(row.script && row.script.trim());
      const isToday = group.section === 'today';
      return `
        <tr class="so-row" draggable="true"
            data-gid="${group.id}" data-rid="${row.id}" data-rowidx="${i}">
          <td class="so-drag-cell">
            <svg class="so-drag-handle" width="12" height="12" viewBox="0 0 24 24" fill="none">
              <circle cx="9"  cy="6"  r="1.5" fill="currentColor"/>
              <circle cx="15" cy="6"  r="1.5" fill="currentColor"/>
              <circle cx="9"  cy="12" r="1.5" fill="currentColor"/>
              <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="9"  cy="18" r="1.5" fill="currentColor"/>
              <circle cx="15" cy="18" r="1.5" fill="currentColor"/>
            </svg>
          </td>
          <td class="so-fmt-cell">
            ${i === 0
              ? `<div class="so-fmt-cell-inner">
                   <button class="so-section-toggle ${isToday ? 'so-section-toggle--today' : ''}"
                           data-gid="${group.id}"
                           title="${isToday ? 'Retirer des tâches du jour' : 'Planifier aujourd\'hui'}">
                     ${isToday
                       ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
                       : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`}
                   </button>
                   <span class="so-fmt-badge">${escHtml(group.format)}</span>
                 </div>`
              : `<span class="so-fmt-bar"></span>`}
          </td>
          <td class="so-sel-cell">
            <select class="form-select so-sel-angle" data-gid="${group.id}" data-rid="${row.id}" data-rowidx="${i}">
              <option value="">— Angle —</option>
              ${_db.angles.map(a => `<option value="${escHtml(a)}" ${row.angle === a ? 'selected' : ''}>${escHtml(a)}</option>`).join('')}
            </select>
          </td>
          <td class="so-sel-cell">
            <select class="form-select so-sel-hook" data-gid="${group.id}" data-rid="${row.id}">
              <option value="">— Hook —</option>
              ${_db.hooks.map(h => `<option value="${escHtml(h)}" ${row.hook === h ? 'selected' : ''}>${escHtml(h)}</option>`).join('')}
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
          <button class="btn btn-ghost btn-sm so-add-fmt-btn">
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
        Aucun format dans la base de données. Ajoutez-en d'abord.
      </p>`;
    }
    const attr = suffix ? `data-src="${suffix}"` : '';
    return `<div class="so-pills">
      ${_db.formats.map(f => `
        <button class="so-pill" data-format="${escHtml(f)}" ${attr}>${escHtml(f)}</button>
      `).join('')}
    </div>`;
  }

  /* ─── Bind events ──────────────────────────────────────────────── */
  function _bindAll(el) {

    /* DB : afficher le champ inline */
    el.querySelectorAll('.so-db-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = el.querySelector(`.so-db-inline[data-for="${btn.dataset.type}"]`);
        if (row) { row.style.display = 'flex'; row.querySelector('input')?.focus(); }
      });
    });

    /* DB : confirmer */
    el.querySelectorAll('.so-db-confirm').forEach(btn => {
      btn.addEventListener('click', () => _confirmAddDB(el, btn.dataset.type));
    });

    /* DB : annuler */
    el.querySelectorAll('.so-db-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = el.querySelector(`.so-db-inline[data-for="${btn.dataset.for}"]`);
        if (row) row.style.display = 'none';
      });
    });

    /* DB : Entrée dans le champ */
    el.querySelectorAll('.so-db-input').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') _confirmAddDB(el, inp.dataset.type);
      });
    });

    /* DB : supprimer tag */
    el.querySelectorAll('.so-tag-del').forEach(btn => {
      btn.addEventListener('click', () => {
        _db[btn.dataset.type].splice(parseInt(btn.dataset.idx), 1);
        _saveDB();
        renderView();
      });
    });

    /* Orga : démarrer */
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
    /* Sélection format initial */
    el.querySelectorAll('#so-init-picker .so-pill').forEach(pill => {
      pill.addEventListener('click', () => _addGroup(el, pill.dataset.format));
    });

    /* Export */
    el.querySelector('#so-export-btn')?.addEventListener('click', _exportMd);

    /* Nouveau plan */
    el.querySelector('#so-reset-btn')?.addEventListener('click', () => {
      App.confirm('Effacer le plan en cours ?', () => {
        _plan = { clientId: null, groups: [] };
        _savePlan();
        renderView();
      });
    });

    /* Ajouter format */
    el.querySelectorAll('.so-add-fmt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
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

    /* + ligne */
    el.querySelectorAll('.so-add-row').forEach(btn => {
      btn.addEventListener('click', () => _addRow(el, btn.dataset.gid));
    });

    /* Supprimer ligne */
    el.querySelectorAll('.so-row-del').forEach(btn => {
      btn.addEventListener('click', () => _deleteRow(el, btn.dataset.gid, btn.dataset.rid));
    });

    /* Toggle section (aujourd'hui / à planifier) */
    el.querySelectorAll('.so-section-toggle').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const g = _plan.groups.find(x => x.id === btn.dataset.gid);
        if (!g) return;
        g.section = g.section === 'today' ? 'unknown' : 'today';
        _savePlan();
        _rerenderPlan(el);
      });
    });

    /* Angle — avec popup sur la 1ère ligne seulement */
    el.querySelectorAll('.so-sel-angle').forEach(sel => {
      sel.addEventListener('change', () => {
        const rowIdx = parseInt(sel.dataset.rowidx);
        const row    = _findRow(sel.dataset.gid, sel.dataset.rid);
        if (row) {
          row.angle = sel.value;
          _savePlan();
          if (rowIdx === 0 && sel.value) {
            _showAngleApplyPopup(el, sel, sel.dataset.gid, sel.value);
          }
        }
      });
    });

    /* Hook */
    el.querySelectorAll('.so-sel-hook').forEach(sel => {
      sel.addEventListener('change', () => {
        const row = _findRow(sel.dataset.gid, sel.dataset.rid);
        if (row) { row.hook = sel.value; _savePlan(); }
      });
    });

    /* Écrire script */
    el.querySelectorAll('.so-script-btn').forEach(btn => {
      btn.addEventListener('click', () => _openScriptModal(btn.dataset.gid, btn.dataset.rid));
    });

    /* Drag & Drop */
    _bindDragDrop(el);
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
        if (i !== 0) row.angle = angle;
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

  /* ─── Drag & Drop ─────────────────────────────────────────────── */
  function _bindDragDrop(el) {
    const rows = el.querySelectorAll('.so-row[draggable="true"]');

    rows.forEach(tr => {
      tr.addEventListener('dragstart', e => {
        _dragState = { type: 'row', gid: tr.dataset.gid, rid: tr.dataset.rid };
        tr.classList.add('so-row--dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', tr.dataset.rid);
      });

      tr.addEventListener('dragend', () => {
        tr.classList.remove('so-row--dragging');
        el.querySelectorAll('.so-row--dragover').forEach(r => r.classList.remove('so-row--dragover'));
        el.querySelectorAll('.so-section-empty-cell--dragover').forEach(c => c.classList.remove('so-section-empty-cell--dragover'));
        _dragState = null;
      });

      tr.addEventListener('dragover', e => {
        if (!_dragState) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.querySelectorAll('.so-row--dragover').forEach(r => r.classList.remove('so-row--dragover'));
        if (tr.dataset.rid !== _dragState.rid) tr.classList.add('so-row--dragover');
      });

      tr.addEventListener('dragleave', () => {
        tr.classList.remove('so-row--dragover');
      });

      tr.addEventListener('drop', e => {
        e.preventDefault();
        if (!_dragState || _dragState.type !== 'row') return;

        const srcGid = _dragState.gid;
        const srcRid = _dragState.rid;
        const dstGid = tr.dataset.gid;
        const dstRid = tr.dataset.rid;

        if (srcRid === dstRid) return;

        if (srcGid === dstGid) {
          // Même groupe : réordonner
          const g    = _plan.groups.find(x => x.id === srcGid);
          const srcI = g.rows.findIndex(r => r.id === srcRid);
          const dstI = g.rows.findIndex(r => r.id === dstRid);
          const [row] = g.rows.splice(srcI, 1);
          g.rows.splice(dstI, 0, row);
        } else {
          // Groupes différents : déplacer la ligne
          const srcG  = _plan.groups.find(x => x.id === srcGid);
          const dstG  = _plan.groups.find(x => x.id === dstGid);
          const srcI  = srcG.rows.findIndex(r => r.id === srcRid);
          const dstI  = dstG.rows.findIndex(r => r.id === dstRid);
          const [row] = srcG.rows.splice(srcI, 1);
          dstG.rows.splice(dstI, 0, row);
          if (srcG.rows.length === 0) {
            _plan.groups = _plan.groups.filter(x => x.id !== srcGid);
          }
        }

        _savePlan();
        _rerenderPlan(el);
      });
    });

    /* Drop sur les zones vides de section */
    el.querySelectorAll('[data-droptarget]').forEach(cell => {
      cell.addEventListener('dragover', e => {
        if (!_dragState) return;
        e.preventDefault();
        cell.classList.add('so-section-empty-cell--dragover');
      });
      cell.addEventListener('dragleave', () => {
        cell.classList.remove('so-section-empty-cell--dragover');
      });
      cell.addEventListener('drop', e => {
        e.preventDefault();
        if (!_dragState || _dragState.type !== 'row') return;
        cell.classList.remove('so-section-empty-cell--dragover');

        const targetSection = cell.dataset.droptarget;
        const srcG = _plan.groups.find(x => x.id === _dragState.gid);
        if (!srcG) return;

        if (srcG.rows.length === 1) {
          srcG.section = targetSection;
        } else {
          const srcI  = srcG.rows.findIndex(r => r.id === _dragState.rid);
          const [row] = srcG.rows.splice(srcI, 1);
          _plan.groups.push({
            id:      App.uid(),
            format:  srcG.format,
            section: targetSection,
            rows:    [row],
          });
        }
        _savePlan();
        _rerenderPlan(el);
      });
    });
  }

  /* ─── Opérations DB ───────────────────────────────────────────── */
  function _confirmAddDB(el, type) {
    const row = el.querySelector(`.so-db-inline[data-for="${type}"]`);
    const inp = row?.querySelector('input');
    const val = inp?.value.trim();
    if (!val) { inp?.focus(); return; }
    if (_db[type].includes(val)) { App.toast('Déjà dans la liste', 'warning'); return; }
    _db[type].push(val);
    _saveDB();
    renderView();
  }

  /* ─── Opérations Plan ─────────────────────────────────────────── */
  function _addGroup(el, format) {
    _plan.groups.push({
      id:      App.uid(),
      format,
      section: 'unknown',
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
    const el = document.getElementById('scriptorga-container');
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
              <kbd class="so-notes-kbd">Ctrl+.</kbd>
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

      // Ctrl+S dans le textarea pour sauvegarder
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

    const todayGroups   = _plan.groups.filter(g => g.section === 'today');
    const unknownGroups = _plan.groups.filter(g => g.section !== 'today');

    if (todayGroups.length > 0) {
      md += `## À faire aujourd'hui\n\n`;
      todayGroups.forEach(g => {
        md += `### Format : ${g.format}\n\n`;
        g.rows.forEach((row, i) => {
          md += `#### Vidéo ${i + 1}\n\n`;
          if (row.angle) md += `**Angle :** ${row.angle}  \n`;
          if (row.hook)  md += `**Hook :** ${row.hook}  \n`;
          md += '\n';
          md += row.script && row.script.trim() ? row.script.trim() + '\n' : '*Script non rédigé*\n';
          md += '\n---\n\n';
        });
      });
    }

    if (unknownGroups.length > 0) {
      md += `## À planifier\n\n`;
      unknownGroups.forEach(g => {
        md += `### Format : ${g.format}\n\n`;
        g.rows.forEach((row, i) => {
          md += `#### Vidéo ${i + 1}\n\n`;
          if (row.angle) md += `**Angle :** ${row.angle}  \n`;
          if (row.hook)  md += `**Hook :** ${row.hook}  \n`;
          md += '\n';
          md += row.script && row.script.trim() ? row.script.trim() + '\n' : '*Script non rédigé*\n';
          md += '\n---\n\n';
        });
      });
    }

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

    // Raccourci clavier Ctrl+. pour les notes (global)
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === '.') {
        const active = document.activeElement;
        const inInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
        if (!inInput) {
          e.preventDefault();
          _openNotesModal();
        }
      }
    });
  });

  return { renderView };
})();
