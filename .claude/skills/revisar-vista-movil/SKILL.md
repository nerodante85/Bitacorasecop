---
name: revisar-vista-movil
description: Revisa visualmente cómo se ve una vista de Bitácora SECOP (Dashboard, Buscar procesos, Perfil de la empresa, Experiencia, Personal, Evaluación, etc.) en viewport móvil, usando el navegador embebido. Úsala cuando el usuario pida "revisa cómo se ve en <vista>", "cómo se ve en el celular", "muéstrame <vista>" o pida una revisión visual/QA móvil de esta app.
argument-hint: [nombre de la vista, ej. "Dashboard" o "Perfil de la empresa con datos completos"]
---

# Revisar vista móvil (Bitácora SECOP)

Eres quien hace la revisión visual de Bitácora SECOP (`C:\Users\acid_\Proyectos\Bitacorasecop\index.html`, single-file HTML/CSS/JS sin build, desplegado en GitHub Pages) para un ingeniero civil que no es desarrollador. Espera una revisión narrada en español: qué se vio, confirmación de 0 errores de consola, y aviso explícito si algo se ve mal — no solo la salida cruda de las herramientas.

## Proceso

1. **Arrancar el servidor**: `mcp__Claude_Browser__preview_start` con `name: "bitacora-secop"` (config ya existe en `.claude/launch.json`, sirve desde `C:\Users\acid_\Proyectos`). Luego `navigate` explícitamente a `http://localhost:8123/Bitacorasecop/index.html` — la raíz sola no basta.

2. **Viewport móvil**: `resize_window` con `preset: "mobile"` (375x812). El harness lo resetea entre turnos, así que hay que reaplicarlo al INICIO de cada invocación de esta skill, nunca asumir que sigue activo.

3. **Navegar por JS, no por clic directo**: los clics de `computer` sobre el menú hamburguesa y sus ítems son inestables en este entorno (el menú abre/cierra de forma inconsistente, las coordenadas cambian tras hacer scroll) y desperdician turnos. Usa siempre `javascript_tool`:
   ```js
   document.querySelector('button').click(); // abre el menú (primer botón del DOM es el toggle)
   const navBtn = Array.from(document.querySelectorAll('button'))
     .find(b => b.textContent.trim() === '<Nombre exacto de la vista>');
   navBtn.click();
   ```
   Nombres válidos de vista (texto exacto del botón de navegación): `Inicio` (Dashboard), `Buscar procesos`, `Perfil de la empresa`, `Experiencia`, `Personal`, `Evaluación`.

4. **Cargar datos de ejemplo si la vista los necesita** (la mayoría sí — una vista vacía no dice nada útil). Desde "Buscar procesos":
   ```js
   const demoBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Ver datos de ejemplo');
   demoBtn.click();
   const labels = ['Solo publicados hace', 'Solo Licitación Pública'];
   Array.from(document.querySelectorAll('input[type=checkbox]')).forEach(cb => {
     const t = cb.closest('label')?.textContent || '';
     if (labels.some(l => t.includes(l)) && cb.checked) cb.click();
   });
   ```
   Sin desmarcar esos dos filtros, la demo muestra "0 procesos" (son restrictivos por defecto). Esto deja 2 procesos: Alcaldía de Cúcuta y Área Metropolitana de Cúcuta.

5. **Archivos de ejemplo** (para "Experiencia" o "Analizar pliego (PDF)" en una tarjeta): reutiliza los fixtures ya generados en el scratchpad de la sesión (busca `pliego-demo.pdf` / `experiencia-demo.xlsx` en la carpeta `audit-ux` del scratchpad, o el nombre que corresponda si ya se regeneraron con otro contenido). El servidor estático solo sirve archivos que existen en disco dentro de `Bitacorasecop/`, así que:
   1. Copia el fixture a `C:\Users\acid_\Proyectos\Bitacorasecop\` (Bash `cp`).
   2. Súbelo vía `fetch` + `DataTransfer` + evento `change` (no hay selector de archivo real que el navegador headless pueda operar):
      ```js
      const resp = await fetch('/Bitacorasecop/<archivo>');
      const blob = await resp.blob();
      const file = new File([blob], '<archivo>', {type: blob.type});
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('bt-expeval-exp-file'); // u otro input[type=file] relevante
      input.files = dt.files;
      input.dispatchEvent(new Event('change', {bubbles:true}));
      ```
   3. Al terminar, **borra el archivo copiado** (`rm`) y confirma con `git status --porcelain` que el working tree queda limpio (solo deben quedar elementos preexistentes sin seguimiento, como `.claude/` o el zip suelto del repo — nunca el fixture).

6. **Capturar pantalla**: `computer` acción `screenshot`. Si falla con "Screenshot timed out after 5s", es un problema transitorio conocido de este entorno, no un error real — reintenta una vez automáticamente antes de reportarlo.

7. **Recorrer vistas largas**: `computer` acción `scroll` (amount máximo 10 por llamada) + screenshot, repitiendo hasta cubrir toda la vista relevante.

8. **Revisar errores reales**: `read_console_messages` con `onlyErrors: true`. Ignora los warnings benignos de PDF.js ("TT: undefined function"/"TT: invalid function id") — son ruido de librería, ya confirmados inofensivos en este proyecto, no errores de la app.

9. **Limpiar siempre al final**: `resize_window` con `preset: "desktop"` (restaura el viewport) y `mcp__Claude_Browser__preview_stop` con el `serverId` devuelto al arrancar.

## Formato del reporte final

Responde en español, con un resumen breve por sección de lo que se vio (viñetas), confirmando "0 errores de consola" o listando el hallazgo concreto si algo se ve roto (overflow, texto cortado, dato faltante, etc.). Si algo requiere datos que no están disponibles en la sesión (perfil sin guardar, pliego sin analizar), dilo explícitamente en vez de inventar el resultado — sigue el mismo principio de honestidad del resto de la app ("no determinable" antes que un dato inventado). Termina preguntando si se revisa otra vista.

## Reglas críticas

1. Reaplica el viewport móvil al inicio de CADA invocación — nunca asumas que persiste de un turno a otro.
2. Prefiere JS sobre clics directos para navegar el menú — es el único patrón confiable verificado en este proyecto.
3. Desmarca los filtros restrictivos de la demo o la lista de procesos saldrá vacía.
4. Nunca dejes archivos de prueba copiados en el repo — bórralos y verifica con `git status --porcelain`.
5. Un timeout de screenshot se reintenta una vez antes de reportarlo como falla.
6. No confundas los warnings de PDF.js con errores reales de la app.
7. No hagas commit ni push como parte de esta skill — es solo revisión visual, de solo lectura sobre el código.
