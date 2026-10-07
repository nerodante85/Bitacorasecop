# Reestructuración "Buscar → Analizar → Comparar → Decidir" — Auditoría (Fase 1) y Plan (Fase 2)

Fecha: 2026-10-07 · Rama: `claude/sharp-archimedes-8vzd9g` · Base medida: `smoke.mjs` 289 ok / 1 fallo
(el fallo es el SRI de los CDN: **solo falla sin salida a internet**, en CI pasa) y `e2e.mjs` 6/6.

Pregunta que guía cada decisión: **¿esto ayuda al gerente de una constructora a decidir si vale la pena presentarse?**

---

## 1. Diagnóstico (Fase 1)

### 1.1 Arquitectura actual
- Sitio estático sin build: `index.html` (12.682 líneas, 794 KB: HTML + CSS + un `<script>` inline con ~376 funciones) +
  `lectura.js`, `evaluacion.js` (motor, sin DOM), `coincidencia.js` (copia idéntica en `daily-digest`), `vendor/xlsx`.
  pdf.js, Tesseract, mammoth y supabase-js por CDN con SRI.
- Persistencia: `window.storage` (shim de `localStorage`, prefijo `bitacora_`) → con cuenta, sincroniza a Supabase
  (`app_state`, y `app_state_analisis_items` por elemento). Texto completo de pliegos en IndexedDB (solo local).
- Supabase: 4 Edge Functions (`extraer-requisitos`, `transcribir-pdf`, `daily-digest`, `eliminar-cuenta`), RLS por empresa,
  bucket privado `pliegos` (tránsito, se borra al terminar), CORS restringido a `nerodante85.github.io`.
- Datos: SECOP II `p6dx-8zbt` (búsqueda), SECOP I `f789-7hwg` (solo adjudicaciones de una entidad), PAA `9sue-ezhx`.

### 1.2 Vistas y flujo actual (7 ítems de menú)
`dashboard · buscar · analisis · perfil · experiencia · personal · pipeline`.
Flujo actual: Inicio (5 tarjetas de cifras + respaldo + alertas + actividad + 6 accesos) → Buscar (3 paneles apilados antes de
los resultados: filtros, "Preparación para analizar un pliego", alertas, PAA) → "Analizar pliego →" → Análisis de pliegos
(selector + tarjeta con ~9 secciones plegables) → Perfil/Experiencia/Personal en 3 pantallas separadas → Pipeline Kanban de 6 etapas.

### 1.3 Problemas de UX
| # | Problema | Evidencia |
|---|---|---|
| U1 | 7 módulos de menú; Experiencia/Personal/Perfil son una sola idea ("mi empresa") partida en 3 pantallas | `VISTAS`, `#bt-nav` |
| U2 | Inicio es un tablero de métricas (5 `stat-card`, respaldo, alertas) — no responde "¿qué proceso busco?" | `view-dashboard` |
| U3 | Buscar muestra 5 campos de filtro + 3 paneles secundarios antes del primer resultado | `view-buscar` |
| U4 | El veredicto vive en una tarjeta con ~9 secciones plegables; no hay una tabla única "Requisito / Exigencia / Empresa / Resultado / Evidencia" | `renderAnalysisHtml` |
| U5 | La evidencia (cita + página) está dispersa: fila de IA, bloque de experiencia, gates | `bloqueRequisitosIAHtml`, `bloqueExperienciaHtml` |
| U6 | Pipeline de 6 etapas con consorcio/adjudicado/perdido = un mini-CRM | `ETAPAS_PIPELINE` |
| U7 | Hay que elegir el proceso en un `<select>` dentro de "Análisis de pliegos" aunque venga de una tarjeta | `bt-analisis-select` |
| U8 | El veredicto global solo tiene 3 valores; "NO DETERMINABLE" existe por requisito pero no como resultado global | `decidirVeredicto` |
| U9 | Textos que mandan a pantallas que desaparecen ("Perfil de la empresa", "Pipeline", "Análisis de pliegos") | ~40 cadenas |

