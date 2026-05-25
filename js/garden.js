/* ================================================================
   THE HOUSE — garden.js   v3.0
   • Grille au-dessus du timer (tous clients)
   • Jardin actif animé sous le timer (client sélectionné)
   • SVG redessinés : bezier, dégradés, ombres, pétales en étoile
   • Progress bar : dégradé + shimmer + ticks de jalons
   ================================================================ */

'use strict';

window.Garden = (() => {

  /* ── XP Minecraft (doublement à chaque niveau) ───────────────── */
  const MAX = 7;
  const NAMES = ['','Graine','Pousses','Fleurs','Arbre','Grand arbre','Maison','Domaine'];

  const _T   = n => n <= 1 ? 0 : 3600 * (Math.pow(2, n - 1) - 1);
  const _lvl = s => s <= 0 ? 1 : Math.min(Math.floor(Math.log2(s / 3600 + 1)) + 1, MAX);
  const _prg = s => { const l = _lvl(s); return l >= MAX ? 1 : (s - _T(l)) / (_T(l + 1) - _T(l)); };

  /* ── Données ─────────────────────────────────────────────────── */
  const _mo   = () => new Date().toISOString().slice(0, 7);
  const _secs = id => (App.load(App.KEYS.TASKS, []) || [])
    .filter(t => t.clientId === id && t.date?.startsWith(_mo()))
    .reduce((a, t) => a + (t.totalDuration || 0), 0);
  const _fmt  = s => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h}h${m ? ` ${m}min` : ''}` : m ? `${m}min` : '0min';
  };

  /* ── CSS (injecté une seule fois) ────────────────────────────── */
  function _css() {
    if (document.getElementById('gdn-css')) return;
    const el = document.createElement('style');
    el.id = 'gdn-css';
    el.textContent = `
      /* ── Header section ── */
      .gdn-header{display:flex;align-items:center;gap:7px;margin:0 0 13px}
      .gdn-header-icon{color:var(--success);flex-shrink:0}
      .gdn-header-title{font-size:.7rem;font-weight:700;text-transform:uppercase;
        letter-spacing:.1em;color:var(--text-3);margin:0;flex:1}
      .gdn-season{font-size:.62rem;font-weight:600;color:var(--text-3);
        background:var(--bg);border:1px solid var(--border);border-radius:20px;
        padding:2px 10px;white-space:nowrap}

      /* ── Grille ── */
      .gdn-grid{display:grid;
        grid-template-columns:repeat(auto-fill,minmax(190px,1fr));
        gap:11px}

      /* ── Carte ── */
      .gdn-card{background:var(--surface);border:1px solid var(--border);
        border-radius:14px;overflow:hidden;display:flex;flex-direction:column;
        transition:box-shadow .22s,transform .22s}
      .gdn-card:hover{transform:translateY(-3px);
        box-shadow:0 10px 32px rgba(0,0,0,.1)}
      .gdn-topbar{height:3px;flex-shrink:0}
      .gdn-card-head{display:flex;align-items:center;gap:7px;padding:10px 12px 0}
      .gdn-av{width:25px;height:25px;border-radius:7px;display:flex;
        align-items:center;justify-content:center;font-size:.6rem;
        font-weight:800;flex-shrink:0}
      .gdn-cname{font-size:.74rem;font-weight:600;color:var(--text);
        flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .gdn-badge{font-size:.57rem;font-weight:700;padding:2px 7px;
        border-radius:20px;white-space:nowrap;flex-shrink:0;
        border:1px solid transparent}
      .gdn-svg-wrap{padding:7px 10px 3px;flex:1}
      .gdn-svg-wrap svg{width:100%;height:auto;display:block}

      /* ── Progress bar ── */
      .gdn-foot{padding:4px 12px 11px;display:flex;flex-direction:column;gap:5px}
      .gdn-bar-outer{position:relative;height:7px;border-radius:99px;
        background:var(--bg);overflow:hidden}
      .gdn-bar-fill{position:absolute;top:0;left:0;bottom:0;
        border-radius:99px;overflow:hidden;
        transition:width .9s cubic-bezier(.4,0,.2,1)}
      /* dégradé blanc → transparent par-dessus la couleur unie */
      .gdn-bar-fill::before{content:'';position:absolute;inset:0;border-radius:inherit;
        background:linear-gradient(90deg,rgba(255,255,255,.48) 0%,transparent 58%)}
      /* shimmer */
      .gdn-bar-fill::after{content:'';position:absolute;top:0;bottom:0;width:50%;
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);
        animation:gdn-shimmer 2.4s ease-in-out infinite}
      @keyframes gdn-shimmer{0%{left:-55%}100%{left:155%}}
      /* ticks de jalons (visibles via z-index au-dessus de l'outer) */
      .gdn-tick{position:absolute;top:1px;bottom:1px;width:2px;
        background:rgba(255,255,255,.6);border-radius:1px;
        pointer-events:none;z-index:2;transform:translateX(-50%)}
      .gdn-labels{display:flex;justify-content:space-between;
        font-size:.59rem;color:var(--text-3);gap:4px}
      .gdn-next{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
        text-align:right;font-weight:500}

      /* ── Jardin actif (sous le timer) ── */
      .gdn-act{margin:14px 0 0;border-radius:14px;overflow:hidden;
        border:2px solid var(--gac,#6366f1);
        animation:gdn-border-glow 3.5s ease-in-out infinite}
      @keyframes gdn-border-glow{
        0%,100%{box-shadow:0 4px 18px rgba(0,0,0,.08)}
        50%{box-shadow:0 6px 26px rgba(0,0,0,.11),0 0 0 3px var(--gac)}}
      .gdn-act-inner{display:flex;align-items:stretch;
        background:var(--surface);min-height:115px}
      /* panneau info */
      .gdn-act-info{flex:0 0 36%;min-width:0;padding:15px 13px;
        display:flex;flex-direction:column;justify-content:space-between;
        border-right:1px solid var(--border)}
      .gdn-act-client{font-size:.65rem;font-weight:800;
        text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
      .gdn-act-lvl{font-size:1rem;font-weight:700;color:var(--text);line-height:1.25}
      .gdn-act-sub{font-size:.6rem;color:var(--text-3);margin-top:2px}
      /* barre active */
      .gdn-act-bar-outer{position:relative;height:6px;border-radius:99px;
        background:var(--bg);overflow:hidden;margin-top:8px}
      .gdn-act-bar-fill{position:absolute;top:0;left:0;bottom:0;
        border-radius:99px;overflow:hidden;
        transition:width .9s cubic-bezier(.4,0,.2,1)}
      .gdn-act-bar-fill::before{content:'';position:absolute;inset:0;
        background:linear-gradient(90deg,rgba(255,255,255,.48) 0%,transparent 58%)}
      .gdn-act-bar-fill::after{content:'';position:absolute;top:0;bottom:0;width:50%;
        background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);
        animation:gdn-shimmer 2.4s ease-in-out infinite}
      /* scène SVG flottante */
      .gdn-act-scene{flex:1;padding:8px 10px;display:flex;
        align-items:center;justify-content:center;
        animation:gdn-float 5s ease-in-out infinite}
      @keyframes gdn-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
      .gdn-act-scene svg{width:100%;height:auto;max-height:130px;display:block}
    `;
    document.head.appendChild(el);
  }

  /* ================================================================
     SVG PAR NIVEAU — viewBox 0 0 120 90
     Chaque SVG contient ses propres <defs> avec IDs uniques (uid)
  ================================================================ */
  function _svg(level, progress, color, uid) {
    const c  = color;
    const id = uid.replace(/[^a-z0-9]/gi, '').slice(0, 12);

    const defs = `<defs>
      <linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${c}" stop-opacity=".11"/>
        <stop offset="100%" stop-color="${c}" stop-opacity=".03"/>
      </linearGradient>
      <linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4ade80"/>
        <stop offset="100%" stop-color="#15803d"/>
      </linearGradient>
      <radialGradient id="w${id}" cx="50%" cy="60%" r="50%">
        <stop offset="0%" stop-color="${c}" stop-opacity=".17"/>
        <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="t${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#a16207"/>
        <stop offset="100%" stop-color="#6b3800"/>
      </linearGradient>
    </defs>`;

    const bg = `
      <rect width="120" height="90" fill="url(#s${id})"/>
      <circle cx="60" cy="50" r="40" fill="url(#w${id})"/>
      <circle cx="106" cy="13" r="11" fill="${c}" opacity=".12"/>
      <circle cx="106" cy="13" r="7.5" fill="${c}" opacity=".18"/>
      <circle cx="106" cy="13" r="4.5" fill="#fff" opacity=".8"/>`;

    const gnd = `
      <rect x="0" y="70" width="120" height="20" fill="url(#g${id})"/>
      <ellipse cx="60" cy="70" rx="64" ry="6" fill="#4ade80" opacity=".38"/>`;

    let scene = '';

    /* ── Niveau 1 : GRAINE ──────────────────────────────────────── */
    switch (level) {
    case 1:
      scene = `
        <!-- Monticule organique -->
        <path d="M36 71 Q44 60 60 58 Q76 60 84 71 Z"
              fill="#92400e" opacity=".45"/>
        <path d="M40 71 Q48 63 60 61 Q72 63 80 71 Z"
              fill="#b45309" opacity=".32"/>
        <!-- Graine -->
        <ellipse cx="60" cy="62" rx="5.5" ry="3.5" fill="#6b3800" opacity=".65"/>
        <ellipse cx="60" cy="61" rx="4" ry="2.5" fill="#92400e" opacity=".45"/>
        <!-- Tige courbée -->
        <path d="M60 60 C59 55 61 50 60 43"
              fill="none" stroke="#166534" stroke-width="3"
              stroke-linecap="round"/>
        ${progress > 0.28 ? `
          <!-- Feuille gauche bezier -->
          <path d="M60 52 C53 47 46 49 44 43 C42 38 51 36 60 49"
                fill="#22c55e"/>
          <path d="M60 52 C53 47 46 49 44 43"
                fill="none" stroke="#15803d" stroke-width=".8"
                stroke-linecap="round"/>
          <!-- Feuille droite bezier -->
          <path d="M60 50 C67 45 74 47 76 41 C78 36 69 34 60 47"
                fill="#4ade80"/>
          <path d="M60 50 C67 45 74 47 76 41"
                fill="none" stroke="#16a34a" stroke-width=".8"
                stroke-linecap="round"/>
          <!-- Bourgeon -->
          <circle cx="60" cy="42" r="4.5" fill="#86efac"/>
          <circle cx="60" cy="42" r="2.8" fill="#a7f3d0"/>
          <circle cx="59" cy="41" r="1.2" fill="#fff" opacity=".6"/>
        ` : `
          <circle cx="60" cy="42" r="3.5" fill="#22c55e" opacity=".85"/>
        `}
        <!-- Rosée -->
        <ellipse cx="74" cy="64" rx="3" ry="2" fill="#bae6fd" opacity=".65"/>
        <circle  cx="74" cy="63" r="1.8" fill="#7dd3fc" opacity=".45"/>
        <!-- Particules d'espoir -->
        <circle cx="85" cy="36" r="1.8" fill="${c}" opacity=".4"/>
        <circle cx="91" cy="26" r="1.3" fill="${c}" opacity=".3"/>
        <circle cx="79" cy="30" r="1.1" fill="${c}" opacity=".3"/>
      `;
      break;

    /* ── Niveau 2 : POUSSES ─────────────────────────────────────── */
    case 2:
      scene = `
        <!-- Pousse gauche -->
        <path d="M28 70 C28 65 27 60 28 54"
              fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M28 62 C21 57 15 59 14 53 C13 47 22 45 28 58"
              fill="#22c55e"/>
        <circle cx="28" cy="51" r="9" fill="#22c55e"/>
        <circle cx="28" cy="49" r="7" fill="#4ade80"/>
        <circle cx="27" cy="48" r="2.8" fill="#fff" opacity=".38"/>

        <!-- Pousse centrale (dominante) -->
        <path d="M60 70 C60 63 58 53 60 43"
              fill="none" stroke="#166534" stroke-width="3" stroke-linecap="round"/>
        <path d="M60 57 C52 52 45 54 43 47 C41 41 51 39 60 53"
              fill="#22c55e"/>
        <path d="M60 55 C68 50 75 52 77 45 C79 39 69 37 60 51"
              fill="#4ade80"/>
        <circle cx="60" cy="40" r="12" fill="#22c55e"/>
        <circle cx="60" cy="38" r="9"  fill="#4ade80"/>
        <circle cx="58" cy="36" r="3.5" fill="#fff" opacity=".38"/>

        <!-- Pousse droite -->
        <path d="M92 70 C92 65 91 61 92 57"
              fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M92 64 C99 59 105 61 106 55 C107 49 99 47 92 59"
              fill="#16a34a"/>
        <circle cx="92" cy="54" r="9" fill="#22c55e"/>
        <circle cx="92" cy="52" r="7" fill="#4ade80"/>
        <circle cx="91" cy="51" r="2.8" fill="#fff" opacity=".38"/>

        <!-- Rosées -->
        <ellipse cx="28" cy="49" rx="2" ry="1.5" fill="#bae6fd" opacity=".65"/>
        <ellipse cx="60" cy="38" rx="2.5" ry="1.8" fill="#bae6fd" opacity=".65"/>
        <ellipse cx="92" cy="52" rx="2" ry="1.5" fill="#bae6fd" opacity=".65"/>
        <!-- Brins d'herbe -->
        <path d="M12 70 Q13 64 14 70" fill="none" stroke="#22c55e"
              stroke-width="1.6" stroke-linecap="round"/>
        <path d="M107 70 Q108 63 110 70" fill="none" stroke="#22c55e"
              stroke-width="1.6" stroke-linecap="round"/>
      `;
      break;

    /* ── Niveau 3 : FLEURS ──────────────────────────────────────── */
    case 3:
      scene = `
        <!-- FLEUR GAUCHE -->
        <path d="M26 70 C26 64 25 58 26 52"
              fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M26 61 C19 56 13 58 12 52 C11 46 20 45 26 57"
              fill="#22c55e"/>
        <!-- 6 pétales en étoile -->
        <g transform="translate(26,47)">
          <ellipse ry="9.5" rx="4.5" fill="${c}" opacity=".8"/>
          <ellipse ry="9.5" rx="4.5" fill="${c}" opacity=".8" transform="rotate(60)"/>
          <ellipse ry="9.5" rx="4.5" fill="${c}" opacity=".8" transform="rotate(120)"/>
          <ellipse ry="9.5" rx="4.5" fill="${c}" opacity=".8" transform="rotate(180)"/>
          <ellipse ry="9.5" rx="4.5" fill="${c}" opacity=".8" transform="rotate(240)"/>
          <ellipse ry="9.5" rx="4.5" fill="${c}" opacity=".8" transform="rotate(300)"/>
          <circle r="6"   fill="#fef9c3"/>
          <circle r="3.5" fill="#fbbf24"/>
          <circle cx="-1.5" cy="-1.5" r="1.4" fill="#fff" opacity=".6"/>
        </g>

        <!-- FLEUR CENTRALE (dominante) -->
        <path d="M60 70 C60 63 58 53 60 42"
              fill="none" stroke="#166534" stroke-width="3" stroke-linecap="round"/>
        <path d="M60 58 C51 53 44 55 42 48 C40 42 51 40 60 54"
              fill="#22c55e"/>
        <path d="M60 55 C69 50 76 52 78 45 C80 39 69 37 60 51"
              fill="#16a34a"/>
        <!-- 6 pétales grande -->
        <g transform="translate(60,36)">
          <ellipse ry="12" rx="5.5" fill="${c}" opacity=".85"/>
          <ellipse ry="12" rx="5.5" fill="${c}" opacity=".85" transform="rotate(60)"/>
          <ellipse ry="12" rx="5.5" fill="${c}" opacity=".85" transform="rotate(120)"/>
          <ellipse ry="12" rx="5.5" fill="${c}" opacity=".85" transform="rotate(180)"/>
          <ellipse ry="12" rx="5.5" fill="${c}" opacity=".85" transform="rotate(240)"/>
          <ellipse ry="12" rx="5.5" fill="${c}" opacity=".85" transform="rotate(300)"/>
          <circle r="7.5"   fill="#fef9c3"/>
          <circle r="4.5"   fill="#fbbf24"/>
          <circle cx="-2" cy="-2" r="2" fill="#fff" opacity=".6"/>
        </g>

        <!-- FLEUR DROITE -->
        <path d="M94 70 C94 64 93 59 94 54"
              fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M94 63 C101 58 107 60 108 54 C109 48 101 47 94 59"
              fill="#16a34a"/>
        <g transform="translate(94,49)">
          <ellipse ry="9.5" rx="4.5" fill="${c}" opacity=".8"/>
          <ellipse ry="9.5" rx="4.5" fill="${c}" opacity=".8" transform="rotate(60)"/>
          <ellipse ry="9.5" rx="4.5" fill="${c}" opacity=".8" transform="rotate(120)"/>
          <ellipse ry="9.5" rx="4.5" fill="${c}" opacity=".8" transform="rotate(180)"/>
          <ellipse ry="9.5" rx="4.5" fill="${c}" opacity=".8" transform="rotate(240)"/>
          <ellipse ry="9.5" rx="4.5" fill="${c}" opacity=".8" transform="rotate(300)"/>
          <circle r="6"   fill="#fef9c3"/>
          <circle r="3.5" fill="#fbbf24"/>
          <circle cx="-1.5" cy="-1.5" r="1.4" fill="#fff" opacity=".6"/>
        </g>

        <!-- Papillon -->
        <g transform="translate(78,22)" opacity=".8">
          <ellipse rx="6" ry="3.5" fill="${c}" opacity=".55" transform="rotate(-22)"/>
          <ellipse cx="7" ry="3.5" rx="6" fill="${c}" opacity=".55" transform="translate(7,0) rotate(22)"/>
          <path d="M3.5,-4 L3.5,5" fill="none" stroke="#92400e"
                stroke-width="1.3" stroke-linecap="round"/>
          <path d="M3 -4 Q4 -6 5 -4" fill="none" stroke="#92400e"
                stroke-width="1" stroke-linecap="round"/>
          <path d="M2 -4 Q3 -6 4 -4" fill="none" stroke="#92400e"
                stroke-width="1" stroke-linecap="round"/>
        </g>
      `;
      break;

    /* ── Niveau 4 : ARBRE ───────────────────────────────────────── */
    case 4:
      scene = `
        <!-- Ombre sol -->
        <ellipse cx="62" cy="71" rx="22" ry="4" fill="#15803d" opacity=".18"/>
        <!-- Tronc ombre -->
        <rect x="58" y="51" width="9" height="21" rx="4" fill="#3f1a00" opacity=".18"/>
        <!-- Tronc -->
        <rect x="56" y="49" width="9" height="22" rx="4" fill="url(#t${id})"/>
        <rect x="58" y="50" width="3" height="20" rx="1.5"
              fill="#ca8a04" opacity=".22"/>
        <!-- Ombre feuillage -->
        <ellipse cx="62" cy="40" rx="30" ry="27" fill="#15803d" opacity=".2"/>
        <!-- Feuillage 4 couches -->
        <circle cx="60" cy="36" r="28" fill="#16a34a"/>
        <circle cx="43" cy="46" r="19" fill="#22c55e"/>
        <circle cx="77" cy="44" r="18" fill="#15803d"/>
        <circle cx="60" cy="20" r="20" fill="#22c55e"/>
        <!-- Zone lumineuse -->
        <ellipse cx="48" cy="22" rx="13" ry="10" fill="#4ade80" opacity=".38"/>
        <!-- Fruits -->
        <circle cx="44" cy="34" r="5.5" fill="${c}"/>
        <circle cx="76" cy="31" r="5.5" fill="${c}"/>
        <circle cx="60" cy="17" r="5"   fill="${c}" opacity=".9"/>
        <!-- Brillances -->
        <circle cx="42.5" cy="33" r="2.2" fill="#fff" opacity=".55"/>
        <circle cx="74.5" cy="30" r="2.2" fill="#fff" opacity=".55"/>
        <!-- Oiseaux -->
        <path d="M88 18 Q91 15 94 18" fill="none" stroke="#6b7280"
              stroke-width="1.6" stroke-linecap="round"/>
        <path d="M96 26 Q99 23 102 26" fill="none" stroke="#6b7280"
              stroke-width="1.6" stroke-linecap="round"/>
        <!-- Herbe -->
        <path d="M10 70 Q11 64 12 70" fill="none" stroke="#22c55e"
              stroke-width="1.6" stroke-linecap="round"/>
        <path d="M108 70 Q109 65 111 70" fill="none" stroke="#22c55e"
              stroke-width="1.6" stroke-linecap="round"/>
      `;
      break;

    /* ── Niveau 5 : GRAND ARBRE ─────────────────────────────────── */
    case 5:
      scene = `
        <!-- Arbre gauche -->
        <ellipse cx="17" cy="71" rx="10" ry="3" fill="#15803d" opacity=".18"/>
        <rect x="14" y="57" width="7" height="15" rx="3" fill="url(#t${id})"/>
        <circle cx="17" cy="51" r="14" fill="#16a34a" opacity=".85"/>
        <circle cx="12" cy="47" r="9"  fill="#22c55e" opacity=".7"/>
        <ellipse cx="11" cy="46" rx="5" ry="4" fill="#4ade80" opacity=".42"/>

        <!-- Arbre droit -->
        <ellipse cx="103" cy="71" rx="10" ry="3" fill="#15803d" opacity=".18"/>
        <rect x="100" y="57" width="7" height="15" rx="3" fill="url(#t${id})"/>
        <circle cx="103" cy="51" r="14" fill="#15803d" opacity=".85"/>
        <circle cx="108" cy="47" r="9"  fill="#22c55e" opacity=".7"/>
        <ellipse cx="109" cy="46" rx="5" ry="4" fill="#4ade80" opacity=".42"/>

        <!-- Ombre sol -->
        <ellipse cx="62" cy="71" rx="30" ry="5" fill="#15803d" opacity=".18"/>
        <!-- Tronc -->
        <rect x="56" y="45" width="11" height="27" rx="5" fill="url(#t${id})"/>
        <rect x="58" y="46" width="4"  height="25" rx="2" fill="#ca8a04" opacity=".22"/>
        <!-- Racines -->
        <path d="M56 70 Q49 71 45 73" fill="none" stroke="#6b3800"
              stroke-width="2.5" stroke-linecap="round" opacity=".45"/>
        <path d="M67 70 Q74 71 78 73" fill="none" stroke="#6b3800"
              stroke-width="2.5" stroke-linecap="round" opacity=".45"/>
        <!-- Ombre feuillage -->
        <ellipse cx="62" cy="32" rx="38" ry="33" fill="#15803d" opacity=".18"/>
        <!-- Feuillage 5 couches -->
        <circle cx="60" cy="28" r="36" fill="#16a34a"/>
        <circle cx="38" cy="40" r="24" fill="#22c55e"/>
        <circle cx="82" cy="38" r="23" fill="#15803d"/>
        <circle cx="60" cy="10" r="22" fill="#22c55e"/>
        <ellipse cx="40" cy="17" rx="15" ry="12" fill="#4ade80" opacity=".42"/>
        <!-- Fruits abondants -->
        <circle cx="41" cy="24" r="6"   fill="${c}"/>
        <circle cx="79" cy="21" r="6"   fill="${c}"/>
        <circle cx="60" cy="6"  r="5.5" fill="${c}" opacity=".9"/>
        <circle cx="27" cy="44" r="4.5" fill="${c}" opacity=".7"/>
        <circle cx="91" cy="41" r="4.5" fill="${c}" opacity=".7"/>
        <circle cx="50" cy="12" r="3.5" fill="${c}" opacity=".6"/>
        <!-- Brillances -->
        <circle cx="39.5" cy="23" r="2.5" fill="#fff" opacity=".58"/>
        <circle cx="77.5" cy="20" r="2.5" fill="#fff" opacity=".58"/>
        <!-- Oiseaux (3) -->
        <path d="M93 10 Q96  7 99 10" fill="none" stroke="#6b7280"
              stroke-width="1.6" stroke-linecap="round"/>
        <path d="M100 17 Q103 14 106 17" fill="none" stroke="#6b7280"
              stroke-width="1.6" stroke-linecap="round"/>
        <path d="M8 18 Q11 15 14 18" fill="none" stroke="#6b7280"
              stroke-width="1.6" stroke-linecap="round"/>
      `;
      break;

    /* ── Niveau 6 : MAISON ──────────────────────────────────────── */
    case 6:
      scene = `
        <!-- Arbre gauche -->
        <ellipse cx="10" cy="71" rx="10" ry="3" fill="#15803d" opacity=".16"/>
        <rect x="7"  y="56" width="6" height="16" rx="2.5" fill="url(#t${id})"/>
        <circle cx="10" cy="49" r="14" fill="#22c55e" opacity=".84"/>
        <circle cx="6"  cy="45" r="9"  fill="#4ade80" opacity=".58"/>

        <!-- Arbre droit -->
        <ellipse cx="110" cy="71" rx="10" ry="3" fill="#15803d" opacity=".16"/>
        <rect x="107" y="56" width="6" height="16" rx="2.5" fill="url(#t${id})"/>
        <circle cx="110" cy="49" r="14" fill="#16a34a" opacity=".84"/>
        <circle cx="114" cy="45" r="9"  fill="#22c55e" opacity=".58"/>

        <!-- Ombre maison -->
        <rect x="26" y="44" width="70" height="29" rx="6"
              fill="#000" opacity=".06" transform="translate(2,2)"/>
        <!-- Murs -->
        <rect x="25" y="43" width="70" height="30" rx="6"
              fill="#faf9f8" stroke="var(--border)" stroke-width="1.5"/>
        <!-- Ombre toit -->
        <polygon points="60,10 19,45 101,45"
                 fill="#000" opacity=".08" transform="translate(2,2)"/>
        <!-- Toit -->
        <polygon points="60,10 18,45 102,45" fill="${c}" opacity=".9"/>
        <!-- Reflet toit -->
        <polygon points="60,10 18,45 40,45" fill="#fff" opacity=".16"/>
        <!-- Cheminée -->
        <rect x="74" y="20" width="8" height="18" rx="2.5" fill="#6b7280"/>
        <rect x="73" y="18" width="10" height="5"  rx="2"   fill="#9ca3af"/>
        <!-- Fumée (bezier organique) -->
        <path d="M78 17 Q74 12 78 7 Q82 3 78 -1"
              fill="none" stroke="#d1d5db" stroke-width="2.2"
              stroke-linecap="round" opacity=".7"/>
        <path d="M80 15 Q83 10 80 6 Q77 2 80 -2"
              fill="none" stroke="#e5e7eb" stroke-width="1.5"
              stroke-linecap="round" opacity=".5"/>
        <!-- Porte -->
        <rect x="50" y="57" width="20" height="16" rx="4"
              fill="#78350f" opacity=".8"/>
        <rect x="51" y="58" width="7"  height="15" rx="2"
              fill="#92400e" opacity=".18"/>
        <circle cx="67" cy="66" r="2.2" fill="#d97706"/>
        <!-- Fenêtre gauche -->
        <rect x="29" y="49" width="16" height="12" rx="2.5"
              fill="#bfdbfe" stroke="#93c5fd" stroke-width="1.2"/>
        <line x1="37"  y1="49"  x2="37"  y2="61" stroke="#93c5fd" stroke-width=".9"/>
        <line x1="29"  y1="55"  x2="45"  y2="55" stroke="#93c5fd" stroke-width=".9"/>
        <rect x="30" y="50" width="6" height="4" rx="1"
              fill="#fff" opacity=".28"/>
        <!-- Fenêtre droite -->
        <rect x="75" y="49" width="16" height="12" rx="2.5"
              fill="#bfdbfe" stroke="#93c5fd" stroke-width="1.2"/>
        <line x1="83"  y1="49"  x2="83"  y2="61" stroke="#93c5fd" stroke-width=".9"/>
        <line x1="75"  y1="55"  x2="91"  y2="55" stroke="#93c5fd" stroke-width=".9"/>
        <rect x="76" y="50" width="6" height="4" rx="1"
              fill="#fff" opacity=".28"/>
        <!-- Allée -->
        <path d="M54 72 Q60 70 66 72" fill="none" stroke="#d97706"
              stroke-width="5" stroke-linecap="round" opacity=".14"/>
        <!-- Petites fleurs au pied -->
        <circle cx="26" cy="70" r="2.8" fill="${c}" opacity=".7"/>
        <line x1="26" y1="72" x2="26" y2="68" stroke="#15803d"
              stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="94" cy="70" r="2.8" fill="${c}" opacity=".7"/>
        <line x1="94" y1="72" x2="94" y2="68" stroke="#15803d"
              stroke-width="1.5" stroke-linecap="round"/>
      `;
      break;

    /* ── Niveau 7 : DOMAINE ─────────────────────────────────────── */
    default:
      scene = `
        <!-- Grands arbres -->
        <ellipse cx="8"   cy="71" rx="11" ry="3.5" fill="#15803d" opacity=".16"/>
        <rect x="5"  y="52" width="7" height="20" rx="3" fill="url(#t${id})"/>
        <circle cx="8"   cy="43" r="17" fill="#15803d" opacity=".88"/>
        <circle cx="3"   cy="39" r="11" fill="#22c55e" opacity=".68"/>
        <ellipse cx="2"  cy="38" rx="6" ry="5" fill="#4ade80" opacity=".38"/>

        <ellipse cx="112" cy="71" rx="11" ry="3.5" fill="#15803d" opacity=".16"/>
        <rect x="108" y="52" width="7" height="20" rx="3" fill="url(#t${id})"/>
        <circle cx="112" cy="43" r="17" fill="#16a34a" opacity=".88"/>
        <circle cx="117" cy="39" r="11" fill="#22c55e" opacity=".68"/>
        <ellipse cx="118" cy="38" rx="6" ry="5" fill="#4ade80" opacity=".38"/>

        <!-- Corps principal ombre -->
        <rect x="19" y="35" width="82" height="38" rx="4"
              fill="#000" opacity=".06" transform="translate(2,2)"/>
        <rect x="18" y="34" width="84" height="38" rx="4"
              fill="#faf9f8" stroke="var(--border)" stroke-width="1.5"/>

        <!-- Tours -->
        <rect x="10" y="26" width="23" height="48" rx="4"
              fill="#f3f4f6" stroke="var(--border)" stroke-width="1.2"/>
        <rect x="87" y="26" width="23" height="48" rx="4"
              fill="#f3f4f6" stroke="var(--border)" stroke-width="1.2"/>
        <!-- Créneaux gauche -->
        <rect x="10"  y="18" width="5" height="10" rx="1.5" fill="${c}"/>
        <rect x="17.5" y="18" width="5" height="10" rx="1.5" fill="${c}"/>
        <rect x="25"  y="18" width="5" height="10" rx="1.5" fill="${c}"/>
        <!-- Créneaux droite -->
        <rect x="87"  y="18" width="5" height="10" rx="1.5" fill="${c}"/>
        <rect x="94.5" y="18" width="5" height="10" rx="1.5" fill="${c}"/>
        <rect x="102" y="18" width="5" height="10" rx="1.5" fill="${c}"/>

        <!-- Toit central ombre -->
        <polygon points="60,5 13,36 107,36"
                 fill="#000" opacity=".08" transform="translate(2,2)"/>
        <!-- Toit central -->
        <polygon points="60,5 12,36 108,36" fill="${c}" opacity=".9"/>
        <polygon points="60,5 12,36 38,36"  fill="#fff" opacity=".17"/>

        <!-- Drapeau -->
        <line x1="60" y1="5" x2="60" y2="-1" stroke="#9ca3af" stroke-width="2.2"/>
        <polygon points="60,-1 74,3.5 60,8" fill="${c}"/>

        <!-- Porte arche -->
        <path d="M49 72 L49 57 Q60 49 71 57 L71 72 Z"
              fill="#78350f" opacity=".82"/>
        <path d="M50.5 72 L50.5 58 Q60 52 69.5 58 L69.5 72 Z"
              fill="#92400e" opacity=".18"/>
        <circle cx="68" cy="65" r="2.3" fill="#d97706"/>

        <!-- Fenêtres tours -->
        <rect x="13" y="34" width="16" height="13" rx="2"
              fill="#bfdbfe" stroke="#93c5fd" stroke-width="1"/>
        <rect x="14" y="35" width="6" height="4" rx="1"
              fill="#fff" opacity=".28"/>
        <rect x="91" y="34" width="16" height="13" rx="2"
              fill="#bfdbfe" stroke="#93c5fd" stroke-width="1"/>
        <rect x="92" y="35" width="6" height="4" rx="1"
              fill="#fff" opacity=".28"/>

        <!-- Fenêtres façade -->
        <rect x="25" y="41" width="19" height="13" rx="2.5"
              fill="#bfdbfe" stroke="#93c5fd" stroke-width="1"/>
        <line x1="34.5" y1="41" x2="34.5" y2="54" stroke="#93c5fd" stroke-width=".8"/>
        <line x1="25"   y1="47.5" x2="44" y2="47.5" stroke="#93c5fd" stroke-width=".8"/>
        <rect x="76" y="41" width="19" height="13" rx="2.5"
              fill="#bfdbfe" stroke="#93c5fd" stroke-width="1"/>
        <line x1="85.5" y1="41" x2="85.5" y2="54" stroke="#93c5fd" stroke-width=".8"/>
        <line x1="76"   y1="47.5" x2="95" y2="47.5" stroke="#93c5fd" stroke-width=".8"/>

        <!-- Fenêtre centrale lumineuse -->
        <rect x="46" y="37" width="28" height="18" rx="3"
              fill="#fef9c3" stroke="#fcd34d" stroke-width="1.2"/>
        <line x1="60" y1="37" x2="60" y2="55" stroke="#fcd34d" stroke-width=".9"/>
        <rect x="47" y="38" width="11" height="7" rx="1.5"
              fill="#fff" opacity=".32"/>

        <!-- Cheminées fumantes -->
        <rect x="13" y="20" width="7" height="10" rx="2" fill="#6b7280" opacity=".78"/>
        <rect x="100" y="20" width="7" height="10" rx="2" fill="#6b7280" opacity=".78"/>
        <path d="M16 19 Q13 14 16 9 Q19 5 16 1"
              fill="none" stroke="#d1d5db" stroke-width="1.8"
              stroke-linecap="round" opacity=".65"/>
        <path d="M103 19 Q100 14 103 9 Q106 5 103 1"
              fill="none" stroke="#d1d5db" stroke-width="1.8"
              stroke-linecap="round" opacity=".65"/>

        <!-- Étoiles nuit douce -->
        <circle cx="104" cy="9"  r="2.2" fill="#fef9c3" opacity=".65"/>
        <circle cx="112" cy="18" r="1.5" fill="#fef9c3" opacity=".5"/>
        <circle cx="8"   cy="13" r="1.8" fill="#fef9c3" opacity=".55"/>
      `;
    }

    return `<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg"
              overflow="hidden">
      ${defs}${bg}${gnd}${scene}
    </svg>`;
  }

  /* ── HTML d'une carte grille ─────────────────────────────────── */
  function _card(client) {
    const s    = _secs(client.id);
    const lvl  = _lvl(s);
    const pct  = Math.round(_prg(s) * 100);
    const name = NAMES[lvl];
    const next = lvl >= MAX
      ? '★ Niveau max'
      : `+${_fmt(_T(lvl + 1) - s)} → ${NAMES[lvl + 1]}`;

    return `<div class="gdn-card">
      <div class="gdn-topbar" style="background:${client.color}"></div>
      <div class="gdn-card-head">
        <div class="gdn-av" style="background:${client.color}20;color:${client.color}">
          ${escHtml(client.initials)}
        </div>
        <span class="gdn-cname">${escHtml(client.name)}</span>
        <span class="gdn-badge"
              style="background:${client.color}18;color:${client.color};
                     border-color:${client.color}30">
          Niv.${lvl} ${name}
        </span>
      </div>
      <div class="gdn-svg-wrap">
        ${_svg(lvl, _prg(s), client.color, client.id)}
      </div>
      <div class="gdn-foot">
        <div class="gdn-bar-outer">
          <div class="gdn-bar-fill"
               style="width:${pct}%;background:${client.color}"></div>
          <div class="gdn-tick" style="left:25%"></div>
          <div class="gdn-tick" style="left:50%"></div>
          <div class="gdn-tick" style="left:75%"></div>
        </div>
        <div class="gdn-labels">
          <span>${_fmt(s)} ce mois</span>
          <span class="gdn-next" style="color:${client.color}">${next}</span>
        </div>
      </div>
    </div>`;
  }

  /* ── Rendu de la grille (au-dessus du timer) ─────────────────── */
  function render() {
    const el = document.getElementById('garden-container');
    if (!el) return;
    try {
      el.innerHTML = App.CLIENTS?.length
        ? App.CLIENTS.map(c => _card(c)).join('')
        : '<p class="empty-hint">Ajoutez des clients pour voir leur jardin.</p>';
      const b = document.getElementById('garden-season-label');
      if (b) b.textContent = new Date().toLocaleDateString('fr-FR',
        { month: 'long', year: 'numeric' });
    } catch (e) { console.error('[Garden]', e); }
  }

  /* ── Jardin actif sous le timer ──────────────────────────────── */
  function updateActive() {
    const el = document.getElementById('gdn-active');
    if (!el) return;
    try {
      /* Le bouton "Terminer" est visible ↔ timer actif (running ou paused) */
      const stopBtn  = document.getElementById('timerStopBtn');
      const running  = stopBtn && stopBtn.style.display === 'inline-flex';
      const clientId = document.getElementById('taskClientSelect')?.value;
      const client   = clientId ? App.getClient(clientId) : null;

      if (!running || !client || client.id === App.AUTRE_CLIENT_ID) {
        el.style.display = 'none';
        return;
      }

      const s    = _secs(client.id);
      const lvl  = _lvl(s);
      const pct  = Math.round(_prg(s) * 100);
      const name = NAMES[lvl];
      const next = lvl >= MAX
        ? '★ Maximum !'
        : `+${_fmt(_T(lvl + 1) - s)} → ${NAMES[lvl + 1]}`;

      el.style.display = 'block';
      el.style.setProperty('--gac', client.color);
      el.innerHTML = `<div class="gdn-act">
        <div class="gdn-act-inner">
          <div class="gdn-act-info">
            <div>
              <div class="gdn-act-client" style="color:${client.color}">
                ${escHtml(client.name)}
              </div>
              <div class="gdn-act-lvl">Niv.${lvl} — ${name}</div>
            </div>
            <div>
              <div class="gdn-act-bar-outer">
                <div class="gdn-act-bar-fill"
                     style="width:${pct}%;background:${client.color}"></div>
              </div>
              <div class="gdn-act-sub" style="margin-top:5px">
                ${_fmt(s)} ce mois · ${next}
              </div>
            </div>
          </div>
          <div class="gdn-act-scene">
            ${_svg(lvl, _prg(s), client.color, client.id + '_a')}
          </div>
        </div>
      </div>`;
    } catch (e) { console.error('[Garden.active]', e); }
  }

  /* ── Wiring événements ───────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    _css();
    /* Boutons timer */
    ['timerStartBtn', 'timerResumeBtn', 'timerStopBtn', 'timerPauseBtn']
      .forEach(id => document.getElementById(id)
        ?.addEventListener('click', () => setTimeout(updateActive, 90)));
    /* Changement de client pendant que le timer tourne */
    document.getElementById('taskClientSelect')
      ?.addEventListener('change', () => setTimeout(updateActive, 90));
  });

  return { render, updateActive };

})();
