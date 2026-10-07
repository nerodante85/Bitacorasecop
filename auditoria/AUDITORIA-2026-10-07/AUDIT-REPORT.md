# AUDIT-REPORT — Auditoría de fidelidad de extracción y trazabilidad (2026-10-07)

**Alcance pedido:** determinar si la aplicación cumple su propósito (analizar procesos de contratación pública y evaluar la viabilidad de participación de una empresa), con foco en la **precisión y trazabilidad de la extracción e interpretación de RUP, RUT, Estudios Previos y Pliegos de Condiciones**, y en detectar alucinaciones, datos inventados, omisiones e inconsistencias.

**Versión auditada:** `main` @ `a4cd551` (PR #26 y #27 ya fusionados). **Modo:** solo lectura. No se corrigió nada (regla 20 del método). Las sondas se guardan en `sondas/` y son reproducibles.

> Esta auditoría **no** certifica seguridad ni cumplimiento legal. Las conclusiones jurídicas (RUP, inhabilidades, protección de datos) requieren revisión profesional.

---

## 1. Veredicto

| | |
|---|---|
| **Estado de lanzamiento** | **BLOQUEADO para lanzamiento general** (hay 5 riesgos de integridad HIGH que pueden producir una conclusión empresarial incorrecta). Estado anterior: BETA CONTROLADA. |
| **Uso hoy** | Aceptable como **herramienta de apoyo con un usuario experto que verifica contra el documento oficial** (así está declarado en la propia pantalla: "Orientativo"). No debe presentarse como veredicto confiable a terceros. |
| **CRITICAL** | 0 |
| **HIGH** | 5 (A7-01 a A7-05) |
| **MEDIUM** | 5 (A7-06 a A7-10) |
| **LOW / INFO** | 5 (A7-11 a A7-15) |
| **Lo bueno, verificado** | Ninguna sonda encontró un dato **inventado de la nada**: cada cifra mostrada sale de un texto real. Los fallos son de **interpretación** (se toma la cifra equivocada, o se calla algo que debería avisar), no de fabricación. |

**Respuesta corta a "¿cumple su propósito?":** parcialmente. Lee bien los documentos *cuando el texto es limpio y el requisito está donde lo espera*, y ante la duda suele decir NO DETERMINABLE (el principio de diseño se cumple en la mayoría de rutas). Pero hay **cinco rutas concretas** donde puede afirmar GO, NO-GO o un umbral que la fuente no sustenta, y **una cadena de trazabilidad rota** en el camino por texto (la página no se guarda).

---

## 2. Método y cobertura

Se ejecutaron **inline** (sin subagentes) los frentes que el método pide. Estado de cada uno:

| Frente | Qué se hizo | Evidencia |
|---|---|---|
| SECOP I | **No aplica**: retirado por decisión del usuario. Se buscó código residual. | A7-14 |
| SECOP II | Búsqueda en vivo de LP-008-2026 con la app real y comparación campo por campo con el registro oficial de datos.gov.co. | VERIFICADO (§3) |
| Pliegos / Estudio Previo | 14 redacciones adversarias de indicadores y 5 de K residual contra el extractor real. | EP-01…EP-16, KR-01…KR-05 |
| RUP | Parser contra texto con formato Confecámaras y 8 variantes adversarias. | RUP-01…RUP-08 |
| RUT | Parser por posición (x,y) con 5 casos. | RUT-01…RUT-05 |
| Veredicto / reglas de negocio | `evaluarProceso` real, y la pantalla real con análisis sembrados. | VER-01…06, UI-01…03 |
| IA / anti-alucinación | Verificador de citas y conversión a umbrales con filas buenas, inventadas y cruzadas. Revisión del prompt. | IA-01…IA-05 |
| Generación documental | Carta de presentación con perfil vacío y persona natural. | DOC-01, DOC-02 |
| Experiencia, capacidad residual (cálculo) | **Solo comprobación de humo.** Ya auditadas a fondo (MC-001…MC-015, RT-001…014). | VER-04…06 |
| Seguridad, privacidad, rendimiento, DevOps | **No se re-ejecutaron.** Se remite a `auditoria/RELEASE-BLOCKERS.md` (SEG-001, PRIV-001 siguen parciales). | NO VERIFICADO hoy |
| UX/Accesibilidad | Solo lo que afecta a entender el resultado (pantalla de análisis y evidencia). Sin barrido WCAG. | parcial |

**Cómo reproducir:**
```
node auditoria/AUDITORIA-2026-10-07/sondas/correr-sondas.mjs                                   # motor real: 50 sondas
PLAYWRIGHT_NODE_MODULES=/opt/node-tools/node_modules CHROME_PATH=/opt/pw-browsers/chromium \
  node auditoria/AUDITORIA-2026-10-07/sondas/sondas-ui.mjs                                     # pantalla real, análisis sembrados
  node auditoria/AUDITORIA-2026-10-07/sondas/sondas-vivo.mjs                                   # app real contra datos.gov.co en vivo
```
Resultado de la corrida del motor: **OK=25 · HALLAZGO=22 · INFO=3** (los 22 se agrupan en los 15 hallazgos de abajo).

### Límites honestos
1. **No hubo un RUP, RUT, Estudio Previo ni Pliego reales** en el entorno. Las pruebas usan texto sintético que reproduce los formatos descritos en el código y en tus capturas. Los hallazgos de **formato del RUP** (A7-06, A7-07) son por tanto **PARCIALMENTE VERIFICADOS**: el defecto del código es real, pero si el RUP real los dispara depende de su formato exacto.
2. **No se llamó a Claude real** (sin crédito/clave en este entorno). No se mide con qué frecuencia el modelo cruza indicadores o inventa; se demuestra que **el código no lo detectaría si ocurriera**.
3. La **fecha de cierre** de LP-008-2026 difiere entre dos fuentes públicas (§3); no hay forma de decidir desde aquí cuál es la vigente.

---

## 3. Lo verificado contra la fuente (cadena completa)

**SECOP II, LP-008-2026 (Guamo, Tolima)** — búsqueda real de la app contra `p6dx-8zbt`, comparada con la API oficial:

| Dato | Registro oficial | Lo que muestra la app | Resultado |
|---|---|---|---|
| Cuantía | `precio_base` = 3449518408 | $3.449.518.408 | ✓ VERIFICADO |
| Ubicación | Tolima · Guamo | Tolima · Guamo | ✓ |
| Modalidad / tipo | Licitación pública Obra Publica / Obra | igual | ✓ |
| Número de proceso | `referencia_del_proceso` LP-008-2026 | LP-008-2026 | ✓ |
| Publicación | 2026-09-29 | 29 de sept de 2026 | ✓ |
| Duración | 5 Mes(es) | 5 mes(es) | ✓ |
| Estado | `estado_del_procedimiento` Publicado · `fase` Presentación de observaciones | "Publicado" | ✓ exacto, pero oculta la fase (A7-15) |
| **Cierre** | `fecha_de_recepcion_de` = **2026-10-28** | 28 de oct de 2026 (21 días) | ✓ fiel al dataset, **pero colombialicita muestra 2026-10-16** (A7-10) |

Documentación oficial de la columna: *"Fecha asignada para la recepción de respuestas por parte de los proveedores"*. El dataset se actualizó por última vez el 2026-10-07 02:04 UTC; colombialicita marca "Última revisión 2026-09-30". Inferencia (no verificada): el dataset es más reciente, probablemente por una adenda.

---

## 4. Hallazgos

Formato: ID · severidad · categoría · confianza · estado (todos **ABIERTO**, nada se corrigió).

### HIGH

#### A7-01 · HIGH · Veredicto — un análisis solo con Estudio Previo puede dar **GO**
- **Evidencia:** VER-01 (motor) y UI-01 (pantalla real). Con `esSoloEP: true` y todo lo extraído en verde, el resultado mostrado es **GO** ("No se identificaron incumplimientos determinantes…"). El resumen de arriba **no menciona** que no hay Pliego.
- **Ubicación:** `evaluacion.js` `evaluarProceso` / `veredictoGlobal`: `hayPliego = !!entry` (un análisis de Estudio Previo cuenta como "pliego"). La nota "basado solo en el Estudio Previo" existe, pero más abajo (`index.html` ~9039).
- **Impacto:** El Estudio Previo no es el documento vinculante; el Pliego definitivo puede cambiar indicadores, experiencia o plazos. Un GO en esa etapa puede llevar a decidir con requisitos provisionales.
- **Corrección propuesta:** si `entry.esSoloEP`, el resultado máximo es **REVISAR** (o una etiqueta propia "GO PRELIMINAR · falta Pliego") y el resumen superior lo dice en la primera línea.
- **Criterio de aceptación:** prueba que, con Estudio Previo y todo en verde, el resultado no es GO; la primera línea del resumen nombra el documento base.
- **Confianza:** alta (reproducido en motor y pantalla).

#### A7-02 · HIGH · Pliegos/EP — el umbral puede salir de un **texto narrativo** o de la **primera aparición**
- **Evidencia:** EP-07, EP-08, EP-09, EP-15, KR-04.
  - Estudio del sector: *"…el índice de endeudamiento promedio fue 0,52. REQUISITOS: … endeudamiento menor o igual a 0,70"* → la app toma **0,52** (el promedio del sector), no 0,70.
  - Dos lotes (liquidez 1,2 y 2,0) o una "referencia" no vinculante (1,0) seguida del valor real (1,6) → toma el **primero** sin avisar.
  - *"capacidad residual promedio de los oferentes fue de $12.000.000.000"* → se toma como K residual exigida.
- **Ubicación:** `buscarUmbralCerca` / `extraerKResidualUmbralPrimero` (`index.html`): devuelve el primer candidato sin comparar con las demás apariciones. La detección de conflicto (IA-004) existe solo para filas de IA y para K residual con montos distintos, no para liquidez/endeudamiento/cobertura por texto.
- **Impacto:** un umbral equivocado en cualquier dirección da un NO-GO falso o un CUMPLE falso. Los Estudios Previos suelen incluir un análisis del sector, así que el patrón es **realista**.
- **Corrección propuesta:** (a) ignorar ventanas cuya oración contenga "promedio", "sector", "referencia", "estimado", "histórico"; (b) si el mismo indicador aparece con valores distintos en el documento, marcar **conflicto** (NO DETERMINABLE) y mostrar ambas citas.
- **Criterio de aceptación:** EP-07/08/09/15 y KR-04 pasan a "sin dato" o "conflicto", nunca a un valor.
- **Confianza:** alta.

#### A7-03 · HIGH · IA — una fila con el **indicador cruzado** se verifica y alimenta el motor
- **Evidencia:** IA-03, IA-04, IA-05. Con una cita **real y exacta** ("liquidez ≥ 1,2 … endeudamiento ≤ 0,70"), una fila que diga `indicador: liquidez, valor 0,7` queda `verificada = true`, sin bloqueo, y el motor usa **0,7** como umbral de liquidez (CUMPLE con liquidez 1,0). Una cita sin nombrar el indicador ("mayor o igual a 1,2") respalda cualquier indicador que la IA elija.
- **Ubicación:** `verificarFilaIA` verifica que la cifra aparezca en la cita y su unidad, pero `contextoDeCifra` devuelve `null` para indicadores ("demasiado variables"), y `exigenciasDesdeIA` confía en `f.indicador`.
- **Impacto:** es exactamente el error "cifra tomada del campo vecino" que IA-001 cerró para experiencia, pero **no** para la capacidad financiera. No se midió la frecuencia con que el modelo real lo comete (NO VERIFICADO), pero el código no lo detectaría.
- **Corrección propuesta:** exigir que la raíz del nombre del indicador (liquidez, endeudamiento, cobertura, patrimonio, capital de trabajo) aparezca en la cita **y** que la cifra esté en la misma oración/línea que ese nombre; si no, bloquear la fila (queda "sin verificar").
- **Criterio de aceptación:** IA-03/04/05 pasan a bloqueo; las filas correctas (IA-01) siguen verificándose.
- **Confianza:** alta (del código); media (de la ocurrencia real).

#### A7-04 · HIGH · Categorizador — "rup" es una **subcadena**: genera falsos UNSPSC, falsos NO-GO y puede perder el requisito real
- **Evidencia:** CAT-01, CAT-02, CAT-03.
  - "…actos de **corrup**ción…" se clasifica como hallazgo "RUP / Clasificador" (CAT-01).
  - Si esa frase va **antes** del requisito real, solo queda registrada la primera frase y el requisito con los códigos se **pierde** (CAT-02, `chunks.find` toma una sola coincidencia por disparador).
  - Un número de 8 dígitos en esa misma frase (p. ej. `CO1.NTC.10975958`) se toma como código UNSPSC exigido y el gate da **"Tu RUP no cubre ninguno de los códigos del pliego (10975958)" → NO-GO** (CAT-03).
- **Ubicación:** `REQUISITO_CATEGORIAS` / `analizarTexto` (`c.toLowerCase().includes('rup')`) y `codigosExigidosEnPliego` (`evaluacion.js`, regex de 8 dígitos sin exigir contexto de clasificación).
- **Impacto:** "corrupción" aparece en casi todo pliego (pacto de integridad, Estatuto Anticorrupción). Un NO-GO por un código que no es un código es una conclusión sin sustento en la fuente.
- **Corrección propuesta:** disparador con límite de palabra (`\brup\b`); extraer códigos solo de frases que contengan "UNSPSC"/"clasificador"/"clasificación"; validar la familia UNSPSC; y ante un `fail` sustentado solo por estos códigos, degradar a "revisar".
- **Criterio de aceptación:** CAT-01/02/03 pasan; un requisito UNSPSC real con 3 códigos sigue evaluándose.
- **Confianza:** alta.

#### A7-05 · HIGH · Veredicto — por texto, requisitos **detectados pero no evaluados** no impiden el GO
- **Evidencia:** EP-16, VER-02, UI-02. `extraerExigencias` solo extrae liquidez, endeudamiento, cobertura, K residual y consorcio. **Patrimonio, capital de trabajo y rentabilidad no se extraen ni generan gate** por texto. Con capital de trabajo, rentabilidad del patrimonio y garantía exigidos (la propia app los detecta como hallazgos), el resultado es **GO**, con "Garantías: NO DETERMINABLE" y "Personal: NO DETERMINABLE" en el mismo resumen.
- **Ubicación:** `extraerExigencias`; `evaluarProceso` (rama `if (entry)`); `resumenViabilidad` (garantías siempre ND, no bloquea).
- **Impacto:** el resultado contradice la regla de diseño ("ante la duda, NO DETERMINABLE"). Con IA el gate "Requisitos por verificar a mano" lo cubre; **sin IA no hay equivalente**.
- **Corrección propuesta:** un gate "Requisitos detectados sin evaluar" en estado `nd` cuando existan hallazgos de Capacidad Organizacional/Financiera/Garantías sin gate propio. Alternativa: que GO exija que ninguna de las 5 áreas esté en NO DETERMINABLE.
- **Criterio de aceptación:** VER-02 y UI-02 dan REVISAR.
- **Confianza:** alta.

### MEDIUM

#### A7-06 · MEDIUM · RUP — se pueden **inventar códigos UNSPSC** desde números que no lo son
- **Evidencia:** RUP-02 (sin encabezado de clasificación, 8 dígitos separados por espacio: cédula `88245678`, fecha `20260115`, teléfono `31245678` → 3 códigos falsos) y RUP-03 (fechas `15.03.24` y `30.03.25` → `15032400`, `30032500`).
- **Ubicación:** `extraerCodigosUNSPSC(secClasif || flat, true)`: sin encabezado reconocido recorre **todo** el texto con códigos "bare".
- **Impacto:** un código falso en el perfil puede hacer que un requisito UNSPSC salga "cubierto" sin estarlo. El RUP real normalmente sí trae el encabezado (RUP-02 con encabezado no falla), por eso **MEDIUM** y no HIGH.
- **Corrección propuesta:** sin encabezado reconocible, no extraer "bare"; exigir el formato con dos puntos (`NN NN NN NN :`).
- **Confianza:** media (depende del formato del RUP real).

#### A7-07 · MEDIUM · RUP — un índice con tres decimales y punto se lee como **miles**
- **Evidencia:** RUP-08. `Índice de liquidez: 1.850` → **1850**; el gate "liquidez ≥ 1,2" da ✓ con "tu perfil: 1850". Nada avisa de que una razón de liquidez de 1850 no es plausible.
- **Impacto:** CUMPLE falso en liquidez si el RUP imprime así. **NO VERIFICADO** cómo imprime el RUP real.
- **Corrección propuesta:** rango de plausibilidad para razones (liquidez > 100 → ambiguo → NO DETERMINABLE con aviso).
- **Confianza:** media.

#### A7-08 · MEDIUM · RUP — no se captura la **fecha de corte** ni la **vigencia/renovación**
- **Evidencia:** RUP-06. `parsearRUP` devuelve `unspsc, capResidual, capK, encontrado`: ninguna fecha.
- **Impacto:** los pliegos suelen exigir RUP vigente y en firme y estados financieros de un cierre determinado. La app no puede decir "tu RUP no está vigente al cierre del proceso". Es una **omisión**, no un error. *(Qué exige cada pliego depende del documento; revisar con asesoría jurídica.)*
- **Corrección propuesta:** extraer "fecha de corte" y "fecha de renovación/inscripción" cuando existan y compararlas con la fecha de cierre; si no existen, mostrar "vigencia del RUP: no verificada".
- **Confianza:** alta (omisión), media (relevancia por pliego).

#### A7-09 · MEDIUM · Trazabilidad — el camino por texto **no guarda la página**
- **Evidencia:** UI-03. "Ver evidencia" de un umbral leído por texto muestra *"Página: No identificada · Esta conclusión no tiene una página asociada"* y, a la vez, *"✓ Texto tomado directamente del documento leído"*.
- **Impacto:** la cadena fuente → página se rompe; el ✓ da una seguridad que, combinada con A7-02, puede ser falsa (la cita es literal pero puede no ser el requisito).
- **Corrección propuesta:** guardar la página de la coincidencia (ya existe `paginaDeOffset`) y cambiar el ✓ a "Texto tomado del documento; confirma que es el requisito".
- **Confianza:** alta.

#### A7-10 · MEDIUM · SECOP II — la **fecha de cierre** difiere entre dos fuentes públicas
- **Evidencia:** §3. Dataset: 2026-10-28 (sin hora). colombialicita: 2026-10-16 12:00 ("se recomienda participar antes de 2026-10-20").
- **Impacto:** 12 días de diferencia sobre el plazo para presentar oferta. La app es fiel al dataset; el problema es que **no lo compara con el cronograma del documento** ni muestra la hora. **NO VERIFICADO** cuál es la vigente.
- **Corrección propuesta:** rotular la fecha con el nombre oficial ("Recepción de respuestas · datos.gov.co") y, cuando el análisis traiga cronograma, avisar si no coincide con el cierre del dataset.
- **Confianza:** alta (discrepancia), baja (cuál tiene razón).

### LOW / INFO

| ID | Sev | Hallazgo | Evidencia |
|---|---|---|---|
| A7-11 | LOW | `capResidual` del RUP copia **prosa** ("capacidad residual … según el artículo 2.2.1.1.1.5.2"); un K residual real del certificado se copia sin etiqueta de origen. | RUP-04, RUP-05 |
| A7-12 | LOW | El **DV del NIT** leído del RUT no se valida con el algoritmo oficial (NIT 900123456: el DV correcto es 8; la app aceptó 7 y 9). Además la **actividad económica** del RUT se lee pero no se contrasta con el objeto del proceso. | RUT-02, RUT-05 |
| A7-13 | LOW | La **carta** para una persona natural dice "sociedad identificada con NIT" y "representante legal". | DOC-02 |
| A7-14 | LOW | Residuos: la etiqueta de Configuración promete "novedades de **empresas seguidas**" (función retirada) y `daily-digest` conserva consultas a **SECOP I** (`f789-7hwg`) que ya no alimentan nada visible. | `index.html:1956`, `daily-digest/index.ts:35,170` |
| A7-15 | LOW | (Autocrítica del PR #26.) La ficha rotula "Código SECOP II" con `CO1.REQ.…`; el portal de referencia muestra el **aviso** `CO1.NTC.…`. Y muestra el estado "Publicado", no la **fase** ("Presentación de observaciones"). Ambos datos están en el dataset. | sonda en vivo |

---

## 5. Comportamientos correctos verificados (no son hallazgos)

- **Sin fabricación:** RUP-01, RUT-01/03/04, EP-01…05, EP-10, EP-12…14, KR-01…03, KR-05: lecturas correctas o "sin dato"; nunca una cifra inventada.
- **Cita inventada:** IA-02. Una fila cuya cita no existe en el PDF queda sin verificar y pone el gate en conflicto (NO DETERMINABLE).
- **Valor ambiguo:** EP-11 (endeudamiento "70" sin %), EP-12 (cobertura "no será exigida"), KR-05 (dos montos distintos → conflicto), VER-05 (SMMLV sin regla explícita → null).
- **Capacidad vs valor:** VER-04. Sin dato o por debajo del valor → "revisar", nunca GO.
- **Carta:** DOC-01. Con el perfil vacío, todo dato faltante sale como `[PLACEHOLDER]`; nada inventado.
- **Ficha de SECOP II:** coincide con el registro oficial (§3).
- **Prompt de extracción:** exige cifras literales, cita textual, null ante la duda, ignora instrucciones dentro del PDF (regla 14).

---

## 6. Orden de corrección sugerido

| # | Hallazgo | Esfuerzo | Por qué primero |
|---|---|---|---|
| 1 | A7-01 (GO con solo Estudio Previo) | pequeño: una condición + prueba | es el caso que más usas hoy |
| 2 | A7-05 (GO con requisitos sin evaluar) | pequeño-medio | mismo tipo de error, misma pantalla |
| 3 | A7-04 (`\brup\b` y contexto de códigos) | pequeño | elimina un NO-GO sin sustento |
| 4 | A7-03 (indicador ↔ cita) | medio: toca el verificador | cierra el hueco de IA en lo financiero |
| 5 | A7-02 (promedio/referencia/conflicto) | medio | cambia la lectura de umbrales |
| 6 | A7-06…A7-10 | pequeño c/u | trazabilidad y RUP |

Cada corrección debe hacerse con la prueba primero y verificarse por mutación; los cambios a `extraer-requisitos` (el esquema o el verificador de IA) exigen **una extracción real** antes de darlos por buenos (regla del proyecto).

## 7. Qué se necesita de ti para cerrar los NO VERIFICADO

1. Un **RUP real** y un **RUT real** (aunque sea con datos tachados) para comprobar A7-06, A7-07, A7-08 y A7-11 con el formato verdadero.
2. El **PDF del Estudio Previo de LP-008-2026** (o su texto) para repetir EP-07/08/09 con el documento real y ver si el patrón del análisis del sector ocurre.
3. **Crédito de Claude** para una extracción real y medir A7-03 con el modelo.
4. Confirmar en SECOP cuál es la fecha de cierre vigente de LP-008-2026 (A7-10).
