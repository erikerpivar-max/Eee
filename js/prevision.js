/* ================================================================
   THE HOUSE — prevision.js
   Prévision financière : trésorerie, revenus, dépenses, forecast
   ================================================================ */

'use strict';

window.Prevision = (() => {

  const KEYS = {
    TREASURY:        'th_prev_treasury',
    INCOME_RECUR:    'th_prev_income_recurring',
    INCOME_EXPECTED: 'th_prev_income_expected',
    EXPENSE_RECUR:   'th_prev_expense_recurring',
    EXPENSE_ONCE:    'th_prev_expense_once',
  };

  /* ── Données ──────────────────────────────────────────────────── */
  function getTreasury()       { return App.load(KEYS.TREASURY, 0); }
  function setTreasury(v)      { App.save(KEYS.TREASURY, Number(v) || 0); }

  function getIncomeRecur()    { return App.load(KEYS.INCOME_RECUR, []); }
  function saveIncomeRecur(d)  { App.save(KEYS.INCOME_RECUR, d); }

  function getIncomeExpected() { return App.load(KEYS.INCOME_EXPECTED, []); }
  function saveIncomeExpected(d){ App.save(KEYS.INCOME_EXPECTED, d); }

  function getExpenseRecur()   { return App.load(KEYS.EXPENSE_RECUR, []); }
  function saveExpenseRecur(d) { App.save(KEYS.EXPENSE_RECUR, d); }

  function getExpenseOnce()    { return App.load(KEYS.EXPENSE_ONCE, []); }
  function saveExpenseOnce(d)  { App.save(KEYS.EXPENSE_ONCE, d); }

  /* ── Format monétaire ─────────────────────────────────────────── */
  function fmt(n) {
    return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  }

  /* ── Mois helpers ─────────────────────────────────────────────── */
  function getMonthLabel(year, month) {
    const d = new Date(year, month, 1);
    const s = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function monthKey(year, month) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }

  /* ── Rendu principal ──────────────────────────────────────────── */
  function render() {
    const container = document.getElementById('prevision-container');
    if (!container) return;

    const treasury       = getTreasury();
    const incomeRecur    = getIncomeRecur();
    const incomeExpected = getIncomeExpected();
    const expenseRecur   = getExpenseRecur();
    const expenseOnce    = getExpenseOnce();

    const totalRecurIncome  = incomeRecur.reduce((s, i) => s + i.amount, 0);
    const totalRecurExpense = expenseRecur.reduce((s, i) => s + i.amount, 0);
    const netRecurring      = totalRecurIncome - totalRecurExpense;

    container.innerHTML = `

      <!-- Résumé -->
      <div class="prev-summary-grid">
        <div class="prev-summary-card prev-card-treasury">
          <div class="prev-card-icon" style="--c:#6366F1;--bg:#EEF2FF">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/></svg>
          </div>
          <div>
            <div class="prev-card-value">${fmt(treasury)}</div>
            <div class="prev-card-label">Trésorerie actuelle</div>
          </div>
          <button class="prev-edit-btn" id="prev-edit-treasury" title="Modifier">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
        <div class="prev-summary-card">
          <div class="prev-card-icon" style="--c:var(--success);--bg:var(--success-bg)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <div class="prev-card-value" style="color:var(--success)">${fmt(totalRecurIncome)}</div>
            <div class="prev-card-label">Revenus récurrents / mois</div>
          </div>
        </div>
        <div class="prev-summary-card">
          <div class="prev-card-icon" style="--c:var(--danger);--bg:var(--danger-bg)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <div class="prev-card-value" style="color:var(--danger)">${fmt(totalRecurExpense)}</div>
            <div class="prev-card-label">Dépenses récurrentes / mois</div>
          </div>
        </div>
        <div class="prev-summary-card">
          <div class="prev-card-icon" style="--c:${netRecurring >= 0 ? 'var(--success)' : 'var(--danger)'};--bg:${netRecurring >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)'}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="${netRecurring >= 0 ? '23 6 13.5 15.5 8.5 10.5 1 18' : '23 18 13.5 8.5 8.5 13.5 1 6'}"/></svg>
          </div>
          <div>
            <div class="prev-card-value" style="color:${netRecurring >= 0 ? 'var(--success)' : 'var(--danger)'}">${netRecurring >= 0 ? '+' : ''}${fmt(netRecurring)}</div>
            <div class="prev-card-label">Balance nette / mois</div>
          </div>
        </div>
      </div>

      <!-- Revenus récurrents -->
      <div class="prev-section">
        <div class="section-header">
          <h3 class="section-title">Revenus récurrents</h3>
          <button class="btn btn-outline btn-sm" id="prev-add-income-recur">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ajouter
          </button>
        </div>
        <div class="prev-list" id="prev-list-income-recur">
          ${incomeRecur.length === 0 ? '<p class="empty-hint">Aucun revenu récurrent défini.</p>' :
            incomeRecur.map(i => `
              <div class="prev-item prev-item-income">
                <span class="prev-item-name">${escHtml(i.name)}</span>
                ${i.startMonth ? `<span class="prev-item-date">à partir de ${i.startMonth}</span>` : ''}
                <span class="prev-item-amount">+${fmt(i.amount)}</span>
                <button class="prev-item-del" data-type="income_recur" data-id="${i.id}" title="Supprimer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>`).join('')}
        </div>
      </div>

      <!-- Revenus attendus -->
      <div class="prev-section">
        <div class="section-header">
          <h3 class="section-title">Revenus attendus</h3>
          <span class="section-hint">Paiements ponctuels à venir</span>
          <button class="btn btn-outline btn-sm" id="prev-add-income-expected" style="margin-left:auto">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ajouter
          </button>
        </div>
        <div class="prev-list" id="prev-list-income-expected">
          ${incomeExpected.length === 0 ? '<p class="empty-hint">Aucun revenu attendu.</p>' :
            incomeExpected.map(i => `
              <div class="prev-item prev-item-income">
                <span class="prev-item-name">${escHtml(i.name)}</span>
                <span class="prev-item-date">${i.month}</span>
                <span class="prev-item-amount">+${fmt(i.amount)}</span>
                <button class="prev-item-del" data-type="income_expected" data-id="${i.id}" title="Supprimer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>`).join('')}
        </div>
      </div>

      <!-- Dépenses récurrentes -->
      <div class="prev-section">
        <div class="section-header">
          <h3 class="section-title">Dépenses récurrentes</h3>
          <button class="btn btn-outline btn-sm" id="prev-add-expense-recur">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ajouter
          </button>
        </div>
        <div class="prev-list" id="prev-list-expense-recur">
          ${expenseRecur.length === 0 ? '<p class="empty-hint">Aucune dépense récurrente définie.</p>' :
            expenseRecur.map(i => `
              <div class="prev-item prev-item-expense">
                <span class="prev-item-name">${escHtml(i.name)}</span>
                ${i.startMonth ? `<span class="prev-item-date">à partir de ${i.startMonth}</span>` : ''}
                <span class="prev-item-amount">-${fmt(i.amount)}</span>
                <button class="prev-item-del" data-type="expense_recur" data-id="${i.id}" title="Supprimer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>`).join('')}
        </div>
      </div>

      <!-- Dépenses ponctuelles -->
      <div class="prev-section">
        <div class="section-header">
          <h3 class="section-title">Dépenses ponctuelles</h3>
          <span class="section-hint">Prévues pour un mois précis</span>
          <button class="btn btn-outline btn-sm" id="prev-add-expense-once" style="margin-left:auto">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ajouter
          </button>
        </div>
        <div class="prev-list" id="prev-list-expense-once">
          ${expenseOnce.length === 0 ? '<p class="empty-hint">Aucune dépense ponctuelle prévue.</p>' :
            expenseOnce.map(i => `
              <div class="prev-item prev-item-expense">
                <span class="prev-item-name">${escHtml(i.name)}</span>
                <span class="prev-item-date">${i.month}</span>
                <span class="prev-item-amount">-${fmt(i.amount)}</span>
                <button class="prev-item-del" data-type="expense_once" data-id="${i.id}" title="Supprimer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>`).join('')}
        </div>
      </div>

      <!-- Graphique -->
      <div class="prev-section">
        <div class="section-header">
          <h3 class="section-title">Projection sur 6 mois</h3>
          <span class="section-hint">Cliquez sur la légende pour masquer/afficher une courbe</span>
        </div>
        <div id="prev-chart"></div>
      </div>

      <!-- Prévision sur 6 mois -->
      <div class="prev-section">
        <div class="section-header">
          <h3 class="section-title">Détail mensuel</h3>
          <span class="section-hint">Solde projeté fin de mois</span>
        </div>
        <div class="table-wrapper">
          <table class="data-table prev-forecast-table">
            <thead>
              <tr>
                <th>Mois</th>
                <th style="color:var(--success)">Entrées</th>
                <th style="color:var(--danger)">Sorties</th>
                <th>Net</th>
                <th>Solde projeté</th>
              </tr>
            </thead>
            <tbody id="prev-forecast-body"></tbody>
          </table>
        </div>
      </div>

      <!-- Conseil -->
      <div class="prev-advice" id="prev-advice"></div>
    `;

    _renderForecast(treasury, incomeRecur, incomeExpected, expenseRecur, expenseOnce);
    _renderChart(treasury, incomeRecur, incomeExpected, expenseRecur, expenseOnce);
    _renderAdvice(treasury, netRecurring, expenseRecur);
    _bindEvents();
  }

  /* ── Graphique SVG linéaire ───────────────────────────────────── */
  function _renderChart(treasury, incomeRecur, incomeExpected, expenseRecur, expenseOnce) {
    const el = document.getElementById('prev-chart');
    if (!el) return;

    const now = new Date();
    const labels = [], sRev = [], sDep = [], sBal = [], sTre = [];
    let bal = treasury;

    for (let i = 0; i < 6; i++) {
      const d  = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mk = monthKey(d.getFullYear(), d.getMonth());
      labels.push(getMonthLabel(d.getFullYear(), d.getMonth()).split(' ')[0]);

      const totalIn  = incomeRecur.filter(x => !x.startMonth || x.startMonth <= mk).reduce((s, x) => s + x.amount, 0)
                     + incomeExpected.filter(x => x.month === mk).reduce((s, x) => s + x.amount, 0);
      const totalOut = expenseRecur.filter(x => !x.startMonth || x.startMonth <= mk).reduce((s, x) => s + x.amount, 0)
                     + expenseOnce.filter(x => x.month === mk).reduce((s, x) => s + x.amount, 0);
      const net = totalIn - totalOut;
      bal += net;

      sRev.push(totalIn);
      sDep.push(totalOut);
      sBal.push(net);
      sTre.push(bal);
    }

    /* Échelle Y */
    const allVals = [...sRev, ...sDep, ...sBal, ...sTre, 0];
    const rawMin  = Math.min(...allVals);
    const rawMax  = Math.max(...allVals);
    const pad     = (rawMax - rawMin) * 0.12 || 200;
    const yMin    = rawMin - pad;
    const yMax    = rawMax + pad;
    const yRange  = yMax - yMin || 1;

    /* Dimensions */
    const W = 700, H = 260, ML = 72, MR = 16, MT = 18, MB = 40;
    const cW = W - ML - MR, cH = H - MT - MB;

    const tx = i  => ML + (i / 5) * cW;
    const ty = v  => MT + cH - ((v - yMin) / yRange) * cH;

    /* Courbe smooth (Catmull-Rom → Cubic Bézier) */
    function smooth(pts) {
      if (!pts.length) return '';
      let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(i - 1, 0)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(i + 2, pts.length - 1)];
        const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
      }
      return d;
    }

    const series = [
      { id: 'rev', label: 'Revenus',     color: '#059669', data: sRev  },
      { id: 'dep', label: 'Dépenses',    color: '#DC2626', data: sDep  },
      { id: 'bal', label: 'Balance',     color: '#F59E0B', data: sBal  },
      { id: 'tre', label: 'Trésorerie',  color: '#6366F1', data: sTre  },
    ];

    /* Grille Y */
    const nGrid = 5;
    let gridSvg = '';
    for (let j = 0; j <= nGrid; j++) {
      const v = yMin + (yRange * j / nGrid);
      const y = ty(v);
      const isZero = Math.abs(v) < yRange * 0.04;
      gridSvg += `<line x1="${ML}" y1="${y.toFixed(1)}" x2="${W - MR}" y2="${y.toFixed(1)}"
        stroke="${isZero ? 'var(--text-3)' : 'var(--border)'}"
        stroke-width="${isZero ? 1.5 : 1}"
        stroke-dasharray="${isZero ? '' : '3 5'}"/>
        <text x="${ML - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end"
          font-size="9.5" font-family="var(--font)" fill="var(--text-3)">${fmt(Math.round(v / 100) * 100)}</text>`;
    }

    /* Labels X */
    const xSvg = labels.map((lbl, i) =>
      `<text x="${tx(i).toFixed(1)}" y="${H - 10}" text-anchor="middle"
        font-size="11" font-family="var(--font)" fill="var(--text-2)">${lbl}</text>`
    ).join('');

    /* Paths + dots */
    let pathsSvg = '', dotsSvg = '';
    series.forEach(s => {
      const pts = s.data.map((v, i) => [tx(i), ty(v)]);
      pathsSvg += `<path class="prev-chart-line" data-series="${s.id}" d="${smooth(pts)}"
        stroke="${s.color}" stroke-width="2.5" fill="none"
        stroke-linecap="round" stroke-linejoin="round"/>`;
      pts.forEach((pt, i) => {
        dotsSvg += `<circle class="prev-chart-dot" data-series="${s.id}"
          cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="4"
          fill="${s.color}" stroke="var(--surface)" stroke-width="2">
          <title>${labels[i]} — ${s.label} : ${fmt(s.data[i])}</title>
        </circle>`;
      });
    });

    /* Légende (cliquable) */
    const legendHtml = series.map(s =>
      `<span class="prev-chart-legend-item" data-series="${s.id}">
        <span class="prev-chart-legend-dot" style="background:${s.color}"></span>${s.label}
      </span>`
    ).join('');

    el.innerHTML = `
      <div class="prev-chart-wrap">
        <svg class="prev-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
          ${gridSvg}${xSvg}${pathsSvg}${dotsSvg}
        </svg>
        <div class="prev-chart-legend">${legendHtml}</div>
      </div>`;

    /* Animation draw */
    el.querySelectorAll('.prev-chart-line').forEach((p, i) => {
      const len = p.getTotalLength ? p.getTotalLength() : 600;
      p.style.strokeDasharray  = len;
      p.style.strokeDashoffset = len;
      p.style.transition = `stroke-dashoffset .9s cubic-bezier(.4,0,.2,1) ${i * .12}s`;
      requestAnimationFrame(() => requestAnimationFrame(() => { p.style.strokeDashoffset = 0; }));
    });

    /* Légende cliquable (masquer/afficher courbe) */
    el.querySelectorAll('.prev-chart-legend-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.series;
        const hidden = item.classList.toggle('hidden');
        el.querySelectorAll(`[data-series="${id}"]`).forEach(n => n.classList.toggle('hidden', hidden));
      });
    });
  }

  /* ── Forecast table ───────────────────────────────────────────── */
  function _renderForecast(treasury, incomeRecur, incomeExpected, expenseRecur, expenseOnce) {
    const tbody = document.getElementById('prev-forecast-body');
    if (!tbody) return;

    const now   = new Date();
    let balance = treasury;
    const rows  = [];

    for (let i = 0; i < 6; i++) {
      const d     = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year  = d.getFullYear();
      const month = d.getMonth();
      const mk    = monthKey(year, month);
      const label = getMonthLabel(year, month);

      /* Revenus du mois (récurrents actifs à ce mois) */
      const recurIn  = incomeRecur
        .filter(x => !x.startMonth || x.startMonth <= mk)
        .reduce((s, x) => s + x.amount, 0);
      const expectIn = incomeExpected
        .filter(x => x.month === mk)
        .reduce((s, x) => s + x.amount, 0);
      const totalIn  = recurIn + expectIn;

      /* Dépenses du mois (récurrentes actives à ce mois) */
      const recurOut = expenseRecur
        .filter(x => !x.startMonth || x.startMonth <= mk)
        .reduce((s, x) => s + x.amount, 0);
      const onceOut  = expenseOnce
        .filter(x => x.month === mk)
        .reduce((s, x) => s + x.amount, 0);
      const totalOut = recurOut + onceOut;

      const net = totalIn - totalOut;
      balance += net;

      const balClass = balance >= 0 ? 'prev-positive' : 'prev-negative';
      const netClass = net >= 0 ? 'prev-positive' : 'prev-negative';

      rows.push(`
        <tr>
          <td class="prev-month-cell">${label}</td>
          <td class="prev-positive">+${fmt(totalIn)}</td>
          <td class="prev-negative">-${fmt(totalOut)}</td>
          <td class="${netClass}">${net >= 0 ? '+' : ''}${fmt(net)}</td>
          <td class="${balClass}" style="font-weight:600">${fmt(balance)}</td>
        </tr>`);
    }

    tbody.innerHTML = rows.join('');
  }

  /* ── Conseils ─────────────────────────────────────────────────── */
  function _renderAdvice(treasury, netRecurring, expenseRecur) {
    const el = document.getElementById('prev-advice');
    if (!el) return;

    const totalExpense   = expenseRecur.reduce((s, x) => s + x.amount, 0);
    const monthsCovered  = totalExpense > 0 ? Math.floor(treasury / totalExpense) : null;

    const tips = [];

    if (monthsCovered !== null && monthsCovered < 3) {
      tips.push(`<span class="prev-advice-icon prev-advice-warn">&#9888;</span> Ta trésorerie couvre seulement <strong>${monthsCovered} mois</strong> de dépenses récurrentes. L'idéal est d'avoir au minimum 3 mois de réserve.`);
    } else if (monthsCovered !== null && monthsCovered >= 3) {
      tips.push(`<span class="prev-advice-icon prev-advice-ok">&#10003;</span> Ta trésorerie couvre <strong>${monthsCovered} mois</strong> de dépenses — bonne réserve.`);
    }

    if (netRecurring < 0) {
      tips.push(`<span class="prev-advice-icon prev-advice-warn">&#9888;</span> Tes dépenses récurrentes dépassent tes revenus récurrents de <strong>${fmt(Math.abs(netRecurring))}/mois</strong>. Attention à l'hémorragie.`);
    }

    if (tips.length === 0) {
      tips.push(`<span class="prev-advice-icon prev-advice-ok">&#10003;</span> Commence par ajouter ta trésorerie, tes revenus et dépenses pour obtenir des conseils personnalisés.`);
    }

    el.innerHTML = tips.map(t => `<div class="prev-advice-item">${t}</div>`).join('');
  }

  /* ── Events ───────────────────────────────────────────────────── */
  function _bindEvents() {
    /* Modifier trésorerie */
    document.getElementById('prev-edit-treasury')?.addEventListener('click', () => {
      _promptValue('Trésorerie actuelle (€)', getTreasury(), val => {
        setTreasury(val);
        render();
      });
    });

    /* Ajouter revenu récurrent */
    document.getElementById('prev-add-income-recur')?.addEventListener('click', () => {
      _promptEntry('Nouveau revenu récurrent', 'startMonth', (name, amount, month) => {
        const list = getIncomeRecur();
        list.push({ id: App.uid(), name, amount, startMonth: month || '' });
        saveIncomeRecur(list);
        render();
      });
    });

    /* Ajouter revenu attendu */
    document.getElementById('prev-add-income-expected')?.addEventListener('click', () => {
      _promptEntry('Nouveau revenu attendu', 'month', (name, amount, month) => {
        const list = getIncomeExpected();
        list.push({ id: App.uid(), name, amount, month });
        saveIncomeExpected(list);
        render();
      });
    });

    /* Ajouter dépense récurrente */
    document.getElementById('prev-add-expense-recur')?.addEventListener('click', () => {
      _promptEntry('Nouvelle dépense récurrente', 'startMonth', (name, amount, month) => {
        const list = getExpenseRecur();
        list.push({ id: App.uid(), name, amount, startMonth: month || '' });
        saveExpenseRecur(list);
        render();
      });
    });

    /* Ajouter dépense ponctuelle */
    document.getElementById('prev-add-expense-once')?.addEventListener('click', () => {
      _promptEntry('Nouvelle dépense ponctuelle', 'month', (name, amount, month) => {
        const list = getExpenseOnce();
        list.push({ id: App.uid(), name, amount, month });
        saveExpenseOnce(list);
        render();
      });
    });

    /* Supprimer items */
    document.querySelectorAll('.prev-item-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const id   = btn.dataset.id;
        if (type === 'income_recur') {
          saveIncomeRecur(getIncomeRecur().filter(x => x.id !== id));
        } else if (type === 'income_expected') {
          saveIncomeExpected(getIncomeExpected().filter(x => x.id !== id));
        } else if (type === 'expense_recur') {
          saveExpenseRecur(getExpenseRecur().filter(x => x.id !== id));
        } else if (type === 'expense_once') {
          saveExpenseOnce(getExpenseOnce().filter(x => x.id !== id));
        }
        render();
      });
    });
  }

  /* ── Modale : saisie montant simple ───────────────────────────── */
  function _promptValue(title, current, onSave) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.display = 'flex';
    backdrop.innerHTML = `
      <div class="modal modal-sm">
        <div class="modal-head"><h3>${escHtml(title)}</h3></div>
        <div class="modal-body">
          <label class="form-label">Montant (€)</label>
          <input type="number" class="form-input" id="_prev-val" value="${current || ''}" min="0" step="1" />
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="_prev-val-cancel">Annuler</button>
          <button class="btn btn-primary" id="_prev-val-ok">Sauvegarder</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('visible')));

    const inp = backdrop.querySelector('#_prev-val');
    setTimeout(() => inp.focus(), 120);

    const close = () => {
      backdrop.classList.remove('visible');
      setTimeout(() => backdrop.remove(), 200);
    };

    backdrop.querySelector('#_prev-val-cancel').addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

    const save = () => {
      const val = Number(inp.value);
      if (isNaN(val)) return;
      close();
      onSave(val);
    };
    backdrop.querySelector('#_prev-val-ok').addEventListener('click', save);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  }

  /* ── Modale : saisie nom + montant (+ mois optionnel) ─────────── */
  function _promptEntry(title, withMonth, onSave) {
    const now = new Date();
    const monthOptions = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mk = monthKey(d.getFullYear(), d.getMonth());
      const ml = getMonthLabel(d.getFullYear(), d.getMonth());
      monthOptions.push(`<option value="${mk}">${ml}</option>`);
    }

    let monthField = '';
    if (withMonth === 'month') {
      monthField = `
        <label class="form-label" style="margin-top:14px">Mois prévu</label>
        <select class="form-select" id="_prev-month">${monthOptions.join('')}</select>`;
    } else if (withMonth === 'startMonth') {
      monthField = `
        <label class="form-label" style="margin-top:14px">À partir de (optionnel)</label>
        <select class="form-select" id="_prev-month">
          <option value="">Dès maintenant</option>
          ${monthOptions.join('')}
        </select>`;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.display = 'flex';
    backdrop.innerHTML = `
      <div class="modal modal-sm">
        <div class="modal-head"><h3>${escHtml(title)}</h3></div>
        <div class="modal-body">
          <label class="form-label">Nom</label>
          <input type="text" class="form-input" id="_prev-name" placeholder="Ex : Loyer bureau" autocomplete="off" />
          <label class="form-label" style="margin-top:14px">Montant (€)</label>
          <input type="number" class="form-input" id="_prev-amount" placeholder="0" min="0" step="1" />
          ${monthField}
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="_prev-entry-cancel">Annuler</button>
          <button class="btn btn-primary" id="_prev-entry-ok">Ajouter</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('visible')));

    const nameInp = backdrop.querySelector('#_prev-name');
    setTimeout(() => nameInp.focus(), 120);

    const close = () => {
      backdrop.classList.remove('visible');
      setTimeout(() => backdrop.remove(), 200);
    };

    backdrop.querySelector('#_prev-entry-cancel').addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

    const save = () => {
      const name   = nameInp.value.trim();
      const amount = Number(backdrop.querySelector('#_prev-amount').value);
      if (!name || !amount || amount <= 0) {
        if (!name) nameInp.focus();
        else backdrop.querySelector('#_prev-amount').focus();
        return;
      }
      const month = withMonth ? backdrop.querySelector('#_prev-month').value : null;
      close();
      onSave(name, amount, month);
    };

    backdrop.querySelector('#_prev-entry-ok').addEventListener('click', save);
    backdrop.querySelector('#_prev-amount').addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  }

  return { render };
})();
