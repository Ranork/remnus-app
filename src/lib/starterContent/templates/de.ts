import type { TemplateText } from '../types';

const text: TemplateText = {
  locale: 'de',
  stock: {
    title: 'Titel',
    status: 'Status',
    id: 'ID',
    todo: 'Zu erledigen',
    inProgress: 'In Arbeit',
    done: 'Erledigt',
  },
  views: { table: 'Tabelle', board: 'Board', calendar: 'Kalender' },

  meetingNotes: `## Teilnehmende

- Sarah Chen (Produktmanagerin)
- Marcus Johnson (Engineering Lead)
- Aisha Patel (Designerin)

## Tagesordnung

1. Sprint-Review und Velocity-Check
2. Prioritäten der Roadmap für das nächste Quartal
3. Neuerungen im Designsystem

## Notizen

Der Sprint lief insgesamt gut. Die Velocity lag leicht über der Schätzung. Der neue Login-Ablauf ist live und läuft wie erwartet.

Prioritäten für das nächste Quartal: Fokus auf ein besseres Onboarding und die mobile Darstellung. Das Marketing braucht das neue Dashboard bis Ende nächsten Monats.

Designsystem: Aisha teilt nächste Woche die aktualisierte Komponentenbibliothek.

## Aufgaben

- [ ] Marcus: Staging-Umgebung bis Freitag einrichten
- [ ] Aisha: Entwurf des Designsystems v2 bis nächsten Dienstag teilen
- [ ] Sarah: Entwurf der Roadmap für das nächste Quartal zur Durchsicht ans Team schicken
`,

  projectBrief: `## Überblick

Ein Analyse-Dashboard der nächsten Generation, mit dem Teams ihre wichtigsten Kennzahlen in Echtzeit verfolgen. Ziel ist, das heutige Reporting in Tabellenkalkulationen durch eine zentrale, automatisierte Lösung zu ersetzen.

## Ziele

- Zeit für manuelles Reporting um 80 % senken
- Team-KPIs in Echtzeit sichtbar machen
- Datenexport als PDF und CSV ermöglichen

## Zeitplan

| Meilenstein | Datum |
|-------------|-------|
| Kick-off | {{kickoff}} |
| Design fertig | {{designDone}} |
| Beta-Release | {{beta}} |
| Launch | {{launch}} |

## Team

- Produkt: Sarah Chen
- Entwicklung: Marcus Johnson, Kai Rivera
- Design: Aisha Patel
`,

  taskTracker: {
    columns: { priority: 'Priorität', assignee: 'Zuständig', dueDate: 'Fällig am' },
    status: { backlog: 'Backlog', inProgress: 'In Arbeit', review: 'Im Review', done: 'Erledigt' },
    priority: { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' },
    rows: {
      landing: 'Entwürfe für die Landingpage gestalten',
      ci: 'CI/CD-Pipeline einrichten',
      tests: 'Unit-Tests für das Auth-Modul schreiben',
      review: 'Code-Review für den Branch feature/payments',
      docs: 'API-Dokumentation aktualisieren',
      staging: 'Auf die Staging-Umgebung deployen',
      loginBug: 'Weiterleitungsfehler nach dem Login beheben',
    },
  },

  eventCalendar: {
    columns: { eventDate: 'Datum', category: 'Kategorie', notes: 'Notizen' },
    category: { meeting: 'Besprechung', conference: 'Konferenz', deadline: 'Frist', personal: 'Privat' },
    rows: {
      standup: { title: 'Wöchentliches Team-Stand-up', notes: 'Jeden Montag' },
      planning: { title: 'Sprintplanung', notes: 'Start von Sprint 14' },
      productReview: { title: 'Vierteljährliches Produkt-Review', notes: 'Roadmap mit den Stakeholdern durchgehen' },
      mvp: { title: 'Frist für das MVP', notes: 'Alle Features müssen in main gemergt sein' },
      summit: { title: 'Frontend Summit', notes: 'Online — Anmeldung unter frontendsummit.io' },
      handoff: { title: 'Übergabe des Designsystems', notes: 'Aisha liefert die v2-Komponenten' },
      offsite: { title: 'Team-Offsite', notes: 'Istanbul — 2 Nächte' },
    },
  },

  readingList: {
    columns: { rating: 'Bewertung', genre: 'Genre', author: 'Autor' },
    status: { wantToRead: 'Möchte ich lesen', reading: 'Lese ich gerade', done: 'Gelesen' },
    genre: { fiction: 'Belletristik', nonFiction: 'Sachbuch', tech: 'Technik', science: 'Wissenschaft' },
    books: {
      pragmatic: 'Der pragmatische Programmierer',
      dune: 'Der Wüstenplanet',
      sapiens: 'Eine kurze Geschichte der Menschheit',
      cleanCode: 'Clean Code',
      threeBody: 'Die drei Sonnen',
      briefHistory: 'Eine kurze Geschichte der Zeit',
      thinking: 'Schnelles Denken, langsames Denken',
    },
  },

  agentMemory: {
    columns: { type: 'Typ', tags: 'Tags', date: 'Datum' },
    type: { decision: 'Entscheidung', preference: 'Vorliebe', gotcha: 'Stolperfalle', fact: 'Fakt' },
    tags: { architecture: 'architektur', conventions: 'konventionen', api: 'api', database: 'datenbank', infra: 'infrastruktur' },
    byType: 'Nach Typ',
    rows: {
      postgres: 'PostgreSQL als primären Datenspeicher verwenden',
      functional: 'Funktionale React-Komponenten statt Klassenkomponenten bevorzugen',
      rateLimit: 'Die Staging-API ist auf 100 Anfragen/Min. begrenzt – Schreibvorgänge bündeln',
      tokens: 'Design-Tokens liegen in tokens.css, nicht in der Tailwind-Konfiguration',
    },
  },
};

export default text;
