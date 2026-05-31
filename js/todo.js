/* ================================================================
   THE HOUSE — todo.js  (v3 : inspiré Google Tasks)
   - Dates d'échéance + filtres (Tout/Aujourd'hui/Semaine/En retard)
   - Sous-tâches
   - Panneau détails (slide-in)
   - Récurrence (daily/weekly/monthly/yearly)
   - Drag & drop pour ordre manuel
   - Section "Terminées" repliable
   - Lien tâche ↔ projet Kanban
   - Raccourcis clavier
   - Toggle densité (compact / confortable)
   ================================================================ */

'use strict';

window.TodoList = {

  KEY:        'th_todos',
  KEY_CATS:   'th_todo_cats',
  KEY_PREFS:  'th_todo_prefs',

  CAT_COLORS: [
    '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#84CC16',
  ],
  PRIORITY_COLOR: '#EAB308',
  UNCAT_COLOR:    '#94A3B8',

  /* ── État UI (non persisté entre sessions sauf prefs) ────────── */
  _filter:        'all',        // all | today | week | late
  _detailOpenId:  null,
  _doneExpanded:  false,
  _dragId:        null,

  /* ── Persistance ─────────────────────────────────────────────── */
  load() {
    try {
      const v = localStorage.getItem(this.KEY);
      const arr = v !== null ? JSON.parse(v) : [];
      return this._migrate(arr);
    } catch { return []; }
  },
  save(todos) {
    try { localStorage.setItem(this.KEY, JSON.stringify(todos)); } catch(e) {}
  },
  loadCats() {
    try {
      const v = localStorage.getItem(this.KEY_CATS);
      return v !== null ? JSON.parse(v) : [];
    } catch { return []; }
  },
  saveCats(cats) {
    try { localStorage.setItem(this.KEY_CATS, JSON.stringify(cats)); } catch(e) {}
  },
  loadPrefs() {
    try {
      const v = localStorage.getItem(this.KEY_PREFS);
      return v !== null ? JSON.parse(v) : { density: 'comfort' };
    } catch { return { density: 'comfort' }; }
  },
  savePrefs(p) {
    try { localStorage.setItem(this.KEY_PREFS, JSON.stringify(p)); } catch(e) {}
  },

  _migrate(arr) {
    let changed = false;
    arr.forEach((t, i) => {
      if (t.notes        === undefined) { t.notes = '';        changed = true; }
      if (t.dueDate      === undefined) { t.dueDate = '';      changed = true; }
      if (t.recurrence   === undefined) { t.recurrence = 'none'; changed = true; }
      if (t.parentId     === undefined) { t.parentId = '';     changed = true; }
      if (t.order        === undefined) { t.order = i;         changed = true; }
      if (t.projectRef   === undefined) { t.projectRef = '';   changed = true; }
      if (t.doneAt       === undefined) { t.doneAt = '';       changed = true; }
    });
    if (changed) this.save(arr);
    return arr;
  },

  /* ── Helpers date ────────────────────────────────────────────── */
  _today() {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  },
  _parseDate(s) {
    if (!s) return null;
    const d = new Date(s + 'T00:00:00');
    return isNaN(d) ? null : d;
  },
  _isToday(s)    { const d = this._parseDate(s); if (!d) return false; return d.getTime() === this._today().getTime(); },
  _isLate(s)     { const d = this._parseDate(s); if (!d) return false; return d.getTime() <  this._today().getTime(); },
  _isThisWeek(s) {
    const d = this._parseDate(s); if (!d) return false;
    const today = this._today();
    const end = new Date(today); end.setDate(end.getDate() + 7);
    return d.getTime() >= today.getTime() && d.getTime() <= end.getTime();
  },
  _formatDateBadge(s) {
    const d = this._parseDate(s); if (!d) return '';
    const today = this._today();
    const diff  = Math.round((d - today) / 86400000);
    if (diff === 0)  return "Aujourd'hui";
    if (diff === 1)  return 'Demain';
    if (diff === -1) return 'Hier';
    if (diff > 0 && diff < 7)   return d.toLocaleDateString('fr-FR', { weekday: 'long' });
    if (diff < 0 && diff > -7)  return `Il y a ${-diff}j`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  },
  _nextRecurrence(dateStr, recurrence) {
    if (!dateStr || recurrence === 'none') return '';
    const d = this._parseDate(dateStr); if (!d) return '';
    if (recurrence === 'daily')   d.setDate(d.getDate() + 1);
    if (recurrence === 'weekly')  d.setDate(d.getDate() + 7);
    if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1);
    if (recurrence === 'yearly')  d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  },

  /* ── Helpers projets Kanban ──────────────────────────────────── */
  _allProjects() {
    if (!window.App || !App.CLIENTS) return [];
    const out = [];
    App.CLIENTS.forEach(c => {
      const projects = App.load(`${App.KEYS.PROJECTS}_${c.id}`, []);
      projects.forEach(p => out.push({
        id: p.id, name: p.name || p.title || '(sans nom)',
        clientId: c.id, clientName: c.name, clientColor: c.color,
      }));
    });
    return out;
  },
  _projectById(refId) {
    if (!refId) return null;
    return this._allProjects().find(p => p.id === refId) || null;
  },

  /* ── Filtre + tri ────────────────────────────────────────────── */
  _applyFilter(todos) {
    const f = this._filter;
    if (f === 'all')   return todos;
    if (f === 'today') return todos.filter(t => this._isToday(t.dueDate));
    if (f === 'week')  return todos.filter(t => this._isThisWeek(t.dueDate));
    if (f === 'late')  return todos.filter(t => this._isLate(t.dueDate) && !t.done);
    return todos;
  },

  _sortRoots(roots) {
    return roots.slice().sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  },

  _counts(todos) {
    return {
      all:   todos.filter(t => !t.parentId && !t.done).length,
      today: todos.filter(t => !t.parentId && !t.done && this._isToday(t.dueDate)).length,
      week:  todos.filter(t => !t.parentId && !t.done && this._isThisWeek(t.dueDate)).length,
      late:  todos.filter(t => !t.parentId && !t.done && this._isLate(t.dueDate)).length,
    };
  },

  /* ── Rendu principal ─────────────────────────────────────────── */
  render() {
    const todos   = this.load();
    const cats    = this.loadCats();
    const prefs   = this.loadPrefs();
    const list    = document.getElementById('todoList');
    const counter = document.getElementById('todo-counter');
    const footer  = document.getElementById('todoFooter');
    const hero    = document.getElementById('todo-hero');
    if (!list) return;

    /* Densité */
    if (hero) hero.dataset.density = prefs.density || 'comfort';

    /* Compteur global (non terminées, hors sous-tâches) */
    const remaining = todos.filter(t => !t.done && !t.parentId).length;
    if (counter) counter.textContent = `${remaining} restante(s)`;

    /* Compteurs des filtres */
    const counts = this._counts(todos);
    document.querySelectorAll('.todo-filter-count').forEach(el => {
      const k = el.dataset.count;
      el.textContent = counts[k] || 0;
    });

    /* Select catégories (champ d'ajout) */
    const catSelect = document.getElementById('todoCatSelect');
    if (catSelect) {
      const currentVal = catSelect.value || '';
      catSelect.innerHTML = '<option value="">Sans étiquette</option>' +
        cats.map(c => `<option value="${c.id}" ${c.id === currentVal ? 'selected' : ''}>${this._esc(c.name)}</option>`).join('');
    }

    /* Index */
    const catById = {}; cats.forEach(c => { catById[c.id] = c; });

    /* Séparer racines / sous-tâches, en cours / terminées */
    const filtered = this._applyFilter(todos);
    const rootsActive = filtered.filter(t => !t.parentId && !t.done);
    const rootsDone   = todos.filter(t => !t.parentId && t.done);
    const subsByParent = {};
    todos.forEach(t => {
      if (t.parentId) {
        (subsByParent[t.parentId] = subsByParent[t.parentId] || []).push(t);
      }
    });
    Object.values(subsByParent).forEach(arr => arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));

    /* Liste active */
    const sortedRoots = this._sortRoots(rootsActive);
    if (sortedRoots.length === 0) {
      const empties = {
        all:   { t: 'Aucune tâche pour le moment',   s: 'Ajoutez une tâche ci-dessus pour commencer.' },
        today: { t: "Rien à faire aujourd'hui",      s: 'Profitez-en !' },
        week:  { t: 'Aucune tâche cette semaine',    s: 'Pensez à planifier vos prochaines actions.' },
        late:  { t: 'Aucune tâche en retard',        s: 'Bravo, tout est sous contrôle.' },
      };
      const e = empties[this._filter] || empties.all;
      list.innerHTML = `<div class="todo-empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <p>${e.t}</p><p class="todo-empty-sub">${e.s}</p>
      </div>`;
    } else {
      list.innerHTML = sortedRoots.map(t => this._renderItem(t, catById, subsByParent[t.id] || [])).join('');
    }

    /* Section terminées repliable */
    const doneSection = document.getElementById('todoDoneSection');
    const doneListEl  = document.getElementById('todoDoneList');
    const doneCountEl = document.getElementById('todoDoneCount');
    const doneChevron = document.querySelector('.todo-done-chevron');
    if (doneSection) {
      if (rootsDone.length === 0) {
        doneSection.style.display = 'none';
      } else {
        doneSection.style.display = 'block';
        doneCountEl.textContent = rootsDone.length;
        doneListEl.style.display = this._doneExpanded ? 'flex' : 'none';
        if (doneChevron) doneChevron.style.transform = this._doneExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
        const doneSorted = rootsDone.slice().sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
        doneListEl.innerHTML = doneSorted.map(t => this._renderItem(t, catById, subsByParent[t.id] || [])).join('');
      }
    }

    /* Footer "Supprimer terminées" */
    if (footer) footer.style.display = rootsDone.length > 0 ? 'flex' : 'none';

    /* Mettre à jour les filtres actifs */
    document.querySelectorAll('.todo-filter').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === this._filter);
    });

    /* Rafraîchir le panneau s'il est ouvert */
    if (this._detailOpenId) {
      const open = todos.find(t => t.id === this._detailOpenId);
      if (!open) this.closeDetail();
      else this._fillDetail(open);
    }
  },

  _renderItem(t, catById, subs) {
    const cat = t.catId ? catById[t.catId] : null;
    const color = t.priority ? this.PRIORITY_COLOR : (cat ? cat.color : this.UNCAT_COLOR);
    const labelText = t.priority ? 'Priorité ultime' : (cat ? cat.name : 'Sans étiquette');
    const subTotal = subs.length;
    const subDone  = subs.filter(s => s.done).length;
    const project  = t.projectRef ? this._projectById(t.projectRef) : null;

    /* Badge date */
    let dateBadge = '';
    if (t.dueDate) {
      const isLate  = this._isLate(t.dueDate)  && !t.done;
      const isToday = this._isToday(t.dueDate) && !t.done;
      const cls = isLate ? 'todo-date-badge late' : isToday ? 'todo-date-badge today' : 'todo-date-badge';
      dateBadge = `<span class="${cls}" title="Échéance">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${this._formatDateBadge(t.dueDate)}
      </span>`;
    }

    /* Récurrence */
    const recurBadge = (t.recurrence && t.recurrence !== 'none')
      ? `<span class="todo-recur-badge" title="Tâche récurrente"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></span>`
      : '';

    /* Sous-tâches counter */
    const subBadge = subTotal > 0
      ? `<span class="todo-sub-badge" title="${subDone}/${subTotal} sous-tâches">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          ${subDone}/${subTotal}
        </span>`
      : '';

    /* Projet lié */
    const projectChip = project
      ? `<span class="todo-project-chip" style="--c:${project.clientColor || '#64748b'}" title="${this._esc(project.clientName)} · ${this._esc(project.name)}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
          ${this._esc(project.name)}
        </span>`
      : '';

    const notesIcon = t.notes
      ? `<span class="todo-notes-icon" title="Cette tâche a des notes"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg></span>`
      : '';

    const subItems = subs.map(s => `
      <div class="todo-sub-item${s.done ? ' todo-done' : ''}" data-id="${s.id}">
        <button class="todo-check todo-sub-check" data-id="${s.id}" aria-label="Cocher">
          ${s.done
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor"/><polyline points="7 13 10 16 17 9" stroke="#fff" stroke-width="2.5"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/></svg>'
          }
        </button>
        <span class="todo-sub-text">${this._esc(s.text)}</span>
        <button class="todo-del todo-sub-del" data-id="${s.id}" aria-label="Supprimer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');

    return `
      <div class="todo-item${t.done ? ' todo-done' : ''}${t.priority ? ' todo-item-priority' : ''}"
           data-id="${t.id}" draggable="true" style="--cat-color:${color}">
        <div class="todo-item-main">
          <span class="todo-drag-handle" title="Glisser pour réordonner">
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2" cy="2" r="1.3"/><circle cx="2" cy="7" r="1.3"/><circle cx="2" cy="12" r="1.3"/><circle cx="8" cy="2" r="1.3"/><circle cx="8" cy="7" r="1.3"/><circle cx="8" cy="12" r="1.3"/></svg>
          </span>
          <button class="todo-check" data-id="${t.id}" aria-label="Cocher">
            ${t.done
              ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="5" fill="var(--cat-color)" stroke="var(--cat-color)"/><polyline points="7 13 10 16 17 9" stroke="#fff" stroke-width="2.5"/></svg>'
              : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/></svg>'
            }
          </button>
          <span class="todo-text" data-detail="${t.id}">${this._esc(t.text)}</span>
          <div class="todo-meta-badges">
            ${dateBadge}
            ${recurBadge}
            ${subBadge}
            ${notesIcon}
          </div>
          ${projectChip}
          <span class="todo-tag" title="${this._esc(labelText)}">
            ${t.priority ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : ''}
            ${this._esc(labelText)}
          </span>
          <button class="todo-prio-btn${t.priority ? ' active' : ''}" data-id="${t.id}" title="${t.priority ? 'Retirer de la priorité' : 'Priorité ultime'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${t.priority ? '#EAB308' : 'none'}" stroke="${t.priority ? '#EAB308' : 'currentColor'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
          <button class="todo-add-sub" data-parent="${t.id}" title="Ajouter une sous-tâche">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/><line x1="16" y1="3" x2="22" y2="3" stroke-width="2.5"/><line x1="19" y1="0" x2="19" y2="6" stroke-width="2.5"/></svg>
          </button>
          <button class="todo-del" data-id="${t.id}" aria-label="Supprimer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        ${subTotal > 0 ? `<div class="todo-subs">${subItems}</div>` : ''}
      </div>`;
  },

  _esc(s) { return window.escHtml ? escHtml(s) : String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); },

  /* ── CRUD tâches ─────────────────────────────────────────────── */
  add(text, catId, parentId) {
    if (!text.trim()) return null;
    const todos = this.load();
    const order = parentId
      ? Math.max(-1, ...todos.filter(t => t.parentId === parentId).map(t => t.order ?? 0)) + 1
      : Math.max(-1, ...todos.filter(t => !t.parentId).map(t => t.order ?? 0)) + 1;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    todos.push({
      id, text: text.trim(), notes: '',
      done: false, doneAt: '',
      catId: catId || '', priority: false,
      dueDate: '', recurrence: 'none',
      parentId: parentId || '', order,
      projectRef: '',
      createdAt: new Date().toISOString(),
    });
    this.save(todos);
    this.render();
    return id;
  },

  toggle(id) {
    const todos = this.load();
    const item = todos.find(t => t.id === id);
    if (!item) return;
    item.done = !item.done;
    item.doneAt = item.done ? new Date().toISOString() : '';

    /* Récurrence : à la complétion, recréer une instance à la prochaine date */
    if (item.done && item.recurrence && item.recurrence !== 'none' && item.dueDate && !item.parentId) {
      const nextDate = this._nextRecurrence(item.dueDate, item.recurrence);
      if (nextDate) {
        const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        todos.push({
          ...item,
          id: newId,
          done: false, doneAt: '',
          dueDate: nextDate,
          order: Math.max(-1, ...todos.filter(t => !t.parentId).map(t => t.order ?? 0)) + 1,
          createdAt: new Date().toISOString(),
        });
      }
    }

    /* Si parent coché : cocher toutes les sous-tâches */
    if (!item.parentId) {
      todos.forEach(s => {
        if (s.parentId === id) { s.done = item.done; s.doneAt = item.done ? new Date().toISOString() : ''; }
      });
    } else {
      /* Si toutes les sous-tâches d'un parent sont done → cocher le parent */
      const subs = todos.filter(s => s.parentId === item.parentId);
      const parent = todos.find(t => t.id === item.parentId);
      if (parent && subs.length > 0 && subs.every(s => s.done) && !parent.done) {
        parent.done = true; parent.doneAt = new Date().toISOString();
      }
      if (parent && parent.done && subs.some(s => !s.done)) {
        parent.done = false; parent.doneAt = '';
      }
    }

    this.save(todos);
    this.render();
  },

  togglePriority(id) {
    const todos = this.load();
    const item = todos.find(t => t.id === id);
    if (!item || item.parentId) return;
    if (item.priority) {
      item.priority = false;
    } else {
      todos.forEach(t => { t.priority = false; });
      item.priority = true;
    }
    this.save(todos);
    this.render();
  },

  remove(id) {
    const todos = this.load().filter(t => t.id !== id && t.parentId !== id);
    this.save(todos);
    if (this._detailOpenId === id) this.closeDetail();
    this.render();
  },

  clearDone() {
    const doneIds = this.load().filter(t => t.done && !t.parentId).map(t => t.id);
    const todos = this.load().filter(t => !doneIds.includes(t.id) && !doneIds.includes(t.parentId) && !(t.done && t.parentId));
    this.save(todos);
    this.render();
  },

  updateField(id, patch) {
    const todos = this.load();
    const item = todos.find(t => t.id === id);
    if (!item) return;
    Object.assign(item, patch);
    this.save(todos);
    this.render();
  },

  /* ── Ordre manuel (drag & drop) ──────────────────────────────── */
  reorder(dragId, targetId) {
    if (!dragId || dragId === targetId) return;
    const todos = this.load();
    const drag = todos.find(t => t.id === dragId);
    const target = todos.find(t => t.id === targetId);
    if (!drag || !target) return;
    if (drag.parentId !== target.parentId) return; // pas d'inter-niveau
    const siblings = todos.filter(t => t.parentId === drag.parentId && !t.done && !t.priority)
                          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idsWithoutDrag = siblings.filter(t => t.id !== dragId).map(t => t.id);
    const targetIdx = idsWithoutDrag.indexOf(targetId);
    if (targetIdx < 0) return;
    idsWithoutDrag.splice(targetIdx, 0, dragId);
    idsWithoutDrag.forEach((id, i) => {
      const t = todos.find(x => x.id === id);
      if (t) t.order = i;
    });
    this.save(todos);
    this.render();
  },

  /* ── Catégories ──────────────────────────────────────────────── */
  addCategory(name, color) {
    if (!name.trim()) return;
    const cats = this.loadCats();
    const c = color || this.CAT_COLORS[cats.length % this.CAT_COLORS.length];
    cats.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name.trim(), color: c,
    });
    this.saveCats(cats);
    this.render();
  },
  renameCategory(catId, newName) {
    const cats = this.loadCats();
    const c = cats.find(x => x.id === catId);
    if (!c || !newName.trim()) return;
    c.name = newName.trim();
    this.saveCats(cats);
    this.render();
  },
  recolorCategory(catId, newColor) {
    const cats = this.loadCats();
    const c = cats.find(x => x.id === catId);
    if (!c) return;
    c.color = newColor;
    this.saveCats(cats);
    this.render();
  },
  deleteCategory(catId) {
    const cats = this.loadCats().filter(c => c.id !== catId);
    this.saveCats(cats);
    const todos = this.load();
    todos.forEach(t => { if (t.catId === catId) t.catId = ''; });
    this.save(todos);
    this.render();
  },

  /* ── Panneau détails ─────────────────────────────────────────── */
  openDetail(id) {
    const todos = this.load();
    const item = todos.find(t => t.id === id);
    if (!item) return;
    this._detailOpenId = id;
    const panel = document.getElementById('todoDetailPanel');
    const overlay = document.getElementById('todoDetailOverlay');
    if (panel)   { panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); }
    if (overlay) { overlay.classList.add('open'); }
    this._fillDetail(item);
    setTimeout(() => {
      const txt = document.getElementById('todoDetailText');
      if (txt) txt.focus();
    }, 50);
  },
  closeDetail() {
    this._detailOpenId = null;
    const panel = document.getElementById('todoDetailPanel');
    const overlay = document.getElementById('todoDetailOverlay');
    if (panel)   { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }
    if (overlay) { overlay.classList.remove('open'); }
  },

  _fillDetail(item) {
    const cats = this.loadCats();
    const projects = this._allProjects();
    const $ = id => document.getElementById(id);

    $('todoDetailText').value       = item.text || '';
    $('todoDetailNotes').value      = item.notes || '';
    $('todoDetailDate').value       = item.dueDate || '';
    $('todoDetailRecurrence').value = item.recurrence || 'none';

    const catSel = $('todoDetailCat');
    catSel.innerHTML = '<option value="">Sans étiquette</option>' +
      cats.map(c => `<option value="${c.id}" ${c.id === item.catId ? 'selected' : ''}>${this._esc(c.name)}</option>`).join('');

    const prSel = $('todoDetailProject');
    prSel.innerHTML = '<option value="">Aucun</option>' +
      projects.map(p => `<option value="${p.id}" ${p.id === item.projectRef ? 'selected' : ''}>${this._esc(p.clientName)} · ${this._esc(p.name)}</option>`).join('');

    /* Sous-tâches */
    const todos = this.load();
    const subs = todos.filter(t => t.parentId === item.id)
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const subsEl = $('todoDetailSubs');
    if (subs.length === 0) {
      subsEl.innerHTML = '<p class="todo-detail-no-subs">Aucune sous-tâche</p>';
    } else {
      subsEl.innerHTML = subs.map(s => `
        <div class="todo-detail-sub-row${s.done ? ' done' : ''}">
          <button class="todo-detail-sub-check" data-id="${s.id}" aria-label="Cocher">
            ${s.done
              ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><polyline points="7 13 10 16 17 9" stroke="#fff" stroke-width="2.5" fill="none"/></svg>'
              : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/></svg>'
            }
          </button>
          <span class="todo-detail-sub-text">${this._esc(s.text)}</span>
          <button class="todo-detail-sub-del" data-id="${s.id}" aria-label="Supprimer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`).join('');
    }
    $('todoDetailSubCount').textContent = subs.length > 0 ? `${subs.filter(s => s.done).length}/${subs.length}` : '';

    /* Méta */
    const meta = [];
    if (item.createdAt) meta.push(`Créée le ${new Date(item.createdAt).toLocaleDateString('fr-FR')}`);
    if (item.done && item.doneAt) meta.push(`Terminée le ${new Date(item.doneAt).toLocaleDateString('fr-FR')}`);
    $('todoDetailMeta').textContent = meta.join(' · ');
  },

  _commitDetail() {
    if (!this._detailOpenId) return;
    const $ = id => document.getElementById(id);
    this.updateField(this._detailOpenId, {
      text:       $('todoDetailText').value,
      notes:      $('todoDetailNotes').value,
      dueDate:    $('todoDetailDate').value,
      recurrence: $('todoDetailRecurrence').value,
      catId:      $('todoDetailCat').value,
      projectRef: $('todoDetailProject').value,
    });
  },

  /* ── Modale étiquettes (inchangée fonctionnellement) ─────────── */
  openCatsModal() {
    let modal = document.getElementById('todoCatsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'todoCatsModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content" style="max-width:480px">
          <div class="modal-header">
            <h3>Étiquettes</h3>
            <button class="modal-close" id="todoCatsModalClose">&times;</button>
          </div>
          <div class="modal-body">
            <div class="todo-cats-add-row">
              <input type="text" id="todoNewCatName" class="form-input" placeholder="Nom de l'étiquette…" />
              <input type="color" id="todoNewCatColor" class="todo-color-input" value="#6366F1" title="Couleur" />
              <button class="btn btn-primary btn-sm" id="todoNewCatAdd">Ajouter</button>
            </div>
            <div id="todoCatsList" class="todo-cats-list"></div>
          </div>
        </div>`;
      document.body.appendChild(modal);

      modal.addEventListener('click', e => { if (e.target === modal) this.closeCatsModal(); });
      modal.querySelector('#todoCatsModalClose').addEventListener('click', () => this.closeCatsModal());
      modal.querySelector('#todoNewCatAdd').addEventListener('click', () => {
        const nameEl  = modal.querySelector('#todoNewCatName');
        const colorEl = modal.querySelector('#todoNewCatColor');
        if (nameEl.value.trim()) {
          this.addCategory(nameEl.value, colorEl.value);
          nameEl.value = '';
          this._renderCatsList();
        }
      });
      modal.querySelector('#todoNewCatName').addEventListener('keydown', e => {
        if (e.key === 'Enter') modal.querySelector('#todoNewCatAdd').click();
      });
      modal.querySelector('#todoCatsList').addEventListener('click', e => {
        const delBtn = e.target.closest('.todo-cats-row-del');
        if (delBtn && confirm('Supprimer cette étiquette ?')) {
          this.deleteCategory(delBtn.dataset.id);
          this._renderCatsList();
        }
      });
      modal.querySelector('#todoCatsList').addEventListener('input', e => {
        const id = e.target.dataset.id;
        if (!id) return;
        if (e.target.classList.contains('todo-cats-row-name'))  this.renameCategory(id, e.target.value);
        if (e.target.classList.contains('todo-cats-row-color')) this.recolorCategory(id, e.target.value);
      });
    }
    modal.style.display = 'flex';
    this._renderCatsList();
  },
  closeCatsModal() {
    const modal = document.getElementById('todoCatsModal');
    if (modal) modal.style.display = 'none';
  },
  _renderCatsList() {
    const wrap = document.getElementById('todoCatsList');
    if (!wrap) return;
    const cats = this.loadCats();
    if (cats.length === 0) {
      wrap.innerHTML = '<p class="todo-cats-empty">Aucune étiquette pour le moment.</p>';
      return;
    }
    wrap.innerHTML = cats.map(c => `
      <div class="todo-cats-row" style="--cat-color:${c.color}">
        <input type="color" class="todo-cats-row-color todo-color-input" data-id="${c.id}" value="${c.color}" title="Couleur" />
        <input type="text"  class="todo-cats-row-name form-input"        data-id="${c.id}" value="${this._esc(c.name)}" />
        <button class="todo-cats-row-del" data-id="${c.id}" title="Supprimer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');
  },

  /* ── Init ────────────────────────────────────────────────────── */
  init() {
    this.render();

    const input    = document.getElementById('todoInput');
    const addBtn   = document.getElementById('todoAddBtn');
    const list     = document.getElementById('todoList');
    const doneList = document.getElementById('todoDoneList');
    const clearBtn = document.getElementById('todoClearDone');
    const catsBtn  = document.getElementById('todoManageCatsBtn');
    const densBtn  = document.getElementById('todoDensityBtn');
    const filters  = document.getElementById('todoFilters');
    const doneTog  = document.getElementById('todoDoneToggle');

    /* Ajout */
    const doAdd = () => {
      const catSel = document.getElementById('todoCatSelect');
      this.add(input.value, catSel ? catSel.value : '');
      input.value = '';
      input.focus();
    };
    if (addBtn) addBtn.addEventListener('click', doAdd);
    if (input)  input.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });

    /* Délégation clics sur liste */
    const handleListClick = e => {
      const checkBtn   = e.target.closest('.todo-check');
      if (checkBtn) { this.toggle(checkBtn.dataset.id); return; }
      const prioBtn    = e.target.closest('.todo-prio-btn');
      if (prioBtn)  { this.togglePriority(prioBtn.dataset.id); return; }
      const delBtn     = e.target.closest('.todo-del');
      if (delBtn)   { this.remove(delBtn.dataset.id); return; }
      const addSubBtn  = e.target.closest('.todo-add-sub');
      if (addSubBtn) {
        const text = prompt('Sous-tâche :');
        if (text) this.add(text, '', addSubBtn.dataset.parent);
        return;
      }
      const titleEl = e.target.closest('[data-detail]');
      if (titleEl)  { this.openDetail(titleEl.dataset.detail); return; }
    };
    if (list)     list.addEventListener('click', handleListClick);
    if (doneList) doneList.addEventListener('click', handleListClick);

    /* Drag & drop */
    const setupDnD = container => {
      if (!container) return;
      container.addEventListener('dragstart', e => {
        const item = e.target.closest('.todo-item');
        if (!item) return;
        this._dragId = item.dataset.id;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      container.addEventListener('dragend', e => {
        const item = e.target.closest('.todo-item');
        if (item) item.classList.remove('dragging');
        this._dragId = null;
        container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });
      container.addEventListener('dragover', e => {
        const item = e.target.closest('.todo-item');
        if (!item || item.dataset.id === this._dragId) return;
        e.preventDefault();
        container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        item.classList.add('drag-over');
      });
      container.addEventListener('drop', e => {
        const item = e.target.closest('.todo-item');
        if (!item || !this._dragId) return;
        e.preventDefault();
        this.reorder(this._dragId, item.dataset.id);
      });
    };
    setupDnD(list);

    /* Filtres */
    if (filters) {
      filters.addEventListener('click', e => {
        const btn = e.target.closest('.todo-filter');
        if (!btn) return;
        this._filter = btn.dataset.filter;
        this.render();
      });
    }

    /* Section terminées repliable */
    if (doneTog) {
      doneTog.addEventListener('click', () => {
        this._doneExpanded = !this._doneExpanded;
        doneTog.setAttribute('aria-expanded', this._doneExpanded ? 'true' : 'false');
        this.render();
      });
    }

    /* Footer */
    if (clearBtn) clearBtn.addEventListener('click', () => {
      if (confirm('Supprimer toutes les tâches terminées ?')) this.clearDone();
    });

    /* Boutons globaux */
    if (catsBtn) catsBtn.addEventListener('click', () => this.openCatsModal());
    if (densBtn) densBtn.addEventListener('click', () => {
      const p = this.loadPrefs();
      p.density = (p.density === 'compact') ? 'comfort' : 'compact';
      this.savePrefs(p);
      this.render();
    });

    /* ── Panneau détails : événements ──────────────────────────── */
    const $ = id => document.getElementById(id);
    const closeBtn = $('todoDetailClose');
    const overlay  = $('todoDetailOverlay');
    const delBtn   = $('todoDetailDel');
    const panel    = $('todoDetailPanel');
    const subAdd   = $('todoDetailSubAddBtn');
    const subInput = $('todoDetailSubInput');
    const subsEl   = $('todoDetailSubs');

    if (closeBtn) closeBtn.addEventListener('click', () => { this._commitDetail(); this.closeDetail(); });
    if (overlay)  overlay.addEventListener('click', () => { this._commitDetail(); this.closeDetail(); });
    if (delBtn)   delBtn.addEventListener('click', () => {
      if (this._detailOpenId && confirm('Supprimer cette tâche ?')) this.remove(this._detailOpenId);
    });

    /* Auto-save sur blur des champs */
    ['todoDetailText','todoDetailNotes','todoDetailDate','todoDetailRecurrence','todoDetailCat','todoDetailProject']
      .forEach(id => {
        const el = $(id);
        if (!el) return;
        el.addEventListener('change', () => this._commitDetail());
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.addEventListener('blur', () => this._commitDetail());
        }
      });

    /* Ajout sous-tâche depuis panneau */
    const addSubFromPanel = () => {
      if (!this._detailOpenId || !subInput.value.trim()) return;
      this.add(subInput.value, '', this._detailOpenId);
      subInput.value = '';
      subInput.focus();
    };
    if (subAdd)   subAdd.addEventListener('click', addSubFromPanel);
    if (subInput) subInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addSubFromPanel(); } });

    /* Sous-tâches : check / del depuis panneau */
    if (subsEl) {
      subsEl.addEventListener('click', e => {
        const chk = e.target.closest('.todo-detail-sub-check');
        if (chk) { this.toggle(chk.dataset.id); return; }
        const dl = e.target.closest('.todo-detail-sub-del');
        if (dl) { this.remove(dl.dataset.id); return; }
      });
    }

    /* Raccourcis clavier globaux */
    document.addEventListener('keydown', e => {
      if (!panel || !panel.classList.contains('open')) return;
      if (e.key === 'Escape') { this.closeDetail(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        this._commitDetail();
        this.closeDetail();
      }
    });
  },
};
