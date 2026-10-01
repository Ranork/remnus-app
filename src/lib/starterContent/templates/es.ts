import type { TemplateText } from '../types';

const text: TemplateText = {
  stock: {
    title: 'Título',
    status: 'Estado',
    id: 'ID',
    todo: 'Por hacer',
    inProgress: 'En curso',
    done: 'Hecho',
  },
  views: { table: 'Tabla', board: 'Tablero', calendar: 'Calendario' },

  meetingNotes: `## Asistentes

- Sarah Chen (Product Manager)
- Marcus Johnson (Líder de ingeniería)
- Aisha Patel (Diseñadora)

## Orden del día

1. Revisión del sprint y de la velocidad
2. Prioridades de la hoja de ruta del tercer trimestre
3. Novedades del sistema de diseño

## Notas

En general, el sprint fue bien. La velocidad quedó algo por encima de lo estimado. El nuevo flujo de inicio de sesión ya está en producción y funciona como se esperaba.

Prioridades del tercer trimestre: centrarse en mejorar el onboarding y la adaptación a móviles. Marketing necesita el nuevo panel antes de que acabe julio.

Sistema de diseño: Aisha compartirá la biblioteca de componentes actualizada la semana que viene.

## Tareas pendientes

- [ ] Marcus: preparar el entorno de staging antes del viernes
- [ ] Aisha: compartir el borrador del sistema de diseño v2 antes del próximo martes
- [ ] Sarah: enviar el borrador de la hoja de ruta del tercer trimestre para que el equipo lo revise
`,

  projectBrief: `## Resumen

Un panel de analítica de nueva generación que ayuda a los equipos a seguir sus métricas clave en tiempo real. El objetivo es sustituir los informes actuales basados en hojas de cálculo por una solución centralizada y automatizada.

## Objetivos

- Reducir un 80 % el tiempo dedicado a informes manuales
- Dar visibilidad en tiempo real de los KPI del equipo
- Permitir exportar los datos a PDF y CSV

## Calendario

| Hito | Fecha |
|------|-------|
| Arranque | 2 de junio de 2026 |
| Diseño terminado | 20 de junio de 2026 |
| Versión beta | 15 de julio de 2026 |
| Lanzamiento | 1 de agosto de 2026 |

## Equipo

- Producto: Sarah Chen
- Ingeniería: Marcus Johnson, Kai Rivera
- Diseño: Aisha Patel
`,

  taskTracker: {
    columns: { priority: 'Prioridad', assignee: 'Responsable', dueDate: 'Fecha límite' },
    status: { backlog: 'Pendiente', inProgress: 'En curso', review: 'En revisión', done: 'Hecho' },
    priority: { low: 'Baja', medium: 'Media', high: 'Alta' },
    rows: {
      landing: 'Diseñar los bocetos de la página de inicio',
      ci: 'Configurar el pipeline de CI/CD',
      tests: 'Escribir pruebas unitarias para el módulo de autenticación',
      review: 'Revisión de código de la rama feature/payments',
      docs: 'Actualizar la documentación de la API',
      staging: 'Desplegar en el entorno de staging',
      loginBug: 'Corregir el error de redirección al iniciar sesión',
    },
  },

  eventCalendar: {
    columns: { eventDate: 'Fecha del evento', category: 'Categoría', notes: 'Notas' },
    category: { meeting: 'Reunión', conference: 'Conferencia', deadline: 'Fecha límite', personal: 'Personal' },
    rows: {
      standup: { title: 'Reunión semanal del equipo', notes: 'Se repite cada lunes' },
      planning: { title: 'Planificación del sprint', notes: 'Arranque del sprint 14' },
      productReview: { title: 'Revisión de producto del tercer trimestre', notes: 'Repasar la hoja de ruta con las partes interesadas' },
      mvp: { title: 'Fecha límite del MVP', notes: 'Todas las funciones deben estar fusionadas en main' },
      summit: { title: 'Frontend Summit 2026', notes: 'En línea — inscripción en frontendsummit.io' },
      handoff: { title: 'Entrega del sistema de diseño', notes: 'Aisha entrega los componentes v2' },
      offsite: { title: 'Retiro del equipo', notes: 'Estambul — 2 noches' },
    },
  },

  readingList: {
    columns: { rating: 'Valoración', genre: 'Género', author: 'Autor' },
    status: { wantToRead: 'Por leer', reading: 'Leyendo', done: 'Leído' },
    genre: { fiction: 'Ficción', nonFiction: 'No ficción', tech: 'Tecnología', science: 'Ciencia' },
    books: {
      pragmatic: 'El programador pragmático',
      dune: 'Dune',
      sapiens: 'Sapiens. De animales a dioses',
      cleanCode: 'Código limpio',
      threeBody: 'El problema de los tres cuerpos',
      briefHistory: 'Breve historia del tiempo',
      thinking: 'Pensar rápido, pensar despacio',
    },
  },

  agentMemory: {
    columns: { type: 'Tipo', tags: 'Etiquetas', date: 'Fecha' },
    type: { decision: 'Decisión', preference: 'Preferencia', gotcha: 'Trampa', fact: 'Dato' },
    tags: { architecture: 'arquitectura', conventions: 'convenciones', api: 'api', database: 'base de datos', infra: 'infraestructura' },
    byType: 'Por tipo',
    rows: {
      postgres: 'Usar PostgreSQL como almacén de datos principal',
      functional: 'Preferir componentes funcionales de React a los de clase',
      rateLimit: 'La API de staging limita a 100 peticiones/min: agrupar las escrituras',
      tokens: 'Los tokens de diseño viven en tokens.css, no en la configuración de Tailwind',
    },
  },
};

export default text;
