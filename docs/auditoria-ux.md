# Auditoría de UX y accesibilidad

**Fecha:** 1 de agosto de 2026
**Alcance:** verificación visual e instrumentada en producción (`https://hospital-dia.vercel.app`, sesión de administrador) + revisión del código fuente.
**Páginas revisadas:** Agenda, Calendario, Pacientes, Medicamentos, Estadística, Histórico, Catálogo, Farmacéuticos, Prescriptores, Cuenta, 404.
**Método:** navegación real con datos (agenda del 09/07/2026, 11 registros), lectura del árbol de accesibilidad, cálculo de contraste, inspección de foco, revisión de componentes.

Severidad: 🔴 crítico · 🟠 alto · 🟡 medio · 🔵 bajo

---

## Resumen

La aplicación es funcionalmente sólida y hay trabajo reciente de calidad (avisos `aria-live` dobles en `Toast`, banner de "vista filtrada", `aria-label` en los botones de icono, formulario de login correcto). Los problemas se concentran en tres frentes:

1. **El flujo principal ("Captura rápida") bloquea al usuario sin explicar por qué** — botón Guardar deshabilitado con 12 campos obligatorios.
2. **Móvil está roto** — barra lateral fija de 224 px sin colapsar y navegación secundaria oculta.
3. **Etiquetas de formulario sin asociar** — 55 de 60 `<label>` no tienen `htmlFor`, lo que rompe lectores de pantalla y clic-en-etiqueta.

Total: 24 hallazgos (3 críticos, 7 altos, 9 medios, 5 bajos).

---

## 🔴 Críticos

### 1. "Guardar" deshabilitado sin indicar qué falta
`src/components/AgendaDia.tsx:1077` — `disabled={formState.isSubmitting || !formState.isValid}`

El formulario de Captura rápida tiene ~12 campos obligatorios repartidos en 4 filas. Mientras alguno falte, el botón queda `disabled` con `pointer-events-none` (`ui/Button.tsx:14`): no es enfocable, no acepta *hover*, no tiene `title` ni `aria-describedby`. El usuario ve un botón apagado y ningún mensaje. Con `mode: "onBlur"` los campos nunca tocados tampoco muestran error, así que el caso más común (dejarse un campo sin visitar) no produce ninguna pista.

**Arreglo:** mantener el botón habilitado, validar al enviar, hacer foco en el primer campo con error y mostrar un resumen ("Faltan: Prescriptor, Farmacéutico"). Si se prefiere conservarlo deshabilitado, quitar `pointer-events-none`, añadir `aria-disabled` + `aria-describedby` apuntando a la lista de campos pendientes.

### 2. La barra lateral no es responsive: móvil inutilizable
`src/components/Sidebar.tsx:68` — `className="w-56 shrink-0 …"`

Ancho fijo de 224 px sin ninguna clase de *breakpoint*, sin botón hamburguesa ni estado colapsado. En un teléfono de 390 px consume el 57 % del ancho y deja ~166 px para la agenda. Además `NavPills` (`NavPills.tsx:15`, `hidden md:block`) oculta **Catálogo, Farmacéuticos, Prescriptor e Histórico** por debajo de `md`, y esos destinos no están en la barra lateral: en móvil son inalcanzables.

**Arreglo:** barra lateral fuera de flujo (`fixed`) con *drawer* y hamburguesa por debajo de `md`; y mover los cuatro destinos de `NavPills` al menú móvil.

### 3. 55 de 60 etiquetas sin asociar al campo
60 `<label>` en `src/**`, solo 5 `htmlFor` (todos en login y cambio de contraseña).

Verificado en producción: **19 de 19 campos de la agenda** no tienen etiqueta accesible (`htmlFor`, `aria-label`, `aria-labelledby` ni anidado). Un lector de pantalla anuncia "cuadro de edición" sin nombre en toda la Captura rápida. También impide hacer clic en la etiqueta para enfocar, que en captura rápida masiva importa.

**Arreglo:** `useId()` por campo, `htmlFor`/`id` emparejados. Aprovechar para añadir `required`, `aria-invalid` y `aria-describedby` hacia el `<div>` de error (hoy ninguno de los tres existe fuera de login).

---

## 🟠 Altos

