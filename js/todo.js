/* ================================================================
   THE HOUSE — todo.js  (v4 : refonte intégrale)

   Inspirée Google Tasks. Système de classes propre, sans héritage
   de l'ancien design. Voir style.css pour la nomenclature.
   ================================================================ */

'use strict';

window.TodoList = {

  /* ── Storage keys ────────────────────────────────────────────── */
  KEY:       'th_todos',
  KEY_CATS:  'th_todo_cats',
  KEY_PREFS: 'th_todo_prefs',

  /* ── Palette ─────────────────────────────────────────────────── */
  CAT_COLORS: [
    '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#84CC16',
  ],
  PRIO_COLOR:  '#EAB308',
  UNCAT_COLOR: '#94A3B8',

  /* ── État UI ─────────────────────────────────────────────────── */
  _filter:       'all',
  _doneOpen:     false,
  _detailId:     null,
  _dragId:       null,

  /* ── Persistance ─────────────────────────────────────────────── */
  load() {
    try {
      const v = localStorage.getItem(this.KEY);
      return this._migrate(v !== null ? JSON.parse(v) : []);
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

  /* Migration silencieuse pour les anciennes versions */
  _migrate(arr) {
    let dirty = false;
    arr.forEach((t, i) => {
      if (t.notes      === undefined) { t.notes = '';        dirty = true; }
      if (t.dueDate    === undefined) { t.dueDate = '';      dirty = true; }
      if (t.recurrence === undefined) { t.recurrence = 'none'; dirty = true; }
      if (t.parentId   === undefined) { t.parentId = '';     dirty = true; }
      if (t.order      === undefined) { t.order = i;         dirty = true; }
      if (t.projectRef === undefined) { t.projectRef = '';   dirty = true; }
      if (t.doneAt     === undefined) { t.doneAt = '';       dirty = true; }
    });
    if (dirty) this.save(arr);
    return arr;
  },

  /* ── Helpers date ────────────────────────────────────────────── */
  _today() { const d = new Date(); d.setHours(0,0,0,0); return d; },
  _parse(s) { if (!s) return null; const d = new Date(s + 'T00:00:00'); return isNaN(d) ? null : d; },
  _isToday(s) { const d = this._parse(s); return d && d.getTime() === this._today().getTime(); },
  _isLate(s)  { const d = this._parse(s); return d && d.getTime() <  this._today().getTime(); },
  _isWeek(s)  {
    const d = this._parse(s); if (!d) return false;
    const t = this._today(); const e = new Date(t); e.setDate(e.getDate() + 7);
    return d >= t && d <= e;
  },
  _fmtBadge(s) {
    const d = this._parse(s); if (!d) return '';
    const diff = Math.round((d - this._today()) / 86400000);
    if (diff === 0)   return "Aujourd'hui";
    if (diff === 1)   return 'Demain';
    if (diff === -1)  return 'Hier';
    if (diff > 1  && diff < 7)  return d.toLocaleDateString('fr-FR', { weekday: 'long' });
    if (diff < -1 && diff > -7) return `Il y a ${-diff}j`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  },
  _nextDate(dateStr, recur) {
    const d = this._parse(dateStr); if (!d || recur === 'none') return '';
    if (recur === 'daily')   d.setDate(d.getDate() + 1);
    if (recur === 'weekly')  d.setDate(d.getDate() + 7);
    if (recur === 'monthly') d.setMonth(d.getMonth() + 1);
    if (recur === 'yearly')  d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  },

  /* ── Projets Kanban ──────────────────────────────────────────── */
  _projects() {
    if (!window.App || !App.CLIENTS) return [];
    const out = [];
    App.CLIENTS.forEach(c => {
      const arr = App.load(`${App.KEYS.PROJECTS}_${c.id}`, []);
      arr.forEach(p => out.push({
        id: p.id, name: p.name || p.title || '(sans nom)',
        clientName: c.name, clientColor: c.color,
      }));
    });
    return out;
  },
  _projectById(refId) {
    if (!refId) return null;
    return this._projects().find(p => p.id === refId) || null;
  },

  /* ── Échappement HTML ────────────────────────────────────────── */
  _esc(s) {
    return window.escHtml ? escHtml(s)
      : String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  },

  /* ── ID unique ───────────────────────────────────────────────── */
  _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

  /* ── Rendu principal ─────────────────────────────────────────── */
  render() {
    const todos = this.load();
    const cats  = this.loadCats();
    const prefs = this.loadPrefs();
    const $list = document.getElementById('todoList');
    if (!$list) return;

    /* Densité */
    const hero = document.getElementById('todoHero');
    if (hero) hero.dataset.density = prefs.density;

    /* Compteurs */
    const counts = {
      all:   todos.filter(t => !t.parentId && !t.done).length,
      today: todos.filter(t => !t.parentId && !t.done && this._isToday(t.dueDate)).length,
      week:  todos.filter(t => !t.parentId && !t.done && this._isWeek(t.dueDate)).length,
      late:  todos.filter(t => !t.parentId && !t.done && this._isLate(t.dueDate)).length,
    };
    const $counter = document.getElementById('todoCounter');
    if ($counter) $counter.textContent = `${counts.all} restante(s)`;
    document.querySelectorAll('.todo-filter-count').forEach(el => {
      el.textContent = counts[el.dataset.count] || 0;
    });
    document.querySelectorAll('.todo-filter').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === this._filter);
    });

    /* Sélecteur catégorie du champ d'ajout */
    const $catSel = document.getElementById('todoCatSelect');
    if ($catSel) {
      const cur = $catSel.value || '';
      $catSel.innerHTML =
        '<option value="">Sans étiquette</option>' +
        cats.map(c => `<option value="${c.id}" ${c.id === cur ? 'selected' : ''}>${this._esc(c.name)}</option>`).join('') +
        '<option disabled>──────────</option>' +
        '<option value="__new__">+ Nouvelle étiquette…</option>';
    }

    /* Index */
    const catById = {}; cats.forEach(c => { catById[c.id] = c; });
    const subsByParent = {};
    todos.forEach(t => {
      if (t.parentId) (subsByParent[t.parentId] = subsByParent[t.parentId] || []).push(t);
    });
    Object.values(subsByParent).forEach(a => a.sort((x, y) => (x.order ?? 0) - (y.order ?? 0)));

    /* Filtre + tri actives */
    const filtered = this._applyFilter(todos);
    const active = filtered.filter(t => !t.parentId && !t.done)
                           .sort((a, b) => {
                             if (a.priority !== b.priority) return a.priority ? -1 : 1;
                             return (a.order ?? 0) - (b.order ?? 0);
                           });
    const done = todos.filter(t => !t.parentId && t.done)
                      .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));

    /* Liste active */
    if (active.length === 0) {
      $list.innerHTML = this._renderEmpty();
    } else {
      $list.innerHTML = active.map(t => this._renderItem(t, catById, subsByParent[t.id] || [])).join('');
    }

    /* Section terminées */
    const $block   = document.getElementById('todoDoneBlock');
    const $doneList = document.getElementById('todoDoneList');
    const $doneCount = document.getElementById('todoDoneCount');
    const $tog       = document.getElementById('todoDoneToggle');
    const $clearRow  = document.getElementById('todoClearDoneRow');
    if ($block) {
      if (done.length === 0) {
        $block.style.display = 'none';
      } else {
        $block.style.display = 'block';
        if ($doneCount) $doneCount.textContent = done.length;
        if ($tog) $tog.setAttribute('aria-expanded', this._doneOpen ? 'true' : 'false');
        if ($doneList) {
          $doneList.style.display = this._doneOpen ? 'flex' : 'none';
          $doneList.innerHTML = done.map(t => this._renderItem(t, catById, subsByParent[t.id] || [])).join('');
        }
        if ($clearRow) $clearRow.style.display = this._doneOpen ? 'flex' : 'none';
      }
    }

    /* Refresh panneau */
    if (this._detailId) {
      const open = todos.find(t => t.id === this._detailId);
      if (!open) this.closeDetail();
      else this._fillDetail(open);
    }
  },

  _applyFilter(todos) {
    if (this._filter === 'all')   return todos;
    if (this._filter === 'today') return todos.filter(t => this._isToday(t.dueDate));
    if (this._filter === 'week')  return todos.filter(t => this._isWeek(t.dueDate));
    if (this._filter === 'late')  return todos.filter(t => this._isLate(t.dueDate) && !t.done);
    return todos;
  },

  _renderEmpty() {
    const msg = {
      all:   { t: 'Aucune tâche pour le moment',  s: 'Ajoutez une tâche ci-dessus pour commencer.' },
      today: { t: "Rien à faire aujourd'hui",     s: 'Profitez-en !' },
      week:  { t: 'Aucune tâche cette semaine',   s: 'Pensez à planifier vos prochaines actions.' },
      late:  { t: 'Aucune tâche en retard',       s: 'Bravo, tout est sous contrôle.' },
    }[this._filter] || { t: 'Aucune tâche', s: '' };
    return `<div class="todo-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      <p>${msg.t}</p><p class="sub">${msg.s}</p>
    </div>`;
  },

  _renderItem(t, catById, subs) {
    const cat   = t.catId ? catById[t.catId] : null;
    const color = t.priority ? this.PRIO_COLOR : (cat ? cat.color : this.UNCAT_COLOR);
    const tagText = t.priority ? 'Priorité ultime' : (cat ? cat.name : 'Sans étiquette');
    const project = t.projectRef ? this._projectById(t.projectRef) : null;

    /* Badges meta */
    let badges = '';
    if (t.dueDate) {
      const late = this._isLate(t.dueDate) && !t.done;
      const today = this._isToday(t.dueDate) && !t.done;
      const mod = late ? ' todo-badge--late' : (today ? ' todo-badge--today' : '');
      badges += `<span class="todo-badge${mod}" title="Échéance">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${this._fmtBadge(t.dueDate)}
      </span>`;
    }
    if (t.recurrence && t.recurrence !== 'none') {
      badges += `<span class="todo-badge todo-badge--icon" title="Tâche récurrente"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></span>`;
    }
    if (subs.length > 0) {
      const done = subs.filter(s => s.done).length;
      badges += `<span class="todo-badge" title="${done}/${subs.length} sous-tâches">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        ${done}/${subs.length}
      </span>`;
    }
    if (t.notes) {
      badges += `<span class="todo-badge todo-badge--icon" title="Cette tâche a des notes"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg></span>`;
    }

    const projectChip = project
      ? `<span class="todo-project" style="--pc:${project.clientColor || '#64748b'}" title="${this._esc(project.clientName)} · ${this._esc(project.name)}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
          ${this._esc(project.name)}
        </span>`
      : '';

    const subRows = subs.map(s => `
      <div class="todo-sub${s.done ? ' is-done' : ''}" data-id="${s.id}">
        <button class="todo-sub-check" data-action="toggle" data-id="${s.id}" aria-label="Cocher">
          ${s.done
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><polyline points="7 13 10 16 17 9" stroke="#fff" stroke-width="2.5" fill="none"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/></svg>'
          }
        </button>
        <span class="todo-sub-title">${this._esc(s.text)}</span>
        <button class="todo-sub-del" data-action="del" data-id="${s.id}" aria-label="Supprimer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');

    return `
      <div class="todo-item${t.done ? ' is-done' : ''}${t.priority ? ' is-priority' : ''}"
           data-id="${t.id}" draggable="true" style="--cat-color:${color}">
        <div class="todo-row">
          <span class="todo-grip" title="Glisser pour réordonner">
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2" cy="2" r="1.3"/><circle cx="2" cy="7" r="1.3"/><circle cx="2" cy="12" r="1.3"/><circle cx="8" cy="2" r="1.3"/><circle cx="8" cy="7" r="1.3"/><circle cx="8" cy="12" r="1.3"/></svg>
          </span>
          <button class="todo-check" data-action="toggle" data-id="${t.id}" aria-label="Cocher">
            ${t.done
              ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="5"/><polyline points="7 13 10 16 17 9" stroke="#fff" stroke-width="2.5" fill="none"/></svg>'
              : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/></svg>'
            }
          </button>
          <span class="todo-title" data-action="open" data-id="${t.id}">${this._esc(t.text)}</span>
          <div class="todo-meta">${badges}</div>
          ${projectChip}
          <span class="todo-tag">
            ${t.priority ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : ''}
            ${this._esc(tagText)}
          </span>
          <button class="todo-action todo-action--prio${t.priority ? ' is-active' : ''}"
                  data-action="prio" data-id="${t.id}" title="${t.priority ? 'Retirer de la priorité' : 'Priorité ultime'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${t.priority ? '#EAB308' : 'none'}" stroke="${t.priority ? '#EAB308' : 'currentColor'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
          <button class="todo-action todo-action--sub" data-action="addsub" data-id="${t.id}" title="Ajouter une sous-tâche">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/><line x1="16" y1="3" x2="22" y2="3" stroke-width="2.5"/><line x1="19" y1="0" x2="19" y2="6" stroke-width="2.5"/></svg>
          </button>
          <button class="todo-action todo-action--del" data-action="del" data-id="${t.id}" aria-label="Supprimer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        ${subs.length > 0 ? `<div class="todo-subs">${subRows}</div>` : ''}
      </div>`;
  },

  /* ── CRUD ────────────────────────────────────────────────────── */
  add(text, catId, parentId) {
    if (!text.trim()) return null;
    const todos = this.load();
    const sibs = todos.filter(t => (parentId ? t.parentId === parentId : !t.parentId));
    const order = Math.max(-1, ...sibs.map(t => t.order ?? 0)) + 1;
    const id = this._uid();
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

    /* Récurrence : duplique à la prochaine date */
    if (item.done && item.recurrence !== 'none' && item.dueDate && !item.parentId) {
      const next = this._nextDate(item.dueDate, item.recurrence);
      if (next) {
        const rootOrder = Math.max(-1, ...todos.filter(t => !t.parentId).map(t => t.order ?? 0)) + 1;
        todos.push({
          ...item, id: this._uid(),
          done: false, doneAt: '',
          dueDate: next, order: rootOrder,
          createdAt: new Date().toISOString(),
        });
      }
    }

    /* Propagation parent → sous-tâches */
    if (!item.parentId) {
      todos.forEach(s => {
        if (s.parentId === id) { s.done = item.done; s.doneAt = item.done ? new Date().toISOString() : ''; }
      });
    } else {
      /* Si toutes les sous-tâches d'un parent sont done → cocher le parent */
      const subs = todos.filter(s => s.parentId === item.parentId);
      const parent = todos.find(t => t.id === item.parentId);
      if (parent && subs.length > 0) {
        const all = subs.every(s => s.done);
        if (all && !parent.done) { parent.done = true;  parent.doneAt = new Date().toISOString(); }
        if (!all && parent.done) { parent.done = false; parent.doneAt = ''; }
      }
    }

    this.save(todos);
    this.render();
  },

  togglePrio(id) {
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
    if (this._detailId === id) this.closeDetail();
    this.render();
  },

  clearDone() {
    const doneRootIds = this.load().filter(t => t.done && !t.parentId).map(t => t.id);
    const todos = this.load().filter(t =>
      !doneRootIds.includes(t.id) && !doneRootIds.includes(t.parentId) && !(t.done && t.parentId)
    );
    this.save(todos);
    this.render();
  },

  patch(id, fields) {
    const todos = this.load();
    const item = todos.find(t => t.id === id);
    if (!item) return;
    Object.assign(item, fields);
    this.save(todos);
    this.render();
  },

  reorder(dragId, targetId) {
    if (!dragId || dragId === targetId) return;
    const todos = this.load();
    const drag = todos.find(t => t.id === dragId);
    const target = todos.find(t => t.id === targetId);
    if (!drag || !target || drag.parentId !== target.parentId) return;
    const sibs = todos.filter(t => t.parentId === drag.parentId && !t.done && !t.priority)
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const ids = sibs.filter(t => t.id !== dragId).map(t => t.id);
    const idx = ids.indexOf(targetId);
    if (idx < 0) return;
    ids.splice(idx, 0, dragId);
    ids.forEach((id, i) => {
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
    cats.push({
      id: this._uid(), name: name.trim(),
      color: color || this.CAT_COLORS[cats.length % this.CAT_COLORS.length],
    });
    this.saveCats(cats);
    this.render();
  },
  renameCategory(id, name) {
    const cats = this.loadCats();
    const c = cats.find(x => x.id === id);
    if (!c || !name.trim()) return;
    c.name = name.trim();
    this.saveCats(cats);
    this.render();
  },
  recolorCategory(id, color) {
    const cats = this.loadCats();
    const c = cats.find(x => x.id === id);
    if (!c) return;
    c.color = color;
    this.saveCats(cats);
    this.render();
  },
  deleteCategory(id) {
    const cats = this.loadCats().filter(c => c.id !== id);
    this.saveCats(cats);
    const todos = this.load();
    todos.forEach(t => { if (t.catId === id) t.catId = ''; });
    this.save(todos);
    this.render();
  },

  /* ── Panneau détails ─────────────────────────────────────────── */
  openDetail(id) {
    const item = this.load().find(t => t.id === id);
    if (!item) return;
    this._detailId = id;
    const panel = document.getElementById('todoPanel');
    const ov = document.getElementById('todoPanelOverlay');
    if (panel) { panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); }
    if (ov)    ov.classList.add('open');
    this._fillDetail(item);
    setTimeout(() => { const e = document.getElementById('todoPanelText'); if (e) e.focus(); }, 50);
  },
  closeDetail() {
    this._detailId = null;
    const panel = document.getElementById('todoPanel');
    const ov = document.getElementById('todoPanelOverlay');
    if (panel) { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }
    if (ov)    ov.classList.remove('open');
  },
  _fillDetail(item) {
    const cats = this.loadCats();
    const projects = this._projects();
    const $ = id => document.getElementById(id);

    $('todoPanelText').value       = item.text || '';
    $('todoPanelNotes').value      = item.notes || '';
    $('todoPanelDate').value       = item.dueDate || '';
    $('todoPanelRecurrence').value = item.recurrence || 'none';

    $('todoPanelCat').innerHTML =
      '<option value="">Sans étiquette</option>' +
      cats.map(c => `<option value="${c.id}" ${c.id === item.catId ? 'selected' : ''}>${this._esc(c.name)}</option>`).join('') +
      '<option disabled>──────────</option>' +
      '<option value="__new__">+ Nouvelle étiquette…</option>';

    $('todoPanelProject').innerHTML = '<option value="">Aucun</option>' +
      projects.map(p => `<option value="${p.id}" ${p.id === item.projectRef ? 'selected' : ''}>${this._esc(p.clientName)} · ${this._esc(p.name)}</option>`).join('');

    const subs = this.load().filter(t => t.parentId === item.id)
                            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const $subs = $('todoPanelSubs');
    if (subs.length === 0) {
      $subs.innerHTML = '<p class="todo-panel-no-subs">Aucune sous-tâche</p>';
    } else {
      $subs.innerHTML = subs.map(s => `
        <div class="todo-panel-sub${s.done ? ' is-done' : ''}">
          <button class="todo-panel-sub-check" data-id="${s.id}" aria-label="Cocher">
            ${s.done
              ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><polyline points="7 13 10 16 17 9" stroke="#fff" stroke-width="2.5" fill="none"/></svg>'
              : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/></svg>'
            }
          </button>
          <span class="todo-panel-sub-title">${this._esc(s.text)}</span>
          <button class="todo-panel-sub-del" data-id="${s.id}" aria-label="Supprimer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`).join('');
    }
    const sc = $('todoPanelSubCount');
    if (sc) sc.textContent = subs.length > 0 ? `${subs.filter(s => s.done).length}/${subs.length}` : '';

    const meta = [];
    if (item.createdAt) meta.push(`Créée le ${new Date(item.createdAt).toLocaleDateString('fr-FR')}`);
    if (item.done && item.doneAt) meta.push(`Terminée le ${new Date(item.doneAt).toLocaleDateString('fr-FR')}`);
    $('todoPanelMeta').textContent = meta.join(' · ');
  },
  _commitDetail() {
    if (!this._detailId) return;
    const $ = id => document.getElementById(id);
    this.patch(this._detailId, {
      text:       $('todoPanelText').value,
      notes:      $('todoPanelNotes').value,
      dueDate:    $('todoPanelDate').value,
      recurrence: $('todoPanelRecurrence').value,
      catId:      $('todoPanelCat').value,
      projectRef: $('todoPanelProject').value,
    });
  },

  /* ── Modale étiquettes ───────────────────────────────────────── */
  openCatsModal() {
    let modal = document.getElementById('todoCatsModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'todoCatsModal';
      modal.className = 'modal-backdrop';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="modal" style="max-width:480px">
          <div class="modal-head">
            <h3>Étiquettes</h3>
            <button class="modal-close-btn" id="todoCatsModalClose" aria-label="Fermer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="todo-cats-add">
              <input type="text" id="todoNewCatName" class="form-input" placeholder="Nom de l'étiquette…" />
              <input type="color" id="todoNewCatColor" class="todo-color" value="#6366F1" title="Couleur" />
              <button class="btn btn-primary btn-sm" id="todoNewCatAdd">Ajouter</button>
            </div>
            <div id="todoCatsList" class="todo-cats-list"></div>
          </div>
        </div>`;
      document.body.appendChild(modal);

      modal.addEventListener('click', e => { if (e.target === modal) this.closeCatsModal(); });
      modal.querySelector('#todoCatsModalClose').addEventListener('click', () => this.closeCatsModal());
      modal.querySelector('#todoNewCatAdd').addEventListener('click', () => {
        const n = modal.querySelector('#todoNewCatName');
        const c = modal.querySelector('#todoNewCatColor');
        if (n.value.trim()) {
          this.addCategory(n.value, c.value);
          n.value = '';
          this._renderCatsList();
        }
      });
      modal.querySelector('#todoNewCatName').addEventListener('keydown', e => {
        if (e.key === 'Enter') modal.querySelector('#todoNewCatAdd').click();
      });
      modal.querySelector('#todoCatsList').addEventListener('click', e => {
        const d = e.target.closest('.todo-cats-row-del');
        if (d && confirm('Supprimer cette étiquette ?')) {
          this.deleteCategory(d.dataset.id);
          this._renderCatsList();
        }
      });
      modal.querySelector('#todoCatsList').addEventListener('input', e => {
        const id = e.target.dataset.id; if (!id) return;
        if (e.target.classList.contains('todo-cats-row-name'))  this.renameCategory(id, e.target.value);
        if (e.target.classList.contains('todo-cats-row-color')) this.recolorCategory(id, e.target.value);
      });
    }
    this._renderCatsList();
    if (window.App && App.openModal) App.openModal('todoCatsModal');
    else {
      modal.style.display = 'flex';
      requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('visible')));
    }
  },
  closeCatsModal() {
    const m = document.getElementById('todoCatsModal');
    if (!m) return;
    if (window.App && App.closeModal) App.closeModal('todoCatsModal');
    else {
      m.classList.remove('visible');
      setTimeout(() => { m.style.display = 'none'; }, 200);
    }
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
        <input type="color" class="todo-cats-row-color todo-color" data-id="${c.id}" value="${c.color}" title="Couleur" />
        <input type="text"  class="todo-cats-row-name form-input"   data-id="${c.id}" value="${this._esc(c.name)}" />
        <button class="todo-cats-row-del" data-id="${c.id}" title="Supprimer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');
  },

  /* ── Init : bindings ─────────────────────────────────────────── */
  init() {
    this.render();

    const $ = id => document.getElementById(id);
    const input    = $('todoInput');
    const addBtn   = $('todoAddBtn');
    const catSel   = $('todoCatSelect');
    const list     = $('todoList');
    const doneList = $('todoDoneList');
    const clearBtn = $('todoClearDone');
    const catsBtn  = $('todoCatsBtn');
    const densBtn  = $('todoDensityBtn');
    const filters  = $('todoFilters');
    const doneTog  = $('todoDoneToggle');

    /* Ajout */
    const doAdd = () => {
      this.add(input.value, catSel ? catSel.value : '');
      input.value = '';
      input.focus();
    };
    addBtn && addBtn.addEventListener('click', doAdd);
    input  && input.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });

    /* Sentinelle "+ Nouvelle étiquette…" dans le sélecteur d'ajout */
    catSel && catSel.addEventListener('change', () => {
      if (catSel.value === '__new__') {
        catSel.value = '';
        this.openCatsModal();
      }
    });

    /* Délégation : actions sur items */
    const onItemClick = e => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const id = el.dataset.id;
      const a  = el.dataset.action;
      if (a === 'toggle') this.toggle(id);
      else if (a === 'prio')   this.togglePrio(id);
      else if (a === 'del')    this.remove(id);
      else if (a === 'open')   this.openDetail(id);
      else if (a === 'addsub') {
        const txt = prompt('Sous-tâche :');
        if (txt) this.add(txt, '', id);
      }
    };
    list     && list.addEventListener('click', onItemClick);
    doneList && doneList.addEventListener('click', onItemClick);

    /* Drag & drop sur liste active */
    if (list) {
      list.addEventListener('dragstart', e => {
        const item = e.target.closest('.todo-item');
        if (!item) return;
        this._dragId = item.dataset.id;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      list.addEventListener('dragend', e => {
        const item = e.target.closest('.todo-item');
        if (item) item.classList.remove('dragging');
        this._dragId = null;
        list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });
      list.addEventListener('dragover', e => {
        const item = e.target.closest('.todo-item');
        if (!item || item.dataset.id === this._dragId) return;
        e.preventDefault();
        list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        item.classList.add('drag-over');
      });
      list.addEventListener('drop', e => {
        const item = e.target.closest('.todo-item');
        if (!item || !this._dragId) return;
        e.preventDefault();
        this.reorder(this._dragId, item.dataset.id);
      });
    }

    /* Filtres */
    filters && filters.addEventListener('click', e => {
      const b = e.target.closest('.todo-filter');
      if (!b) return;
      this._filter = b.dataset.filter;
      this.render();
    });

    /* Terminées repliable */
    doneTog && doneTog.addEventListener('click', () => {
      this._doneOpen = !this._doneOpen;
      this.render();
    });

    /* Clear done */
    clearBtn && clearBtn.addEventListener('click', () => {
      if (confirm('Supprimer toutes les tâches terminées ?')) this.clearDone();
    });

    /* Étiquettes / densité */
    catsBtn && catsBtn.addEventListener('click', () => this.openCatsModal());
    densBtn && densBtn.addEventListener('click', () => {
      const p = this.loadPrefs();
      p.density = p.density === 'compact' ? 'comfort' : 'compact';
      this.savePrefs(p);
      this.render();
    });

    /* ── Panneau détails ───────────────────────────────────────── */
    const panel = $('todoPanel');
    const closeBtn = $('todoPanelClose');
    const delBtn   = $('todoPanelDel');
    const overlay  = $('todoPanelOverlay');
    const subAdd   = $('todoPanelSubAddBtn');
    const subIn    = $('todoPanelSubInput');
    const subsEl   = $('todoPanelSubs');

    closeBtn && closeBtn.addEventListener('click', () => { this._commitDetail(); this.closeDetail(); });
    overlay  && overlay.addEventListener('click',  () => { this._commitDetail(); this.closeDetail(); });
    delBtn   && delBtn.addEventListener('click',   () => {
      if (this._detailId && confirm('Supprimer cette tâche ?')) this.remove(this._detailId);
    });

    /* Auto-save sur change/blur */
    ['todoPanelText','todoPanelNotes','todoPanelDate','todoPanelRecurrence','todoPanelCat','todoPanelProject']
      .forEach(id => {
        const el = $(id); if (!el) return;
        el.addEventListener('change', () => this._commitDetail());
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.addEventListener('blur', () => this._commitDetail());
        }
      });

    /* Sentinelle "+ Nouvelle étiquette…" dans le sélecteur du panneau */
    const panelCat = $('todoPanelCat');
    panelCat && panelCat.addEventListener('change', () => {
      if (panelCat.value === '__new__') {
        panelCat.value = '';
        this.openCatsModal();
      }
    });

    /* Ajout sous-tâche depuis panneau */
    const doAddSub = () => {
      if (!this._detailId || !subIn.value.trim()) return;
      this.add(subIn.value, '', this._detailId);
      subIn.value = '';
      subIn.focus();
    };
    subAdd && subAdd.addEventListener('click', doAddSub);
    subIn  && subIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAddSub(); } });

    /* Sous-tâches du panneau */
    subsEl && subsEl.addEventListener('click', e => {
      const c = e.target.closest('.todo-panel-sub-check');
      if (c) { this.toggle(c.dataset.id); return; }
      const d = e.target.closest('.todo-panel-sub-del');
      if (d) { this.remove(d.dataset.id); return; }
    });

    /* Raccourcis clavier (panneau ouvert) */
    document.addEventListener('keydown', e => {
      if (!panel || !panel.classList.contains('open')) return;
      if (e.key === 'Escape') this.closeDetail();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        this._commitDetail();
        this.closeDetail();
      }
    });
  },
};
