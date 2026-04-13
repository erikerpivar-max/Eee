/* ================================================================
   THE HOUSE — comptabilite.js
   Provisions fiscales : TVA nette Billit + cotisation Partena
   ================================================================ */

'use strict';

const Comptabilite = (() => {

  const COTISATION = 876;
  const PROXY = 'http://localhost:3001';

  let tvaNette = null;
  let quarterKey = '';

  /* ─── Trimestre courant ──────────────────────────────────────── */
  function getQuarter() {
    const now   = new Date();
    const m     = now.getMonth();
    const y     = now.getFullYear();
    let q, label, deadlineLabel, deadline;

    if (m >= 3 && m <= 5) {
      q = 'q2'; label = `Q2 ${y} · avr–juin`;
      deadline = new Date(y, 5, 30);
      deadlineLabel = `30 juin ${y}`;
    } else if (m >= 6 && m <= 8) {
      q = 'q3'; label = `Q3 ${y} · juil–sept`;
      deadline = new Date(y, 8, 30);
      deadlineLabel = `30 septembre ${y}`;
    } else if (m >= 9 && m <= 11) {
      q = 'q4'; label = `Q4 ${y} · oct–déc`;
      deadline = new Date(y, 11, 31);
      deadlineLabel = `31 décembre ${y}`;
    } else {
      q = 'q1'; label = `Q1 ${y} · jan–mars`;
      deadline = new Date(y, 2, 31);
      deadlineLabel = `31 mars ${y}`;
    }

    const daysLeft = Math.ceil((deadline - now) / 86400000);
    return { q, label, deadlineLabel, daysLeft, year: y };
  }

  /* ─── Format monnaie ─────────────────────────────────────────── */
  function fmt(n) {
    return n.toLocaleString('fr-BE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €';
  }

  /* ─── Init ───────────────────────────────────────────────────── */
  function init() {
    const qi = getQuarter();
    quarterKey = `${qi.q}_${qi.year}`;

    el('cpt-quarter-label').textContent = qi.label;
    el('cpt-deadline').textContent = qi.deadlineLabel;

    const cd = el('cpt-countdown');
    if (qi.daysLeft <= 0) {
      cd.textContent = 'Échéance dépassée';
      cd.classList.add('cpt-countdown-late');
    } else {
      cd.textContent = `J−${qi.daysLeft}`;
      cd.classList.toggle('cpt-countdown-ok', qi.daysLeft > 30);
    }

    restoreToggles();

    // Seulement si pas encore sync depuis cet init
    if (el('cpt-last-sync').textContent === 'Pas encore synchronisé') {
      fetch_();
    }
  }

  /* ─── Fetch Billit via proxy local ───────────────────────────── */
  async function fetch_() {
    const btn = el('cpt-sync-btn');
    btn.disabled = true;
    btn.textContent = '↻ Chargement…';
    hideError();

    try {
      const [sRes, pRes] = await Promise.all([
        window.fetch(`${PROXY}/billit/sales`),
        window.fetch(`${PROXY}/billit/purchases`),
      ]);

      if (!sRes.ok || !pRes.ok) throw new Error(`HTTP ${sRes.status}/${pRes.status}`);

      const sales     = await sRes.json();
      const purchases = await pRes.json();

      const sList = Array.isArray(sales)     ? sales     : (sales.value     || []);
      const pList = Array.isArray(purchases) ? purchases : (purchases.value || []);

      const caHT    = sList.reduce((s, o) => s + (parseFloat(o.TotalExcl) || 0), 0);
      const tvaCol  = sList.reduce((s, o) => s + (parseFloat(o.TotalVAT)  || 0), 0);
      const tvaDed  = pList.reduce((s, o) => s + (parseFloat(o.TotalVAT)  || 0), 0);
      const tvaNet  = tvaCol - tvaDed;

      el('cpt-ca-ht').textContent    = fmt(caHT);
      el('cpt-tva-col').textContent  = fmt(tvaCol);
      el('cpt-tva-ded').textContent  = `− ${fmt(tvaDed)}`;
      el('cpt-inv-count').textContent = `${sList.length} / ${pList.length}`;
      el('cpt-tva-nette').textContent = fmt(tvaNet);
      el('cpt-manual').style.display = 'none';

      tvaNette = tvaNet;
      updateTotal();

      el('cpt-last-sync').textContent =
        `Sync : ${new Date().toLocaleTimeString('fr-BE')}`;

    } catch (err) {
      showError(err.message);
    }

    btn.disabled = false;
    btn.textContent = '↻ Actualiser Billit';
  }

  /* ─── Erreur + mode manuel ───────────────────────────────────── */
  function showError(msg) {
    const box = el('cpt-error');
    box.innerHTML = `<strong>Proxy Billit inaccessible</strong><br>
      Lancez <code>node server.js</code> dans le dossier widget-comptable, puis réessayez.<br>
      <small style="opacity:.7">${msg}</small>`;
    box.style.display = 'block';
    el('cpt-manual').style.display = 'block';
    el('cpt-last-sync').textContent = 'Échec de synchronisation';
    ['cpt-ca-ht','cpt-tva-col','cpt-tva-ded','cpt-inv-count','cpt-tva-nette']
      .forEach(id => el(id).textContent = '—');
  }

  function hideError() {
    el('cpt-error').style.display = 'none';
  }

  function applyManual() {
    const val = parseFloat(document.getElementById('cpt-manual-input').value);
    if (isNaN(val) || val < 0) return;
    tvaNette = val;
    el('cpt-tva-nette').textContent = fmt(val);
    updateTotal();
  }

  /* ─── Total ──────────────────────────────────────────────────── */
  function updateTotal() {
    if (tvaNette === null) return;
    const total = tvaNette + COTISATION;
    el('cpt-total').textContent    = fmt(total);
    el('cpt-breakdown').textContent = `${fmt(tvaNette)} TVA nette + ${fmt(COTISATION)} cotisation`;
  }

  /* ─── Toggles provision ──────────────────────────────────────── */
  function toggle(key) {
    const storageKey = `cpt_${quarterKey}_${key}`;
    const next = localStorage.getItem(storageKey) !== '1';
    localStorage.setItem(storageKey, next ? '1' : '0');
    applyToggle(key, next);
    checkAllDone();
  }

  function restoreToggles() {
    applyToggle('tva',        localStorage.getItem(`cpt_${quarterKey}_tva`)        === '1');
    applyToggle('cotisation', localStorage.getItem(`cpt_${quarterKey}_cotisation`) === '1');
    checkAllDone();
  }

  function applyToggle(key, done) {
    const btn = el(`cpt-btn-${key}`);
    if (done) {
      btn.classList.add('cpt-provision-btn--done');
      btn.innerHTML = key === 'tva'
        ? '<span class="cpt-btn-icon">✓</span> TVA provisionnée'
        : '<span class="cpt-btn-icon">✓</span> Cotisation provisionnée';
    } else {
      btn.classList.remove('cpt-provision-btn--done');
      btn.innerHTML = key === 'tva'
        ? '<span class="cpt-btn-icon">⚠</span> TVA non provisionnée'
        : '<span class="cpt-btn-icon">⚠</span> Cotisation non provisionnée';
    }
  }

  function checkAllDone() {
    const tvaDone  = localStorage.getItem(`cpt_${quarterKey}_tva`)        === '1';
    const cotDone  = localStorage.getItem(`cpt_${quarterKey}_cotisation`) === '1';
    el('cpt-all-done').style.display = (tvaDone && cotDone) ? 'flex' : 'none';
  }

  /* ─── Utilitaire ─────────────────────────────────────────────── */
  function el(id) { return document.getElementById(id); }

  return { init, fetch: fetch_, applyManual, toggle };

})();
