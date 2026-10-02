import type { TemplateText } from '../types';

const text: TemplateText = {
  locale: 'fr',
  stock: {
    title: 'Titre',
    status: 'Statut',
    id: 'ID',
    todo: 'À faire',
    inProgress: 'En cours',
    done: 'Terminé',
  },
  views: { table: 'Tableau', board: 'Kanban', calendar: 'Calendrier' },

  meetingNotes: `## Participants

- Sarah Chen (cheffe de produit)
- Marcus Johnson (responsable technique)
- Aisha Patel (designer)

## Ordre du jour

1. Bilan du sprint et vélocité
2. Priorités de la feuille de route du prochain trimestre
3. Évolutions du design system

## Notes

Le sprint s’est bien passé dans l’ensemble. La vélocité a été légèrement supérieure à l’estimation. Le nouveau parcours de connexion est en ligne et fonctionne comme prévu.

Priorités du prochain trimestre : améliorer l’onboarding et l’affichage sur mobile. Le marketing a besoin du nouveau tableau de bord d’ici la fin du mois prochain.

Design system : Aisha partagera la bibliothèque de composants mise à jour la semaine prochaine.

## Actions

- [ ] Marcus : mettre en place l’environnement de préproduction d’ici vendredi
- [ ] Aisha : partager le brouillon du design system v2 d’ici mardi prochain
- [ ] Sarah : envoyer le brouillon de la feuille de route du prochain trimestre à l’équipe pour relecture
`,

  projectBrief: `## Présentation

Un tableau de bord analytique de nouvelle génération qui aide les équipes à suivre leurs indicateurs clés en temps réel. L’objectif est de remplacer le reporting actuel, fait de tableurs, par une solution centralisée et automatisée.

## Objectifs

- Réduire de 80 % le temps passé sur le reporting manuel
- Rendre les KPI de l’équipe visibles en temps réel
- Permettre l’export des données en PDF et en CSV

## Calendrier

| Étape | Date |
|-------|------|
| Lancement du projet | {{kickoff}} |
| Design terminé | {{designDone}} |
| Version bêta | {{beta}} |
| Mise en ligne | {{launch}} |

## Équipe

- Produit : Sarah Chen
- Développement : Marcus Johnson, Kai Rivera
- Design : Aisha Patel
`,

  taskTracker: {
    columns: { priority: 'Priorité', assignee: 'Responsable', dueDate: 'Échéance' },
    status: { backlog: 'Backlog', inProgress: 'En cours', review: 'En revue', done: 'Terminé' },
    priority: { low: 'Basse', medium: 'Moyenne', high: 'Haute' },
    rows: {
      landing: 'Concevoir les maquettes de la page d’accueil',
      ci: 'Mettre en place le pipeline CI/CD',
      tests: 'Écrire les tests unitaires du module d’authentification',
      review: 'Revue de code de la branche feature/payments',
      docs: 'Mettre à jour la documentation de l’API',
      staging: 'Déployer en préproduction',
      loginBug: 'Corriger le bug de redirection à la connexion',
    },
  },

  eventCalendar: {
    columns: { eventDate: 'Date de l’événement', category: 'Catégorie', notes: 'Notes' },
    category: { meeting: 'Réunion', conference: 'Conférence', deadline: 'Échéance', personal: 'Personnel' },
    rows: {
      standup: { title: 'Point d’équipe hebdomadaire', notes: 'Tous les lundis' },
      planning: { title: 'Planification du sprint', notes: 'Lancement du sprint 14' },
      productReview: { title: 'Revue produit trimestrielle', notes: 'Passer en revue la feuille de route avec les parties prenantes' },
      mvp: { title: 'Échéance du MVP', notes: 'Toutes les fonctionnalités doivent être fusionnées dans main' },
      summit: { title: 'Frontend Summit', notes: 'En ligne — inscription sur frontendsummit.io' },
      handoff: { title: 'Livraison du design system', notes: 'Aisha livre les composants v2' },
      offsite: { title: 'Séminaire d’équipe', notes: 'Istanbul — 2 nuits' },
    },
  },

  readingList: {
    columns: { rating: 'Note', genre: 'Genre', author: 'Auteur' },
    status: { wantToRead: 'À lire', reading: 'En cours de lecture', done: 'Lu' },
    genre: { fiction: 'Fiction', nonFiction: 'Essai', tech: 'Tech', science: 'Sciences' },
    books: {
      pragmatic: 'The Pragmatic Programmer',
      dune: 'Dune',
      sapiens: 'Sapiens : Une brève histoire de l’humanité',
      cleanCode: 'Coder proprement',
      threeBody: 'Le Problème à trois corps',
      briefHistory: 'Une brève histoire du temps',
      thinking: 'Système 1 / Système 2 : Les deux vitesses de la pensée',
    },
  },

  agentMemory: {
    columns: { type: 'Type', tags: 'Étiquettes', date: 'Date' },
    type: { decision: 'Décision', preference: 'Préférence', gotcha: 'Piège', fact: 'Fait' },
    tags: { architecture: 'architecture', conventions: 'conventions', api: 'api', database: 'base de données', infra: 'infra' },
    byType: 'Par type',
    rows: {
      postgres: 'Utiliser PostgreSQL comme base de données principale',
      functional: 'Préférer les composants React fonctionnels aux composants de classe',
      rateLimit: 'L’API de préproduction est limitée à 100 requêtes/min : regrouper les écritures',
      tokens: 'Les design tokens sont dans tokens.css, pas dans la configuration Tailwind',
    },
  },
};

export default text;
