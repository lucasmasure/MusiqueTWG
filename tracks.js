// ─── BIBLIOTHÈQUE DE MUSIQUES (Musique TWG) ─────────────────────────────
// Chaque musique ajoutée via le formulaire (fichier MP3 + nom + catégorie)
// est stockée directement dans le navigateur de la personne (IndexedDB,
// adapté au stockage de fichiers volumineux, contrairement à localStorage).
//
// En complément, les musiques listées dans hosted-tracks.js (déposées
// manuellement dans ce dépôt GitHub, sans jeton ni programmation) sont
// automatiquement mélangées à l'affichage, avec un vrai lien .mp3
// permanent et partageable.
//
// Deux destinations possibles pour une musique du formulaire, exclusives
// l'une de l'autre :
//  - Personnelle (par défaut) : visible uniquement par le pseudo qui l'a
//    ajoutée, dans "Liste des musiques".
//  - Globale (isGlobal: true) : réservé aux grades admin/super-admin via
//    une case à cocher sur "Téléchargement musique", visible par tout le
//    monde sur cet appareil, dans "Musiques globales".
//
// IMPORTANT : le fichier du formulaire reste stocké localement dans ce
// navigateur. Il n'est envoyé à aucun serveur et n'est pas partagé entre
// appareils ou visiteurs — seules les musiques de hosted-tracks.js sont
// réellement partagées avec tout le monde, partout.
(function () {
  const DB_NAME    = 'MusiqueTWG';
  const DB_VERSION = 1;
  const STORE_NAME = 'tracks';
  const MAX_TRACKS_PER_USER = 200;

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('Le stockage local (IndexedDB) n\'est pas disponible sur ce navigateur.')); return; }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('pseudo', 'pseudo', { unique: false });
        }
      };
      request.onsuccess = function (e) { resolve(e.target.result); };
      request.onerror   = function () { reject(request.error); };
    });
    return dbPromise;
  }

  function normalizePseudo(pseudo) { return (pseudo || '').trim().toLowerCase(); }

  function getCurrentPseudo() {
    if (window.TWGAuth && typeof window.TWGAuth.getPseudo === 'function') {
      return window.TWGAuth.getPseudo();
    }
    try { return localStorage.getItem('twg_pseudo'); } catch (e) { return null; }
  }

  function isUserLoggedIn() {
    if (window.TWGAuth && typeof window.TWGAuth.isLoggedIn === 'function') {
      return window.TWGAuth.isLoggedIn();
    }
    return !!getCurrentPseudo();
  }

  function makeTrackId() {
    return 'trk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // track = { name, category, file, isGlobal } où file est un objet File (MP3)
  function saveTrackForCurrentUser(track) {
    const pseudo = getCurrentPseudo();
    const key = normalizePseudo(pseudo);
    if (!key) return Promise.reject(new Error('Vous devez être connecté.'));

    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const record = {
          id: makeTrackId(),
          pseudo: key,
          name: track.name,
          category: track.category || '',
          fileName: track.file.name,
          mimeType: track.file.type || 'audio/mpeg',
          size: track.file.size,
          addedAt: Date.now(),
          isGlobal: !!track.isGlobal,
          blob: track.file // les objets File/Blob sont stockables tels quels dans IndexedDB
        };
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).add(record);
        tx.oncomplete = function () { resolve(record); };
        tx.onerror    = function () { reject(tx.error); };
      });
    });
  }

  function getTracksForCurrentUser() {
    const key = normalizePseudo(getCurrentPseudo());
    if (!key) return Promise.resolve([]);

    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx    = db.transaction(STORE_NAME, 'readonly');
        const index = tx.objectStore(STORE_NAME).index('pseudo');
        const range = IDBKeyRange.only(key);
        const results = [];
        const cursorRequest = index.openCursor(range);
        cursorRequest.onsuccess = function (e) {
          const cursor = e.target.result;
          if (cursor) {
            if (!cursor.value.isGlobal) results.push(cursor.value);
            cursor.continue();
          } else {
            const merged = results.concat(getHostedTracks());
            merged.sort(function (a, b) { return b.addedAt - a.addedAt; });
            resolve(merged);
          }
        };
        cursorRequest.onerror = function () { reject(cursorRequest.error); };
      });
    });
  }

  // Musiques dont le MP3 est réellement hébergé dans ce dépôt GitHub
  // (voir hosted-tracks.js) — vrai lien .mp3 permanent, pas de blob.
  function getHostedTracks() {
    const list = Array.isArray(window.TWG_HOSTED_TRACKS) ? window.TWG_HOSTED_TRACKS : [];
    return list.map(function (entry, index) {
      let absoluteUrl;
      try { absoluteUrl = new URL(entry.file, document.baseURI).href; }
      catch (e) { absoluteUrl = entry.file; }
      return {
        id: 'hosted-' + index,
        pseudo: entry.addedBy || 'Site',
        name: entry.name || 'Musique',
        category: entry.category || '',
        addedAt: entry.addedAt ? new Date(entry.addedAt).getTime() : 0,
        isGlobal: true,
        isHosted: true,
        url: absoluteUrl
      };
    });
  }

  function deleteTrackForCurrentUser(trackId) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(trackId);
        tx.oncomplete = function () { resolve(); };
        tx.onerror    = function () { reject(tx.error); };
      });
    });
  }

  function updateTrackCategory(trackId, newCategory) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx    = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getRequest = store.get(trackId);

        getRequest.onsuccess = function () {
          const record = getRequest.result;
          if (!record) { reject(new Error('Musique introuvable.')); return; }
          record.category = (newCategory || '').trim();
          store.put(record);
        };
        getRequest.onerror = function () { reject(getRequest.error); };

        tx.oncomplete = function () { resolve(); };
        tx.onerror    = function () { reject(tx.error); };
      });
    });
  }

  function getGlobalTracks() {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx    = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const results = [];
        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = function (e) {
          const cursor = e.target.result;
          if (cursor) {
            if (cursor.value.isGlobal) results.push(cursor.value);
            cursor.continue();
          } else {
            const merged = results.concat(getHostedTracks());
            merged.sort(function (a, b) { return b.addedAt - a.addedAt; });
            resolve(merged);
          }
        };
        cursorRequest.onerror = function () { reject(cursorRequest.error); };
      });
    });
  }

  function getCategoriesForCurrentUser() {
    return getTracksForCurrentUser().then(function (tracks) {
      const seen = {};
      const categories = [];
      tracks.forEach(function (t) {
        if (t.category && !seen[t.category.toLowerCase()]) {
          seen[t.category.toLowerCase()] = true;
          categories.push(t.category);
        }
      });
      return categories.sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    });
  }

  window.TWGTracks = {
    saveTrackForCurrentUser: saveTrackForCurrentUser,
    getTracksForCurrentUser: getTracksForCurrentUser,
    getGlobalTracks: getGlobalTracks,
    getHostedTracks: getHostedTracks,
    deleteTrackForCurrentUser: deleteTrackForCurrentUser,
    updateTrackCategory: updateTrackCategory,
    getCategoriesForCurrentUser: getCategoriesForCurrentUser,
    isUserLoggedIn: isUserLoggedIn,
    getCurrentPseudo: getCurrentPseudo
  };
})();
