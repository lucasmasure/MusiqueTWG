// ─── MUSIQUES HÉBERGÉES SUR GITHUB (Musique TWG) ────────────────────────
// Ce fichier liste les musiques dont le MP3 est réellement placé dans ce
// dépôt GitHub (pas dans le navigateur des visiteurs). Elles apparaissent
// automatiquement sur "Liste des musiques" et "Musiques globales", avec un
// vrai lien .mp3 permanent (utilisable par "Copier le lien" et partageable
// avec n'importe qui, contrairement aux musiques ajoutées via le
// formulaire qui restent locales à chaque navigateur).
//
// ─── COMMENT AJOUTER UNE MUSIQUE ICI (aucun jeton, aucune programmation) ─
// 1. Sur GitHub.com, ouvrez ce dépôt, puis le dossier "musiques/"
//    (créez-le s'il n'existe pas encore : bouton "Add file" → "Create new
//    file", tapez "musiques/votre-fichier.mp3" comme nom).
// 2. Glissez votre fichier .mp3 dans ce dossier via "Add file" → "Upload
//    files", puis validez ("Commit changes").
// 3. Ajoutez une entrée ci-dessous dans HOSTED_TRACKS, avec le même nom de
//    fichier que celui envoyé à l'étape 2.
// 4. Validez ("Commit changes") — GitHub Pages republie le site tout seul
//    en général en 1 à 2 minutes, sans rien faire d'autre.
//
// Chaque entrée :
//   name     : le nom affiché de la musique
//   category : la catégorie (laissez '' pour "Sans catégorie")
//   file     : le chemin du fichier dans le dépôt, tel qu'envoyé à l'étape 2
//   addedBy  : (optionnel) le nom affiché comme "Ajoutée par ..."
window.TWG_HOSTED_TRACKS = [
  // Exemple — à adapter ou supprimer :
  // {
  //   name: 'Titre de la musique',
  //   category: 'Exemple',
  //   file: 'musiques/titre-de-la-musique.mp3',
  //   addedBy: 'Équipe TWG'
  // }
];
