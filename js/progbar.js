/* ================================================================
   THE HOUSE — progbar.js
   Barre de programmation sur la page Dashboard.
   Une ligne par client, fenêtre de 8 semaines à partir d'aujourd'hui.
     - VERT   : publication programmée (PubCal coché ou entrée)
     - ORANGE : stock en cours (projets non publiés) projeté sur les
                créneaux libres au rythme du gap (défaut 3 jours)
     - ROUGE  : créneau libre au-delà du seuil (aujourd'hui + 14 jours)
   ================================================================ */

'use strict';

window.ProgBar = (() => {

  const WINDOW_DAYS  = 56;
  const RED_AFTER    = 14;
  const DEFAULT_GAP  = 3;

  function _iso(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function _fmtDayShort(d) {
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  function _plannedDatesFor(clientId) {
    const out = new Set();
    const pubData = App.load(App.KEYS.PUBCAL, {}) || {};
    Object.entries(pubData).forEach(([dateStr, clients]) => {
      if (clients && clients[clientId]) out.add(dateStr);
    });
    (App.load('th_pubcal_entries', []) || []).forEach(e => {
      if (e.clientId === clientId && e.date) out.add(e.date);
    });
    return out;
  }

  function _stockFor(clientId) {
    const projects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []) || [];
    return projects
      .filter(p => p.stage !== 'publie')
      .reduce((s, p) => s + (p.videoCount || 1), 0);
  }

  function _buildDays(clientId) {
    const planned = _plannedDatesFor(clientId);
    let   stock   = _stockFor(clientId);

    const today = new Date(); today.setHours(0,0,0,0);

    /* Date du dernier slot vert (utile pour décider du report orange) */
    let nextOrangeIdx = -1; // index du prochain créneau orange à poser
    let lastOrangeAt  = -1;

    const days = [];
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = _iso(d);

      let status;
      if (planned.has(iso)) {
        status = 'green';
        lastOrangeAt = i; // un vert "remplit" aussi un créneau pour rythmer l'orange
      } else if (stock > 0 && (lastOrangeAt < 0 || (i - lastOrangeAt) >= DEFAULT_GAP)) {
        status = 'orange';
        stock--;
        lastOrangeAt = i;
      } else if (i >= RED_AFTER) {
        status = 'red';
      } else {
        status = 'empty';
      }

      days.push({ iso, status, date: d, dow: d.getDay() });
    }
    return days;
  }

  function render() {
    const el = document.getElementById('progbar-grid');
    if (!el) return;

    const today = new Date(); today.setHours(0,0,0,0);

    const html = App.CLIENTS.map(client => {
      const days = _buildDays(client.id);

      const counts = { green:0, orange:0, red:0, empty:0 };
      days.forEach(d => counts[d.status]++);

      /* Segments : tirets fins, gap 2px, un par jour */
      const segs = days.map((d, i) => {
        const label = d.iso + ' — ' + (
          d.status === 'green'  ? 'programmé' :
          d.status === 'orange' ? 'stock à monter' :
          d.status === 'red'    ? 'créneau vide' : 'libre');
        const bg = COLORS[d.status];
        const isMonday = d.dow === 1;
        const border = isMonday ? 'box-shadow:inset 1px 0 0 var(--text-3,#9ca3af);' : '';
        return `<div class="pb-seg" title="${label}" data-i="${i}" style="flex:1;height:100%;background:${bg};${border}"></div>`;
      }).join('');

      /* Graduations : un label par lundi */
      const ticks = days.map((d, i) => {
        if (d.dow !== 1 && i !== 0) return '<div style="flex:1"></div>';
        return `<div style="flex:1;font-size:.65rem;color:var(--text-3,#9ca3af);text-align:left;white-space:nowrap;overflow:visible">${_fmtDayShort(d.date)}</div>`;
      }).join('');

      return `
        <div class="pb-row" style="margin-bottom:14px">
          <div class="pb-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${client.color}"></span>
              <span style="font-weight:600;font-size:.85rem">${escHtml(client.name)}</span>
            </div>
            <div style="font-size:.72rem;color:var(--text-3,#9ca3af);display:flex;gap:10px">
              <span style="color:#22C55E">● ${counts.green} prog.</span>
              <span style="color:#F59E0B">● ${counts.orange} stock</span>
              <span style="color:#EF4444">● ${counts.red} vide</span>
            </div>
          </div>
          <div class="pb-track" style="display:flex;gap:2px;height:14px;border-radius:4px;overflow:hidden;background:var(--bg-2,#f3f4f6)">
            ${segs}
          </div>
          <div class="pb-ticks" style="display:flex;gap:2px;margin-top:3px">
            ${ticks}
          </div>
        </div>`;
    }).join('');

    /* Légende globale */
    const todayStr = _fmtDayShort(today);
    const redLimit = new Date(today); redLimit.setDate(today.getDate() + RED_AFTER);
    const legend = `
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-bottom:14px;font-size:.75rem;color:var(--text-2,#6b7280)">
        <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:8px;background:#22C55E;border-radius:2px"></span>Programmé</span>
        <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:8px;background:#F59E0B;border-radius:2px"></span>Stock à monter</span>
        <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:8px;background:#EF4444;border-radius:2px"></span>Créneau vide (≥ J+${RED_AFTER})</span>
        <span style="margin-left:auto">Aujourd'hui ${todayStr} · alerte rouge dès ${_fmtDayShort(redLimit)}</span>
      </div>`;

    el.innerHTML = legend + html;
  }

  const COLORS = {
    green:  '#22C55E',
    orange: '#F59E0B',
    red:    '#EF4444',
    empty:  'var(--border,#e5e7eb)',
  };

  function renderForClient(clientId) {
    const days = _buildDays(clientId);
    const counts = { green:0, orange:0, red:0, empty:0 };
    days.forEach(d => counts[d.status]++);

    const segs = days.map((d, i) => {
      const label = d.iso + ' — ' + (
        d.status === 'green'  ? 'programmé' :
        d.status === 'orange' ? 'stock à monter' :
        d.status === 'red'    ? 'créneau vide' : 'libre');
      const bg = COLORS[d.status];
      const border = d.dow === 1 ? 'box-shadow:inset 1px 0 0 var(--text-3,#9ca3af);' : '';
      return `<div class="pb-seg" title="${label}" data-i="${i}" style="flex:1;height:100%;background:${bg};${border}"></div>`;
    }).join('');

    const ticks = days.map((d, i) => {
      if (d.dow !== 1 && i !== 0) return '<div style="flex:1"></div>';
      return `<div style="flex:1;font-size:.62rem;color:var(--text-3,#9ca3af);white-space:nowrap;overflow:visible">${_fmtDayShort(d.date)}</div>`;
    }).join('');

    return `
      <div style="padding-top:8px;border-top:1px dashed var(--border,#e5e7eb)">
        <div style="display:flex;justify-content:flex-end;gap:10px;font-size:.7rem;margin-bottom:4px">
          <span style="color:#22C55E;font-weight:600">● ${counts.green} prog.</span>
          <span style="color:#F59E0B;font-weight:600">● ${counts.orange} stock</span>
          <span style="color:#EF4444;font-weight:600">● ${counts.red} vide</span>
        </div>
        <div style="display:flex;gap:2px;height:10px;border-radius:3px;overflow:hidden;background:var(--bg-2,#f3f4f6)">
          ${segs}
        </div>
        <div style="display:flex;gap:2px;margin-top:2px">
          ${ticks}
        </div>
      </div>`;
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  return { render, renderForClient };

})();
