/* ================================================================
   THE HOUSE — portal.js
   Portail Client : Auth PIN + Stats sociales manuelles
   Architecture API-ready : remplacer MetaDataSource.mode = 'api'
   quand les tokens Meta seront disponibles.
   ================================================================ */

'use strict';

/* ─── Clés localStorage ─────────────────────────────────────────── */
const PORTAL_KEYS = {
  PINS:     'th_portal_pins',
  DATA:     'th_portal_data',
  SESSION:  'th_portal_session',
};

/* ─── PINs par défaut ───────────────────────────────────────────── */
const DEFAULT_PINS = {
  admin:          '0000',
  'ixina-ath':    '1111',
  'ixina-tours':  '2222',
  'ixina-ixelles':'3333',
};

/* ================================================================
   MetaDataSource — Adaptateur API/Manuel
   ----------------------------------------------------------------
   Pour activer l'API Meta quand les tokens seront prêts :
     1. Passer MetaDataSource.mode = 'api'
     2. Renseigner MetaDataSource.config.appId, appSecret, pageTokens
     3. Appeler MetaDataSource.fetchFromAPI(clientId)
   En mode 'manual', toutes les données viennent du localStorage.
   ================================================================ */
const MetaDataSource = {
  mode: 'manual', // 'manual' | 'api'

  /* Config API (à remplir quand les tokens sont disponibles) */
  config: {
    appId:      '',
    appSecret:  '',
    /* pageTokens : { 'ixina-ath': 'PAGE_TOKEN_ATH', ... } */
    pageTokens: {},
    /* pageIds : { 'ixina-ath': 'PAGE_ID_ATH', ... } */
    pageIds:    {},
  },

  /* Métriques supportées */
  METRICS: ['reach', 'followers', 'likes'],

  /* ── Lecture des données ──────────────────────────────────────── */
  async getData(clientId) {
    if (this.mode === 'api') {
      return await this.fetchFromAPI(clientId);
    }
    return this._getManualData(clientId);
  },

  _getManualData(clientId) {
    const all = App.load(PORTAL_KEYS.DATA, {});
    return all[clientId] || { periods: [], reach: [], followers: [], likes: [] };
  },

  saveManualData(clientId, data) {
    const all = App.load(PORTAL_KEYS.DATA, {});
    all[clientId] = data;
    App.save(PORTAL_KEYS.DATA, all);
  },

  /* ── Appel API Meta (activé quand tokens disponibles) ────────── */
  async fetchFromAPI(clientId) {
    const token  = this.config.pageTokens[clientId];
    const pageId = this.config.pageIds[clientId];
    if (!token || !pageId) throw new Error('Token ou Page ID manquant pour ' + clientId);

    /* Période : 8 dernières semaines */
    const since = Math.floor(Date.now() / 1000) - (8 * 7 * 24 * 3600);
    const until = Math.floor(Date.now() / 1000);

    const base = `https://graph.facebook.com/v19.0/${pageId}`;
    const params = `?metric=page_impressions_unique,page_fans,page_post_engagements&period=week&since=${since}&until=${until}&access_token=${token}`;

    const res  = await fetch(base + '/insights' + params);
    const json = await res.json();

    if (json.error) throw new Error(json.error.message);

    /* Normalisation vers le format interne */
    return this._normalizeAPIResponse(json);
  },

  _normalizeAPIResponse(json) {
    /* Map : nom_metric_meta → clé interne */
    const MAP = {
      page_impressions_unique:    'reach',
      page_fans:                  'followers',
      page_post_engagements:      'likes',
    };
    const result = { periods: [], reach: [], followers: [], likes: [] };

    const base = json.data?.[0];
    if (!base) return result;

    result.periods = base.values.map(v => {
      const d = new Date(v.end_time);
      return `Sem ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
    });

    for (const metric of json.data) {
      const key = MAP[metric.name];
      if (key) result[key] = metric.values.map(v => v.value);
    }

    return result;
  },
};

/* ================================================================
   PortalAuth — Gestion des PINs et session
   ================================================================ */
const PortalAuth = {
  getPins() {
    return App.load(PORTAL_KEYS.PINS, DEFAULT_PINS);
  },

  savePins(pins) {
    App.save(PORTAL_KEYS.PINS, pins);
  },

  verify(pin) {
    const pins = this.getPins();
    if (pin === pins.admin) return { role: 'admin', clientId: null };
    for (const c of App.CLIENTS) {
      if (pin === pins[c.id]) return { role: 'client', clientId: c.id };
    }
    return null;
  },

  getSession() {
    const s = App.load(PORTAL_KEYS.SESSION, null);
    if (!s) return null;
    /* Session expire après 8h */
    if (Date.now() - (s.ts || 0) > 8 * 3600 * 1000) {
      this.endSession();
      return null;
    }
    return s;
  },

  startSession(session) {
    App.save(PORTAL_KEYS.SESSION, { ...session, ts: Date.now() });
  },

  endSession() {
    localStorage.removeItem(PORTAL_KEYS.SESSION);
  },
};

/* ================================================================
   MiniChart — Graphiques ligne légers (Canvas, sans dépendance)
   ================================================================ */
const MiniChart = {
  COLORS: {
    reach:     '#6366F1',
    followers: '#10B981',
    likes:     '#F59E0B',
  },

  draw(canvas, data, metric) {
    const ctx    = canvas.getContext('2d');
    const W      = canvas.offsetWidth  || 400;
    const H      = canvas.offsetHeight || 160;
    canvas.width  = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    ctx.clearRect(0, 0, W, H);

    const values = data[metric] || [];
    if (values.length < 2) {
      ctx.fillStyle = '#A09080';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Pas assez de données', W / 2, H / 2);
      return;
    }

    const PAD   = { top: 16, right: 16, bottom: 32, left: 44 };
    const cW    = W - PAD.left - PAD.right;
    const cH    = H - PAD.top  - PAD.bottom;
    const min   = Math.min(...values);
    const max   = Math.max(...values);
    const range = max - min || 1;
    const color = this.COLORS[metric] || '#C8882A';

    const xStep = cW / (values.length - 1);
    const pts   = values.map((v, i) => ({
      x: PAD.left + i * xStep,
      y: PAD.top  + cH * (1 - (v - min) / range),
    }));

    /* Aire sous la courbe */
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH);
    grad.addColorStop(0, color + '28');
    grad.addColorStop(1, color + '00');

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i-1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(mx, pts[i-1].y, mx, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.lineTo(pts[pts.length - 1].x, PAD.top + cH);
    ctx.lineTo(pts[0].x, PAD.top + cH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    /* Ligne */
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i-1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(mx, pts[i-1].y, mx, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    /* Points */
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle   = '#fff';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.stroke();
    });

    /* Labels axe X */
    ctx.fillStyle  = '#A09080';
    ctx.font       = '11px Inter, sans-serif';
    ctx.textAlign  = 'center';
    const periods  = data.periods || values.map((_, i) => `P${i+1}`);
    pts.forEach((p, i) => {
      const label = periods[i] || '';
      ctx.fillText(label.length > 8 ? label.slice(0, 8) + '…' : label, p.x, H - PAD.bottom + 16);
    });

    /* Labels axe Y (min/max) */
    ctx.textAlign = 'right';
    ctx.fillText(this._fmt(max), PAD.left - 6, PAD.top + 4);
    ctx.fillText(this._fmt(min), PAD.left - 6, PAD.top + cH + 4);
  },

  _fmt(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(1) + 'k';
    return String(n);
  },
};

/* ================================================================
   Portal — Module principal
   ================================================================ */
window.Portal = {
  _session: null,

  /* ── Init ────────────────────────────────────────────────────── */
  init() {
    this._session = PortalAuth.getSession();
    if (this._session) {
      this.renderDashboard();
    } else {
      this.renderLogin();
    }
  },

  /* ── Écran connexion ─────────────────────────────────────────── */
  renderLogin() {
    const el = document.getElementById('view-portal');
    if (!el) return;

    el.innerHTML = `
      <div class="portal-login-wrap">
        <div class="portal-login-card">
          <div class="portal-login-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2 class="portal-login-title">Accès Portail</h2>
          <p class="portal-login-sub">Entrez votre code PIN pour accéder aux statistiques</p>

          <div class="pin-display" id="pinDisplay">
            <span class="pin-dot" id="pd0"></span>
            <span class="pin-dot" id="pd1"></span>
            <span class="pin-dot" id="pd2"></span>
            <span class="pin-dot" id="pd3"></span>
          </div>

          <div class="pin-pad">
            ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => `
              <button class="pin-key ${k==='' ? 'pin-key-empty' : ''}" data-key="${k}">${k}</button>
            `).join('')}
          </div>

          <p class="pin-error" id="pinError" style="display:none">PIN incorrect. Réessayez.</p>
        </div>
      </div>`;

    this._bindLogin();
  },

  _bindLogin() {
    let entered = '';

    const update = () => {
      for (let i = 0; i < 4; i++) {
        const dot = document.getElementById(`pd${i}`);
        if (dot) dot.classList.toggle('filled', i < entered.length);
      }
    };

    document.getElementById('view-portal').addEventListener('click', e => {
      const key = e.target.closest('.pin-key');
      if (!key || key.classList.contains('pin-key-empty')) return;

      const k = key.dataset.key;

      if (k === '⌫') {
        entered = entered.slice(0, -1);
      } else if (entered.length < 4) {
        entered += k;
      }
      update();

      if (entered.length === 4) {
        const session = PortalAuth.verify(entered);
        if (session) {
          PortalAuth.startSession(session);
          this._session = session;
          this.renderDashboard();
        } else {
          const err = document.getElementById('pinError');
          if (err) err.style.display = 'block';
          document.getElementById('view-portal').querySelector('.pin-display')?.classList.add('pin-shake');
          setTimeout(() => {
            entered = '';
            update();
            if (err) err.style.display = 'none';
            document.getElementById('view-portal').querySelector('.pin-display')?.classList.remove('pin-shake');
          }, 900);
        }
      }
    });
  },

  /* ── Dashboard portail ───────────────────────────────────────── */
  renderDashboard() {
    const el = document.getElementById('view-portal');
    if (!el) return;

    const session  = this._session;
    const clients  = session.role === 'admin'
      ? App.CLIENTS
      : App.CLIENTS.filter(c => c.id === session.clientId);

    const modeTag = MetaDataSource.mode === 'api'
      ? `<span class="portal-mode-badge portal-mode-api">API Meta active</span>`
      : `<span class="portal-mode-badge portal-mode-manual">Données manuelles</span>`;

    el.innerHTML = `
      <div class="portal-header">
        <div>
          <h2 class="view-title">Portail Client</h2>
          <p class="view-subtitle">
            Statistiques Instagram · Facebook
            ${modeTag}
          </p>
        </div>
        <div class="portal-header-actions">
          ${session.role === 'admin' ? `
            <button class="btn btn-outline" id="portalPinsBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
              PINs
            </button>
          ` : ''}
          <button class="btn btn-ghost" id="portalLogoutBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Déconnexion
          </button>
        </div>
      </div>

      <div class="portal-clients-wrap" id="portalClientsWrap"></div>
    `;

    document.getElementById('portalLogoutBtn')?.addEventListener('click', () => {
      PortalAuth.endSession();
      this._session = null;
      this.renderLogin();
    });

    if (session.role === 'admin') {
      document.getElementById('portalPinsBtn')?.addEventListener('click', () => {
        this._openPinsModal();
      });
    }

    this._renderClients(clients);
  },

  /* ── Rendu des clients ───────────────────────────────────────── */
  async _renderClients(clients) {
    const wrap = document.getElementById('portalClientsWrap');
    if (!wrap) return;

    for (const client of clients) {
      const data    = await MetaDataSource.getData(client.id);
      const section = document.createElement('div');
      section.className      = 'portal-client-section';
      section.dataset.clientId = client.id;
      wrap.appendChild(section);
      this._fillClientSection(section, client, data);
    }
  },

  /* ── Modal saisie de données ─────────────────────────────────── */
  _openDataModal(clientId, currentData) {
    const client = App.getClient(clientId);
    const modal  = document.getElementById('modal-portalData');
    if (!modal) return;

    const periods   = currentData.periods   || [];
    const reach     = currentData.reach     || [];
    const followers = currentData.followers || [];
    const likes     = currentData.likes     || [];

    /* Construire les lignes existantes */
    const rows = periods.map((p, i) => ({ p, r: reach[i]||0, f: followers[i]||0, l: likes[i]||0 }));

    document.getElementById('portalDataClientName').textContent = client.name;
    document.getElementById('portalDataClientId').value = clientId;

    const tbody = document.getElementById('portalDataRows');
    tbody.innerHTML = '';

    const addRow = (row = { p: '', r: '', f: '', l: '' }) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input class="form-input form-input-sm" type="text"   value="${escHtml(row.p)}" placeholder="Ex: Sem 14 Avr" data-col="p"></td>
        <td><input class="form-input form-input-sm" type="number" value="${row.r}" placeholder="0" data-col="r"></td>
        <td><input class="form-input form-input-sm" type="number" value="${row.f}" placeholder="0" data-col="f"></td>
        <td><input class="form-input form-input-sm" type="number" value="${row.l}" placeholder="0" data-col="l"></td>
        <td><button class="btn-icon-del" title="Supprimer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button></td>
      `;
      tr.querySelector('.btn-icon-del').addEventListener('click', () => tr.remove());
      tbody.appendChild(tr);
    };

    rows.forEach(addRow);

    document.getElementById('portalAddRowBtn').onclick = () => addRow();

    App.openModal('modal-portalData');
  },

  _saveDataModal() {
    const clientId = document.getElementById('portalDataClientId').value;
    const rows     = [...document.getElementById('portalDataRows').querySelectorAll('tr')];

    const data = { periods: [], reach: [], followers: [], likes: [] };
    rows.forEach(tr => {
      const p = tr.querySelector('[data-col=p]').value.trim();
      const r = parseFloat(tr.querySelector('[data-col=r]').value) || 0;
      const f = parseFloat(tr.querySelector('[data-col=f]').value) || 0;
      const l = parseFloat(tr.querySelector('[data-col=l]').value) || 0;
      if (p) {
        data.periods.push(p);
        data.reach.push(r);
        data.followers.push(f);
        data.likes.push(l);
      }
    });

    MetaDataSource.saveManualData(clientId, data);
    App.closeModal('modal-portalData');

    /* Rafraîchir la section du client en conservant sa position */
    const section  = document.querySelector(`.portal-client-section[data-client-id="${clientId}"]`);
    const wrap     = document.getElementById('portalClientsWrap');
    const anchor   = section?.nextSibling ?? null; /* nœud suivant pour ré-insertion */
    if (section) section.remove();

    /* Ajouter un conteneur temporaire à la bonne position */
    const placeholder = document.createElement('div');
    if (anchor) wrap.insertBefore(placeholder, anchor);
    else        wrap.appendChild(placeholder);

    const client = App.getClient(clientId);
    MetaDataSource.getData(clientId).then(freshData => {
      const newSection = document.createElement('div');
      newSection.className    = 'portal-client-section';
      newSection.dataset.clientId = clientId;

      /* Réutiliser _buildClientHTML pour éviter la duplication */
      placeholder.replaceWith(newSection);
      this._fillClientSection(newSection, client, freshData);
    });
  },

  /* ── Construction du HTML d'une section client (extrait) ─────── */
  _fillClientSection(section, client, data) {
    const last   = key => data[key]?.at(-1) ?? '—';
    const delta  = key => {
      const arr = data[key] || [];
      return arr.length < 2 ? null : arr.at(-1) - arr.at(-2);
    };
    const fmtDelta = key => {
      const d = delta(key);
      if (d === null) return '';
      const sign = d >= 0 ? '+' : '';
      const cls  = d >= 0 ? 'delta-pos' : 'delta-neg';
      return `<span class="portal-delta ${cls}">${sign}${MiniChart._fmt(d)}</span>`;
    };

    const session = this._session;

    section.innerHTML = `
      <div class="portal-client-head">
        <div class="portal-client-badge" style="background:${client.bg};color:${client.color}">${client.initials}</div>
        <h3 class="portal-client-name">${escHtml(client.name)}</h3>
        ${session.role === 'admin' ? `
          <button class="btn btn-sm btn-outline portal-edit-btn" data-client="${client.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Saisir données
          </button>
        ` : ''}
      </div>
      <div class="portal-kpis">
        <div class="portal-kpi" style="--kc:${MiniChart.COLORS.reach}">
          <div class="portal-kpi-value">${MiniChart._fmt(last('reach'))}</div>
          <div class="portal-kpi-label">Portée ${fmtDelta('reach')}</div>
        </div>
        <div class="portal-kpi" style="--kc:${MiniChart.COLORS.followers}">
          <div class="portal-kpi-value">${MiniChart._fmt(last('followers'))}</div>
          <div class="portal-kpi-label">Abonnés ${fmtDelta('followers')}</div>
        </div>
        <div class="portal-kpi" style="--kc:${MiniChart.COLORS.likes}">
          <div class="portal-kpi-value">${MiniChart._fmt(last('likes'))}</div>
          <div class="portal-kpi-label">Likes ${fmtDelta('likes')}</div>
        </div>
      </div>
      <div class="portal-charts">
        ${['reach','followers','likes'].map(m => `
          <div class="portal-chart-card">
            <div class="portal-chart-label" style="color:${MiniChart.COLORS[m]}">${
              m === 'reach' ? 'Portée (reach)' : m === 'followers' ? 'Abonnés' : 'Likes'
            }</div>
            <canvas class="portal-canvas" data-client="${client.id}" data-metric="${m}" style="width:100%;height:160px"></canvas>
          </div>
        `).join('')}
      </div>`;

    section.querySelector('.portal-edit-btn')?.addEventListener('click', () => {
      this._openDataModal(client.id, data);
    });

    requestAnimationFrame(() => {
      section.querySelectorAll('.portal-canvas').forEach(canvas => {
        MiniChart.draw(canvas, data, canvas.dataset.metric);
      });
    });
  },

  /* ── Modal gestion PINs (admin) ──────────────────────────────── */
  _openPinsModal() {
    const pins  = PortalAuth.getPins();
    const modal = document.getElementById('modal-portalPins');
    if (!modal) return;

    document.getElementById('pinAdmin').value          = pins.admin          || '';
    document.getElementById('pinIxinaAth').value       = pins['ixina-ath']   || '';
    document.getElementById('pinIxinaTours').value     = pins['ixina-tours'] || '';
    document.getElementById('pinIxinaIxelles').value   = pins['ixina-ixelles'] || '';

    App.openModal('modal-portalPins');
  },

  _savePins() {
    const pins = {
      admin:            document.getElementById('pinAdmin').value.trim()        || DEFAULT_PINS.admin,
      'ixina-ath':      document.getElementById('pinIxinaAth').value.trim()     || DEFAULT_PINS['ixina-ath'],
      'ixina-tours':    document.getElementById('pinIxinaTours').value.trim()   || DEFAULT_PINS['ixina-tours'],
      'ixina-ixelles':  document.getElementById('pinIxinaIxelles').value.trim() || DEFAULT_PINS['ixina-ixelles'],
    };
    PortalAuth.savePins(pins);
    App.closeModal('modal-portalPins');
  },
};

/* ── Initialisation ─────────────────────────────────────────────── */
window.addEventListener('beforeunload', () => {
  PortalAuth.endSession();
});

document.addEventListener('DOMContentLoaded', () => {
  /* Bouton save modal données */
  document.getElementById('confirmPortalDataBtn')?.addEventListener('click', () => {
    Portal._saveDataModal();
  });

  /* Bouton save PINs */
  document.getElementById('confirmPortalPinsBtn')?.addEventListener('click', () => {
    Portal._savePins();
  });
});
