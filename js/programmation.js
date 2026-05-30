/* ================================================================
   THE HOUSE — programmation.js
   Flow Programmation : à l'entrée dans "Programmé / Publié"
   - demande la date de départ et l'écart entre vidéos
   - calcule les dates pour A1, A2, ...
   - pointe sur le dossier ARRIVAL (File System Access API)
   - renomme A{n}.ext → YYYY-MM-DD.ext
   ================================================================ */

'use strict';

window.Programmation = (() => {

  const IDB_NAME  = 'th_fs_handles';
  const IDB_STORE = 'handles';
  const HANDLE_KEY = 'arrivalDir';

  /* Mapping prefixe fichier → client dashboard */
  const CLIENT_PREFIX = {
    'AT': 'ixina-ath',
    'XL': 'ixina-ixelles',
    'TT': 'ixina-tours',
  };

  /* ── IndexedDB minimal pour persister les FileSystemDirectoryHandle ── */
  function _idb() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(IDB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror   = () => reject(r.error);
    });
  }

  async function _saveHandle(handle) {
    const db = await _idb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(handle, HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  }

  async function _loadHandle() {
    const db = await _idb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const r  = tx.objectStore(IDB_STORE).get(HANDLE_KEY);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror   = () => resolve(null);
    });
  }

  async function _ensurePermission(handle, mode = 'readwrite') {
    if (!handle) return false;
    if ((await handle.queryPermission({ mode })) === 'granted') return true;
    return (await handle.requestPermission({ mode })) === 'granted';
  }

  async function _pickArrival() {
    if (!window.showDirectoryPicker) {
      App.toast('Ton navigateur ne supporte pas File System Access. Utilise Chrome/Edge récent.', 'error');
      return null;
    }
    try {
      const handle = await window.showDirectoryPicker({ id: 'ixina-arrival', mode: 'readwrite' });
      await _saveHandle(handle);
      return handle;
    } catch(e) {
      return null; /* annulation utilisateur */
    }
  }

  /* ── Calcule les dates pour N vidéos à partir d'une date de départ ── */
  function _computeDates(startISO, count, gapDays) {
    const out = [];
    const d = new Date(startISO + 'T12:00:00');
    for (let i = 0; i < count; i++) {
      const dd = new Date(d);
      dd.setDate(d.getDate() + i * gapDays);
      out.push(dd.toISOString().split('T')[0]);
    }
    return out;
  }

  /* ── Renomme A{n}.ext OU XX_A{n}.ext → date.ext dans ARRIVAL ──── */
  async function _renameFiles(dirHandle, letter, count, dates, defaultClientId) {
    const results = [];
    /* Liste tous les fichiers existants pour trouver les extensions */
    const filesByName = new Map();
    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind === 'file') filesByName.set(name, entry);
    }

    for (let i = 0; i < count; i++) {
      const idx     = i + 1;
      const baseOld = `${letter}${idx}`;            /* ex: A1 */
      const dateNew = dates[i];

      /* Cherche un fichier qui matche soit "A1.ext" soit "AT_A1.ext" */
      let foundName  = null;
      let ext        = null;
      let clientId   = defaultClientId;
      for (const name of filesByName.keys()) {
        const dot = name.lastIndexOf('.');
        if (dot < 1) continue;
        const stem    = name.slice(0, dot);
        const stemUp  = stem.toUpperCase();
        if (stemUp === baseOld) {
          foundName = name;
          ext       = name.slice(dot);
          break;
        }
        /* Vérifie format préfixé : XX_A1 */
        const m = stemUp.match(/^([A-Z]{2})_(.+)$/);
        if (m && m[2] === baseOld && CLIENT_PREFIX[m[1]]) {
          foundName = name;
          ext       = name.slice(dot);
          clientId  = CLIENT_PREFIX[m[1]];
          break;
        }
      }

      if (!foundName) {
        results.push({ ok: false, old: baseOld, msg: 'fichier introuvable' });
        continue;
      }

      const newName = `${dateNew}${ext}`;
      try {
        /* Copie via getFile + write puis suppression de l'ancien */
        const src      = await filesByName.get(foundName).getFile();
        const newHand  = await dirHandle.getFileHandle(newName, { create: true });
        const writable = await newHand.createWritable();
        await writable.write(src);
        await writable.close();
        await dirHandle.removeEntry(foundName);
        results.push({ ok: true, old: foundName, new: newName, date: dateNew, clientId });
      } catch(e) {
        results.push({ ok: false, old: foundName, msg: e.message });
      }
    }
    return results;
  }

  /* ── Modale principale ──────────────────────────────────────── */
  async function openForProject(clientId, projectId, onConfirmed) {
    const projects = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
    const project  = projects.find(p => p.id === projectId);
    if (!project) return;
    const client   = App.getClient(clientId);

    if (!project.letter || !project.videoCount) {
      App.toast("Ce projet n'a pas de lettre ou de nombre de vidéos. Modifie-le d'abord.", 'error');
      return;
    }

    const today = App.today();

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.display = 'flex';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <h3>Programmer : ${escHtml(project.name)}</h3>
          <button class="modal-close-btn" id="_pg-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size:.88rem;color:var(--text-2);margin-bottom:12px">
            <strong>${project.videoCount}</strong> vidéo(s) — lettre <strong>${escHtml(project.letter)}</strong> — client <span style="color:${client?.color || '#000'}">${escHtml(client?.name || '?')}</span>
          </p>
          <div style="display:flex;gap:12px">
            <div style="flex:1">
              <label class="form-label">Date de la 1ʳᵉ vidéo</label>
              <input type="date" id="_pg-start" class="form-input" value="${today}" />
            </div>
            <div style="flex:1">
              <label class="form-label">Écart (jours)</label>
              <input type="number" id="_pg-gap" class="form-input" min="1" max="30" value="3" />
            </div>
          </div>
          <div id="_pg-preview" style="margin-top:14px;padding:10px 12px;background:var(--surface-2,#f9fafb);border-radius:8px;font-size:.82rem;max-height:200px;overflow-y:auto"></div>
          <p style="font-size:.78rem;color:var(--text-3);margin-top:10px">
            Le dashboard va renommer <code>${escHtml(project.letter)}1.mp4</code>, <code>${escHtml(project.letter)}2.mp4</code>… présents dans le dossier <code>ARRIVAL</code> avec les dates ci-dessus.
          </p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-ghost" id="_pg-cancel">Annuler</button>
          <button class="btn btn-primary" id="_pg-go">Choisir ARRIVAL et renommer</button>
        </div>
      </div>`;

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('visible')));

    const startEl   = backdrop.querySelector('#_pg-start');
    const gapEl     = backdrop.querySelector('#_pg-gap');
    const previewEl = backdrop.querySelector('#_pg-preview');

    function refreshPreview() {
      const dates = _computeDates(startEl.value, project.videoCount, parseInt(gapEl.value, 10) || 3);
      previewEl.innerHTML = dates.map((d, i) =>
        `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--border,#e5e7eb)">
           <span style="font-family:monospace">${escHtml(project.letter)}${i+1}.mp4</span>
           <span style="font-family:monospace;color:${client?.color || '#000'}">→ ${d}.mp4</span>
         </div>`
      ).join('');
    }
    refreshPreview();
    startEl.addEventListener('change', refreshPreview);
    gapEl.addEventListener('input', refreshPreview);

    const close = () => {
      backdrop.classList.remove('visible');
      setTimeout(() => backdrop.remove(), 200);
    };

    backdrop.querySelector('#_pg-close').addEventListener('click', close);
    backdrop.querySelector('#_pg-cancel').addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });

    backdrop.querySelector('#_pg-go').addEventListener('click', async () => {
      const dates = _computeDates(startEl.value, project.videoCount, parseInt(gapEl.value, 10) || 3);

      /* Récupère ou demande le handle ARRIVAL */
      let dirHandle = await _loadHandle();
      if (dirHandle) {
        const ok = await _ensurePermission(dirHandle, 'readwrite');
        if (!ok) dirHandle = null;
      }
      if (!dirHandle) dirHandle = await _pickArrival();
      if (!dirHandle) { App.toast('Dossier ARRIVAL non choisi.', 'error'); return; }

      const results = await _renameFiles(dirHandle, project.letter, project.videoCount, dates, clientId);
      const okCount  = results.filter(r => r.ok).length;
      const koCount  = results.length - okCount;

      /* Stocke les dates programmées sur le projet */
      const ps = App.load(`${App.KEYS.PROJECTS}_${clientId}`, []);
      const p  = ps.find(x => x.id === projectId);
      if (p) {
        p.scheduledDates = dates;
        App.save(`${App.KEYS.PROJECTS}_${clientId}`, ps);
      }

      /* Coche la case dans Publication pour chaque vidéo renommée */
      if (window.PubCal && typeof PubCal.setCheck === 'function') {
        results.forEach(r => {
          if (r.ok && r.date && r.clientId) PubCal.setCheck(r.date, r.clientId, true);
        });
      }

      if (koCount === 0) {
        App.toast(`✓ ${okCount} vidéo(s) renommée(s) et cochée(s) dans Publication.`, 'success');
        close();
        if (onConfirmed) onConfirmed();
      } else {
        const errs = results.filter(r => !r.ok).map(r => `• ${r.old} : ${r.msg}`).join('\n');
        App.toast(`${okCount} OK, ${koCount} échec(s). Voir console.`, 'error');
        console.error('[Programmation] Échecs :\n' + errs);
        /* On ne ferme pas pour laisser l'utilisateur voir et corriger */
      }
    });
  }

  return { openForProject };
})();
