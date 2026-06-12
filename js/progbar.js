/* ================================================================
   THE HOUSE — progbar.js
   Timeline de programmation sur le Dashboard.
   Grille 8 semaines × 7 jours, une ligne par client.
     - VERT   : publication programmée (PubCal)
     - ORANGE : stock disponible projeté (rythme DEFAULT_GAP jours)
     - ROUGE  : créneau vide au-delà de RED_AFTER jours
     - GRIS   : libre (dans la fenêtre de grâce)
   ================================================================ */

'use strict';

window.ProgBar = (() => {

  const WINDOW_DAYS = 56;
  const RED_AFTER   = 14;
  const DEFAULT_GAP = 3;

  const COLORS = {
    green:  '#22C55E',
    orange: '#F59E0B',
    red:    '#EF4444',
    empty:  'var(--border,#e5e7eb)',
  };

  const JOURS = ['D','L','M','M','J','V','S'];

  function _iso(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function _fmtShort(d) {
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  function _fmtFull(d) {
    const noms = ['dim','lun','mar','mer','jeu','ven','sam'];
    return `${noms[d.getDay()]} ${_fmtShort(d)}`;
  }

  function _plannedDatesFor(clientId) {
    const out = new Set();
    const pubData = App.load(App.KEYS.PUBCAL, {}) || {};
    Object.entries(pubData).forEach(([dateStr, cs]) => {
      if (cs && cs[clientId]) out.add(dateStr);
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
    const planned     = _plannedDatesFor(clientId);
    let   stock       = _stockFor(clientId);
    const today       = new Date(); today.setHours(0,0,0,0);
    let   lastSlotAt  = -1;
    const days        = [];

    for (let i = 0; i < WINDOW_DAYS; i++) {
      const d   = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = _iso(d);

      let status;
      if (planned.has(iso)) {
        status       = 'green';
        lastSlotAt   = i;
      } else if (stock > 0 && (lastSlotAt < 0 || (i - lastSlotAt) >= DEFAULT_GAP)) {
        status       = 'orange';
        stock--;
        lastSlotAt   = i;
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

    const today    = new Date(); today.setHours(0,0,0,0);
    const todayIso = _iso(today);

    const html = App.CLIENTS.map(client => {
      const days   = _buildDays(client.id);
      const counts = { green:0, orange:0, red:0, empty:0 };
      days.forEach(d => counts[d.status]++);

      /* 8 colonnes semaine */
      const weekCols = [];
      for (let w = 0; w < 8; w++) {
        const weekDays   = days.slice(w * 7, w * 7 + 7);
        const weekStart  = weekDays[0].date;
        const weekEnd    = weekDays[weekDays.length - 1].date;
        const hasContent = weekDays.some(d => d.status === 'green' || d.status === 'orange');

        const squares = weekDays.map(d => {
          const isToday   = d.iso === todayIso;
          const tooltip   = `${_fmtFull(d.date)} — ${
            d.status === 'green'  ? '✓ Programmé' :
            d.status === 'orange' ? '⏳ Stock à placer' :
            d.status === 'red'    ? '⚠ Créneau vide' : 'Libre'}`;
          const bg        = COLORS[d.status];
          const todayRing = isToday
            ? 'outline:2px solid var(--primary,#6366f1);outline-offset:1px;'
            : '';
          const dowLabel  = JOURS[d.dow];
          return `
            <div title="${tooltip}" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:default">
              <div style="width:100%;height:26px;background:${bg};border-radius:3px;${todayRing}"></div>
              <span style="font-size:.6rem;color:${isToday ? 'var(--primary,#6366f1)' : 'var(--text-3,#9ca3af)'};font-weight:${isToday ? '700' : '400'}">${dowLabel}</span>
            </div>`;
        }).join('');

        weekCols.push(`
          <div style="flex:1;min-width:0;background:${hasContent ? 'var(--bg-2,#f9fafb)' : 'transparent'};border-radius:6px;padding:6px 4px 4px">
            <div style="text-align:center;margin-bottom:5px">
              <span style="font-size:.72rem;font-weight:700;color:var(--text-1,#374151)">${_fmtShort(weekStart)}</span>
              <span style="font-size:.65rem;color:var(--text-3,#9ca3af)"> – ${_fmtShort(weekEnd)}</span>
            </div>
            <div style="display:flex;gap:3px">${squares}</div>
          </div>`);
      }

      return `
        <div style="background:var(--surface);border:1px solid var(--border);border-left:4px solid ${client.color};border-radius:var(--radius);padding:14px 16px;margin-bottom:14px;box-shadow:var(--shadow-sm)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:32px;height:32px;border-radius:50%;background:${client.color}22;color:${client.color};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.8rem">${escHtml(client.initials)}</div>
              <span style="font-weight:700;font-size:.95rem">${escHtml(client.name)}</span>
            </div>
            <div style="display:flex;gap:14px;font-size:.78rem;font-weight:600">
              <span style="color:#22C55E">✓ ${counts.green} programmé${counts.green > 1 ? 's' : ''}</span>
              <span style="color:#F59E0B">⏳ ${counts.orange} à placer</span>
              <span style="color:#EF4444">⚠ ${counts.red} vide</span>
            </div>
          </div>
          <div style="display:flex;gap:4px">
            ${weekCols.join('')}
          </div>
        </div>`;
    }).join('');

    const redLimit = new Date(today); redLimit.setDate(today.getDate() + RED_AFTER);
    const legend   = `
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;margin-bottom:16px;padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);font-size:.76rem;color:var(--text-2,#6b7280)">
        <strong style="color:var(--text-1)">Aujourd'hui ${_fmtShort(today)}</strong>
        <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:16px;height:10px;background:#22C55E;border-radius:2px;display:inline-block"></span>Programmé (calendrier Publication)</span>
        <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:16px;height:10px;background:#F59E0B;border-radius:2px;display:inline-block"></span>Stock disponible — à placer</span>
        <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:16px;height:10px;background:#EF4444;border-radius:2px;display:inline-block"></span>Créneau vide (alerte dès J+${RED_AFTER} · ${_fmtShort(redLimit)})</span>
        <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:14px;height:14px;background:transparent;border-radius:3px;outline:2px solid var(--primary,#6366f1);display:inline-block"></span>Aujourd'hui</span>
      </div>`;

    el.innerHTML = legend + html;
  }

  function renderForClient(clientId) { return ''; }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  return { render, renderForClient };

})();
