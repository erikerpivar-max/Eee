/* ================================================================
   THE HOUSE — comptabilite.js
   Provisions fiscales — saisie manuelle par trimestre

   RÈGLES BELGES (indépendant, CA < 2.500.000 €/an) :
   · TVA        → déclaration trimestrielle, échéance le 20 du mois
                  suivant la fin du trimestre (sauf Q4 : 20 décembre)
   · Cotisation → paiement trimestriel, échéance le dernier jour
                  du trimestre (31/03 · 30/06 · 30/09 · 31/12)
   ================================================================ */

'use strict';

const Comptabilite = (() => {

  const COTISATION_DEFAULT = 876;

  let tvaNette   = null;
  let cotisation = COTISATION_DEFAULT;
  let quarterKey = '';

  /* ─── Trimestre courant ────────────────────────────────────────── */
  function getQuarter() {
    const now = new Date();
    const m   = now.getMonth();
    const y   = now.getFullYear();
    let q, label;
    let deadlineCot, deadlineCotLabel;
    let deadlineTVA, deadlineTVALabel;

    if (m >= 3 && m <= 5) {
      q = 'q2'; label = `Q2 ${y} · avr–juin`;
      deadlineCot = new Date(y, 5, 30);  deadlineCotLabel = `30 juin ${y}`;
      deadlineTVA = new Date(y, 6, 20);  deadlineTVALabel = `20 juillet ${y}`;
    } else if (m >= 6 && m <= 8) {
      q = 'q3'; label = `Q3 ${y} · juil–sept`;
      deadlineCot = new Date(y, 8, 30);  deadlineCotLabel = `30 septembre ${y}`;
      deadlineTVA = new Date(y, 9, 20);  deadlineTVALabel = `20 octobre ${y}`;
    } else if (m >= 9 && m <= 11) {
      q = 'q4'; label = `Q4 ${y} · oct–déc`;
      deadlineCot = new Date(y, 11, 31); deadlineCotLabel = `31 décembre ${y}`;
      deadlineTVA = new Date(y, 11, 20); deadlineTVALabel = `20 décembre ${y}`; // règle spéciale Q4
    } else {
      q = 'q1'; label = `Q1 ${y} · jan–mars`;
      deadlineCot = new Date(y, 2, 31);  deadlineCotLabel = `31 mars ${y}`;
      deadlineTVA = new Date(y, 3, 20);  deadlineTVALabel = `20 avril ${y}`;
    }

    return {
      q, label, year: y,
      deadlineCotLabel,
      daysLeftCot: Math.ceil((deadlineCot - now) / 86400000),
      deadlineTVALabel,
      daysLeftTVA: Math.ceil((deadlineTVA - now) / 86400000),
    };
  }

  /* ─── Format monnaie ───────────────────────────────────────────── */
  function fmt(n) {
    return n.toLocaleString('fr-BE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €';
  }

  /* ─── Compte à rebours ─────────────────────────────────────────── */
  function renderCountdown(elId, daysLeft) {
    const cd = el(elId);
    if (daysLeft <= 0) {
      cd.textContent = 'Échéance dépassée';
      cd.className = 'cpt-value cpt-countdown cpt-countdown-late';
    } else {
      cd.textContent = `J−${daysLeft}`;
      cd.className = `cpt-value cpt-countdown${daysLeft > 30 ? ' cpt-countdown-ok' : ''}`;
    }
  }

  /* ─── Init ─────────────────────────────────────────────────────── */
  function init() {
    const qi = getQuarter();
    quarterKey = `${qi.q}_${qi.year}`;

    el('cpt-quarter-label').textContent = qi.label;

    // Deadlines TVA
    el('cpt-tva-deadline').textContent = qi.deadlineTVALabel;
    renderCountdown('cpt-tva-countdown', qi.daysLeftTVA);

    // Deadlines Cotisation
    el('cpt-deadline').textContent = qi.deadlineCotLabel;
    renderCountdown('cpt-countdown', qi.daysLeftCot);

    restoreData();
    restoreToggles();
  }

  /* ─── Restaurer les données saisies du trimestre ───────────────── */
  function restoreData() {
    const savedCot = parseFloat(localStorage.getItem(`cpt_amount_${quarterKey}`));
    cotisation = isNaN(savedCot) ? COTISATION_DEFAULT : savedCot;
    el('cpt-cotisation-display').textContent = fmt(cotisation);
    el('cpt-cotisation-input').value         = cotisation;

    const raw   = localStorage.getItem(`cpt_data_${quarterKey}`);
    const saved = raw ? JSON.parse(raw) : null;

    if (saved) {
      el('cpt-input-ca').value  = saved.ca  ?? '';
      el('cpt-input-col').value = saved.col ?? '';
      el('cpt-input-ded').value = saved.ded ?? '';

      el('cpt-ca-ht').textContent   = saved.ca  > 0 ? fmt(saved.ca)         : '—';
      el('cpt-tva-col').textContent = saved.col > 0 ? fmt(saved.col)        : '—';
      el('cpt-tva-ded').textContent = saved.ded > 0 ? `− ${fmt(saved.ded)}` : '—';

      if (saved.col !== undefined) {
        tvaNette = (saved.col || 0) - (saved.ded || 0);
        el('cpt-tva-nette').textContent = fmt(tvaNette);
        updateTotal();
      }
    }
  }

  /* ─── Appliquer TVA depuis les champs de saisie ────────────────── */
  function applyTVA() {
    const ca  = parseFloat(el('cpt-input-ca').value)  || 0;
    const col = parseFloat(el('cpt-input-col').value) || 0;
    const ded = parseFloat(el('cpt-input-ded').value) || 0;

    if (col === 0) return;

    tvaNette = col - ded;

    el('cpt-ca-ht').textContent     = ca  > 0 ? fmt(ca)         : '—';
    el('cpt-tva-col').textContent   = fmt(col);
    el('cpt-tva-ded').textContent   = ded > 0 ? `− ${fmt(ded)}` : '—';
    el('cpt-tva-nette').textContent = fmt(tvaNette);

    localStorage.setItem(`cpt_data_${quarterKey}`, JSON.stringify({ ca, col, ded }));
    updateTotal();
  }

  /* ─── Appliquer montant cotisation ─────────────────────────────── */
  function applyCotisation() {
    const val = parseFloat(el('cpt-cotisation-input').value);
    if (isNaN(val) || val < 0) return;
    cotisation = val;
    el('cpt-cotisation-display').textContent = fmt(cotisation);
    localStorage.setItem(`cpt_amount_${quarterKey}`, cotisation);
    updateTotal();
  }

  /* ─── Total à provisionner ──────────────────────────────────────── */
  function updateTotal() {
    if (tvaNette === null) return;
    const total = tvaNette + cotisation;
    el('cpt-total').textContent     = fmt(total);
    el('cpt-breakdown').textContent = `${fmt(tvaNette)} TVA + ${fmt(cotisation)} cotisations`;
  }

  /* ─── Toggles provision ─────────────────────────────────────────── */
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

  /* ─── Utilitaire ────────────────────────────────────────────────── */
  function el(id) { return document.getElementById(id); }

  return { init, applyTVA, applyCotisation, toggle };

})();