### 1.4 Problemas técnicos / de riesgo
- T1 Monolito de 12,7 mil líneas; cualquier cambio de nombre rompe `smoke.mjs`, que extrae funciones **por anclas de texto**.
- T2 La búsqueda del usuario pide "búsqueda natural"; la versión con LLM se construyó y **se eliminó por costo** (HISTORIAL
  §"LLM para lenguaje natural"). → Se resuelve con un intérprete **determinista** (sin IA, sin costo).
- T3 El prompt pide SECOP I en la búsqueda; el HISTORIAL (§"Fase 2 … SECOP I") midió 6,4 M de filas, ~2.700 realmente abiertas,
  y se **acordó con el usuario** no mezclarlo. → Se conserva SECOP I donde aporta (histórico de adjudicación en el detalle del proceso).
  **Decisión abierta para el usuario** (ver §5).
- T4 Pliegos largos (~70+ págs) pueden superar los ~150 s del plan gratuito; ya se recortan páginas relevantes y se informa la
  lectura parcial (`lecturaParcial`, `gateLecturaParcial`, "posible tabla no leída").
- T5 La clave `sb_anon`/JWT `anon` en `index.html` es **pública por diseño** (no es `service_role`); la barrera es RLS.

### 1.5 Seguridad y privacidad (revisión del repositorio, sin tocar producción)
- ✅ RLS habilitada en `companies`, `company_members`, `app_state`, `app_state_analisis_items`; `ai_usage` con RLS **sin** policies.
- ✅ Bucket `pliegos` privado, policies por carpeta de empresa, archivos borrados al terminar y barrido diario.
- ✅ Secretos solo como secrets de Supabase; CORS exacto (nunca `*`); `verify_jwt`; cupo diario reservado antes de llamar a Claude.
- ✅ CSP por `<meta>` con `connect-src` fijo; SRI en CDN; pdf.js con `isEvalSupported:false`.
- ⚠️ Limitación de GitHub Pages (documentar): no hay cabeceras HTTP propias (HSTS, `frame-ancestors`, `X-Content-Type-Options`);
  la CSP por `<meta>` no puede usar `frame-ancestors`. Mitigación parcial: la app no maneja pagos ni datos sensibles de terceros.
- ⚠️ Abiertos conocidos (RELEASE-BLOCKERS): política de privacidad con `[COMPLETAR]`, CAPTCHA, dominio SMTP, medir inyección
  contra el modelo real. **No se inventa texto jurídico.**
- Inventario de datos para la política (lo que el código permite afirmar): perfiles, experiencia, personal, historial y análisis →
  `localStorage` (navegador) y, con cuenta, Supabase (`app_state*`); texto de pliegos → solo IndexedDB local; PDF → Storage solo
  mientras la IA lo lee (se borra al terminar o en ≤24 h); nombres de empresa/alertas → correo vía Resend; PDF/páginas →
  Anthropic cuando el usuario pulsa "con IA". Eliminación: botón "Eliminar mi cuenta y mis datos" (cascada + Storage + Auth).
  **No se puede afirmar** plazo de conservación de backups de Supabase ni transferencia internacional (campos `[COMPLETAR]`).

### 1.6 Funciones críticas (no se tocan sin pruebas)
Búsqueda SECOP II + filtros (`runSearch`, `fetchAllForDataset`), lectura de PDF/OCR/IA (`lectura.js`, `extractPdfText`,
`ocrPdfPages`, `transcribirPaginasConIA`), extracción y verificación de citas (`extraerRequisitosConIA`, `verificarFilaIA`,
`citaCoincideAproximada`), motor (`evaluacion.js`, `evaluarRequisito`, `parseValorUnidad`), cuentas/RLS/Edge Functions.