### 4. El estado se imprime dos veces en cada fila: "Pendiente Pendiente"
`src/components/StatusBadge.tsx:26-30`

El componente pinta `<span>{STATUS_LABEL[value]}</span>` y, al lado, un `<select>` cuya opción seleccionada muestra la misma palabra. En las 11 filas de la agenda se lee "Pendiente Pendiente ⌄". Además el `<select>` no tiene nombre accesible propio: el `<label>` que lo envuelve tiene como texto la palabra duplicada.

**Arreglo:** eliminar el `<span>` y dar estilo al `<select>` (o dejar el `<span>` y ocultar el select visualmente con `sr-only` + `aria-label="Cambiar estado de <paciente>"`).

### 5. Acciones irreversibles a un clic, sin confirmación ni deshacer
`src/components/agenda/AgendaItemActions.tsx:35-48`

"Listo" y "Entregado" se aplican de inmediato. Son botones de **26 px de alto y 43-73 px de ancho**, pegados entre sí y repetidos en cada fila (hasta 5 controles por fila). En un contexto de farmacia oncológica, marcar "Entregado" al paciente equivocado por un clic desviado es un error con consecuencias, y el `Toast` de éxito no ofrece "Deshacer".

**Arreglo:** añadir "Deshacer" al toast de cambio de estado (ventana de ~8 s), subir el objetivo táctil a ≥40 px de alto y separar visualmente "Entregado" del resto.

### 6. El menú "⋯" no es un menú accesible
`src/components/agenda/AgendaItemActions.tsx:76-114`

El disparador no tiene `aria-expanded` ni `aria-haspopup`; el desplegable es un `<div>` sin `role="menu"`, sin `role="menuitem"` en las opciones, sin gestión de foco, sin navegación por flechas y sin cierre con `Escape`. Contiene la acción destructiva "Cancelar…". Con teclado se puede abrir pero el foco se queda fuera.

### 7. El popover "Estados" no cierra con Escape y tapa el formulario
Verificado en producción: tras pulsar `Escape` el popover sigue abierto (`aria-expanded="true"`). Mientras está abierto cubre los campos **Número de receta** e **Identificación** de la Captura rápida, justo los dos primeros del flujo de captura.

**Arreglo:** cerrar con `Escape` y devolver el foco al disparador; reposicionar el popover para que no solape el formulario (o anclarlo hacia abajo-izquierda).

### 8. Los contadores del pie mienten cuando hay filtro activo
`src/components/agenda/AgendaSummaryFooter.tsx:14`

Con el filtro "Listo" activo y 11 pendientes en el día, el pie muestra `Pendientes: 0 · Listos: 0 · Entregados: 0 · Cancelados: 0`. El banner "Vista filtrada" (buen añadido) avisa de la tabla, pero los contadores siguen presentándose como el total del día.

**Arreglo:** mostrar siempre los totales del día y, si hay filtro, añadir "(N de M visibles)".

### 9. El anillo de foco es invisible sobre la barra lateral
Regla global: `:focus-visible { outline: rgba(24,24,27,.75) solid 2px }`.

Sobre el azul `blue-950` de la barra lateral el contraste del contorno queda ~1.4:1 — verificado visualmente: enfocar "CALENDARIO" no produce indicación perceptible. Las utilidades `focus-visible:outline-blue-600` repartidas por los componentes solo fijan el *color*, no el grosor, así que no aportan nada extra. Incumple WCAG 2.4.11 (Focus Appearance).

**Arreglo:** contorno adaptado al fondo (blanco/claro dentro de la barra lateral y sobre botones primarios azules), con `outline-offset` de 2 px.

### 10. Los modales no atrapan el foco y se cierran al arrastrar
`src/components/Modal.tsx:56-60`

`role="dialog"` + `aria-modal="true"` pero sin foco inicial, sin *focus trap*, sin devolver el foco al cerrar y sin `inert` en el fondo.

**Comprobado en producción con datos (2 de agosto de 2026):** con "Cancelar registro" abierto y un motivo escrito, el foco no está dentro del diálogo, hay 58 elementos enfocables detrás, y **cuatro tabulaciones llevan el foco al enlace "AGENDA" de la barra lateral**, tras el overlay.

