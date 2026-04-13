/* ================================================================
   THE HOUSE — app.js
   Navigation, modales, utilitaires globaux, initialisation
   ================================================================ */

'use strict';

/* ─── Namespace global App ──────────────────────────────────────── */
window.App = {

  _DEFAULT_CLIENTS: [
    { id: 'ixina-ath',     name: 'Ixina Ath',          initials: 'IA', color: '#6366F1', bg: '#EEF2FF' },
    { id: 'ixina-tours',   name: 'Ixina Tours et taxi', initials: 'IT', color: '#F59E0B', bg: '#FFF7ED' },
    { id: 'ixina-ixelles', name: 'Ixina Ixelles',       initials: 'II', color: '#10B981', bg: '#ECFDF5' },
  ],

  CLIENTS: [], /* chargé dynamiquement depuis localStorage au DOMContentLoaded */

  STAGES: [
    { id: 'scripting',    label: 'Scripting',    color: '#6366F1', bg: '#EEF2FF' },
    { id: 'tournage',     label: 'Tournage',     color: '#D97706', bg: '#FFF7ED' },
    { id: 'brouillon',    label: 'Brouillon',    color: '#8B5CF6', bg: '#F5F3FF' },
    { id: 'montage',      label: 'Montage',      color: '#2563EB', bg: '#EFF6FF' },
    { id: 'verification', label: 'Vérification', color: '#059669', bg: '#ECFDF5' },
  ],

  KEYS: {
    TASKS:    'th_tasks',
    PROJECTS: 'th_projects',
    PUBCAL:   'th_pubcal',
    CLIENTS:  'th_clients',
  },

  /* ── Gestion clients dynamiques ──────────────────────────────── */
  loadClients() {
    const saved = this.load(this.KEYS.CLIENTS, null);
    this.CLIENTS = saved || [...this._DEFAULT_CLIENTS];
  },

  saveClients() {
    this.save(this.KEYS.CLIENTS, this.CLIENTS);
  },

  addClient(name, color) {
    const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const id       = 'client-' + this.uid();
    const bg       = color + '22'; /* couleur transparente pour le fond */
    this.CLIENTS.push({ id, name: name.trim(), initials, color, bg });
    this.saveClients();
    return id;
  },

  deleteClient(id) {
    this.CLIENTS = this.CLIENTS.filter(c => c.id !== id);
    this.saveClients();
    /* Nettoyage des projets associés */
    localStorage.removeItem(`${this.KEYS.PROJECTS}_${id}`);
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
    'dashboard':     'Dashboard',
    'timetracker':   'Time Tracking',
    'kanban':        'Kanban',
    'publication':   'Publication',
    'portal':        'Portail Client',
    'comptabilite':  'Comptabilité',
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
    if (viewId === 'kanban')      _safeRender('kanban-board',  () => Kanban.renderView());
    if (viewId === 'publication') _safeRender('pubcal-container', () => PubCal.renderView());
    if (viewId === 'portal')        _safeRender('view-portal',       () => Portal.init());
    if (viewId === 'comptabilite')  Comptabilite.init();

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

  /* ── Toast ────────────────────────────────────────────────────── */
  toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `app-toast app-toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('visible'));
    setTimeout(() => {
      t.classList.remove('visible');
      setTimeout(() => t.remove(), 300);
    }, 3000);
  },

  /* ── Confirm inline (remplace window.confirm) ─────────────────── */
  confirm(msg, onConfirm) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.display = 'flex';
    backdrop.innerHTML = `
      <div class="modal modal-sm">
        <div class="modal-body" style="padding-top:24px">
          <p style="font-size:.95rem;font-weight:500">${escHtml(msg)}</p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="_conf-cancel">Annuler</button>
          <button class="btn btn-danger-outline" id="_conf-ok">Supprimer</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('visible')));

    const close = () => {
      backdrop.classList.remove('visible');
      setTimeout(() => backdrop.remove(), 200);
    };
    backdrop.querySelector('#_conf-cancel').addEventListener('click', close);
    backdrop.querySelector('#_conf-ok').addEventListener('click', () => { close(); onConfirm(); });
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  },
};

/* ─── Palette de couleurs prédéfinie ────────────────────────────── */
const CLIENT_COLORS = [
  '#6366F1','#F59E0B','#10B981','#EF4444','#3B82F6',
  '#8B5CF6','#EC4899','#14B8A6','#F97316','#06B6D4',
  '#84CC16','#A855F7',
];

