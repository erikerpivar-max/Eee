/* ================================================================
   THE HOUSE — app.js
   Navigation, modales, utilitaires globaux, initialisation
   ================================================================ */

'use strict';

/* ─── Namespace global App ──────────────────────────────────────── */
window.App = {

  /* Config */
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
    EVENTS:   'th_events',
    GANTT:    'th_gantt',
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

  /* Format secondes → "1h 05min" ou "45min" */
  fmtDur(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${String(m).padStart(2,'0')}min`;
    return `${m}min`;
  },

  /* Format secondes → "00:00:00" */
  fmtClock(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  },

  /* Format date ISO → "lun. 11 avr. 2025" */
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
    'dashboard':           'Dashboard',
    'timetracker':         'Time Tracking',
    'client-ixina-ath':    'Ixina Ath',
    'client-ixina-tours':  'Ixina Tours et taxi',
    'client-ixina-ixelles':'Ixina Ixelles',
  },

  navigateTo(viewId) {
    /* Cache toutes les vues */
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    /* Désactive tous les liens */
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    /* Affiche la bonne vue */
    const view = document.getElementById(`view-${viewId}`);
    if (view) view.classList.add('active');

    /* Active le bon lien */
    const link = document.querySelector(`.nav-link[data-view="${viewId}"]`);
    if (link) link.classList.add('active');

    /* Met à jour le titre */
    const titleEl = document.getElementById('topbarTitle');
    if (titleEl) titleEl.textContent = this.PAGE_TITLES[viewId] || viewId;

    this.currentView = viewId;

    /* Rafraîchit le contenu de la vue */
    if (viewId === 'dashboard') {
      Dashboard.refresh();
    } else if (viewId === 'timetracker') {
      TimeTracker.renderTable();
    } else if (viewId.startsWith('client-')) {
      const clientId = viewId.replace('client-', '');
      Clients.renderView(clientId);
    }

    /* Ferme la sidebar sur mobile */
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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('visible'));
    });
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('visible');
    setTimeout(() => { el.style.display = 'none'; }, 200);
  },

  /* ── Dashboard module ────────────────────────────────────────── */
  /* (appelé par Dashboard.refresh()) */
};

/* ─── Module Dashboard ──────────────────────────────────────────── */
window.Dashboard = {
  refresh() {
    this._stats();
    this._clientCards();
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

    let totalProjects = 0;
    App.CLIENTS.forEach(c => {
      const p = App.load(`${App.KEYS.PROJECTS}_${c.id}`, []);
      totalProjects += p.length;
    });
    const el3 = document.getElementById('stat-active-projects');
    if (el3) el3.textContent = totalProjects;
  },

  _clientCards() {
    App.CLIENTS.forEach(c => {
      const projects = App.load(`${App.KEYS.PROJECTS}_${c.id}`, []);

      /* Compteur */
      const countEl = document.getElementById(`csc-count-${c.id}`);
      if (countEl) countEl.textContent = `${projects.length} projet${projects.length !== 1 ? 's' : ''}`;

      /* Pipeline badges */
      const pipeEl = document.getElementById(`csc-pipeline-${c.id}`);
      if (!pipeEl) return;

      const counts = {};
      App.STAGES.forEach(s => counts[s.id] = 0);
      projects.forEach(p => { counts[p.stage] = (counts[p.stage] || 0) + 1; });

      pipeEl.innerHTML = App.STAGES.map(s => {
        const n = counts[s.id];
        const cls = n > 0 ? 'pipeline-badge has-items' : 'pipeline-badge';
        const style = n > 0 ? `--stage-color:${s.color};--stage-bg:${s.bg}` : '';
        return `<span class="${cls}" style="${style}">${s.label}${n > 0 ? `<span class="count">${n}</span>` : ''}</span>`;
      }).join('');
    });
  },

  _recentTasks() {
    const tasks   = App.load(App.KEYS.TASKS, []);
    const today   = App.today();
    const recent  = tasks.filter(t => t.date === today).slice(-5).reverse();
    const el      = document.getElementById('dashboard-recent-tasks');
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

  /* ── Dates dans l'interface ─── */
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
  const topbarDate = document.getElementById('topbarDate');
  const sidebarDate = document.getElementById('sidebarDate');
  if (topbarDate) topbarDate.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  if (sidebarDate) sidebarDate.textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  /* ── Sidebar hamburger ─── */
  const hamburger  = document.getElementById('hamburger');
  const sidebar    = document.getElementById('sidebar');
  const overlay    = document.getElementById('sidebarOverlay');
  const closeBtn   = document.getElementById('sidebarClose');

  function openSidebar() {
    if (window.innerWidth < 1024) {
      sidebar.classList.add('open');
      overlay.classList.add('active');
    } else {
      /* Desktop : toggle collapsed */
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

  /* ── Navigation par liens ─── */
  document.addEventListener('click', (e) => {
    /* Liens nav */
    const navLink = e.target.closest('.nav-link[data-view]');
    if (navLink) {
      e.preventDefault();
      App.navigateTo(navLink.dataset.view);
      return;
    }
    /* Client summary cards */
    const card = e.target.closest('.client-summary-card[data-view]');
    if (card) {
      App.navigateTo(card.dataset.view);
      return;
    }
    /* "Voir tout" link */
    const sectionLink = e.target.closest('.section-link[data-view]');
    if (sectionLink) {
      e.preventDefault();
      App.navigateTo(sectionLink.dataset.view);
      return;
    }
    /* Fermeture de modal */
    const closeModal = e.target.closest('[data-close]');
    if (closeModal) {
      App.closeModal(closeModal.dataset.close);
      return;
    }
    /* Clic backdrop de modal */
    if (e.target.classList.contains('modal-backdrop')) {
      e.target.classList.remove('visible');
      setTimeout(() => { e.target.style.display = 'none'; }, 200);
    }
  });

  /* ── Initialisation données démo (première visite) ─── */
  _initDemoData();

  /* ── Affiche le dashboard ─── */
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

  const today = App.today();
  const y = today.slice(0, 4);
  const m = today.slice(5, 7);

  const DEMO_GANTT = {
    'ixina-ath': [
      { id:'g1', name:'Vidéo Cuisine 2025',  stage:'montage',      start:`${y}-${m}-01`, end:`${y}-${m}-20` },
      { id:'g2', name:'Réels Instagram',      stage:'scripting',    start:`${y}-${m}-10`, end:`${y}-${m}-28` },
      { id:'g3', name:'Vidéo Showroom',       stage:'verification', start:`${y}-${m}-18`, end:`${y}-${m}-25` },
    ],
    'ixina-tours': [
      { id:'g4', name:'Présentation Taxi',    stage:'tournage',     start:`${y}-${m}-05`, end:`${y}-${m}-22` },
      { id:'g5', name:'Brand Film',           stage:'scripting',    start:`${y}-${m}-15`, end:`${y}-${m}-30` },
    ],
    'ixina-ixelles': [
      { id:'g6', name:'Vidéo Inauguration',   stage:'verification', start:`${y}-${m}-01`, end:`${y}-${m}-14` },
      { id:'g7', name:'Cuisine Luxe Reel',    stage:'montage',      start:`${y}-${m}-10`, end:`${y}-${m}-28` },
    ],
  };

  App.CLIENTS.forEach(c => {
    /* Projets */
    if (!localStorage.getItem(`${App.KEYS.PROJECTS}_${c.id}`)) {
      App.save(`${App.KEYS.PROJECTS}_${c.id}`, DEMO_PROJECTS[c.id] || []);
    }
    /* Gantt */
    if (!localStorage.getItem(`${App.KEYS.GANTT}_${c.id}`)) {
      App.save(`${App.KEYS.GANTT}_${c.id}`, DEMO_GANTT[c.id] || []);
    }
    /* Events : démarrage vide */
    if (!localStorage.getItem(`${App.KEYS.EVENTS}_${c.id}`)) {
      App.save(`${App.KEYS.EVENTS}_${c.id}`, []);
    }
  });

  /* Tasks : démarrage vide */
  if (!localStorage.getItem(App.KEYS.TASKS)) {
    App.save(App.KEYS.TASKS, []);
  }
}
