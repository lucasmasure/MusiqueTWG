// ─── GRADES (Musique TWG) ────────────────────────────────────────────────
// Système de grades minimal : "admin" et "super-admin".
// À ce stade, aucun droit ni fonctionnalité n'est rattaché à ces grades —
// ils existent en tant que statut, visible sous forme de badge à côté du
// pseudo, et contrôlent l'accès à l'espace "Staff" (page Accueil).
//
// Le grade est rattaché à l'ADRESSE EMAIL du compte (pas au pseudo, qui
// peut changer librement), stocké dans ce navigateur.
//
// IMPORTANT — limite de sécurité : ce site est statique, sans serveur.
// N'importe qui peut donc théoriquement s'attribuer un grade en modifiant
// le stockage local de son propre navigateur (ex : via la console du
// navigateur). Tant qu'aucune vérification côté serveur n'existe, ce
// système de grades est un simple statut d'affichage/accès, pas une vraie
// protection de sécurité.
//
// Pour attribuer un grade de façon permanente (fonctionne sur n'importe
// quel navigateur/appareil) : ajoutez une ligne dans SEED_GRADES ci-dessous.
//
// Pour attribuer un grade temporairement, uniquement sur ce navigateur
// (aucune interface n'existe encore) : ouvrez la console du navigateur sur
// le site et tapez par exemple :
//   TWGRoles.setGradeForEmail('quelquun@exemple.com', 'super-admin');
//   TWGRoles.setGradeForEmail('autre@exemple.com', 'admin');
// Pour retirer un grade (attribué via la console, pas via SEED_GRADES) :
//   TWGRoles.setGradeForEmail('quelquun@exemple.com', null);
(function () {
  const GRADES_KEY = 'twg_grades_by_email'; // { emailLower: 'admin' | 'super-admin' }
  const VALID_GRADES = ['super-admin', 'admin'];

  // Grades attribués en dur dans le code (valables sur n'importe quel
  // navigateur/appareil, sans commande manuelle). Prioritaires sur le
  // stockage local. Ajoutez/retirez des lignes ici pour gérer ces comptes.
  const SEED_GRADES = {
    'lucas.masure@gmail.com': 'super-admin'
  };

  function normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
  }

  function loadGrades() {
    try {
      const raw = localStorage.getItem(GRADES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      return (map && typeof map === 'object') ? map : {};
    } catch (e) { return {}; }
  }

  function saveGrades(map) {
    try { localStorage.setItem(GRADES_KEY, JSON.stringify(map)); }
    catch (e) { /* stockage indisponible */ }
  }

  function getGradeForEmail(email) {
    const key = normalizeEmail(email);
    if (!key) return null;
    if (SEED_GRADES[key]) return SEED_GRADES[key];
    const map = loadGrades();
    return map[key] || null; // null = aucun grade particulier
  }

  function setGradeForEmail(email, grade) {
    const key = normalizeEmail(email);
    if (!key) return false;
    if (grade !== null && VALID_GRADES.indexOf(grade) === -1) {
      console.warn('Grade invalide. Valeurs acceptées :', VALID_GRADES.join(', '), 'ou null.');
      return false;
    }
    if (SEED_GRADES[key]) {
      console.warn('Cette adresse a un grade défini en dur dans roles.js (SEED_GRADES) ; modifiez le fichier pour la changer.');
      return false;
    }
    const map = loadGrades();
    if (grade === null) delete map[key];
    else map[key] = grade;
    saveGrades(map);
    updateGradeBadge();
    return true;
  }

  function getCurrentEmail() {
    if (window.TWGAuth && typeof window.TWGAuth.getEmail === 'function') {
      return window.TWGAuth.getEmail();
    }
    try { return localStorage.getItem('twg_email'); } catch (e) { return null; }
  }

  function getCurrentGrade() {
    return getGradeForEmail(getCurrentEmail());
  }

  function isStaff() {
    const grade = getCurrentGrade();
    return grade === 'admin' || grade === 'super-admin';
  }

  function getAllGrades() {
    const result = {};
    Object.keys(SEED_GRADES).forEach(function (email) {
      result[email] = { grade: SEED_GRADES[email], hardcoded: true };
    });
    const stored = loadGrades();
    Object.keys(stored).forEach(function (email) {
      if (!result[email]) result[email] = { grade: stored[email], hardcoded: false };
    });
    return result; // { emailLower: { grade, hardcoded } }
  }

  function updateGradeBadge() {
    const el = document.getElementById('user-grade-display');
    if (!el) return;
    const grade = getCurrentGrade();
    if (grade) {
      el.textContent = grade;
      el.className = 'grade-badge grade-' + grade;
      el.style.display = 'inline-flex';
    } else {
      el.style.display = 'none';
      el.textContent = '';
    }
  }

  function updateStaffButton() {
    const btn = document.getElementById('staff-fab');
    if (!btn) return;
    btn.style.display = isStaff() ? 'inline-flex' : 'none';
  }

  function refreshRoleUI() {
    updateGradeBadge();
    updateStaffButton();
  }

  window.TWGRoles = {
    VALID_GRADES: VALID_GRADES,
    getGradeForEmail: getGradeForEmail,
    setGradeForEmail: setGradeForEmail,
    getAllGrades: getAllGrades,
    getCurrentGrade: getCurrentGrade,
    isStaff: isStaff,
    updateGradeBadge: updateGradeBadge,
    updateStaffButton: updateStaffButton,
    refreshRoleUI: refreshRoleUI
  };

  document.addEventListener('DOMContentLoaded', function () {
    refreshRoleUI();

    // Réaffiche le badge et le bouton Staff après connexion / déconnexion.
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', function () { setTimeout(refreshRoleUI, 0); });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', function () { setTimeout(refreshRoleUI, 0); });
  });
})();
