/* ================================================================
   THE HOUSE — todo.js
   To Do List widget intégré au Dashboard
   ================================================================ */

'use strict';

window.TodoList = {

  KEY: 'th_todos',

  load() {
    try {
      const v = localStorage.getItem(this.KEY);
      return v !== null ? JSON.parse(v) : [];
    } catch { return []; }
  },

  save(todos) {
    try { localStorage.setItem(this.KEY, JSON.stringify(todos)); } catch(e) {}
  },

  render() {
    const todos = this.load();
    const list  = document.getElementById('todoList');
    const counter = document.getElementById('todo-counter');
    const footer  = document.getElementById('todoFooter');
    if (!list) return;

    const remaining = todos.filter(t => !t.done).length;
    const doneCount = todos.filter(t => t.done).length;

    if (counter) counter.textContent = `${remaining} restante(s)`;
    if (footer) footer.style.display = doneCount > 0 ? 'flex' : 'none';

    if (todos.length === 0) {
      list.innerHTML = '<li class="todo-empty">Aucune tâche pour le moment.</li>';
      return;
    }

    list.innerHTML = todos.map(t => `
      <li class="todo-item${t.done ? ' todo-done' : ''}" data-id="${t.id}">
        <button class="todo-check" data-id="${t.id}" aria-label="Cocher">
          ${t.done
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="4" fill="var(--primary)" stroke="var(--primary)"/><polyline points="7 13 10 16 17 9" stroke="#fff" stroke-width="2.5"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>'
          }
        </button>
        <span class="todo-text">${window.escHtml ? escHtml(t.text) : t.text}</span>
        <button class="todo-del" data-id="${t.id}" aria-label="Supprimer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </li>
    `).join('');
  },

  add(text) {
    if (!text.trim()) return;
    const todos = this.load();
    todos.push({
      id:   Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text: text.trim(),
      done: false,
      createdAt: new Date().toISOString(),
    });
    this.save(todos);
    this.render();
  },

  toggle(id) {
    const todos = this.load();
    const item = todos.find(t => t.id === id);
    if (item) {
      item.done = !item.done;
      /* Trier : non-faites en haut, faites en bas */
      todos.sort((a, b) => a.done - b.done);
      this.save(todos);
      this.render();
    }
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

  init() {
    this.render();

    const input  = document.getElementById('todoInput');
    const addBtn = document.getElementById('todoAddBtn');
    const list   = document.getElementById('todoList');
    const clearBtn = document.getElementById('todoClearDone');

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.add(input.value);
        input.value = '';
        input.focus();
      });
    }

    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          this.add(input.value);
          input.value = '';
        }
      });
    }

    if (list) {
      list.addEventListener('click', e => {
        const checkBtn = e.target.closest('.todo-check');
        if (checkBtn) { this.toggle(checkBtn.dataset.id); return; }

        const delBtn = e.target.closest('.todo-del');
        if (delBtn) { this.remove(delBtn.dataset.id); return; }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearDone());
    }
  },
};
