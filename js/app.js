/* ================================================================
   THE HOUSE — app.js
   Navigation, modales, utilitaires globaux, initialisation
   ================================================================ */

'use strict';

/* ─── Namespace global App ──────────────────────────────────────── */
window.App = {

  CLIENTS: [
    { id: 'ixina-ath',     name: 'Ixina Ath',          initials: 'IA', color: '#6366F1', bg: '#EEF2FF' },
    { id: 'ixina-tours',   name: 'Ixina Tours et taxi', initials: 'IT', color: '#F59E0B', bg: '#FFF7ED' },
    { id: 'ixina-ixelles', name: 'Ixina Ixelles',       initials: 'II', color: '#10B981', bg: '#ECFDF5' },
  ],

  STAGES: [
    { id: 'scripting',    label: 'Scripting',    color: '#6366F1', bg: '#EEF2FF' },
    { id: 'tournage',     label: 'Tournage',     color: '#D97706', bg: '#FFF7ED' },
    { id: 'montage',      label: 'Montage',      color: '#2563EB', bg: '#EFF6FF' },
    { id: 'verification', label: 'Vérification', color: '#059669', bg: '#ECFDF5' },
  ],

  KEYS: {
    TASKS:    'th_tasks',
    PROJECTS: 'th_projects',
    PUBCAL:   'th_pubcal',
  },

  currentView: 'dashboard',

  /* ── Utilitaires ─────────────────────────────────────────────── */
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  save(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
  },

  load(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },

  today() {
    return new Date().toISOString().split('T')[0];
  },

  fmtDur(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${String(m).padStart(2,'0')}min`;
    return `${m}min`;
  },

  fmtClock(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  },

  fmtDate(isoStr) {
    const d = new Date(isoStr + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  },

  fmtDateLong(date = new Date()) {
    return date.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  },

  getStage(id)  { return this.STAGES.find(s => s.id === id) || this.STAGES[0]; },
  getClient(id) { return this.CLIENTS.find(c => c.id === id); },

  /* ── Navigation ──────────────────────────────────────────────── */
  PAGE_TITLES: {
    'dashboard':   'Dashboard',
    'timetracker': 'Time Tracking',
    'kanban':      'Kanban',
    'publication': 'Publication',
  },

  navigateTo(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const view = document.getElementById(`view-${viewId}`);
    if (view) view.classList.add('active');

    const link = document.querySelector(`.nav-link[data-view="${viewId}"]`);
    if (link) link.classList.add('active');

    const titleEl = document.getElementById('topbarTitle');
    if (titleEl) titleEl.textContent = this.PAGE_TITLES[viewId] || viewId;

    this.currentView = viewId;

    if (viewId === 'dashboard')   Dashboard.refresh();
    if (viewId === 'timetracker') TimeTracker.renderTable();
    if (viewId === 'kanban')      Kanban.renderView();
    if (viewId === 'publication') PubCal.renderView();

    if (window.innerWidth < 1024) {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('active');
    }
  },

  /* ── Modales ─────────────────────────────────────────────────── */
  openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('visible');
    setTimeout(() => { el.style.display = 'none'; }, 200);
  },
};

/* ─── Module Dashboard ──────────────────────────────────────────── */
window.Dashboard = {
  refresh() {
    this._stats();
    this._contentAdvance();
    this._recentTasks();
  },

  _stats() {
    const tasks   = App.load(App.KEYS.TASKS, []);
    const today   = App.today();
    const todayTs = tasks.filter(t => t.date === today);
    const total   = todayTs.reduce((s, t) => s + (t.totalDuration || 0), 0);

    const el1 = document.getElementById('stat-today-time');
    const el2 = document.getElementById('stat-tasks-count');
    if (el1) el1.textContent = total > 0 ? App.fmtDur(total) : '0h 00min';
    if (el2) el2.textContent = todayTs.length;
  },

  _contentAdvance() {
    const el = document.getElementById('content-advance-grid');
    if (!el) return;

    el.innerHTML = App.CLIENTS.map(client => {
      const days = PubCal.getDaysAdvance(client.id);

      let color, label, status;
      if (days === null) {
        color  = 'var(--text-3)';
        label  = 'Aucune donnée';
        status = 'none';
      } else if (days > 30) {
        color  = 'var(--success)';
        label  = `${days}j d'avance`;
        status = 'good';
      } else if (days >= 15) {
        color  = 'var(--warning)';
        label  = `${days}j d'avance`;
        status = 'warning';
      } else if (days >= 0) {
        color  = 'var(--danger)';
        label  = `${days}j d'avance`;
        status = 'danger';
      } else {
        color  = 'var(--danger)';
        label  = `En retard (${Math.abs(days)}j)`;
        status = 'critical';
      }

      /* Barre : 100% = 30 jours, capped */
      const pct = days === null ? 0 : Math.min(100, Math.max(0, (days / 30) * 100)).toFixed(1);

      /* Badge statut */
      const badge = status === 'none' ? '' :
        `<span class="advance-status-badge advance-${status}">
           ${status === 'good' ? '✓ OK' : status === 'warning' ? '⚠ Attention' : status === 'danger' ? '⚠ Urgent' : '● Retard'}
         </span>`;

      return `
        <div class="advance-row">
          <div class="advance-client">
            <span class="advance-dot" style="background:${client.color}"></span>
            <span class="advance-name">${escHtml(client.name)}</span>
          </div>
          <div class="advance-bar-wrap">
            <div class="advance-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <div class="advance-right">
            <span class="advance-value" style="color:${color}">${label}</span>
            ${badge}
          </div>
        </div>`;
    }).join('');
  },

  _recentTasks() {
    const tasks  = App.load(App.KEYS.TASKS, []);
    const today  = App.today();
    const recent = tasks.filter(t => t.date === today).slice(-5).reverse();
    const el     = document.getElementById('dashboard-recent-tasks');
    if (!el) return;

    if (recent.length === 0) {
      el.innerHTML = '<p class="empty-hint">Aucune tâche enregistrée aujourd\'hui.</p>';
      return;
    }
    el.innerHTML = recent.map(t => `
      <div class="recent-task-item">
        <span class="recent-task-dot"></span>
        <span class="recent-task-name">${escHtml(t.name)}</span>
        <span class="recent-task-dur">${App.fmtDur(t.totalDuration || 0)}</span>
      </div>`).join('');
  },
};