**Corrección:** la descripción del cierre por arrastre estaba invertida. Arrastrar *desde dentro y soltar fuera* **no** cierra —el panel detiene la propagación del `mousedown`—. Lo que sí cierra, y descarta lo escrito, es arrastrar **desde fuera hacia dentro**: el `mousedown` cae en el contenedor y dispara el cierre antes de que exista un clic. Reproducido en producción: el motivo "PRUEBA QA" se perdió.

---

## 🟡 Medios

### 11. Dos sistemas de navegación solapados
Barra lateral (Agenda, Calendario, Pacientes, Medicamentos, Estadística) + píldoras arriba a la derecha (Catálogo, Farmacéuticos, Prescriptor, Histórico), sin relación jerárquica visible. En `/medicamentos` "MEDICAMENTOS" aparece **a la vez** en la barra lateral y en las píldoras. No hay criterio aparente de qué va en cada sitio.

**Arreglo:** un solo menú, con las entradas de mantenimiento (Catálogo, Farmacéuticos, Prescriptores) agrupadas bajo "Configuración" o similar.

### 12. Sin `aria-current` en el elemento de navegación activo
No hay ni una ocurrencia en `src/`. El estado activo es solo visual (fondo azul). Un lector de pantalla no puede decir en qué página se está.

### 13. Todos los campos fuerzan mayúsculas por CSS
`src/components/ui/Input.tsx:15` — clase `uppercase`. Verificado: 18 de 19 campos.

**Corrección posterior:** este hallazgo estaba en su mayor parte equivocado. `/api/items` sí normaliza a mayúsculas al guardar (paciente, dosis, frecuencia; y `/api/medications` para el catálogo), así que lo mostrado y lo almacenado coinciden. Las mayúsculas son una convención institucional deliberada, no un defecto.

Lo que sí divergía es **Observaciones**, el único campo que el servidor deja tal cual (`body.observaciones ?? null`, `src/app/api/items/route.ts:197`) mientras la vista lo mostraba en mayúsculas. Además es prosa, donde la caja normal se lee mejor.

De paso apareció que la regla global de `globals.css` era código muerto para estos campos: selecciona `input[type="text"]` y `ui/Input` no declara `type`, así que nunca los alcanzaba — las mayúsculas venían solo de la clase del componente.

### 14. Tablas sin semántica de encabezado
Los `<th>` no llevan `scope="row"`/`scope="col"` y ninguna tabla tiene `<caption>` (los títulos "Agenda del día", "Pacientes del día" viven fuera de la tabla). Con 8 columnas, un lector de pantalla no puede relacionar celda y columna.

### 15. Doble barra de desplazamiento en la agenda
`src/components/AgendaDia.tsx:1319` — `max-h-[62vh] overflow-auto`

La tabla scrollea dentro de una página que también scrollea. Verificado: 396 px visibles sobre 658 px de contenido. El resultado es que se ven ~6 de 11 filas y aparecen filas cortadas por la mitad al desplazarse.

**Arreglo:** dejar que la tabla crezca y usar encabezado `sticky`, o pasar la altura máxima a `calc(100vh - …)` con la cabecera fijada.

### 16. La cabecera translúcida deja ver el contenido a través
`src/app/*/page.tsx:8` — `bg-white/90 backdrop-blur`

Al desplazarse, los botones rojos de eliminar y las píldoras de estado se transparentan a través de la cabecera (visible en las capturas). En una tabla clínica es ruido que puede confundirse con contenido.

**Arreglo:** fondo opaco (`bg-white`).

### 17. Se expone un identificador interno al usuario final
`src/components/Estadistica.tsx:102` — `REQUEST ID: 745ae682-0f79-4668-…` impreso junto al botón Actualizar, en la vista principal de Estadística. Igualmente, `ErrorLogPanel` (con trazas de pila y descarga `.txt`) va montado en el layout de producción para todos los roles.

**Arreglo:** mover ambos detrás de un panel de soporte, o mostrarlos solo cuando hay un error y solo para el rol administrador.

### 18. Estados de carga inconsistentes y descolocados
"CARGANDO…" aparece como texto gris pequeño alineado a la derecha, lejos del área que va a cambiar (Pacientes, Medicamentos, Estadística, Histórico). No hay esqueletos ni reserva de espacio, así que el contenido salta al llegar. En Estadística la espera fue de varios segundos con la pantalla prácticamente vacía.

