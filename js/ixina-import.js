/* ================================================================
   THE HOUSE — ixina-import.js
   Import d'une session IXINA generee par PREPARER_ENVOI (fichier .json)
   Ajoute chaque clip comme projet dans le Kanban du bon client,
   colonne "Verification DRAFT".
   ================================================================ */

'use strict';

window.IxinaImport = (() => {

  const STAGE_CIBLE = 'verif-draft';

  function init() {
    const btn = document.getElementById('ixinaImportBtn');
    const input = document.getElementById('ixinaImportInput');
    if (!btn || !input) return;

    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) lireFichier(file);
      input.value = '';
    });
  }

  function lireFichier(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        importerSession(data);
      } catch (err) {
        alert("Fichier JSON invalide : " + err.message);
      }
    };
    reader.onerror = () => alert("Impossible de lire le fichier.");
    reader.readAsText(file, 'utf-8');
  }

  function importerSession(data) {
    if (!data || data.version !== 1) {
      alert("Format de session non reconnu.\n\nSelectionne un fichier session_*.json genere par PREPARER_ENVOI dans C:\\IXINA\\_outils\\sessions\\");
      return;
    }

    const clientId = data.client_dashboard_id;
    const client = clientId ? App.getClient(clientId) : null;
    if (!client) {
      alert("Client introuvable dans le dashboard : " + (clientId || '(vide)'));
      return;
    }

    const clips = Array.isArray(data.clips) ? data.clips : [];
    if (clips.length === 0) {
      alert("Aucun clip trouve dans le fichier de session.");
      return;
    }

    const cleProjets = `${App.KEYS.PROJECTS}_${clientId}`;
    const projets = App.load(cleProjets, []);

    let ajoutes = 0;
    clips.forEach((clip, idx) => {
      const numero = clip.numero || (idx + 1);
      const nomClip = clip.nom_fichier || `Clip ${numero}`;
      projets.push({
        id: App.uid(),
        name: nomClip,
        stage: STAGE_CIBLE,
        createdAt: App.today(),
        ixinaSession: {
          date: data.date_session,
          sheetNom: data.sheet_nom,
          sheetUrl: data.sheet_url,
          numero: numero,
          nomFichier: clip.nom_fichier,
          fichierComplet: clip.fichier_complet,
        }
      });
      ajoutes++;
    });

    App.save(cleProjets, projets);

    const sheetInfo = data.sheet_url
      ? `\n\nSheet de correction :\n${data.sheet_url}`
      : '';

    alert(
      `${ajoutes} clip(s) ajoute(s) au pipeline "${client.name}" — colonne "Verification DRAFT".${sheetInfo}`
    );

    if (window.Dashboard && typeof Dashboard.refresh === 'function') {
      Dashboard.refresh();
    }
    const vueClientActive = document.querySelector(`#view-client-${clientId}.view.active`);
    if (vueClientActive && window.Clients && typeof Clients.renderView === 'function') {
      Clients.renderView(clientId);
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  IxinaImport.init();
});
