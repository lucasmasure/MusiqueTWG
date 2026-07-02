// ─── AUTHENTIFICATION (Musique TWG) ─────────────────────────────────────
// Connexion par pseudo + adresse email.
//
// Le champ email est un champ classique : le navigateur propose son
// auto-remplissage natif, sans dépendre d'une configuration externe.
// Ça fonctionne donc immédiatement, même en local.
//
// Mémoire des connexions : chaque paire (pseudo, email) déjà utilisée sur
// cet appareil est mémorisée. À la reconnexion :
//  - le champ email propose (liste déroulante + pré-remplissage) les
//    adresses déjà utilisées ;
//  - si l'adresse saisie correspond à une adresse déjà connue, le champ
//    pseudo se complète automatiquement avec le pseudo associé.
//
// OPTIONNEL — pour activer le vrai sélecteur de comptes Google (popup
// listant les comptes connectés au navigateur) :
// 1. Créez un identifiant OAuth sur https://console.cloud.google.com
//    (APIs & Services > Identifiants > Créer des identifiants > ID client OAuth > Application Web)
// 2. Ajoutez l'URL exacte de votre site dans "Origines JavaScript autorisées"
// 3. Remplacez GOOGLE_CLIENT_ID ci-dessous par le vôtre.
// Tant que ce n'est pas fait, le bouton Google reste simplement masqué
// et seul le champ email classique est utilisé — le site fonctionne
// normalement dans les deux cas.
(function () {
  const GOOGLE_CLIENT_ID = 'REMPLACEZ_PAR_VOTRE_CLIENT_ID.apps.googleusercontent.com';
  const GOOGLE_CONFIGURED = GOOGLE_CLIENT_ID.indexOf('REMPLACEZ_PAR') === -1;

  const PSEUDO_KEY  = 'twg_pseudo';
  const EMAIL_KEY   = 'twg_email';
  const ENTRIES_KEY = 'twg_known_logins'; // liste de { pseudo, email }
  const MAX_ENTRIES = 8;

  let googleEmail = null; // rempli uniquement si connexion via Google

  function getPseudo() { try { return localStorage.getItem(PSEUDO_KEY); } catch (e) { return null; } }
  function getEmail()  { try { return localStorage.getItem(EMAIL_KEY); }  catch (e) { return null; } }

  function loadEntries() {
    try {
      const raw = localStorage.getItem(ENTRIES_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function saveEntries(list) {
    try { localStorage.setItem(ENTRIES_KEY, JSON.stringify(list)); }
    catch (e) { /* stockage indisponible */ }
  }

  function rememberEntry(pseudo, email) {
    let list = loadEntries().filter(function (entry) {
      return entry.email.toLowerCase() !== email.toLowerCase();
    });
    list.unshift({ pseudo: pseudo, email: email });
    list = list.slice(0, MAX_ENTRIES);
    saveEntries(list);
  }

  function findEntryByEmail(email) {
    const target = (email || '').trim().toLowerCase();
    if (!target) return null;
    return loadEntries().find(function (entry) {
      return entry.email.toLowerCase() === target;
    }) || null;
  }

  function populateEmailDatalist() {
    const datalist = document.getElementById('known-emails-list');
    if (!datalist) return;
    datalist.innerHTML = '';
    loadEntries().forEach(function (entry) {
      const option = document.createElement('option');
      option.value = entry.email;
      datalist.appendChild(option);
    });
  }

  function setSession(pseudo, email) {
    try {
      localStorage.setItem(PSEUDO_KEY, pseudo);
      localStorage.setItem(EMAIL_KEY, email);
    } catch (e) { /* stockage indisponible */ }
  }

  function clearSession() {
    try {
      localStorage.removeItem(PSEUDO_KEY);
      localStorage.removeItem(EMAIL_KEY);
    } catch (e) { /* rien à faire */ }
  }

  function isLoggedIn() { return !!(getPseudo() && getEmail()); }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function decodeJwt(token) {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  function updateNavUI() {
    const openBtn   = document.getElementById('open-login-btn');
    const userBadge = document.getElementById('user-badge');
    const pseudoEl  = document.getElementById('user-pseudo-display');
    if (!openBtn || !userBadge) return;

    if (isLoggedIn()) {
      openBtn.style.display = 'none';
      userBadge.style.display = 'flex';
      if (pseudoEl) pseudoEl.textContent = getPseudo();
    } else {
      openBtn.style.display = 'inline-flex';
      userBadge.style.display = 'none';
    }
  }

  function guardContent() {
    const gated   = document.querySelector('[data-requires-auth]');
    const lockMsg = document.getElementById('auth-lock-message');
    if (!gated) return; // page non protégée (ex : Accueil)

    if (isLoggedIn()) {
      gated.style.display = '';
      if (lockMsg) lockMsg.style.display = 'none';
    } else {
      gated.style.display = 'none';
      if (lockMsg) lockMsg.style.display = 'flex';
    }
  }

  // Si l'email saisi correspond à une connexion déjà connue, complète le pseudo.
  function autoFillPseudoFromEmail() {
    const emailIn  = document.getElementById('login-email');
    const pseudoIn = document.getElementById('login-pseudo');
    if (!emailIn || !pseudoIn) return;

    const entry = findEntryByEmail(emailIn.value);
    if (entry) {
      pseudoIn.value = entry.pseudo;
    }
    checkFormValidity();
  }

  function openModal() {
    const overlay  = document.getElementById('login-overlay');
    const pseudoIn = document.getElementById('login-pseudo');
    const emailIn  = document.getElementById('login-email');
    if (overlay) overlay.classList.add('open');

    populateEmailDatalist();

    // Propose la dernière connexion utilisée sur cet appareil, si les champs sont vides.
    const entries = loadEntries();
    if (emailIn && !emailIn.value && !googleEmail && entries.length > 0) {
      emailIn.value = entries[0].email;
      if (pseudoIn && !pseudoIn.value) pseudoIn.value = entries[0].pseudo;
    }

    checkFormValidity();
  }

  function closeModal() {
    const overlay = document.getElementById('login-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  function showGoogleSelectedEmail(email) {
    googleEmail = email;
    const picker      = document.getElementById('google-btn');
    const display      = document.getElementById('selected-email-display');
    const text         = document.getElementById('selected-email-text');
    const manualInput  = document.getElementById('login-email');
    if (picker)  picker.style.display = 'none';
    if (display) display.style.display = 'flex';
    if (text)    text.textContent = email;
    if (manualInput) { manualInput.value = email; manualInput.disabled = true; }
    autoFillPseudoFromEmail();
    checkFormValidity();
  }

  function resetGoogleSelection() {
    googleEmail = null;
    const picker      = document.getElementById('google-btn');
    const display      = document.getElementById('selected-email-display');
    const manualInput  = document.getElementById('login-email');
    if (picker)  picker.style.display = 'flex';
    if (display) display.style.display = 'none';
    if (manualInput) { manualInput.disabled = false; manualInput.value = ''; }
    checkFormValidity();
  }

  function checkFormValidity() {
    const pseudoInput = document.getElementById('login-pseudo');
    const emailInput  = document.getElementById('login-email');
    const submitBtn   = document.getElementById('modal-submit-btn');
    if (!submitBtn) return;

    const pseudoOk = pseudoInput && pseudoInput.value.trim().length > 0;
    const emailOk  = !!googleEmail || (emailInput && isValidEmail(emailInput.value.trim()));
    submitBtn.disabled = !(pseudoOk && emailOk);
  }

  function handleCredentialResponse(response) {
    const payload = decodeJwt(response.credential);
    if (payload && payload.email) {
      showGoogleSelectedEmail(payload.email);
      const pseudoInput = document.getElementById('login-pseudo');
      if (pseudoInput && !pseudoInput.value && payload.given_name) {
        pseudoInput.value = payload.given_name;
      }
      checkFormValidity();
    }
  }

  function initGoogleButton(attempt) {
    if (!GOOGLE_CONFIGURED) return; // pas d'identifiant réel : on ne tente rien, pas d'erreur 400
    attempt = attempt || 0;
    const container = document.getElementById('google-btn');
    const field      = document.getElementById('google-field');
    if (!container) return;

    if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
      if (attempt < 20) setTimeout(function () { initGoogleButton(attempt + 1); }, 300);
      return;
    }

    if (field) field.style.display = 'block';

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false
    });
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width: 280
    });
  }

  function initModal() {
    const openBtn    = document.getElementById('open-login-btn');
    const closeBtn   = document.getElementById('modal-close-btn');
    const overlay    = document.getElementById('login-overlay');
    const form       = document.getElementById('login-form');
    const pseudoIn   = document.getElementById('login-pseudo');
    const emailIn    = document.getElementById('login-email');
    const changeBtn  = document.getElementById('change-email-btn');
    const logoutBtn  = document.getElementById('logout-btn');

    if (openBtn)  openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeModal();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    if (pseudoIn) pseudoIn.addEventListener('input', checkFormValidity);
    if (emailIn) {
      emailIn.addEventListener('input', function () {
        autoFillPseudoFromEmail();
      });
    }
    if (changeBtn) changeBtn.addEventListener('click', resetGoogleSelection);

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const pseudo = pseudoIn.value.trim();
        const email  = googleEmail || emailIn.value.trim();

        if (!pseudo || !isValidEmail(email)) {
          checkFormValidity();
          return;
        }

        setSession(pseudo, email);
        rememberEntry(pseudo, email);
        updateNavUI();
        guardContent();
        closeModal();
        form.reset();
        resetGoogleSelection();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        clearSession();
        resetGoogleSelection();
        updateNavUI();
        guardContent();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initModal();
    initGoogleButton();
    populateEmailDatalist();
    updateNavUI();
    guardContent();
  });

  // ── API publique (utilisée par tracks.js et roles.js) ─────
  window.TWGAuth = {
    getPseudo: getPseudo,
    getEmail: getEmail,
    isLoggedIn: isLoggedIn,
    getPseudoForEmail: function (email) {
      const entry = findEntryByEmail(email);
      return entry ? entry.pseudo : null;
    }
  };
})();
