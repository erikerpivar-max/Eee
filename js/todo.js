/* ================================================================
   THE HOUSE — todo.js
   To Do List : liste plate, étiquettes catégorie à droite,
   cadre couleur autour de la tâche, priorité ultime épinglée.
   ================================================================ */

'use strict';

window.TodoList = {

  KEY:      'th_todos',
  KEY_CATS: 'th_todo_cats',

  CAT_COLORS: [
    '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#84CC16',
  ],

  PRIORITY_COLOR: '#EAB308',
  UNCAT_COLOR:    '#94A3B8',

  /* ── Persistance ─────────────────────────────────────────────── */
  load() {
    try {
      const v = localStorage.getItem(this.KEY);
      return v !== null ? JSON.parse(v) : [];
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

  /* ── Rendu principal ─────────────────────────────────────────── */
  render() {
    const todos   = this.load();
    const cats    = this.loadCats();
    const list    = document.getElementById('todoList');
    const counter = document.getElementById('todo-counter');
    const footer  = document.getElementById('todoFooter');
    if (!list) return;

    const remaining = todos.filter(t => !t.done).length;
    const doneCount = todos.filter(t => t.done).length;

    if (counter) counter.textContent = `${remaining} restante(s)`;
    if (footer)  footer.style.display = doneCount > 0 ? 'flex' : 'none';

    /* Sélecteur de catégorie au-dessus du champ */
    const catSelect = document.getElementById('todoCatSelect');
    if (catSelect) {
      const currentVal = catSelect.value || '';
      catSelect.innerHTML = '<option value="">Sans étiquette</option>' +
        cats.map(c => `<option value="${c.id}" ${c.id === currentVal ? 'selected' : ''}>${this._esc(c.name)}</option>`).join('');
    }

    /* Index pour retrouver la catégorie d'une tâche */
    const catById = {};
    cats.forEach(c => { catById[c.id] = c; });

    /* Ordre : priorité d'abord, puis non terminées, puis terminées */
    const sorted = todos.slice().sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      if (a.done !== b.done) return a.done ? 1 : -1;
      return 0;
    });

    if (sorted.length === 0) {
      list.innerHTML = `<div class="todo-empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <p>Aucune tâche pour le moment</p>
        <p class="todo-empty-sub">Ajoutez une tâche ci-dessus pour commencer.</p>
      </div>`;
      return;
    }

    list.innerHTML = sorted.map(t => this._renderItem(t, catById)).join('');
  },

  _renderItem(t, catById) {
    const cat = t.catId ? catById[t.catId] : null;
    const color = t.priority ? this.PRIORITY_COLOR : (cat ? cat.color : this.UNCAT_COLOR);
    const labelText = t.priority ? 'Priorité ultime' : (cat ? cat.name : 'Sans étiquette');

    return `
      <div class="todo-item${t.done ? ' todo-done' : ''}${t.priority ? ' todo-item-priority' : ''}"
           data-id="${t.id}" style="--cat-color:${color}">
        <button class="todo-check" data-id="${t.id}" aria-label="Cocher">
          ${t.done
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="5" fill="var(--cat-color)" stroke="var(--cat-color)"/><polyline points="7 13 10 16 17 9" stroke="#fff" stroke-width="2.5"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/></svg>'
          }
        </button>
        <span class="todo-text">${this._esc(t.text)}</span>
        <span class="todo-tag" title="${this._esc(labelText)}">
          ${t.priority ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:4px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : ''}
          ${this._esc(labelText)}
        </span>
        <button class="todo-prio-btn${t.priority ? ' active' : ''}" data-id="${t.id}" title="${t.priority ? 'Retirer de la priorité' : 'Priorité ultime'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${t.priority ? '#EAB308' : 'none'}" stroke="${t.priority ? '#EAB308' : 'currentColor'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
        <button class="todo-del" data-id="${t.id}" aria-label="Supprimer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
  },

  _esc(s) { return window.escHtml ? escHtml(s) : String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); },

  /* ── Actions sur tâches ──────────────────────────────────────── */
  add(text, catId) {
    if (!text.trim()) return;
    const todos = this.load();
    todos.push({
      id:        Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text:      text.trim(),
      done:      false,
      catId:     catId || '',
      priority:  false,
      createdAt: new Date().toISOString(),
    });
    this.save(todos);
    this.render();
  },

  _pendingDeletes: {},

  toggle(id) {
    const todos = this.load();
    const item = todos.find(t => t.id === id);
    if (!item) return;
    item.done = !item.done;
    this.save(todos);
    this.render();

    if (item.done) {
      if (this._pendingDeletes[id]) clearTimeout(this._pendingDeletes[id]);
      this._pendingDeletes[id] = setTimeout(() => {
        delete this._pendingDeletes[id];
        this.remove(id);
      }, 5000);
    } else if (this._pendingDeletes[id]) {
      clearTimeout(this._pendingDeletes[id]);
      delete this._pendingDeletes[id];
    }
  },

  togglePriority(id) {
    const todos = this.load();
    const item = todos.find(t => t.id === id);
    if (!item) return;
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
    const todos = this.load().filter(t => t.id !== id);
    this.save(todos);
    this.render();
  },

  clearDone() {
    const todos = this.load().filter(t => !t.done);
    this.save(todos);
    this.render();
  },

  /* ── Catégories ──────────────────────────────────────────────── */
  addCategory(name, color) {
    if (!name.trim()) return;
    const cats = this.loadCats();
    const c = color || this.CAT_COLORS[cats.length % this.CAT_COLORS.length];
    cats.push({
      id:    Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name:  name.trim(),
      color: c,
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

  /* ── Modale de gestion des étiquettes ────────────────────────── */
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
        if (delBtn) {
          if (confirm('Supprimer cette étiquette ? Les tâches associées resteront sans étiquette.')) {
            this.deleteCategory(delBtn.dataset.id);
            this._renderCatsList();
          }
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
    const clearBtn = document.getElementById('todoClearDone');
    const catsBtn  = document.getElementById('todoManageCatsBtn');

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const catSel = document.getElementById('todoCatSelect');
        this.add(input.value, catSel ? catSel.value : '');
        input.value = '';
        input.focus();
      });
    }

    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const catSel = document.getElementById('todoCatSelect');
          this.add(input.value, catSel ? catSel.value : '');
          input.value = '';
        }
      });
    }

    if (list) {
      list.addEventListener('click', e => {
        const checkBtn = e.target.closest('.todo-check');
        if (checkBtn) { this.toggle(checkBtn.dataset.id); return; }
        const prioBtn = e.target.closest('.todo-prio-btn');
        if (prioBtn)  { this.togglePriority(prioBtn.dataset.id); return; }
        const delBtn  = e.target.closest('.todo-del');
        if (delBtn)   { this.remove(delBtn.dataset.id); return; }
      });
    }

    if (clearBtn) clearBtn.addEventListener('click', () => this.clearDone());
    if (catsBtn)  catsBtn.addEventListener('click', () => this.openCatsModal());
  },
};
