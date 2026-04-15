/* ================================================================
   THE HOUSE — comptabilite.js
   Provisions fiscales — saisie manuelle par trimestre
   Stockage : localStorage, clé par trimestre
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

  /* ─── Format monnaie ───────────────────────────────────────────── */
  function fmt(n) {
    return n.toLocaleString('fr-BE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' €';
  }

  /* ─── Init ─────────────────────────────────────────────────────── */
  function init() {
    const qi = getQuarter();
    quarterKey = `${qi.q}_${qi.year}`;

    el('cpt-quarter-label').textContent = qi.label;
    el('cpt-deadline').textContent      = qi.deadlineLabel;

    const cd = el('cpt-countdown');
    if (qi.daysLeft <= 0) {
      cd.textContent = 'Échéance dépassée';
      cd.classList.add('cpt-countdown-late');
    } else {
      cd.textContent = `J−${qi.daysLeft}`;
      cd.classList.toggle('cpt-countdown-ok', qi.daysLeft > 30);
    }

    restoreData();
    restoreToggles();
  }

  /* ─── Restaurer les données saisies du trimestre ───────────────── */
  function restoreData() {
    // Cotisation : montant spécifique à ce trimestre (ou défaut)
    const savedCot = parseFloat(localStorage.getItem(`cpt_amount_${quarterKey}`));
    cotisation = isNaN(savedCot) ? COTISATION_DEFAULT : savedCot;
    el('cpt-cotisation-display').textContent = fmt(cotisation);
    el('cpt-cotisation-input').value         = cotisation;

    // TVA : données saisies
    const raw  = localStorage.getItem(`cpt_data_${quarterKey}`);
    const saved = raw ? JSON.parse(raw) : null;

    if (saved) {
      el('cpt-input-ca').value  = saved.ca  ?? '';
      el('cpt-input-col').value = saved.col ?? '';
      el('cpt-input-ded').value = saved.ded ?? '';

      el('cpt-ca-ht').textContent   = saved.ca  > 0 ? fmt(saved.ca)            : '—';
      el('cpt-tva-col').textContent = saved.col > 0 ? fmt(saved.col)           : '—';
      el('cpt-tva-ded').textContent = saved.ded > 0 ? `− ${fmt(saved.ded)}`    : '—';

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

    if (col === 0) return; // TVA collectée obligatoire

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