/* ─── Gestion UI clients (Dashboard) ───────────────────────────── */
window.ClientManager = {
  render() {
    const el = document.getElementById('dashboardClients');
    if (!el) return;
    el.innerHTML = App.CLIENTS.map(c => `
      <div class="client-chip" style="--cc:${c.color}">
        <span class="client-chip-dot" style="background:${c.color}"></span>
        <span class="client-chip-name">${escHtml(c.name)}</span>
        <button class="client-chip-del" data-id="${c.id}" title="Supprimer">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');

    el.querySelectorAll('.client-chip-del').forEach(btn => {
      btn.addEventListener('click', () => {
        App.confirm(`Supprimer le client "${App.getClient(btn.dataset.id)?.name}" ? Toutes ses données seront perdues.`, () => {
          App.deleteClient(btn.dataset.id);
          this.render();
          Dashboard.refresh();
          /* Rafraîchir kanban/pubcal si actifs */
          if (App.currentView === 'kanban')      Kanban.renderView();
          if (App.currentView === 'publication') PubCal.renderView();
        });
      });
    });
  },

  openAddModal() {
    document.getElementById('newClientName').value = '';
    /* Construire la palette */
    const palette = document.getElementById('colorPalette');
    palette.innerHTML = CLIENT_COLORS.map(c => `
      <button class="color-swatch${c === '#6366F1' ? ' selected' : ''}"
              style="background:${c}" data-color="${c}" title="${c}"></button>
    `).join('');
    document.getElementById('newClientColor').value = '#6366F1';

    palette.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        palette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
        sw.classList.add('selected');
        document.getElementById('newClientColor').value = sw.dataset.color;
      });
    });

    App.openModal('modal-addClient');
    setTimeout(() => document.getElementById('newClientName').focus(), 120);
  },

  confirmAdd() {
    const name  = document.getElementById('newClientName').value.trim();
    const color = document.getElementById('newClientColor').value;
    if (!name) { document.getElementById('newClientName').focus(); return; }
    App.addClient(name, color);
    App.closeModal('modal-addClient');
    this.render();
    Dashboard.refresh();
    App.toast(`Client "${name}" ajouté !`, 'success');
  },
};

/* ─── Module Dashboard ──────────────────────────────────────────── */
window.Dashboard = {
  refresh() {
    ClientManager.render();
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

/* ─── Helper rendu sécurisé ─────────────────────────────────────── */
function _safeRender(fallbackId, fn) {
  try {
    fn();
  } catch(e) {
    console.error('[_safeRender]', e);
    const el = document.getElementById(fallbackId);
    if (el) el.innerHTML =
      `<div style="padding:20px;color:#DC2626;background:#FEF2F2;border-radius:8px;font-family:monospace;font-size:.85rem">
        <strong>Erreur JS :</strong> ${String(e.message).replace(/</g,'&lt;')}
       </div>`;
  }
}

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

  /* Chargement clients dynamiques */
  App.loadClients();

  /* Bouton nouveau client */
  document.getElementById('manageClientsBtn')
    ?.addEventListener('click', () => ClientManager.openAddModal());
  document.getElementById('confirmAddClientBtn')
    ?.addEventListener('click', () => ClientManager.confirmAdd());
  document.getElementById('newClientName')
    ?.addEventListener('keydown', e => { if (e.key === 'Enter') ClientManager.confirmAdd(); });

  /* Données démo (première visite) */
  _initDemoData();

  /* PIN pad auth overlay — bind une seule fois */
  document.getElementById('auth-pad')?.addEventListener('click', e => {
    const key = e.target.closest('.pin-key');
    if (!key || key.classList.contains('pin-key-empty')) return;
    App.Auth._onKey(key.dataset.key);
  });

  /* Bloquer la navigation pour les sessions client */
  const _origNavigateTo = App.navigateTo.bind(App);
  App.navigateTo = function(viewId) {
    if (document.body.classList.contains('is-client') && viewId !== 'portal') return;
    _origNavigateTo(viewId);
  };

  /* Auth — vérifie session ou affiche l'overlay */
  App.Auth.check();
});

/* ─── Auth globale ───────────────────────────────────────────────── */
App.Auth = {
  _entered: '',

  check() {
    const session = PortalAuth.getSession();
    if (session) {
      this._unlock(session);
    }
    /* Sinon : lock screen visible par défaut, rien à faire */
  },

  lock() {
    PortalAuth.endSession();
    document.body.classList.remove('is-client');
    this._entered = '';
    this._updateDots();
    const err = document.getElementById('auth-error');
    if (err) err.style.display = 'none';
    document.getElementById('lock-screen').style.display = 'flex';
  },

  _unlock(session) {
    document.getElementById('lock-screen').style.display = 'none';

    if (session.role === 'client') {
      document.body.classList.add('is-client');
      App.navigateTo('portal');
    } else {
      document.body.classList.remove('is-client');
      App.navigateTo('dashboard');
    }
  },

  _updateDots() {
    for (let i = 0; i < 4; i++) {
      document.getElementById(`auth-pd${i}`)
        ?.classList.toggle('ls-dot--filled', i < this._entered.length);
    }
  },

  _onKey(k) {
    if (k === '⌫') {
      this._entered = this._entered.slice(0, -1);
    } else if (this._entered.length < 4) {
      this._entered += k;
    }
    this._updateDots();

    if (this._entered.length === 4) {
      const session = PortalAuth.verify(this._entered);
      if (session) {
        PortalAuth.startSession(session);
        this._unlock(session);
      } else {
        const disp = document.getElementById('auth-display');
        const err  = document.getElementById('auth-error');
        disp?.classList.add('ls-shake');
        if (err) err.style.display = 'block';
        setTimeout(() => {
          this._entered = '';
          this._updateDots();
          disp?.classList.remove('ls-shake');
          if (err) err.style.display = 'none';
        }, 900);
      }
    }
  },
};

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
