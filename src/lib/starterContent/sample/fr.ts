import type { SampleText } from '../types';

const text: SampleText = {
  workspaceName: (userName) => `Espace de travail de ${userName}`,
  personalWorkspace: 'Espace de travail personnel',
  demoWorkspace: 'Espace de démonstration',
  demoUserName: 'Utilisateur de démo',
  agentTokenName: 'Agent IA Claude',

  startHere: {
    title: 'Commencez ici',
    content: `### Bonjour à tous !

Pour montrer comment **Remnus nous aide** à garder la main sur un projet construit avec des agents IA, je développe un *clone simple de Microsoft Paint comme projet d’exemple*.

Tout ce que vous voyez ici a été assemblé par *Claude Code* et *Remnus*, côte à côte !

<div data-yt-id="OVi9pjY_p84"></div>

**Regardez la vidéo pour voir comment cet espace de travail a été créé !**

<div data-callout-icon="⚡" data-callout-color="blue" data-callout-text="Chaque ligne du Suivi du sprint qui porte un badge d’agent a été écrite par un vrai agent IA via MCP. Ouvrez le panneau Agents IA (en bas à gauche) pour voir le journal d’activité en direct."></div>

### Ce que l’agent IA a réellement fait

Voici la trace de la vraie session qui a construit cet espace de travail, tirée directement du journal d’audit des agents de Remnus :

| Quand | Action | Ce qui s’est passé |
|-------|--------|--------------------|
| Connexion | \`list_workspace\` | L’agent a parcouru l’espace de travail pour s’orienter |
| Planification | \`create_page\` | Il a rédigé la **Spécification produit** du clone de Paint |
| Mise en place | \`create_database\` | Il a créé le **Suivi du sprint** à partir de la spécification |
| Backlog | \`create_page\` ×16 | Il a généré chaque tâche avec ses propres critères d’acceptation |
| Développement | \`update_page\` | Il a passé les tâches *structure*, *pinceau* et *gomme* à **Terminé** au fil des livraisons |
| Revue | \`query_database\` | Il a relu le tableau pour choisir la tâche suivante |
| En cours | \`update_page\` | Il a déplacé l’*outil ligne* vers **En cours** |

Vous voulez toute l’histoire par écrit ? Ouvrez la page ci-dessous 👇

{{HOW_BUILT_CB}}
`,
  },

  howBuilt: {
    title: 'Comment cet espace a été construit',
    content: `Cet espace de travail n’a pas été rempli à la main. Un agent IA (**Claude Code**) s’est connecté à Remnus via **MCP** et a tout construit : la spécification, le tableau des tâches et le suivi de l’avancement, pendant qu’une personne regardait tout se faire en temps réel.

Cette page accompagne par écrit la vidéo de **Commencez ici** : la même histoire, à lire à votre rythme.

## Le déroulé

1. **Se connecter :** l’agent s’est authentifié auprès de cet espace de travail avec un jeton MCP et a appelé \`list_workspace\` pour voir ce qui s’y trouvait déjà.
2. **Planifier :** il a écrit une **Spécification produit** pour un clone de Paint qui tourne dans le navigateur (vous pouvez l’ouvrir depuis la barre latérale).
3. **Découper :** à partir de cette spécification, il a créé la base de données **Suivi du sprint** et généré **16 tâches**, chacune avec ses critères d’acceptation et ses notes.
4. **Construire et suivre :** au fil de l’implémentation, il a fait avancer les tâches sur le tableau (\`Backlog → En cours → Terminé\`) et a consigné son travail réel dans la page de chaque tâche.
5. **Rester synchronisé :** une personne peut intervenir à tout moment et tout modifier ; l’agent découvre le nouvel état à sa requête suivante. Pas de copier-coller, pas de contexte perdu.

## Comment lire les signaux

Remnus rend le travail de l’agent **visible et vérifiable**. C’est ce qu’on ne voit pas dans les autres outils :

<div data-callout-icon="⚡" data-callout-color="blue" data-callout-text="Le badge d’agent sur une ligne signifie qu’un agent IA l’a modifiée en dernier. Survolez-le pour voir quel jeton a fait la modification, et quand."></div>

- **Le badge d’agent ⚡ :** chaque ligne du Suivi du sprint touchée par un agent est marquée. Vous savez toujours ce qui a été écrit par une personne et ce qui a été écrit par une machine.
- **Le panneau Agents IA :** cliquez sur **Agents IA** en bas à gauche de la barre latérale. Vous y voyez chaque jeton, sa portée et un journal en direct des derniers appels d’outils (\`create_page\`, \`update_page\`, \`query_database\`…).

## Essayez vous-même

Vous pouvez brancher votre propre agent IA sur votre propre espace de travail en moins d’une minute :

1. Ouvrez **Paramètres de l’espace → MCP** et créez un jeton MCP (portée lecture ou écriture).
2. Ajoutez Remnus comme serveur MCP dans votre client (Cursor, VS Code ou Claude). Le point de terminaison et l’en-tête d’authentification s’affichent dès la création du jeton, et des boutons d’installation en un clic sont aussi proposés.
3. Demandez à votre agent de planifier un projet, de remplir une base de données ou de résumer une page. Chacune de ses actions apparaît dans le journal d’audit, marquée et réversible.

<div data-callout-icon="🔒" data-callout-color="green" data-callout-text="Vous gardez le contrôle : les jetons ont une portée, chaque écriture est journalisée et vous pouvez révoquer l’accès à tout moment."></div>

C’est toute l’idée de Remnus. Vos agents IA disposent d’un vrai espace de travail, et vous gardez une vue complète sur tout ce qu’ils font.
`,
  },

  productSpec: {
    title: 'Spécification produit',
    content: `# Spécification produit : clone de Paint

Une application de dessin minimale qui tourne dans le navigateur. Aucune dépendance, aucun compte, rien à installer.

## Fonctionnalités du MVP

### Toile et dessin

- Outil pinceau / crayon à main levée
- Taille du pinceau réglable
- Outil gomme
- Pot de peinture (remplissage par diffusion)
- Bouton pour effacer la toile

### Couleur

- Sélecteur de couleur (\`<input type="color">\` natif)
- Palette de couleurs prédéfinies
- Aperçu de la couleur actuelle

### Formes

- Outil ligne
- Outil rectangle (contour + plein)
- Outil cercle / ellipse (contour + plein)

### Fichier

- Enregistrer la toile en PNG (téléchargement)
- Charger / ouvrir un fichier image sur la toile

### Interface

- Barre d’outils avec des icônes
- Raccourcis clavier pour les outils courants (B = pinceau, E = gomme, F = remplissage, etc.)
- Annuler (un seul niveau ou plusieurs étapes via une pile d’historique)

## Hors périmètre (v1)

- Calques
- Outil texte
- Sauvegarde dans le cloud
- Collaboration

`,
  },

  sprintBoard: {
    name: 'Suivi du sprint',
    columns: { title: 'Titre', status: 'Statut', priority: 'Priorité', category: 'Catégorie' },
    status: { backlog: 'Backlog', inProgress: 'En cours', done: 'Terminé' },
    priority: { high: 'Haute', medium: 'Moyenne', low: 'Basse' },
    category: { canvas: 'Toile', color: 'Couleur', shapes: 'Formes', file: 'Fichier', ui: 'Interface' },
    views: { board: 'Kanban', table: 'Tableau' },
  },

  tasks: {
    scaffold: {
      title: 'Mettre en place la structure du projet',
      content: `# Mettre en place la structure du projet

Créer la structure HTML/CSS/JS de base du clone de Paint. Ni framework ni outil de build, uniquement des fichiers simples.

## Tâches
- [x] Créer \`index.html\` avec l’élément \`<canvas>\` et un emplacement pour la barre d’outils
- [x] Créer \`style.css\` (reset, mise en page barre latérale + zone de la toile, thème de base)
- [x] Créer \`main.js\` (point d’entrée, initialisation du contexte de la toile)
- [x] Vérifier que la toile occupe l’espace disponible et se redimensionne correctement

## Critères d’acceptation
- Ouvrir \`index.html\` dans un navigateur affiche une toile vierge et une barre d’outils vide ✅
- Aucune erreur dans la console au chargement ✅

## Résultat

### Fichiers créés
- \`index.html\` : squelette avec \`<aside id="toolbar">\` + \`<canvas id="canvas">\` dans \`<main id="canvas-area">\`
- \`style.css\` : reset CSS, mise en page flex (barre latérale de 56px + zone de la toile qui occupe le reste), toile blanche entourée d’un cadre sombre
- \`main.js\` : initialisation du contexte de la toile, \`resizeCanvas()\` qui remplit la zone disponible et conserve le dessin quand la fenêtre est redimensionnée grâce à \`getImageData\`/\`putImageData\`

### Notes
- La toile prend la taille de la zone disponible moins 32px de marge sur chaque axe, recalculée à chaque \`window.resize\`
- Un fond blanc est peint à chaque redimensionnement : le PNG enregistré ne sera jamais transparent
- La barre d’outils est un \`<aside>\` vertical prêt à recevoir les boutons ajoutés par les tâches suivantes
`,
    },
    brush: {
      title: 'Créer le pinceau / crayon à main levée',
      content: `# Créer le pinceau / crayon à main levée

Permettre à l’utilisateur de dessiner des traits à main levée sur la toile, à la souris ou au doigt.

## Tâches
- [x] Suivre les événements \`mousedown\`, \`mousemove\` et \`mouseup\` sur la toile
- [x] Utiliser \`ctx.beginPath()\` / \`ctx.lineTo()\` / \`ctx.stroke()\` pour tracer des traits fluides
- [x] Appliquer la couleur et la taille de pinceau actuelles aux traits
- [x] Empêcher le dessin quand le bouton de la souris n’est pas enfoncé

## Critères d’acceptation
- Cliquer-glisser trace un trait continu ✅
- La couleur et la taille du trait correspondent aux valeurs choisies ✅
- Relâcher la souris arrête le dessin ✅

## Résultat

### Modifications de \`main.js\`
- Ajout d’un objet \`state\` qui suit \`tool\`, \`color\`, \`size\`, \`isDrawing\`, \`lastX\` et \`lastY\`
- \`getPos(e)\` : normalise les coordonnées de la souris et du toucher par rapport aux limites de la toile
- \`applyBrushStyle()\` : règle \`strokeStyle\`, \`lineWidth\`, \`lineCap\`, \`lineJoin\` et \`globalCompositeOperation\` avant chaque trait
- \`onPointerDown\` : enregistre la position de départ et dessine un point pour un simple clic
- \`onPointerMove\` : trace à chaque image un segment entre la dernière position et la position actuelle
- \`onPointerUp\` / \`mouseleave\` : arrête le dessin
- Événements tactiles (\`touchstart\`, \`touchmove\`, \`touchend\`) branchés à côté de ceux de la souris, avec \`passive: false\` pour autoriser \`preventDefault\`
`,
    },
    eraser: {
      title: 'Créer la gomme',
      content: `# Créer la gomme

Permettre à l’utilisateur d’effacer des parties de la toile en dessinant avec la couleur de fond.

## Tâches
- [x] Ajouter la gomme à la barre d’outils
- [x] Quand la gomme est active, régler \`ctx.globalCompositeOperation = 'destination-out'\`
- [x] Utiliser la taille de pinceau actuelle comme largeur de la gomme
- [x] Rétablir l’opération de composition au retour au pinceau

## Critères d’acceptation
- La gomme efface le dessin en glissant ✅
- La taille de la gomme suit le curseur de taille du pinceau ✅
- Changer d’outil rétablit le dessin normal ✅

## Résultat

### Modifications de \`main.js\`
- \`applyBrushStyle()\` distingue désormais \`state.tool === 'eraser'\` : règle \`globalCompositeOperation = 'destination-out'\` et utilise un trait noir opaque (efface les pixels du canal alpha)
- Le point de \`onPointerDown\` applique aussi \`destination-out\` pendant l’effacement, puis rétablit l’opération de composition après le remplissage
- La gomme partage \`state.size\` avec le pinceau, pas besoin d’une taille à part
- Passer à n’importe quel outil autre que la gomme rétablit automatiquement \`source-over\` au trait suivant, via \`applyBrushStyle()\`
`,
    },
    brushSize: {
      title: 'Créer la taille de pinceau réglable',
      content: `# Créer la taille de pinceau réglable

Proposer un curseur ou un champ qui règle la largeur du trait et de la gomme.

## Tâches
- [ ] Ajouter \`<input type="range">\` à la barre d’outils (min 1, max 64)
- [ ] Afficher la taille actuelle à côté du curseur
- [ ] Appliquer la taille choisie à \`ctx.lineWidth\` avant chaque trait
- [ ] Taille par défaut : 4px

## Critères d’acceptation
- Déplacer le curseur change immédiatement la largeur du pinceau
- Le pinceau et la gomme respectent tous deux la taille actuelle
`,
    },
    fill: {
      title: 'Créer le remplissage (pot de peinture)',
      content: `# Créer le remplissage (pot de peinture)

Au clic, remplir une zone continue de la toile avec la couleur actuelle.

## Tâches
- [ ] Lire les pixels avec \`ctx.getImageData()\`
- [ ] Implémenter un algorithme itératif de remplissage BFS/DFS qui part du pixel cliqué
- [ ] Réécrire les pixels remplis avec \`ctx.putImageData()\`
- [ ] Ajouter un seuil de tolérance (par ex. ±15) pour les bords anticrénelés

## Critères d’acceptation
- Cliquer dans une zone fermée la remplit avec la couleur actuelle
- Le remplissage ne déborde pas au-delà des bords nets
- Les performances restent acceptables pour les tailles de toile courantes (≤1920×1080)
`,
    },
    clear: {
      title: 'Créer le bouton pour effacer la toile',
      content: `# Créer le bouton pour effacer la toile

Remettre toute la toile à blanc.

## Tâches
- [ ] Ajouter un bouton « Effacer » à la barre d’outils
- [ ] Au clic, appeler \`ctx.clearRect(0, 0, canvas.width, canvas.height)\` puis remplir de blanc
- [ ] Enregistrer un instantané dans l’historique avant d’effacer, pour pouvoir annuler

## Critères d’acceptation
- Cliquer sur Effacer supprime tout le dessin
- L’action peut être annulée avec Annuler
`,
    },
    colorPicker: {
      title: 'Créer le sélecteur de couleur',
      content: `# Créer le sélecteur de couleur

Permettre à l’utilisateur de choisir n’importe quelle couleur de dessin avec le sélecteur natif du navigateur.

## Tâches
- [ ] Ajouter \`<input type="color">\` à la barre d’outils
- [ ] Stocker la couleur choisie dans une variable d’état globale \`currentColor\`
- [ ] Mettre à jour \`ctx.strokeStyle\` et \`ctx.fillStyle\` à chaque changement de couleur
- [ ] Couleur par défaut : \`#000000\`

## Critères d’acceptation
- Ouvrir le sélecteur affiche le sélecteur de couleur du système
- Choisir une couleur s’applique immédiatement aux traits et remplissages suivants
`,
    },
    palette: {
      title: 'Créer la palette de couleurs prédéfinies',
      content: `# Créer la palette de couleurs prédéfinies

Afficher une rangée de pastilles de couleurs prédéfinies pour choisir rapidement.

## Tâches
- [ ] Définir une liste d’environ 16 couleurs de peinture classiques (noir, blanc, rouge, vert, bleu, jaune, etc.)
- [ ] Afficher chacune comme une petite pastille \`<div>\` cliquable dans la barre d’outils
- [ ] Au clic, régler \`currentColor\` et synchroniser la valeur du sélecteur de couleur
- [ ] Mettre en évidence la pastille active avec une bordure ou un anneau

## Critères d’acceptation
- Cliquer sur une pastille change immédiatement la couleur active
- Le sélecteur de couleur affiche la couleur de la pastille choisie
- La pastille active est visiblement repérable
`,
    },
    line: {
      title: 'Créer l’outil ligne',
      content: `# Créer l’outil ligne

Permettre à l’utilisateur de tracer une ligne droite entre deux points.

## Tâches
- [ ] Sur \`mousedown\`, enregistrer le point de départ et un instantané de la toile
- [ ] Sur \`mousemove\`, restaurer l’instantané puis tracer une ligne d’aperçu jusqu’au curseur
- [ ] Sur \`mouseup\`, fixer la ligne finale sur la toile
- [ ] Maintenir Maj pour limiter l’angle à des pas de 45°

## Critères d’acceptation
- Glisser trace une ligne droite avec aperçu en direct
- Relâcher la souris fixe la ligne définitivement
- Maj limite l’angle
`,
    },
    rect: {
      title: 'Créer l’outil rectangle',
      content: `# Créer l’outil rectangle

Dessiner des rectangles en contour ou pleins par cliquer-glisser.

## Tâches
- [ ] Sur \`mousedown\`, enregistrer l’origine et un instantané de la toile
- [ ] Sur \`mousemove\`, restaurer l’instantané et dessiner le rectangle d’aperçu
- [ ] Sur \`mouseup\`, fixer le rectangle
- [ ] Basculer entre contour (\`ctx.strokeRect\`) et plein (\`ctx.fillRect\`) via une option de la barre d’outils
- [ ] Maintenir Maj pour le limiter à un carré

## Critères d’acceptation
- Glisser dessine un aperçu du rectangle en direct
- La bascule contour / plein fonctionne
- Maj le limite à un carré
`,
    },
    ellipse: {
      title: 'Créer l’outil cercle / ellipse',
      content: `# Créer l’outil cercle / ellipse

Dessiner des ellipses en contour ou pleines par cliquer-glisser.

## Tâches
- [ ] Sur \`mousedown\`, enregistrer l’origine et un instantané de la toile
- [ ] Sur \`mousemove\`, restaurer l’instantané et dessiner l’ellipse d’aperçu avec \`ctx.ellipse()\`
- [ ] Sur \`mouseup\`, fixer l’ellipse
- [ ] Réutiliser la bascule contour/plein de l’outil rectangle
- [ ] Maintenir Maj pour la limiter à un cercle parfait

## Critères d’acceptation
- Glisser dessine un aperçu de l’ellipse en direct
- La bascule contour / plein fonctionne
- Maj la limite à un cercle
`,
    },
    save: {
      title: 'Créer l’enregistrement en PNG',
      content: `# Créer l’enregistrement en PNG

Permettre à l’utilisateur de télécharger la toile actuelle sous forme de fichier PNG.

## Tâches
- [ ] Ajouter un bouton « Enregistrer » à la barre d’outils
- [ ] Au clic, appeler \`canvas.toDataURL('image/png')\`
- [ ] Déclencher le téléchargement par programme via un élément \`<a download>\` temporaire
- [ ] Nom de fichier par défaut : \`painting.png\`

## Critères d’acceptation
- Cliquer sur Enregistrer télécharge un PNG identique au contenu de la toile
- Le fond blanc est conservé (la toile n’est pas transparente)
`,
    },
    open: {
      title: 'Créer l’ouverture / le chargement d’image',
      content: `# Créer l’ouverture / le chargement d’image

Permettre à l’utilisateur d’ouvrir un fichier image local et de le dessiner sur la toile.

## Tâches
- [ ] Ajouter un bouton « Ouvrir » qui déclenche un \`<input type="file" accept="image/*">\` caché
- [ ] Lire le fichier choisi avec \`FileReader.readAsDataURL()\`
- [ ] Dessiner l’image chargée sur la toile avec \`ctx.drawImage()\`, mise à l’échelle pour tenir
- [ ] Enregistrer un instantané dans l’historique avant de dessiner, pour pouvoir annuler

## Critères d’acceptation
- Ouvrir une image l’affiche sur la toile
- L’image est mise à l’échelle proportionnellement pour tenir dans la toile
- L’action peut être annulée
`,
    },
    undo: {
      title: 'Créer l’historique d’annulation',
      content: `# Créer l’historique d’annulation

Permettre à l’utilisateur de revenir pas à pas aux états précédents de la toile.

## Tâches
- [ ] Tenir une liste \`history\` d’instantanés \`ImageData\` (50 entrées au maximum)
- [ ] Enregistrer un instantané avant chaque opération de dessin validée
- [ ] À l’annulation (\`Ctrl+Z\`), retirer le dernier instantané et le restaurer avec \`ctx.putImageData()\`
- [ ] Ajouter un bouton Annuler à la barre d’outils pour qui n’utilise pas le clavier
- [ ] Désactiver le bouton Annuler quand l’historique est vide

## Critères d’acceptation
- \`Ctrl+Z\` revient en arrière d’une opération à la fois
- Jusqu’à 50 étapes d’historique sont disponibles
- Le bouton Annuler apparaît désactivé quand il n’y a rien à annuler
`,
    },
    toolbar: {
      title: 'Créer la barre d’outils et ses icônes',
      content: `# Créer la barre d’outils et ses icônes

Construire la barre latérale qui regroupe tous les boutons et réglages des outils.

## Tâches
- [ ] Concevoir en CSS une barre d’outils verticale à gauche
- [ ] Ajouter des boutons avec icône pour : Pinceau, Gomme, Remplissage, Ligne, Rectangle, Ellipse, Ouvrir, Enregistrer, Annuler, Effacer
- [ ] Utiliser des symboles Unicode ou de simples icônes SVG (pas de bibliothèque d’icônes externe)
- [ ] Mettre en évidence le bouton de l’outil actif avec un style sélectionné
- [ ] Ajouter une info-bulle à chaque bouton (attribut \`title\`)

## Critères d’acceptation
- Tous les outils sont accessibles depuis la barre d’outils
- L’outil actif est clairement mis en évidence
- La barre d’outils est lisible en 1080p et ne déborde pas sur les petits écrans
`,
    },
    shortcuts: {
      title: 'Créer les raccourcis clavier',
      content: `# Créer les raccourcis clavier

Brancher des raccourcis clavier pour changer vite d’outil et pour les actions courantes.

## Liste des raccourcis
| Touche | Action |
|--------|--------|
| B | Pinceau |
| E | Gomme |
| F | Remplissage (pot) |
| L | Ligne |
| R | Rectangle |
| C | Cercle / ellipse |
| Ctrl+Z | Annuler |
| Ctrl+S | Enregistrer en PNG |
| Suppr | Effacer la toile |

## Tâches
- [ ] Ajouter un écouteur \`keydown\` sur \`document\`
- [ ] Diriger vers le bon outil ou la bonne action selon \`event.key\`
- [ ] Protéger les combinaisons \`Ctrl+\` avec \`event.ctrlKey\` / \`event.metaKey\`
- [ ] Ne pas déclencher les raccourcis quand le focus est dans un champ de saisie

## Critères d’acceptation
- Chaque raccourci active le bon outil ou la bonne action
- Les raccourcis n’entrent pas en conflit avec ceux du navigateur (sauf Ctrl+S, volontairement remplacé)
`,
    },
  },
};

export default text;
