// ─── BIBLIOTHÈQUE DE MUSIQUES (Musique TWG) ─────────────────────────────
// Chaque musique ajoutée (fichier MP3 + nom + catégorie) est stockée
// directement dans le navigateur de la personne (IndexedDB, adapté au
// stockage de fichiers volumineux, contrairement à localStorage).
//
// Deux destinations possibles pour une musique, exclusives l'une de l'autre :
//  - Personnelle (par défaut) : visible uniquement par le pseudo qui l'a
//    ajoutée, dans "Liste des musiques".
//  - Globale (isGlobal: true) : réservé aux grades admin/super-admin via
//    une case à cocher sur "Téléchargement musique", visible par tout le
//    monde sur cet appareil, dans "Musiques globales".
//
// IMPORTANT : le fichier reste stocké localement dans ce navigateur. Il
// n'est envoyé à aucun serveur et n'est pas partagé entre appareils ou
// visiteurs — il n'y a pas de serveur derrière ce site.
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
            results.sort(function (a, b) { return b.addedAt - a.addedAt; });
            resolve(results);
          }
        };
        cursorRequest.onerror = function () { reject(cursorRequest.error); };
      });
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
            results.sort(function (a, b) { return b.addedAt - a.addedAt; });
            resolve(results);
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
    deleteTrackForCurrentUser: deleteTrackForCurrentUser,
    updateTrackCategory: updateTrackCategory,
    getCategoriesForCurrentUser: getCategoriesForCurrentUser,
    isUserLoggedIn: isUserLoggedIn,
    getCurrentPseudo: getCurrentPseudo
  };
})();
