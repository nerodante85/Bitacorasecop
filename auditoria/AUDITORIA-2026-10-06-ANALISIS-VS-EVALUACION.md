# Auditoría 2026-10-06 — "Análisis de pliegos" vs "Evaluación y documentos"

Commit auditado: `737ffc8` (main, tras el PR #9). Modo: **solo inspección** (no se modificó la app).
Alcance: el solapamiento que notó el usuario + una pasada de seguridad estática, datos, documentos generados, UX/accesibilidad y QA sobre lo que toca ese flujo.
Estado de lanzamiento: **sin cambios — BETA CONTROLADA (condicionada)**. No apareció ningún CRITICAL ni HIGH nuevo; sí 4 MEDIUM y 4 LOW/INFO.

Escala de evidencia: VERIFICADO (lo medí o lo ejecuté) · PARCIAL (leído en código, no ejecutado de punta a punta) · NO VERIFICADO.

---

## 1. Respuesta a la pregunta: ¿se parecen? Sí, y es duplicación real

**Diagnóstico.** Ambas pantallas llaman al mismo motor (`evaluarMejor`) y a las mismas funciones de documentos (`descargarCartaDeProceso`, `descargarPaqueteDeProceso`). El propio código lo reconoce (`partesCompatibilidad`: "ese bloque … ahora se muestra justo arriba … repetir el mismo conteo es ruido"). El resultado: dos lugares que muestran el mismo veredicto, con riesgo de desfase (hallazgo F-01).

| Función | Análisis de pliegos | Evaluación y documentos | ¿Duplicado? |
|---|---|---|---|
| Veredicto GO/REVISAR/NO-GO y razones | Sí (resumen + "detalle del veredicto") | Sí | **Sí** |
| Gates por requisito | Solo del mejor perfil | De **cada** perfil | Parcial |
| Aviso de lectura parcial | Sí | Sí | **Sí** |
| Carta de presentación y paquete (.txt) | Solo del mejor perfil | **Por perfil** | Parcial |
| Informe de la evaluación (.txt) | Informe de análisis / de experiencia | "Descargar evaluación" | Parcial |
| Subir pliego/Estudio Previo, lectura, IA, alertas, cronograma | **Solo aquí** | No | No |
| Adjudicaciones históricas de la entidad (SECOP I + II) | No | **Solo aquí** | No |
| Sugerencia de oferta económica | No | **Solo aquí** | No |

Lo realmente exclusivo de "Evaluación" es: veredicto **por empresa**, documentos **por empresa**, adjudicaciones y oferta económica. Todo lo demás ya vive en "Análisis de pliegos".

**Propuesta (fusionar, no mantener dos pantallas)**

1. *Solución:* integrar esas cuatro piezas como secciones plegables dentro de "Análisis de pliegos" ("Por empresa y documentos", "Contexto de la entidad: adjudicaciones y oferta") y retirar "Evaluación y documentos" del menú. Se reutilizan `evalDetalleHtml`, el manejador de adjudicaciones y `sugerenciaOfertaEconomica`; los listeners ya cuelgan de ambos contenedores (`enContenedoresDeProceso`).
2. *Impacto esperado (KPIs):* un solo veredicto visible por proceso (0 desfases posibles); menú móvil de 8 a 7 ítems; menos textos que mantener (F-02); un solo punto de entrada para llegar a la carta de cualquier perfil. Costo estimado: medio (días, no semanas); sin dependencia nueva.
3. *Riesgos:* los botones por perfil necesitan `perfilId` en el contenedor nuevo; las adjudicaciones tardan hasta ~48 s sin caché (ya documentado), deben cargar bajo demanda y no al abrir; hay que migrar las pruebas que apuntan a `bt-eval-*`. Conviene hacerlo con prueba primero y mutación.

---

## 2. Hallazgos

| ID | Sev. | Hallazgo | Evidencia | Estado |
|---|---|---|---|---|
| F-01 | MEDIUM | **"Evaluación" puede mostrar un veredicto desactualizado.** `runEvaluacion` solo corre al pulsar "Evaluar"; nada refresca `#bt-eval-out` cuando el análisis cambia (leer más páginas, confirmar un requisito). En una pantalla de decisión, un GO viejo es un riesgo de integridad. El comentario de la línea ~8765 documenta un bug de la misma clase ya vivido. | Código: único disparador en `index.html` (`evalRunBtn` click); `render()` solo repuebla el selector. | PARCIAL |
| F-02 | MEDIUM | **Regresión del PR #9: textos que mandan al lugar equivocado.** Tras mover el análisis, 13 referencias siguen diciendo "ve a Buscar procesos" para subir el PDF, "Seguir leyendo" o ver el detalle: líneas 7819, 7866, 7874, 7906, 7946, 8201, 10576 (más el texto de ayuda de Evaluación, línea 1781, que afirma que el veredicto "aparece directo en la tarjeta de Buscar procesos", y las guías de Experiencia/Personal/Inicio, líneas 1226, 1637, 1663, 1690, 1757). Hoy "Buscar" ya no tiene esos controles. | `grep -n "Buscar procesos"` | VERIFICADO |
| F-03 | MEDIUM | **Las dos vistas no avisan si los datos son de ejemplo o de respaldo.** Con "Ver datos de ejemplo" activo, "Análisis de pliegos" no muestra ningún aviso (medido: el texto de la vista no contiene "ejemplo/respaldo"). Las cartas bloquean solo el modo demo; con el snapshot de respaldo (`snapshot.json`, posiblemente viejo) sí se generan. | Playwright con datos de ejemplo. | VERIFICADO |
| F-04 | MEDIUM | **Un análisis guardado solo es alcanzable si el proceso está en la búsqueda actual.** El selector usa `lastScored` (ya recortado a 40 por `limiteLista`). Un pliego analizado ayer de un proceso que hoy no sale queda invisible en ambas vistas, aunque exista en `analisis`. Ya se advirtió en el PR #9. | Lectura de `renderAnalisisView`/`poblarEvalSelect`; recarga limpia lista 40 procesos del snapshot. | PARCIAL |
| F-05 | LOW | **El foco del teclado se pierde al redirigir.** Tras pulsar "Analizar pliego →" con Enter, `document.activeElement` queda en `BODY` (medido). Un usuario de teclado o lector de pantalla no sabe dónde está. Ocurre en toda la navegación (`mostrarVista` no gestiona el foco), pero el nuevo flujo depende de ella. | Playwright, tecla Enter. | VERIFICADO |
| F-06 | LOW | **Ítems del menú móvil de 40 px** frente a la regla del proyecto de 44 px (la regla táctil cubre `.nav-toggle`, inputs y selects, no `.nav-item`). Igual antes y después del PR #9 (40 px). Cumple WCAG 2.2 AA (mínimo 24 px) pero no el estándar propio. | Medición a 375 px, versión anterior y actual. | VERIFICADO |
| F-07 | LOW | **Pruebas del PR #9 son de texto, no de comportamiento.** La prueba nueva comprueba cadenas del código; el flujo real (botón → vista → selector) solo se probó a mano. Un cambio que rompa la redirección pasaría el CI. | `tests/smoke.mjs`, prueba "Buscar procesos: la tarjeta de la lista…". | VERIFICADO |
| F-08 | LOW | **Carta de presentación:** solo marca "por verificar" las declaraciones 2, 3 y 7; las 1 y 4 ("conozco y acepto el pliego", "me comprometo a suscribir") afirman cosas en nombre de la empresa sin marca. Además da por hecho "sociedad" y "cédula" aunque el perfil sea persona natural. No inventa datos de la empresa (usa `[COMPLETAR]`). Requiere revisión jurídica profesional. | Lectura de `generarCartaTexto`. | INFERIDO |
| F-09 | INFO | `Access-Control-Allow-Origin: *` en las 3 Edge Functions con `verify_jwt = true`: riesgo bajo porque exigen JWT; restringir al origen de GitHub Pages sería higiene. CSP con `'unsafe-inline'` en scripts: conocido y asumido (sin build). | `supabase/functions/*/index.ts`, meta CSP. | VERIFICADO |
| F-10 | INFO | RLS activado en las 5 tablas (`companies`, `company_members`, `app_state`, `app_state_analisis_items`, `ai_usage`) y políticas de Storage del bucket `pliegos`; `daily-digest` con `verify_jwt=false` protegida por `x-cron-secret`. Sin hallazgos nuevos. | `schema.sql`, `migrations/`, `config.toml`. | PARCIAL (no probé acceso cruzado entre empresas con dos cuentas reales) |

---

## 3. Lo que sí está bien (con evidencia)

- **Motor de cumplimiento:** `node tests/smoke.mjs` da 281 correctas; el único fallo local es el chequeo de SRI de CDN, que necesita internet (en CI pasa). Cubre veredicto de punta a punta, citas verificadas contra el PDF, NO DETERMINABLE ante la duda y límites de la IA (esquema ≤16 uniones, tope de 100 páginas).
- **Documentos:** campos faltantes quedan como `[COMPLETAR: …]`, nunca inventados; bloqueo en modo demo; nota de "plantilla orientativa, no es el formato oficial".
- **SECOP I y II separados:** cada adjudicación lleva `fuente: 'I' | 'II'`; SECOP I no aporta presupuesto base (TR-001) y los conteos por fuente se muestran. Búsqueda de procesos solo en SECOP II (decisión documentada).
- **Móvil:** la vista nueva no desborda a 375 px y sus controles miden 44 px.

---

## 4. Qué NO verifiqué (para no dar falsa seguridad)

- Llamadas reales a las Edge Functions/Claude, correo diario y login real (sin cuenta ni crédito en el sandbox).
- Consultas en vivo a SECOP I y SECOP II desde la app (la integración se revisó solo leyendo el código).
- El sitio publicado en GitHub Pages (el sandbox no llega a `github.io`).
- Acceso cruzado entre empresas con dos cuentas reales; rendimiento con pliegos de 100+ páginas; restauración de respaldos.
- Lector de pantalla real y orden de tabulación completo de la vista nueva (solo medí el foco tras la redirección).

## 5. Prioridad sugerida

1. **F-01 + F-02 + fusión de pantallas** (resuelve de raíz el solapamiento): un solo veredicto, textos coherentes.
2. **F-03** (aviso de datos de ejemplo/respaldo en la vista de análisis): bajo costo, evita decidir sobre datos no reales.
3. **F-04** (poder abrir cualquier análisis guardado).
4. F-05, F-06, F-07, F-08 como pulido; F-09 como higiene.

Criterio de cierre por hallazgo: prueba que falla antes y pasa después (con mutación para F-01, F-03 y F-04) y medición en navegador real para F-05 y F-06.

---

## 6. Cierre posterior (fusión de las dos pantallas)

La pantalla "Evaluación y documentos" se fusionó en "Análisis de pliegos" (rama `claude/affectionate-allen-87jomu`).

| ID | Estado | Verificación |
|---|---|---|
| F-01 (veredicto desactualizado) | **CERRADO** | Ya no existe el panel que se calculaba solo al pulsar "Evaluar": las secciones viven dentro de la tarjeta de análisis y se redibujan con ella. Prueba nueva en `tests/smoke.mjs`; en navegador real, con y sin pliego, con 1 y 2 empresas: sin errores de JS. |
| F-02 (textos obsoletos) | **CERRADO** | 12 textos corregidos; la prueba nueva falla si reaparece alguno de los viejos. |
| Solapamiento | **CERRADO** | Un solo veredicto por proceso; menú de 7 ítems; una `ultima_vista` guardada como `evaluacion` abre "Análisis de pliegos". |
| F-03, F-04, F-05, F-06, F-07, F-08, F-09 | **ABIERTOS** | No se tocaron en esta fusión. |

Regresión encontrada y corregida durante la fusión: con una sola empresa y sin pliego analizado desaparecían la carta y el paquete por empresa (la pantalla vieja sí los ofrecía). Prueba nueva verificada por mutación.
No verificado: adjudicaciones en vivo (sin red a datos.gov.co en el sandbox), sitio publicado y lectura real de un pliego con IA.
