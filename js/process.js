/* ================================================================
   THE HOUSE — process.js  v3
   Timeline par phases, édition icône + type, taille confortable
   ================================================================ */

'use strict';

window.Process = (() => {

  /* ── Bibliothèque d'icônes ──────────────────────────────────── */
  const ICON_LIB = {
    video:      { label: 'Caméra',    svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>` },
    mic:        { label: 'Micro',     svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>` },
    headphones: { label: 'Audio',     svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>` },
    scissors:   { label: 'Ciseaux',   svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>` },
    film:       { label: 'Film',      svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>` },
    upload:     { label: 'Upload',    svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>` },
    download:   { label: 'Download',  svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>` },
    check:      { label: 'Validé',    svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` },
    send:       { label: 'Envoyer',   svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>` },
    phone:      { label: 'Téléphone', svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.58 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>` },
    edit:       { label: 'Crayon',    svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>` },
    settings:   { label: 'Config',    svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>` },
    clock:      { label: 'Horloge',   svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>` },
    calendar:   { label: 'Agenda',    svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>` },
    folder:     { label: 'Dossier',   svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>` },
    star:       { label: 'Étoile',    svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>` },
    bolt:       { label: 'Auto',      svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>` },
    refresh:    { label: 'Relance',   svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>` },
    user:       { label: 'Client',    svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` },
    globe:      { label: 'Web',       svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>` },
    archive:    { label: 'Archive',   svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>` },
    music:      { label: 'Musique',   svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>` },
    cpu:        { label: 'Ordinateur',svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>` },
    layers:     { label: 'Couches',   svg: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>` },
  };

  /* ── Icônes par défaut selon le type ────────────────────────── */
  const TYPE_DEFAULT_ICON = { auto: 'bolt', semi: 'refresh', manuel: 'cpu', client: 'user' };

  /* ── Méta couleurs / libellés par type ──────────────────────── */
  const TYPE_META = {
    auto:   { color: '#059669', bg: '#ECFDF5', label: 'Auto'     },
    semi:   { color: '#8B5CF6', bg: '#F5F3FF', label: 'Semi-auto'},
    manuel: { color: '#3B82F6', bg: '#EFF6FF', label: 'Manuel'   },
    client: { color: '#C8882A', bg: '#FDF5E8', label: 'Client'   },
  };

  /* ── Phases ─────────────────────────────────────────────────── */
  const PHASE_DEFS = [
    { id: 'pre-prod',   label: 'Pré-Production',          color: '#3B82F6' },
    { id: 'tournage',   label: 'Tournage',                 color: '#8B5CF6' },
    { id: 'post-prod',  label: 'Post-Production',          color: '#EF4444' },
    { id: 'validation', label: 'Validation & Publication', color: '#22C55E' },
    { id: 'archivage',  label: 'Archivage',                color: '#F59E0B' },
  ];

  /* ── Étapes par défaut ──────────────────────────────────────── */
  const DEFAULTS = {
    cas1: {
      'pre-prod':   [],
      'tournage':   [
        { id: 'tournage',      label: 'Tournage',          desc: 'Vidéo brute chez le client',      type: 'manuel', icon: 'video'      },
        { id: 'depot-rushs',   label: 'Dépôt rushs',       desc: '→ 1_rushs_a_traiter\\',           type: 'manuel', icon: 'folder'     },
        { id: 'extraction',    label: 'Extraction audio',  desc: 'EXTRAIRE_AUDIO.bat',               type: 'auto',   icon: 'mic'        },
        { id: 'transcription', label: 'Transcription',     desc: 'TurboScribe',                      type: 'manuel', icon: 'headphones' },
        { id: 'srt',           label: 'Correction SRT',    desc: 'Claude — skill SRT',               type: 'semi',   icon: 'scissors'   },
      ],
      'post-prod':  [
        { id: 'montage',       label: 'Montage',           desc: 'CapCut PC',                        type: 'manuel', icon: 'film'       },
        { id: 'export',        label: 'Export clips',      desc: '→ 4_clips_a_uploader\\',           type: 'manuel', icon: 'download'   },
        { id: 'preparer',      label: 'Préparer envoi',    desc: 'PREPARER_ENVOI.bat',               type: 'auto',   icon: 'bolt'       },
        { id: 'import-dash',   label: 'Import dashboard',  desc: 'Bouton "Importer session"',        type: 'auto',   icon: 'upload'     },
      ],
      'validation': [
        { id: 'whatsapp',      label: 'Envoi WhatsApp',    desc: 'Lien YouTube unlisted + message',  type: 'manuel', icon: 'send'       },
        { id: 'valid-client',  label: 'Validation client', desc: 'Jessica — Google Sheet',           type: 'client', icon: 'user'       },
        { id: 'corrections',   label: 'Corrections',       desc: 'CapCut PC',                        type: 'manuel', icon: 'edit'       },
        { id: 'mise-en-ligne', label: 'Mise en ligne',     desc: 'YouTube · Meta · TikTok',          type: 'manuel', icon: 'globe'      },
      ],
      'archivage':  [],
    },
    cas2: {
      'pre-prod':   [
        { id: 'script',        label: 'Écriture script',   desc: 'Texte préparé avant tournage',     type: 'manuel', icon: 'edit'       },
      ],
      'tournage':   [
        { id: 'tournage',      label: 'Tournage',          desc: 'Tournage avec script en main',     type: 'manuel', icon: 'video'      },
        { id: 'depot-rushs',   label: 'Dépôt rushs',       desc: '→ 1_rushs_a_traiter\\',           type: 'manuel', icon: 'folder'     },
        { id: 'extraction',    label: 'Extraction audio',  desc: 'EXTRAIRE_AUDIO.bat',               type: 'auto',   icon: 'mic'        },
        { id: 'transcription', label: 'Transcription',     desc: 'TurboScribe',                      type: 'manuel', icon: 'headphones' },
        { id: 'srt',           label: 'Correction SRT',    desc: 'Claude — skill SRT',               type: 'semi',   icon: 'scissors'   },
      ],
      'post-prod':  [
        { id: 'montage',       label: 'Montage',           desc: 'CapCut PC',                        type: 'manuel', icon: 'film'       },
        { id: 'export',        label: 'Export clips',      desc: '→ 4_clips_a_uploader\\',           type: 'manuel', icon: 'download'   },
        { id: 'preparer',      label: 'Préparer envoi',    desc: 'PREPARER_ENVOI.bat',               type: 'auto',   icon: 'bolt'       },
        { id: 'import-dash',   label: 'Import dashboard',  desc: 'Bouton "Importer session"',        type: 'auto',   icon: 'upload'     },
      ],
      'validation': [
        { id: 'whatsapp',      label: 'Envoi WhatsApp',    desc: 'Lien YouTube unlisted + message',  type: 'manuel', icon: 'send'       },
        { id: 'valid-client',  label: 'Validation client', desc: 'Jessica — Google Sheet',           type: 'client', icon: 'user'       },
        { id: 'corrections',   label: 'Corrections',       desc: 'CapCut PC',                        type: 'manuel', icon: 'edit'       },
        { id: 'mise-en-ligne', label: 'Mise en ligne',     desc: 'YouTube · Meta · TikTok',          type: 'manuel', icon: 'globe'      },
      ],
      'archivage':  [],
    },
  };

  /* ── Persistance ────────────────────────────────────────────── */
  function _load(caseKey) {
    try {
      const raw = localStorage.getItem('th_process2_' + caseKey);
      if (!raw) return _deepClone(DEFAULTS[caseKey]);
      const saved = JSON.parse(raw);
      const merged = {};
      PHASE_DEFS.forEach(ph => {
        merged[ph.id] = saved[ph.id] !== undefined ? saved[ph.id] : _deepClone(DEFAULTS[caseKey][ph.id] || []);
      });
      return merged;
    } catch { return _deepClone(DEFAULTS[caseKey]); }
  }

  function _save(caseKey, phases) {
    localStorage.setItem('th_process2_' + caseKey, JSON.stringify(phases));
  }

  function _deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function _uid() { return 'step_' + Math.random().toString(36).slice(2, 9); }

  /* ── État global ────────────────────────────────────────────── */
  let _activeCase = 'cas1';
  let _dragSrc    = null;
  let _dragPhase  = null;
  // Contexte de la modale d'édition
  let _editCtx    = null; // { caseKey, phaseId, stepId }

  /* ── Rendu principal ────────────────────────────────────────── */
  function _renderAll() {
    _renderTabs();
    _renderTimeline(_activeCase);
  }

  function _renderTabs() {
    const wrap = document.getElementById('proc-tabs');
    if (!wrap) return;
    wrap.innerHTML = '';
    [
      { key: 'cas1', label: 'Cas 1 — Échange client' },
      { key: 'cas2', label: 'Cas 2 — Clip scripté'   },
    ].forEach(({ key, label }) => {
      const btn = document.createElement('button');
      btn.className = 'proc-tab' + (key === _activeCase ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => { _activeCase = key; _renderAll(); });
      wrap.appendChild(btn);
    });
  }

  function _renderTimeline(caseKey) {
    const container = document.getElementById('proc-timeline');
    if (!container) return;
    container.innerHTML = '';
    const phases = _load(caseKey);

    PHASE_DEFS.forEach((phaseDef, phIdx) => {
      const steps = phases[phaseDef.id] || [];
      const phEl  = document.createElement('div');
      phEl.className = 'proc-phase';
      phEl.style.animationDelay = (phIdx * 0.06) + 's';

      phEl.innerHTML = `
        <div class="proc-phase-header">
          <div class="proc-phase-bar" style="background:${phaseDef.color}"></div>
          <span class="proc-phase-label" style="color:${phaseDef.color}">${phaseDef.label}</span>
          ${steps.length ? `<span class="proc-phase-count" style="color:${phaseDef.color}">${steps.length}</span>` : ''}
        </div>
      `;

      const stepsWrap = document.createElement('div');
      stepsWrap.className = 'proc-steps';
      stepsWrap.style.setProperty('--phase-color', phaseDef.color);
      stepsWrap.dataset.phase = phaseDef.id;
      stepsWrap.dataset.case  = caseKey;

      if (steps.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'proc-steps-empty';
        empty.textContent = 'Aucune étape — cliquez "+ Ajouter" pour en créer une.';
        stepsWrap.appendChild(empty);
      } else {
        steps.forEach((step, sIdx) => {
          stepsWrap.appendChild(_buildStepEl(step, caseKey, phaseDef.id, sIdx, phaseDef.color));
        });
      }

      phEl.appendChild(stepsWrap);

      /* Bouton + Ajouter */
      const addBtn = document.createElement('button');
      addBtn.className = 'proc-add-btn';
      addBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Ajouter une étape`;

      const form = _buildAddForm(phaseDef, caseKey, addBtn);
      addBtn.addEventListener('click', () => _openAddForm(form, addBtn));

      phEl.appendChild(addBtn);
      phEl.appendChild(form);
      container.appendChild(phEl);
    });
  }

  /* ── Résolution icône ────────────────────────────────────────── */
  function _resolveIcon(step) {
    const key = step.icon || TYPE_DEFAULT_ICON[step.type] || 'bolt';
    return (ICON_LIB[key] || ICON_LIB.bolt).svg;
  }

  /* ── Construction d'une carte étape ────────────────────────── */
  function _buildStepEl(step, caseKey, phaseId, sIdx, phaseColor) {
    const meta      = TYPE_META[step.type] || TYPE_META.manuel;
    const icon      = _resolveIcon(step);
    const iconColor = phaseColor || meta.color;
    const iconBg    = iconColor + '18'; /* ~9% opacité */

    const el = document.createElement('div');
    el.className = 'proc-step';
    el.dataset.id    = step.id;
    el.dataset.phase = phaseId;
    el.dataset.case  = caseKey;
    el.draggable     = true;
    el.style.setProperty('--step-color', meta.color);
    el.style.setProperty('--step-bg',    meta.bg);
    el.style.animationDelay = (sIdx * 0.04) + 's';

    el.innerHTML = `
      <div class="proc-step-grip" title="Glisser pour réorganiser">
        <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
          <circle cx="2" cy="2"  r="1.3" fill="currentColor"/>
          <circle cx="6" cy="2"  r="1.3" fill="currentColor"/>
          <circle cx="2" cy="6"  r="1.3" fill="currentColor"/>
          <circle cx="6" cy="6"  r="1.3" fill="currentColor"/>
          <circle cx="2" cy="10" r="1.3" fill="currentColor"/>
          <circle cx="6" cy="10" r="1.3" fill="currentColor"/>
        </svg>
      </div>
      <div class="proc-step-icon" style="background:${iconBg};color:${iconColor}">${icon}</div>
      <div class="proc-step-body">
        <div class="proc-step-label">${step.label}</div>
        <div class="proc-step-desc">${step.desc || ''}</div>
      </div>
      <span class="proc-step-badge" style="background:${meta.bg};color:${meta.color}">${meta.label}</span>
      <div class="proc-step-actions">
        <button class="proc-step-edit" title="Modifier cette étape">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="proc-step-del" title="Supprimer cette étape">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;

    el.addEventListener('dragstart', _onDragStart);
    el.addEventListener('dragenter', _onDragEnter);
    el.addEventListener('dragover',  _onDragOver);
    el.addEventListener('dragleave', _onDragLeave);
    el.addEventListener('drop',      _onDrop);
    el.addEventListener('dragend',   _onDragEnd);

    el.querySelector('.proc-step-edit').addEventListener('click', e => {
      e.stopPropagation();
      _openEditModal(step, caseKey, phaseId);
    });
    el.querySelector('.proc-step-del').addEventListener('click', e => {
      e.stopPropagation();
      _deleteStep(caseKey, phaseId, step.id);
    });

    return el;
  }

  /* ── Modale d'édition ───────────────────────────────────────── */
  function _ensureEditModal() {
    if (document.getElementById('proc-edit-modal')) return;

    const iconGrid = Object.entries(ICON_LIB).map(([key, val]) =>
      `<button class="proc-icon-btn" data-icon="${key}" title="${val.label}">${val.svg}</button>`
    ).join('');

    const el = document.createElement('div');
    el.className  = 'modal-backdrop';
    el.id         = 'proc-edit-modal';
    el.style.display = 'none';
    el.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <h3>Modifier l'étape</h3>
          <button class="modal-close-btn" id="proc-edit-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <label class="form-label">Nom de l'étape</label>
          <input type="text" id="proc-edit-label" class="form-input" autocomplete="off" />

          <label class="form-label" style="margin-top:14px">Description / outil</label>
          <input type="text" id="proc-edit-desc" class="form-input" autocomplete="off" />

          <label class="form-label" style="margin-top:14px">Type</label>
          <select id="proc-edit-type" class="form-select">
            <option value="manuel">Manuel</option>
            <option value="auto">Auto</option>
            <option value="semi">Semi-auto</option>
            <option value="client">Client</option>
          </select>

          <label class="form-label" style="margin-top:18px">Icône</label>
          <div class="proc-icon-grid" id="proc-icon-grid">${iconGrid}</div>
          <input type="hidden" id="proc-edit-icon" />
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="proc-edit-cancel">Annuler</button>
          <button class="btn btn-primary" id="proc-edit-save">Sauvegarder</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    /* Fermeture */
    el.querySelector('#proc-edit-close').addEventListener('click',  _closeEditModal);
    el.querySelector('#proc-edit-cancel').addEventListener('click', _closeEditModal);
    el.addEventListener('click', e => { if (e.target === el) _closeEditModal(); });

    /* Sélection icône */
    el.querySelector('#proc-icon-grid').addEventListener('click', e => {
      const btn = e.target.closest('.proc-icon-btn');
      if (!btn) return;
      el.querySelectorAll('.proc-icon-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      el.querySelector('#proc-edit-icon').value = btn.dataset.icon;
    });

    /* Sauvegarde */
    el.querySelector('#proc-edit-save').addEventListener('click', _saveEdit);
  }

  function _openEditModal(step, caseKey, phaseId) {
    _ensureEditModal();
    _editCtx = { caseKey, phaseId, stepId: step.id };

    const modal = document.getElementById('proc-edit-modal');
    modal.querySelector('#proc-edit-label').value = step.label || '';
    modal.querySelector('#proc-edit-desc').value  = step.desc  || '';
    modal.querySelector('#proc-edit-type').value  = step.type  || 'manuel';
    modal.querySelector('#proc-edit-icon').value  = step.icon  || '';

    /* Marque l'icône active */
    const currentIcon = step.icon || TYPE_DEFAULT_ICON[step.type] || 'bolt';
    modal.querySelectorAll('.proc-icon-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.icon === currentIcon);
    });

    App.openModal('proc-edit-modal');
  }

  function _closeEditModal() {
    App.closeModal('proc-edit-modal');
    _editCtx = null;
  }

  function _saveEdit() {
    if (!_editCtx) return;
    const { caseKey, phaseId, stepId } = _editCtx;
    const label = document.getElementById('proc-edit-label').value.trim();
    if (!label) { document.getElementById('proc-edit-label').focus(); return; }

    const phases = _load(caseKey);
    const steps  = phases[phaseId] || [];
    const idx    = steps.findIndex(s => s.id === stepId);
    if (idx === -1) return;

    steps[idx] = {
      ...steps[idx],
      label,
      desc: document.getElementById('proc-edit-desc').value.trim(),
      type: document.getElementById('proc-edit-type').value,
      icon: document.getElementById('proc-edit-icon').value || steps[idx].icon,
    };
    phases[phaseId] = steps;
    _save(caseKey, phases);
    _closeEditModal();
    _renderTimeline(caseKey);
  }

  /* ── Formulaire inline d'ajout ──────────────────────────────── */
  function _buildAddForm(phaseDef, caseKey, addBtn) {
    const form = document.createElement('div');
    form.className = 'proc-add-form';

    form.innerHTML = `
      <div class="proc-add-fields">
        <input class="proc-add-input form-input" type="text" placeholder="Nom de l'étape…" autocomplete="off" />
        <input class="proc-add-desc  form-input" type="text" placeholder="Outil / description…" autocomplete="off" />
        <select class="proc-add-type form-select">
          <option value="manuel">Manuel</option>
          <option value="auto">Auto</option>
          <option value="semi">Semi-auto</option>
          <option value="client">Client</option>
        </select>
      </div>
      <div class="proc-add-actions">
        <button class="btn btn-primary btn-sm proc-add-confirm">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter
        </button>
        <button class="btn btn-ghost btn-sm proc-add-cancel">Annuler</button>
      </div>
    `;

    const inputLabel = form.querySelector('.proc-add-input');
    const inputDesc  = form.querySelector('.proc-add-desc');
    const selType    = form.querySelector('.proc-add-type');

    form.querySelector('.proc-add-confirm').addEventListener('click', () => {
      const label = inputLabel.value.trim();
      if (!label) { inputLabel.focus(); return; }
      _addStep(caseKey, phaseDef.id, {
        id:    _uid(),
        label,
        desc:  inputDesc.value.trim(),
        type:  selType.value,
        icon:  TYPE_DEFAULT_ICON[selType.value] || 'bolt',
      });
    });

    form.querySelector('.proc-add-cancel').addEventListener('click', () => {
      _closeAddForm(form, addBtn);
    });

    inputLabel.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); form.querySelector('.proc-add-confirm').click(); }
      if (e.key === 'Escape') _closeAddForm(form, addBtn);
    });

    return form;
  }

  function _openAddForm(form, addBtn) {
    /* Ferme tous les autres formulaires ouverts */
    document.querySelectorAll('.proc-add-form.open').forEach(f => {
      if (f !== form) {
        f.classList.remove('open');
        const prev = f.previousElementSibling;
        if (prev && prev.classList.contains('proc-add-btn')) prev.style.display = '';
      }
    });
    form.classList.add('open');
    addBtn.style.display = 'none';
    setTimeout(() => form.querySelector('.proc-add-input').focus(), 80);
  }

  function _closeAddForm(form, addBtn) {
    form.classList.remove('open');
    form.querySelector('.proc-add-input').value = '';
    form.querySelector('.proc-add-desc').value  = '';
    if (addBtn) addBtn.style.display = '';
  }

  /* ── CRUD étapes ────────────────────────────────────────────── */
  function _deleteStep(caseKey, phaseId, stepId) {
    const phases = _load(caseKey);
    phases[phaseId] = (phases[phaseId] || []).filter(s => s.id !== stepId);
    _save(caseKey, phases);
    _renderTimeline(caseKey);
  }

  function _addStep(caseKey, phaseId, step) {
    const phases = _load(caseKey);
    if (!phases[phaseId]) phases[phaseId] = [];
    phases[phaseId].push(step);
    _save(caseKey, phases);
    _renderTimeline(caseKey);
  }

  /* ── Drag & drop ────────────────────────────────────────────── */
  function _onDragStart(e) {
    _dragSrc   = this;
    _dragPhase = this.dataset.phase;
    this.classList.add('proc-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id);
  }
  function _onDragEnter(e) {
    e.preventDefault();
    if (_isValidDragTarget(this)) this.classList.add('proc-drag-over');
  }
  function _onDragOver(e) {
    e.preventDefault();
    if (_isValidDragTarget(this)) e.dataTransfer.dropEffect = 'move';
  }
  function _onDragLeave() { this.classList.remove('proc-drag-over'); }
  function _onDrop(e) {
    e.preventDefault();
    this.classList.remove('proc-drag-over');
    if (!_dragSrc || _dragSrc === this || !_isValidDragTarget(this)) return;
    const caseKey  = this.dataset.case;
    const phaseId  = this.dataset.phase;
    const wrap     = this.closest('.proc-steps');
    const cards    = [...wrap.querySelectorAll('.proc-step')];
    const fromIdx  = cards.indexOf(_dragSrc);
    const toIdx    = cards.indexOf(this);
    if (fromIdx === -1 || toIdx === -1) return;
    const phases   = _load(caseKey);
    const [moved]  = phases[phaseId].splice(fromIdx, 1);
    phases[phaseId].splice(toIdx, 0, moved);
    _save(caseKey, phases);
    _renderTimeline(caseKey);
  }
  function _onDragEnd() {
    _dragSrc = _dragPhase = null;
    document.querySelectorAll('.proc-step').forEach(c =>
      c.classList.remove('proc-dragging', 'proc-drag-over')
    );
  }
  function _isValidDragTarget(el) {
    return el !== _dragSrc
      && el.dataset.phase === _dragPhase
      && el.dataset.case  === (_dragSrc && _dragSrc.dataset.case);
  }

  /* ── Init public ────────────────────────────────────────────── */
  function init() {
    _ensureEditModal();
    _renderAll();
  }

  return { init };

})();