### 19. Página 404 en inglés y sin salida
`/pagina-inexistente` devuelve el 404 por defecto de Next.js: "This page could not be found." en una aplicación íntegramente en español, sin enlace de vuelta a la agenda. Se renderiza dentro del shell, con la barra lateral al lado.

**Arreglo:** `src/app/not-found.tsx` en español con enlace a "Volver a la agenda".

---

## 🔵 Bajos

### 25. No hay forma de eliminar una ficha de paciente
🟠 **Alto.** Descubierto al limpiar la prueba del 2 de agosto de 2026.

"Eliminar paciente del día" borra la solicitud del día y sus líneas, pero deja intacta la fila de `Patient`. Y `/api/patients/[id]` solo expone `GET` y `PATCH`: no existe `DELETE`, ni por interfaz ni por API.

Consecuencia: una cédula tecleada mal crea una ficha permanente que nadie puede retirar y que seguirá apareciendo en el autocompletado de Identificación y de Nombre para siempre, compitiendo con la ficha correcta en el momento de la captura. En un flujo donde el nombre se autorrellena a partir de la cédula, eso es una vía directa a asociar una preparación a un paciente equivocado.

Verificado: tras eliminar el registro de prueba, `/api/patients?query=0-0000` y `?query=PRUEBA` siguen devolviendo la ficha, mientras `/api/items` del día ya está vacío.

**Arreglo:** `DELETE /api/patients/[id]` restringido a administrador y solo cuando la ficha no tenga solicitudes asociadas; o una fusión de fichas duplicadas, que es el caso real más frecuente.

---

### 20. Botón etiquetado "Esc"
`src/components/agenda/AgendaItemActions.tsx:63` — durante la edición en línea, el botón de cancelar se llama "Esc". Es el nombre de una tecla, no una acción. Debería decir "Cancelar" (y mencionar el atajo aparte).

### 21. Fecha de aplicación anterior a la de recepción
Al cambiar la fecha de la agenda al 09/07/2026, "Fechas de aplicación" se sincroniza pero "Fecha de recepción" se queda en 01/08/2026: el formulario queda listo para registrar una aplicación **casi un mes anterior** a su recepción, sin aviso.

### 22. `/cuenta` es una página huérfana con el texto equivocado
No está enlazada desde ninguna navegación. Además muestra "PRIMER INGRESO — Establezca su contraseña" incluso a un usuario que ya tiene contraseña; el texto solo encaja con el flujo de alta.

### 23. Vocabulario y capitalización inconsistentes
"Prescriptor" (singular) junto a "Farmacéuticos" y "Medicamentos" (plural). Estados vacíos con estilos distintos en la misma pantalla: "SIN REGISTROS" frente a "Sin pacientes para esta fecha/filtros." Títulos de tarjeta unas veces en versalitas ("PACIENTES REGISTRADOS") y otras en frase ("Pacientes del día"), en la misma vista.

### 24. Detalles menores
- Sin enlace "saltar al contenido"; en la agenda hay que tabular por toda la barra lateral y la cabecera antes de llegar a la tabla.
- Ningún `<input>` declara `autocomplete` fuera del login.
- Los botones de icono tienen `aria-label` pero no `title`: quien ve la pantalla no tiene *tooltip* para distinguir lápiz / papelera / check.
- El filtro Estados no ofrece "Limpiar todo" desde el propio popover (sí desde el banner "Ver todos").
- El login no tiene alternar visibilidad de contraseña ni ruta de recuperación.

---

## Orden sugerido

**Semana 1 — desbloquear el trabajo diario**
1 (Guardar sin explicación) · 4 (estado duplicado) · 5 (deshacer + tamaño de objetivo) · 8 (contadores filtrados) · 16 (cabecera opaca) · 20 (botón "Esc")

**Semana 2 — accesibilidad**
3 (etiquetas) · 9 (foco) · 10 (modales) · 6 y 7 (menú y popover) · 12 · 14

**Semana 3 — estructura**
2 (móvil) · 11 (navegación duplicada) · 15 (doble scroll) · 17 (datos internos) · 19 (404) · 13 (mayúsculas)