/* ─── Helpers ────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
window.escHtml = escHtml;

/* ─── Init ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  /* Dates */
  const now     = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
  const cap     = s => s.charAt(0).toUpperCase() + s.slice(1);
  const topbarDate  = document.getElementById('topbarDate');
  const sidebarDate = document.getElementById('sidebarDate');
  if (topbarDate)  topbarDate.textContent  = cap(dateStr);
  if (sidebarDate) sidebarDate.textContent = cap(dateStr);

  /* Sidebar hamburger */
  const hamburger = document.getElementById('hamburger');
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebarOverlay');
  const closeBtn  = document.getElementById('sidebarClose');

  function openSidebar() {
    if (window.innerWidth < 1024) {
      sidebar.classList.add('open');
      overlay.classList.add('active');
    } else {
      document.body.classList.toggle('sidebar-collapsed');
    }
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  }

  hamburger?.addEventListener('click', openSidebar);
  closeBtn?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);

  /* Navigation par délégation */
  document.addEventListener('click', e => {
    const navLink = e.target.closest('.nav-link[data-view]');
    if (navLink) { e.preventDefault(); App.navigateTo(navLink.dataset.view); return; }

    const sectionLink = e.target.closest('.section-link[data-view]');
    if (sectionLink) { e.preventDefault(); App.navigateTo(sectionLink.dataset.view); return; }

    const closeModal = e.target.closest('[data-close]');
    if (closeModal) { App.closeModal(closeModal.dataset.close); return; }

    if (e.target.classList.contains('modal-backdrop')) {
      e.target.classList.remove('visible');
      setTimeout(() => { e.target.style.display = 'none'; }, 200);
    }
  });

  /* Données démo (première visite) */
  _initDemoData();

  /* Vue initiale */
  App.navigateTo('dashboard');
});

/* ─── Données démo ───────────────────────────────────────────────── */
function _initDemoData() {
  const DEMO_PROJECTS = {
    'ixina-ath': [
      { id: 'p1', name: 'Vidéo Cuisine 2025',  stage: 'montage',      createdAt: '2025-04-01' },
      { id: 'p2', name: 'Réels Instagram',      stage: 'scripting',    createdAt: '2025-04-05' },
      { id: 'p3', name: 'Vidéo Showroom',       stage: 'verification', createdAt: '2025-03-28' },
    ],
    'ixina-tours': [
      { id: 'p4', name: 'Présentation Taxi',    stage: 'tournage',     createdAt: '2025-04-02' },
      { id: 'p5', name: 'Brand Film',           stage: 'scripting',    createdAt: '2025-04-08' },
    ],
    'ixina-ixelles': [
      { id: 'p6', name: 'Vidéo Inauguration',   stage: 'verification', createdAt: '2025-03-25' },
      { id: 'p7', name: 'Cuisine Luxe Reel',    stage: 'montage',      createdAt: '2025-04-01' },
    ],
  };

  App.CLIENTS.forEach(c => {
    if (!localStorage.getItem(`${App.KEYS.PROJECTS}_${c.id}`)) {
      App.save(`${App.KEYS.PROJECTS}_${c.id}`, DEMO_PROJECTS[c.id] || []);
    }
  });

  if (!localStorage.getItem(App.KEYS.TASKS)) {
    App.save(App.KEYS.TASKS, []);
  }
}
