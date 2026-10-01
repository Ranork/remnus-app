import type { SampleText } from '../types';

const text: SampleText = {
  workspaceName: (userName) => `Espacio de trabajo de ${userName}`,
  personalWorkspace: 'Espacio de trabajo personal',
  demoWorkspace: 'Espacio de trabajo de demostración',
  demoUserName: 'Usuario de demostración',
  agentTokenName: 'Agente de IA Claude',

  startHere: {
    title: 'Empieza aquí',
    content: `### ¡Hola a todos!

Para mostrar cómo **Remnus nos ayuda** a tener un proyecto bajo control mientras construimos con agentes de IA, estoy haciendo un *clon sencillo de Microsoft Paint como proyecto de ejemplo*.

¡Todo lo que ves aquí lo han montado *Claude Code* y *Remnus* trabajando codo con codo!

<div data-yt-id="OVi9pjY_p84"></div>

**¡Mira el vídeo para ver cómo se creó este espacio de trabajo!**

<div data-callout-icon="⚡" data-callout-color="blue" data-callout-text="Cada fila del Tablero del sprint con una insignia de agente la escribió un agente de IA real a través de MCP. Abre el panel Agentes IA (abajo a la izquierda) para ver el registro de actividad en directo."></div>

### Qué hizo realmente el agente de IA

Este es el rastro de la sesión real que construyó este espacio de trabajo, sacado directamente del registro de auditoría de agentes de Remnus:

| Cuándo | Acción | Qué pasó |
|--------|--------|----------|
| Conexión | \`list_workspace\` | El agente recorrió el espacio de trabajo para orientarse |
| Planificación | \`create_page\` | Redactó la **Especificación del producto** del clon de Paint |
| Preparación | \`create_database\` | Creó el **Tablero del sprint** a partir de la especificación |
| Pendientes | \`create_page\` ×16 | Generó cada tarea con sus propios criterios de aceptación |
| Desarrollo | \`update_page\` | Marcó como **Hecho** las tareas de *estructura*, *pincel* y *goma* a medida que las terminaba |
| Revisión | \`query_database\` | Volvió a leer el tablero para elegir la siguiente tarea |
| En marcha | \`update_page\` | Pasó la *herramienta de línea* a **En curso** |

¿Quieres la historia completa por escrito? Abre la página de abajo 👇

{{HOW_BUILT_CB}}
`,
  },

  howBuilt: {
    title: 'Cómo se construyó',
    content: `Este espacio de trabajo no se rellenó a mano. Un agente de IA (**Claude Code**) se conectó a Remnus por **MCP** y lo construyó todo: la especificación, el tablero de tareas y el seguimiento del progreso, mientras una persona lo veía todo en tiempo real.

Esta página acompaña por escrito al vídeo de **Empieza aquí**: la misma historia, para leerla a tu ritmo.

## El flujo de trabajo

1. **Conectar:** el agente se autenticó en este espacio de trabajo con un token MCP y llamó a \`list_workspace\` para ver qué había ya.
2. **Planificar:** escribió una **Especificación del producto** para un clon de Paint que funciona en el navegador (puedes abrirla desde la barra lateral).
3. **Desglosar:** a partir de esa especificación creó la base de datos **Tablero del sprint** y generó **16 tareas**, cada una con sus criterios de aceptación y notas.
4. **Construir y seguir:** según implementaba funciones, movía las tareas por el tablero (\`Pendiente → En curso → Hecho\`) y escribía su resultado real en la página de cada tarea.
5. **Mantenerse al día:** una persona puede intervenir en cualquier momento y editar lo que quiera, y el agente ve el nuevo estado en su siguiente consulta. Sin copiar y pegar, sin perder contexto.

## Cómo leer las señales

Remnus hace que el trabajo del agente sea **visible y auditable**. Esto es lo que no aparece en otras herramientas:

<div data-callout-icon="⚡" data-callout-color="blue" data-callout-text="La insignia de agente en una fila significa que un agente de IA la editó por última vez. Pasa el cursor por encima para ver qué token hizo el cambio y cuándo."></div>

- **La insignia de agente ⚡:** cada fila del Tablero del sprint que tocó un agente queda marcada. Siempre sabes qué escribió una persona y qué escribió una máquina.
- **El panel Agentes IA:** haz clic en **Agentes IA**, abajo a la izquierda de la barra lateral. Verás cada token, su alcance y un registro en directo de las últimas llamadas a herramientas (\`create_page\`, \`update_page\`, \`query_database\`…).

## Pruébalo tú mismo

Puedes conectar tu propio agente de IA a tu propio espacio de trabajo en menos de un minuto:

1. Abre **Configuración del espacio → MCP** y crea un token MCP (alcance de lectura o de escritura).
2. Añade Remnus como servidor MCP en tu cliente (Cursor, VS Code o Claude). El endpoint y la cabecera de autenticación aparecen justo después de crear el token, y también hay botones de instalación con un clic.
3. Pide a tu agente que planifique un proyecto, rellene una base de datos o resuma una página. Cada acción que realiza aparece en el registro de auditoría, marcada y reversible.

<div data-callout-icon="🔒" data-callout-color="green" data-callout-text="Tú mantienes el control: los tokens tienen un alcance, cada escritura queda registrada y puedes revocar el acceso cuando quieras."></div>

Esa es toda la idea de Remnus. Tus agentes de IA tienen un espacio de trabajo real en el que trabajar, y tú sigues viendo todo lo que hacen.
`,
  },

  productSpec: {
    title: 'Especificación del producto',
    content: `# Especificación del producto: clon de Paint

Una aplicación de dibujo mínima que funciona en el navegador. Sin dependencias, sin cuentas y sin instalar nada.

## Funciones del MVP

### Lienzo y dibujo

- Herramienta de pincel / lápiz a mano alzada
- Tamaño de pincel ajustable
- Herramienta de goma
- Bote de pintura (relleno por inundación)
- Botón para borrar el lienzo

### Color

- Selector de color (\`<input type="color">\` nativo)
- Paleta de colores predefinidos
- Muestra del color actual

### Formas

- Herramienta de línea
- Herramienta de rectángulo (contorno + relleno)
- Herramienta de círculo / elipse (contorno + relleno)

### Archivo

- Guardar el lienzo como PNG (descarga)
- Cargar / abrir un archivo de imagen en el lienzo

### Interfaz

- Barra de herramientas con iconos
- Atajos de teclado para las herramientas habituales (B = pincel, E = goma, F = relleno, etc.)
- Deshacer (un solo nivel o varios pasos con una pila de historial)

## Fuera de alcance (v1)

- Capas
- Herramienta de texto
- Guardado en la nube
- Colaboración

`,
  },

  sprintBoard: {
    name: 'Tablero del sprint',
    columns: { title: 'Título', status: 'Estado', priority: 'Prioridad', category: 'Categoría' },
    status: { backlog: 'Pendiente', inProgress: 'En curso', done: 'Hecho' },
    priority: { high: 'Alta', medium: 'Media', low: 'Baja' },
    category: { canvas: 'Lienzo', color: 'Color', shapes: 'Formas', file: 'Archivo', ui: 'Interfaz' },
    views: { board: 'Tablero', table: 'Tabla' },
  },

  tasks: {
    scaffold: {
      title: 'Preparar la estructura del proyecto',
      content: `# Preparar la estructura del proyecto

Crear la estructura base HTML/CSS/JS del clon de Paint. Sin frameworks ni herramientas de compilación, solo archivos planos.

## Tareas
- [x] Crear \`index.html\` con el elemento \`<canvas>\` y un hueco para la barra de herramientas
- [x] Crear \`style.css\` (reset, diseño de barra lateral + zona del lienzo, tema básico)
- [x] Crear \`main.js\` (punto de entrada, inicialización del contexto del lienzo)
- [x] Comprobar que el lienzo ocupa el espacio disponible y se redimensiona bien

## Criterios de aceptación
- Al abrir \`index.html\` en un navegador se ven un lienzo en blanco y una barra de herramientas vacía ✅
- Sin errores en la consola al cargar ✅

## Resultado

### Archivos creados
- \`index.html\`: estructura con \`<aside id="toolbar">\` + \`<canvas id="canvas">\` dentro de \`<main id="canvas-area">\`
- \`style.css\`: reset de CSS, diseño flex (barra lateral de 56px + zona del lienzo que ocupa el resto), lienzo blanco con marco oscuro alrededor
- \`main.js\`: inicialización del contexto del lienzo, \`resizeCanvas()\` que ocupa la zona disponible y conserva el dibujo al redimensionar la ventana mediante \`getImageData\`/\`putImageData\`

### Notas
- El lienzo se ajusta a la zona disponible menos 32px de margen en cada eje y se recalcula en cada \`window.resize\`
- En cada redimensionado se pinta un fondo blanco, así el PNG guardado nunca será transparente
- La barra de herramientas es un \`<aside>\` vertical listo para recibir los botones de las siguientes tareas
`,
    },
    brush: {
      title: 'Crear el pincel / lápiz a mano alzada',
      content: `# Crear el pincel / lápiz a mano alzada

Permitir que el usuario dibuje trazos a mano alzada en el lienzo con el ratón o con el dedo.

## Tareas
- [x] Escuchar los eventos \`mousedown\`, \`mousemove\` y \`mouseup\` en el lienzo
- [x] Usar \`ctx.beginPath()\` / \`ctx.lineTo()\` / \`ctx.stroke()\` para dibujar trazos suaves
- [x] Aplicar el color y el tamaño de pincel actuales a los trazos
- [x] Impedir el dibujo cuando no se mantiene pulsado el botón del ratón

## Criterios de aceptación
- Hacer clic y arrastrar dibuja un trazo continuo ✅
- El color y el tamaño del trazo reflejan los valores seleccionados ✅
- Al soltar el ratón se deja de dibujar ✅

## Resultado

### Cambios en \`main.js\`
- Añadido un objeto \`state\` que guarda \`tool\`, \`color\`, \`size\`, \`isDrawing\`, \`lastX\` y \`lastY\`
- \`getPos(e)\`: normaliza las coordenadas del ratón y del tacto respecto a los límites del lienzo
- \`applyBrushStyle()\`: fija \`strokeStyle\`, \`lineWidth\`, \`lineCap\`, \`lineJoin\` y \`globalCompositeOperation\` antes de cada trazo
- \`onPointerDown\`: guarda la posición inicial y dibuja un punto con un solo clic
- \`onPointerMove\`: dibuja en cada fotograma un segmento desde la última posición hasta la actual
- \`onPointerUp\` / \`mouseleave\`: deja de dibujar
- Eventos táctiles (\`touchstart\`, \`touchmove\`, \`touchend\`) conectados junto a los del ratón, con \`passive: false\` para permitir \`preventDefault\`
`,
    },
    eraser: {
      title: 'Crear la goma de borrar',
      content: `# Crear la goma de borrar

Permitir que el usuario borre partes del lienzo dibujando con el color de fondo.

## Tareas
- [x] Añadir la goma a la barra de herramientas
- [x] Con la goma activa, fijar \`ctx.globalCompositeOperation = 'destination-out'\`
- [x] Usar el tamaño de pincel actual como ancho de la goma
- [x] Restaurar la operación de composición al volver al pincel

## Criterios de aceptación
- La goma borra lo dibujado al arrastrar ✅
- El tamaño de la goma lo controla el deslizador de tamaño del pincel ✅
- Cambiar de herramienta recupera el dibujo normal ✅

## Resultado

### Cambios en \`main.js\`
- \`applyBrushStyle()\` ahora se bifurca según \`state.tool === 'eraser'\`: fija \`globalCompositeOperation = 'destination-out'\` y usa un trazo negro opaco (borra los píxeles del canal alfa)
- El punto de \`onPointerDown\` también aplica \`destination-out\` al borrar y restablece la operación de composición después del relleno
- La goma comparte \`state.size\` con el pincel, no necesita un tamaño propio
- Al cambiar a cualquier herramienta que no sea la goma, \`applyBrushStyle()\` restaura \`source-over\` automáticamente en el siguiente trazo
`,
    },
    brushSize: {
      title: 'Crear el tamaño de pincel ajustable',
      content: `# Crear el tamaño de pincel ajustable

Ofrecer un deslizador o un campo que controle el ancho del trazo y de la goma.

## Tareas
- [ ] Añadir \`<input type="range">\` a la barra de herramientas (mínimo 1, máximo 64)
- [ ] Mostrar el valor del tamaño actual junto al deslizador
- [ ] Aplicar el tamaño elegido a \`ctx.lineWidth\` antes de cada trazo
- [ ] Tamaño por defecto: 4px

## Criterios de aceptación
- Al mover el deslizador cambia el ancho del pincel al instante
- Tanto el pincel como la goma usan el tamaño actual
`,
    },
    fill: {
      title: 'Crear el relleno por inundación (bote de pintura)',
      content: `# Crear el relleno por inundación (bote de pintura)

Al hacer clic, rellenar con el color actual una zona continua del lienzo.

## Tareas
- [ ] Leer los píxeles con \`ctx.getImageData()\`
- [ ] Implementar un algoritmo iterativo BFS/DFS de relleno que empiece en el píxel pulsado
- [ ] Escribir los píxeles rellenados con \`ctx.putImageData()\`
- [ ] Añadir un umbral de tolerancia (p. ej. ±15) para los bordes suavizados

## Criterios de aceptación
- Hacer clic dentro de una zona cerrada la rellena con el color actual
- El relleno no se sale por los bordes definidos
- El rendimiento es aceptable con tamaños de lienzo habituales (≤1920×1080)
`,
    },
    clear: {
      title: 'Crear el botón de borrar el lienzo',
      content: `# Crear el botón de borrar el lienzo

Devolver todo el lienzo a un estado en blanco.

## Tareas
- [ ] Añadir un botón "Borrar" a la barra de herramientas
- [ ] Al hacer clic, llamar a \`ctx.clearRect(0, 0, canvas.width, canvas.height)\` y rellenar de blanco
- [ ] Guardar una instantánea en el historial antes de borrar para poder deshacerlo

## Criterios de aceptación
- Hacer clic en Borrar elimina todo lo dibujado
- La acción se puede deshacer con Deshacer
`,
    },
    colorPicker: {
      title: 'Crear el selector de color',
      content: `# Crear el selector de color

Permitir que el usuario elija cualquier color para dibujar con el selector de color nativo del navegador.

## Tareas
- [ ] Añadir \`<input type="color">\` a la barra de herramientas
- [ ] Guardar el color elegido en una variable de estado global \`currentColor\`
- [ ] Actualizar \`ctx.strokeStyle\` y \`ctx.fillStyle\` en cada cambio de color
- [ ] Color por defecto: \`#000000\`

## Criterios de aceptación
- Al abrir el selector aparece el selector de color del sistema operativo
- Elegir un color afecta al instante a los trazos y rellenos siguientes
`,
    },
    palette: {
      title: 'Crear la paleta de colores predefinidos',
      content: `# Crear la paleta de colores predefinidos

Mostrar una fila de muestras de colores predefinidos para elegir rápido.

## Tareas
- [ ] Definir una lista de ~16 colores clásicos de pintura (negro, blanco, rojo, verde, azul, amarillo, etc.)
- [ ] Mostrar cada uno como una pequeña muestra \`<div>\` pulsable en la barra de herramientas
- [ ] Al hacer clic, fijar \`currentColor\` y sincronizar el valor del selector de color
- [ ] Resaltar la muestra activa con un borde o anillo

## Criterios de aceptación
- Hacer clic en una muestra cambia el color activo al instante
- El selector de color muestra el color de la muestra elegida
- La muestra activa se distingue visualmente
`,
    },
    line: {
      title: 'Crear la herramienta de línea',
      content: `# Crear la herramienta de línea

Permitir que el usuario dibuje una línea recta entre dos puntos.

## Tareas
- [ ] En \`mousedown\`, guardar el punto inicial y una instantánea del lienzo
- [ ] En \`mousemove\`, restaurar la instantánea y dibujar una línea de vista previa hasta el cursor
- [ ] En \`mouseup\`, fijar la línea final en el lienzo
- [ ] Mantener Mayús pulsada para limitar el ángulo a pasos de 45°

## Criterios de aceptación
- Al arrastrar se dibuja una línea recta con vista previa en directo
- Al soltar el ratón la línea queda fijada
- Mayús limita el ángulo
`,
    },
    rect: {
      title: 'Crear la herramienta de rectángulo',
      content: `# Crear la herramienta de rectángulo

Dibujar rectángulos de contorno o rellenos haciendo clic y arrastrando.

## Tareas
- [ ] En \`mousedown\`, guardar el origen y una instantánea del lienzo
- [ ] En \`mousemove\`, restaurar la instantánea y dibujar el rectángulo de vista previa
- [ ] En \`mouseup\`, fijar el rectángulo
- [ ] Alternar entre contorno (\`ctx.strokeRect\`) y relleno (\`ctx.fillRect\`) con una opción de la barra de herramientas
- [ ] Mantener Mayús pulsada para limitarlo a un cuadrado

## Criterios de aceptación
- Al arrastrar se dibuja una vista previa del rectángulo en directo
- Funciona el cambio entre contorno y relleno
- Mayús lo limita a un cuadrado
`,
    },
    ellipse: {
      title: 'Crear la herramienta de círculo / elipse',
      content: `# Crear la herramienta de círculo / elipse

Dibujar elipses de contorno o rellenas haciendo clic y arrastrando.

## Tareas
- [ ] En \`mousedown\`, guardar el origen y una instantánea del lienzo
- [ ] En \`mousemove\`, restaurar la instantánea y dibujar la elipse de vista previa con \`ctx.ellipse()\`
- [ ] En \`mouseup\`, fijar la elipse
- [ ] Reutilizar el cambio contorno/relleno de la herramienta de rectángulo
- [ ] Mantener Mayús pulsada para limitarla a un círculo perfecto

## Criterios de aceptación
- Al arrastrar se dibuja una vista previa de la elipse en directo
- Funciona el cambio entre contorno y relleno
- Mayús la limita a un círculo
`,
    },
    save: {
      title: 'Crear el guardado como PNG',
      content: `# Crear el guardado como PNG

Permitir que el usuario descargue el lienzo actual como archivo PNG.

## Tareas
- [ ] Añadir un botón "Guardar" a la barra de herramientas
- [ ] Al hacer clic, llamar a \`canvas.toDataURL('image/png')\`
- [ ] Lanzar la descarga por código con un elemento \`<a download>\` temporal
- [ ] Nombre de archivo por defecto: \`painting.png\`

## Criterios de aceptación
- Hacer clic en Guardar descarga un PNG idéntico a lo que hay en el lienzo
- Se conserva el fondo blanco (el lienzo no es transparente)
`,
    },
    open: {
      title: 'Crear la apertura / carga de imágenes',
      content: `# Crear la apertura / carga de imágenes

Permitir que el usuario abra un archivo de imagen local y lo dibuje en el lienzo.

## Tareas
- [ ] Añadir un botón "Abrir" que active un \`<input type="file" accept="image/*">\` oculto
- [ ] Leer el archivo elegido con \`FileReader.readAsDataURL()\`
- [ ] Dibujar la imagen cargada en el lienzo con \`ctx.drawImage()\`, escalada para que quepa
- [ ] Guardar una instantánea en el historial antes de dibujar para poder deshacerlo

## Criterios de aceptación
- Al abrir una imagen se muestra en el lienzo
- La imagen se escala de forma proporcional para caber en el lienzo
- La acción se puede deshacer
`,
    },
    undo: {
      title: 'Crear el historial de deshacer',
      content: `# Crear el historial de deshacer

Permitir que el usuario vuelva paso a paso a estados anteriores del lienzo.

## Tareas
- [ ] Mantener una lista \`history\` de instantáneas \`ImageData\` (máximo 50 entradas)
- [ ] Guardar una instantánea antes de cada operación de dibujo fijada
- [ ] Al deshacer (\`Ctrl+Z\`), sacar la última instantánea y restaurarla con \`ctx.putImageData()\`
- [ ] Añadir un botón Deshacer a la barra de herramientas para quien no use el teclado
- [ ] Desactivar el botón Deshacer cuando el historial esté vacío

## Criterios de aceptación
- \`Ctrl+Z\` retrocede una operación cada vez
- Hay hasta 50 pasos de historial
- El botón Deshacer se ve desactivado cuando no hay nada que deshacer
`,
    },
    toolbar: {
      title: 'Crear la barra de herramientas y sus iconos',
      content: `# Crear la barra de herramientas y sus iconos

Construir la barra lateral que reúne todos los botones y controles de las herramientas.

## Tareas
- [ ] Diseñar en CSS una barra de herramientas vertical a la izquierda
- [ ] Añadir botones con icono para: Pincel, Goma, Relleno, Línea, Rectángulo, Elipse, Abrir, Guardar, Deshacer y Borrar
- [ ] Usar símbolos Unicode o iconos SVG sencillos (sin bibliotecas de iconos externas)
- [ ] Resaltar el botón de la herramienta activa con un estilo de seleccionado
- [ ] Añadir información emergente a cada botón (atributo \`title\`)

## Criterios de aceptación
- Todas las herramientas están accesibles desde la barra
- La herramienta activa se resalta con claridad
- La barra se lee bien a 1080p y no se desborda en pantallas más pequeñas
`,
    },
    shortcuts: {
      title: 'Crear los atajos de teclado',
      content: `# Crear los atajos de teclado

Conectar atajos de teclado para cambiar rápido de herramienta y para las acciones habituales.

## Mapa de atajos
| Tecla | Acción |
|-------|--------|
| B | Pincel |
| E | Goma |
| F | Relleno (bote) |
| L | Línea |
| R | Rectángulo |
| C | Círculo / elipse |
| Ctrl+Z | Deshacer |
| Ctrl+S | Guardar como PNG |
| Supr | Borrar el lienzo |

## Tareas
- [ ] Añadir un listener \`keydown\` en \`document\`
- [ ] Llevar a la herramienta o acción correcta según \`event.key\`
- [ ] Proteger las combinaciones \`Ctrl+\` con \`event.ctrlKey\` / \`event.metaKey\`
- [ ] No disparar atajos cuando el foco esté en un campo de texto

## Criterios de aceptación
- Cada atajo activa la herramienta o acción correcta
- Los atajos no interfieren con los del navegador (salvo Ctrl+S, que se sobrescribe a propósito)
`,
    },
  },
};

export default text;
