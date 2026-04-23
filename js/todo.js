/* ================================================================
   THE HOUSE — todo.js
   To Do List widget avec catégories + priorité ultime
   ================================================================ */

'use strict';

window.TodoList = {

  KEY:      'th_todos',
  KEY_CATS: 'th_todo_cats',

  /* ── Catégories par défaut (couleurs) ────────────────────────── */
  CAT_COLORS: [
    '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#84CC16',
  ],

  PRIORITY_COLOR: '#EAB308',

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
    if (footer) footer.style.display = doneCount > 0 ? 'flex' : 'none';

    /* ── Rendu du sélecteur de catégorie ───────────────────────── */
    const catSelect = document.getElementById('todoCatSelect');
    if (catSelect) {
      const currentVal = catSelect.value || '';
      catSelect.innerHTML = '<option value="">Sans catégorie</option>' +
        cats.map(c => `<option value="${c.id}" ${c.id === currentVal ? 'selected' : ''}>${window.escHtml ? escHtml(c.name) : c.name}</option>`).join('');
    }

    /* ── Construction des sections ────────────────────────────── */
    let html = '';

    /* 1) PRIORITÉ ULTIME (jaune) — max 1 tâche */
    const priorityTask = todos.find(t => t.priority);
    html += `<div class="todo-cat-section todo-priority-section" style="--cat-color:${this.PRIORITY_COLOR}">
      <div class="todo-cat-header" style="background:${this.PRIORITY_COLOR}22;border-left:3px solid ${this.PRIORITY_COLOR}">
        <span class="todo-cat-label" style="color:${this.PRIORITY_COLOR}">Priorité ultime</span>
      </div>
      <div class="todo-cat-items">`;

    if (priorityTask) {
      html += this._renderItem(priorityTask);
    } else {
      html += '<div class="todo-cat-empty">Glissez ou marquez une tâche comme priorité ultime</div>';
    }
    html += '</div></div>';

    /* 2) Tâches par catégorie */
    cats.forEach(cat => {
      const catTodos = todos.filter(t => t.catId === cat.id && !t.priority);
      html += `<div class="todo-cat-section" style="--cat-color:${cat.color}">
        <div class="todo-cat-header" style="background:${cat.color}22;border-left:3px solid ${cat.color}">
          <span class="todo-cat-label" style="color:${cat.color}">${window.escHtml ? escHtml(cat.name) : cat.name}</span>
          <button class="todo-cat-del-btn" data-cat-id="${cat.id}" title="Supprimer la catégorie">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="todo-cat-items">`;

      if (catTodos.length === 0) {
        html += '<div class="todo-cat-empty">Aucune tâche</div>';
      } else {
        catTodos.sort((a, b) => a.done - b.done);
        html += catTodos.map(t => this._renderItem(t)).join('');
      }
      html += '</div></div>';
    });

    /* 3) Sans catégorie */
    const uncatTodos = todos.filter(t => !t.catId && !t.priority);
    if (uncatTodos.length > 0 || cats.length === 0) {
      html += `<div class="todo-cat-section" style="--cat-color:var(--text-3)">
        <div class="todo-cat-header" style="background:var(--bg);border-left:3px solid var(--text-3)">
          <span class="todo-cat-label" style="color:var(--text-3)">Sans catégorie</span>
        </div>
        <div class="todo-cat-items">`;
      if (uncatTodos.length === 0) {
        html += '<div class="todo-cat-empty">Aucune tâche</div>';
      } else {
        uncatTodos.sort((a, b) => a.done - b.done);
        html += uncatTodos.map(t => this._renderItem(t)).join('');
      }
      html += '</div></div>';
    }

    list.innerHTML = html;
  },

  _renderItem(t) {
    const esc = window.escHtml ? escHtml : s => s;
    return `
      <div class="todo-item${t.done ? ' todo-done' : ''}${t.priority ? ' todo-item-priority' : ''}" data-id="${t.id}">
        <button class="todo-check" data-id="${t.id}" aria-label="Cocher">
          ${t.done
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="4" fill="var(--primary)" stroke="var(--primary)"/><polyline points="7 13 10 16 17 9" stroke="#fff" stroke-width="2.5"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>'
          }
        </button>
        <span class="todo-text">${esc(t.text)}</span>
        <button class="todo-prio-btn${t.priority ? ' active' : ''}" data-id="${t.id}" title="${t.priority ? 'Retirer de la priorité' : 'Priorité ultime'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${t.priority ? '#EAB308' : 'none'}" stroke="${t.priority ? '#EAB308' : 'currentColor'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
        <button class="todo-del" data-id="${t.id}" aria-label="Supprimer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
  },

  /* ── Actions ─────────────────────────────────────────────────── */
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
    if (item) {
      item.done = !item.done;
      this.save(todos);
      this.render();

      if (item.done) {
        /* Suppression auto après 5 secondes */
        if (this._pendingDeletes[id]) clearTimeout(this._pendingDeletes[id]);
        this._pendingDeletes[id] = setTimeout(() => {
          delete this._pendingDeletes[id];
          this.remove(id);
        }, 5000);
      } else {
        /* Décochée → annuler la suppression */
        if (this._pendingDeletes[id]) {
          clearTimeout(this._pendingDeletes[id]);
          delete this._pendingDeletes[id];
        }
      }
    }
  },

  togglePriority(id) {
    const todos = this.load();
    const item = todos.find(t => t.id === id);
    if (!item) return;

    if (item.priority) {
      /* Retirer */
      item.priority = false;
    } else {
      /* Retirer la priorité des autres */
      todos.forEach(t => { t.priority = false; });
      item.priority = true;
    }
    this.save(todos);
    this.render();
  },

  remove(id) {
    let todos = this.load();
    todos = todos.filter(t => t.id !== id);
    this.save(todos);
    this.render();
  },

  clearDone() {
    let todos = this.load();
    todos = todos.filter(t => !t.done);
    this.save(todos);
    this.render();
  },

  /* ── Catégories ─────────────────────────────────────────────── */
  addCategory(name) {
    if (!name.trim()) return;
    const cats = this.loadCats();
    const colorIdx = cats.length % this.CAT_COLORS.length;
    cats.push({
      id:    Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name:  name.trim(),
      color: this.CAT_COLORS[colorIdx],
    });
    this.saveCats(cats);
    this.render();
  },

  deleteCategory(catId) {
    let cats = this.loadCats();
    cats = cats.filter(c => c.id !== catId);
    this.saveCats(cats);
    /* Retirer la catégorie des tâches */
    const todos = this.load();
    todos.forEach(t => { if (t.catId === catId) t.catId = ''; });
    this.save(todos);
    this.render();
  },

  /* ── Init ─────────────────────────────────────────────────────── */
  init() {
    this.render();

    const input    = document.getElementById('todoInput');
    const addBtn   = document.getElementById('todoAddBtn');
    const list     = document.getElementById('todoList');
    const clearBtn = document.getElementById('todoClearDone');
    const addCatBtn = document.getElementById('todoAddCatBtn');

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
        if (prioBtn) { this.togglePriority(prioBtn.dataset.id); return; }

        const delBtn = e.target.closest('.todo-del');
        if (delBtn) { this.remove(delBtn.dataset.id); return; }

        const catDelBtn = e.target.closest('.todo-cat-del-btn');
        if (catDelBtn) { this.deleteCategory(catDelBtn.dataset.catId); return; }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearDone());
    }

    if (addCatBtn) {
      addCatBtn.addEventListener('click', () => {
        const name = prompt('Nom de la nouvelle catégorie :');
        if (name) this.addCategory(name);
      });
    }
  },
};