### 1.7 Pruebas existentes
`tests/smoke.mjs` (290 comprobaciones; lógica ejecutada de verdad con datos sintéticos, mutaciones documentadas),
`tests/e2e.mjs` (6 flujos en navegador real sin red). Hay skills de verificación por mutación, medición responsive y archivos reales.

---

## 2. Matriz de funciones (Fase 1 → decisión)

| Función actual | Ubicación | Importancia | Acción |
|---|---|---|---|
| Búsqueda SECOP II + filtros | `view-buscar`, `runSearch` | Crítica | **CONSERVAR** (filtros secundarios → "Más filtros") |
| Búsqueda natural | (eliminada por costo) | Media | **CREAR determinista** (sin IA) |
| SECOP I | `buscarAdjudicaciones` | Media | **COMBINAR** → "Histórico de adjudicación" del proceso |
| Análisis de pliego (PDF/Word/EP) | `analisis`, `lectura.js` | Crítica | **CONSERVAR** |
| Lectura OCR / IA por tandas | `ocrPdfPages`, `transcribir-pdf` | Crítica | **CONSERVAR** |
| Extracción + verificación de citas | `extraerRequisitosConIA`, `verificarFilaIA` | Crítica | **CONSERVAR y PROTEGER** |
| Motor GO/REVISAR/NO-GO | `evaluacion.js` | Crítica | **CONSERVAR**; **REFACTORIZAR** solo para exponer "NO DETERMINABLE" global |
| Tarjeta de análisis (9 plegables) | `renderAnalysisHtml` | Crítica | **REFACTORIZAR**: resumen de viabilidad + alertas + matriz + panel de evidencia |
| Evidencia (cita/página) | filas IA, experiencia | Crítica | **REFACTORIZAR** → panel lateral "Ver evidencia" |
| Perfil de empresa (RUP/RUT/K) | `view-perfil` | Alta | **COMBINAR** → Empresa › Datos |
| Experiencia | `view-experiencia` | Crítica | **COMBINAR** → Empresa › Experiencia |
| Personal | `view-personal` | Alta | **COMBINAR** → Empresa › Personal (sin gestión avanzada) |
| Pipeline Kanban (6 etapas) | `view-pipeline` | Media | **REFACTORIZAR** → "Mis procesos" (5 estados) |
| Historial / "Actividad reciente" | `historial`, dashboard | Media | **COMBINAR** → Inicio (actividad) y Mis procesos |
| Dashboard (5 cifras) | `view-dashboard` | Baja | **ELIMINAR de la UI**; Inicio = buscador + acciones + actividad |
| Respaldo de datos (.json) | dashboard | Media | **OCULTAR** → Configuración y ayuda |
| Alertas guardadas + correo diario | panel en Buscar, `daily-digest` | Baja | **OCULTAR** (dentro de "Más filtros"; el correo sigue técnico) |
| PAA | panel en Buscar | Baja | **OCULTAR** (desplegable al pie de Buscar; no es módulo) |
| Adjudicaciones + sugerencia de oferta | sección del análisis | Baja | **COMBINAR** → "Histórico de adjudicación" en el detalle; oferta económica queda oculta dentro de él |
| Carta / paquete / hojas de vida / plantillas | botones del análisis | Baja | **OCULTAR** (no hay botón principal; quedan en "Más acciones") |
| Stepper "Preparación para analizar" | Buscar | Baja | **ELIMINAR** (se reemplaza por un aviso de "faltan datos de la empresa" en el análisis) |
| Cuenta / sesión / eliminar cuenta | sidebar foot | Alta | **CONSERVAR** (zona secundaria) |
| Documentos | (no existe como sección) | Media | **CREAR**: índice honesto de lo cargado (no almacena archivos nuevos) |

## 3. Plan (Fase 2)

**Mantener**: motor, lectura, IA con verificación de citas, búsqueda SECOP II, RLS/Edge Functions, respaldo, cuentas, pruebas.
**Combinar**: Perfil+Experiencia+Personal → *Empresa* (3 pestañas internas, mismos ids DOM); SECOP I/adjudicaciones/oferta → detalle del proceso.
**Ocultar**: PAA, alertas, respaldo, carta/paquete, ayuda (zona secundaria "Configuración y ayuda").
**Eliminar de la UI**: dashboard de cifras, stepper de preparación, pipeline de 6 etapas.
**Refactorizar**: `decidirVeredicto` (+`NO DETERMINABLE` global, función pura nueva), tarjeta de análisis, pipeline → Mis procesos con migración de etapas.
**Crear**: navegación de 4 ítems; Inicio simple; intérprete de búsqueda natural determinista; Resumen de viabilidad; Alertas críticas/revisar;
matriz de requisitos con filtro; panel lateral de evidencia; vista Documentos; avisos de análisis parcial; pruebas de los 6 casos del prompt.

Orden de ejecución (cada paso con pruebas antes y después, un commit por paso):
1. Motor: veredicto global con NO DETERMINABLE (+ prueba + mutación).
2. Navegación de 4 ítems, Empresa con pestañas, redirecciones de vistas antiguas, Configuración y ayuda.
3. Inicio simple + Mis procesos (5 estados con migración).
4. Buscar: búsqueda natural determinista, "Más filtros", paneles secundarios fuera del camino.
5. Análisis: resumen de viabilidad, alertas, matriz, panel de evidencia, avisos de parcialidad.
6. Documentos.
7. Seguridad/privacidad: inventario y correcciones reales.
8. Pruebas e2e nuevas, documentación (CLAUDE.md, README) y auditoría final con 6 roles.

## 4. Funcionalidades futuras (NO se implementan)
Verificación de dominio/SMTP para abrir la beta; caché de IA por hash de PDF; migrar pdf.js a 4.x; exportar el análisis a PDF;
comparación lado a lado de dos procesos; búsqueda en SECOP I filtrada por estados abiertos (nota de HISTORIAL).

## 5. Decisiones abiertas para el usuario
1. **SECOP I en la búsqueda**: el prompt lo pide; el HISTORIAL documenta por qué se descartó (mezcla contratos cerrados con oportunidades).
   Por defecto: **no** se agrega; SECOP I aparece como "Histórico de adjudicación" de cada proceso. ¿Quieres reabrirlo?
2. **Texto de la política de privacidad**: solo la persona responsable puede dar los campos `[COMPLETAR]`.

---

## 6. Resultado de la ejecución (2026-10-07)

Hecho: motor con NO DETERMINABLE global; menú de 4 ítems + Configuración; Empresa con pestañas; Inicio simple; Mis procesos (5 estados con
migración); búsqueda natural determinista; filtros de valor/entidad/cierre; pantalla de análisis (resultado, viabilidad, alertas, matriz, evidencia);
Documentos; pruebas nuevas (smoke 304 ok salvo el SRI sin red; e2e 13/13) con mutaciones sobre las reglas críticas.

Seguridad (revisión del código, sin tocar producción): sin secretos en el repo (la clave `anon` es pública por diseño); RLS con `USING` que actúa como
`WITH CHECK` en `app_state`; todo texto dinámico nuevo pasa por `escapeHtml`. Sin hallazgos nuevos que corregir. Límite de GitHub Pages: sin cabeceras HTTP propias.

**FUTURA FUNCIONALIDAD** (no implementada): guardar hojas de vida/matrículas como archivos en Storage privado; búsqueda en SECOP I filtrada por estados abiertos;
exportar el análisis a PDF; comparar dos procesos lado a lado.

Pendiente de verificar con el usuario: SECOP I en la búsqueda (decisión abierta, §5), texto jurídico de privacidad, y una extracción real con IA tras el rediseño
(no probada: requiere cuenta y crédito).
