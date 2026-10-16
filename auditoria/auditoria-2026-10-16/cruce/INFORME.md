# Auditoría independiente del CRUCE pliego ↔ empresa (Bitácora SECOP)

Fecha: 2026-10-16. Alcance: evaluacion.js, magnitudes.js y, en index.html, evaluarRequisito, cruceFichaEmpresa, comparación de indicadores, K residual/SCE, personal y lectura de datos del perfil.
Método: lectura de código + ejecución real con el arnés de tests/smoke.mjs (copia en `harness.mjs`; sin tocar el repo, `git status` limpio). Scripts reproducibles en este mismo directorio (e1…v1.mjs, `node X.mjs`).
No se repiten RA2-1…7, RA3-1…6 ni lo cerrado en RELEASE-BLOCKERS.

## Resumen
HIGH: 6 (CR2-1…CR2-6). MEDIUM: 7 (CR2-7…CR2-13). LOW: 2 (CR2-14, 15). INFO: 2 (CR2-16, 17). Sin CRITICAL (ningún GO final falso con un solo dato; los HIGH producen CUMPLE falso en una fila/gate o un GO bajo una condición realista de consorcio o de personal).

## Hallazgos

### CR2-1 · HIGH · VERIFICADO — El gate «Personal / equipo de trabajo» da `ok` con UNA palabra en común
- Ubicación: evaluacion.js:212-232 (`gatePersonalRequerido`), `texto.indexOf(p)` sobre palabras de `palabrasClaveDe`.
- Reproducción (`p1.mjs`): pliego «Director de obra: ingeniero civil o arquitecto con mínimo 10 años de experiencia profesional y especialización en gerencia de proyectos»; perfil «Residente de obra, Ingeniero civil, 1 año» → `ok` («Perfil(es) que podrían acreditarlo: Juan»). «Ingeniero sanitario con 5 años en redes de acueducto» vs «Director de obra, ingeniero civil, 12 años» → `ok`. «Especialista en geotecnia con maestría» vs especialización en gerencia → `ok`. «Profesional SST con licencia vigente» vs residente sin licencia → `ok`.
- Causa: coincide cualquier token no genérico (`ingeniero`, `civil`, `experiencia`, `anos`, `profesional`, `trabajo`…), por subcadena, sin cargo, formación ni años.
- Impacto: ese `ok` cuenta para GO (`decidirVeredicto`), pinta «Personal: CUMPLE» en `resumenViabilidad` y en la matriz. CUMPLE/GO falso en un caso muy común. El detalle solo nombra a la persona, no qué palabra coincidió: no se puede auditar el «por qué».
- Corrección: nunca `ok` por palabras; como mucho `revisar`/`nd` listando qué se coincidió (cargo/formación) y qué no se pudo comprobar (años, especialización, licencia). `ok` solo con cargo + formación + años comparados numéricamente.
- Confianza: alta.

### CR2-2 · HIGH · VERIFICADO — Consorcio: el veredicto es «el mejor perfil», la experiencia se suma pero los indicadores NO
- Ubicación: evaluacion.js:358 (`experienciaGateDetalle`, global) y 381-387 (`evaluarContraPerfiles` elige el mejor por perfil).
- Reproducción (`v1.mjs`): A (liquidez 1,6; endeud. 0,55; sin experiencia propia) y B (liquidez 0,4; endeud. 0,95; con toda la experiencia), marcadas juntas; pliego pide liquidez ≥ 1,5 y endeudamiento ≤ 0,6. Salida: `mejor: A → GO / GO` (A: «Experiencia: ok» con los contratos de B). B sola: NO-GO. Ponderado 50/50 el consorcio daría liquidez 1,0 y endeud. 0,75: NO cumple.
- Impacto: GO falso para un consorcio/UT. La app promete «consorcio = suma de contratos», pero financieros y K nunca se combinan (ni suman ni ponderan por participación). El texto «mejor de 2 perfiles (A)» no aclara que la experiencia viene de B ni que A sola no tendría con qué acreditar.
- Corrección: con ≥ 2 perfiles marcados, no declarar GO; calcular los indicadores ponderados por la participación (dato a pedir) o dejar NO DETERMINABLE «indicadores de proponente plural sin combinar». Separar «A sola» de «A+B».
- Confianza: alta.

### CR2-3 · HIGH · VERIFICADO — `parseValorUnidad` (K residual del perfil) mezcla pesos y SMMLV y toma el MAYOR número
- Ubicación: index.html:7494-7541 (`Math.max` en 7540; la unidad sale de si aparece «SMMLV» en cualquier parte).
- Reproducción (`pv2.mjs`, `k2.mjs`): `$2.500.000.000 (1.428 SMMLV)` → `{valor: 2500000000, unidad: 'SMMLV'}`. Con pliego «K residual ≥ 5.000 SMMLV»: «Capacidad K residual: ok · tu perfil: 2.500.000.000 SMMLV ✓» (real: 1.428). Idem `1.428 SMMLV ($2.500.000.000)` y «K residual: 1.200 SMMLV (año 2023: 1.160.000)» → 1.160.000 SMMLV. Además `K residual 2022: 3.000.000.000; 2023: 1.500.000.000` → 3.000.000.000 (el mayor, optimista); `K residual 1.500.000.000 (antes de contratos: 3.000.000.000)` → 3.000.000.000.
- Impacto: fila «Capacidad K residual» y bloque «Capacidad Residual» (`comparacionCapacidadResidual`: «APARENTEMENTE CUMPLE», margen de 2.500 millones de SMMLV) y en la ficha (`empresaParaFicha` multiplica por el SMMLV del año: ≈ 4,4e15) quedan CUMPLE falsos. El GO se frena solo porque «Capacidad vs valor» queda nd (K en SMMLV) — defensa accidental. Escribir K en pesos y SMMLV es lo habitual.
- Corrección: si hay cifras en dos unidades o varias cifras no equivalentes, devolver null/ambiguo (NO DETERMINABLE); no usar `max`.
- Confianza: alta.

### CR2-4 · HIGH · VERIFICADO — Indicadores del perfil con dos años en la misma línea: se toma el PRIMERO sin avisar
- Ubicación: index.html:9766-9796 (`cifrasDePerfil`, `leerIndiceDePerfil`); solo marca ambiguo cuando la ETIQUETA aparece 2 veces.
- Reproducción (`pf2.mjs`): `Endeudamiento: 0,35 (2022) y 0,82 (2023)` → 0,35 (pasa ≤ 0,6; el año vigente 0,82 no). `Índice de liquidez: 2,5 (2022) / 1,1 (2023)` → 2,5 (pasa ≥ 1,5; vigente 1,1 no). También `Liquidez 2022: 2,5 | 2023: 1,1`.
- Impacto: CUMPLE falso por datos de otro año de corte. Más general: el motor no tiene noción de año de corte (ver CR2-9).
- Corrección: si el segmento trae ≥ 2 cifras distintas tras la etiqueta, devolver ambiguo; idealmente campo estructurado `valor + fecha de corte`.
- Confianza: alta.

### CR2-5 · HIGH · VERIFICADO — Consorcio: el mismo contrato conjunto cargado por cada integrante cuenta como 2 contratos
- Ubicación: index.html:4798-4830 (`recalcularExpevalActivo` concatena sin deduplicar entre empresas); `depurarContratos` (5713) solo depura dentro de un Excel.
- Reproducción (`c1.mjs`): A y B cargan el mismo contrato `C-045-2022` (mismo objeto, valor, fecha; 60 % / 40 %). Combinados: 2 contratos. Requisito «mínimo 2 contratos de construcción de puentes vehiculares» → CUMPLE (real: un solo contrato). El valor sí se pondera bien (60 % + 40 %), pero el conteo no.
- Impacto: CUMPLE falso en el caso típico de empresas que ya trabajaron juntas.
- Corrección: dedupe entre perfiles por (número de contrato + contratante) o (objeto + contratante + valor + fecha fin); al fusionar, sumar participaciones y contar UNA vez; si no se puede decidir, avisar.
- Confianza: alta.

### CR2-6 · HIGH · VERIFICADO — Magnitudes de pozos/conexiones: se suman componentes, otros pozos y líneas suministro+instalación
- Ubicación: magnitudes.js:96-100 (`clasificarItem`, pozos), 245 (`else prudente = suma(unicos)` — la regla RA2-1 de suministro/instalación solo existe para tubería).
- Reproducción (`m1.mjs`, `m2.mjs`) con exigencia «19 pozos de inspección»: «Pozo de inspección 10 und» + «Cono excéntrico para pozo de inspección 10 und» → 20 und CUMPLE. «Construcción de pozo séptico 20 und» → CUMPLE. «Pozo de bombeo 20 und» → CUMPLE. «Anillo de concreto para pozo de inspección 25 und» → CUMPLE. «Ajuste de cota de pozo existente 20 und» → CUMPLE. «Pozos de inspección 20» (resumen) + detalles 10+10 → 40. Conexiones («100 und»): «Suministro de conexión domiciliaria de alcantarillado 60» + «Instalación de conexión … 60» → 120 CUMPLE.
- Impacto: mismo patrón de RA2-1/RA2-2 sin cerrar para pozos y conexiones. Solo ocurre con cantidades cargadas, pero un acta real trae cono, anillos y tapa por pozo.
- Corrección: lista blanca para pozos («pozo de inspección/visita/registro» sin componente: cono, anillo, base, cañuela, escalera, aro, cámara…); excluir séptico/bombeo/profundo/existente/ajuste; aplicar la consolidación suministro↔instalación y «resumen vs detalle» a todas las actividades de conteo, y dejar `item_dudoso` si solo la suma plana alcanza.
- Confianza: alta.

### CR2-7 · MEDIUM · VERIFICADO — Cantidad mínima (unidades contables): suma entre contratos, sin unidad y sin participación
- Ubicación: index.html:6963-6972 (rama `minCantidad`), 9467-9471 (IA solo la acepta con unidad contable).
- Reproducción (`e3.mjs`, fila IA «mínimo 50 viviendas», `acumulable:false`): 2 contratos de 30 → «Cantidad acumulada: 60» CUMPLE (si es por contrato, NO cumple). Contrato con cantidad «150 m2» vs «100 viviendas» → CUMPLE (se ignora la unidad de `cantidad`). Consorcio 25 % con 120 viviendas vs exigencia 100 → CUMPLE (el valor SÍ se pondera por participación, la cantidad no). Cantidad «12 aulas» vs «100 viviendas» → NO CUMPLE (debería ser ND).
- Corrección: respetar `acumulable`/`porContrato`; comparar solo si la unidad del contrato coincide (si no, ND); ponderar o dejar ND por consorcio como hace Magnitudes.
- Confianza: alta.

### CR2-8 · MEDIUM · VERIFICADO — Un contrato SIN fecha de terminación acredita; con solo fecha de inicio entra «dentro» de la ventana
- Ubicación: index.html:6111 (`fechaReferenciaContrato` = `fechaFin || fechaInicio`), 6195 (`contratoEnEjecucion` solo mira fecha futura / marca textual).
- Reproducción (`e2.mjs` caso A, `t1.mjs`): requisito sin ventana + contrato sin fecha → CUMPLE. Requisito «dentro de los últimos 5 años» + contrato solo con inicio 2025-03-01 → CUMPLE. Un contrato aún en ejecución con fecha de fin ya vencida (prórroga no actualizada) también cuenta.
- Impacto: contradice «un contrato en ejecución no acredita». Excel de experiencia con celdas vacías es frecuente.
- Corrección: sin fecha de terminación confiable y sin marca «terminado/liquidado» → ND (igual que ya se hace con fechas futuras/invertidas).
- Confianza: alta.

### CR2-9 · MEDIUM · VERIFICADO (comportamiento) — No existe «año de corte» de los estados financieros
- El perfil guarda indicadores y K como texto libre (`perfil.k`, `kResidual`) sin fecha; `extraerIndicadoresRUP` (index.html:4234) no captura el corte; los umbrales del pliego «con corte a 31 de diciembre de 2024» se leen pero solo se descarta el año como cifra (`cifrasCandidatas`). `compararIndiceConUmbral` nunca compara fechas. `aplicarRUPaCampos` (index.html:4307) NO sobrescribe la K si ya había datos: un RUP nuevo con indicadores actualizados se ignora y se sigue usando el viejo (solo se muestra un aviso en la carga). `capacidadActualizada` (>1 año) solo alerta en Empresa, no en el análisis.
- Impacto: CUMPLE/NO CUMPLE con datos de otro año, sin que el análisis lo diga. Es la base de CR2-3/CR2-4.
- Corrección: guardar `{valor, corte}` por indicador; avisar en el gate cuando el corte sea anterior al exigido o a la última renovación del RUP; ofrecer reemplazar al cargar un RUP más reciente.

### CR2-10 · MEDIUM · VERIFICADO — Contratos en ejecución VENCIDOS en fecha no se descuentan de la K y el gate dice `ok`
- Ubicación: index.html:3851-3853 (`calcularSCE`: «Ya venció» no suma a `incompletos`); evaluacion.js:36-40.
- Reproducción (`k1.mjs`): K 3.000 M, contrato en ejecución saldo 2.900 M con fecha fin pasada → «Capacidad K residual: ok · disponible $3.000.000.000», veredicto GO. La alerta `vencido` existe solo en Empresa.
- Corrección: tratar «en ejecución con fecha vencida» como incompleto (`revisar`), igual que sin saldo/fecha.

### CR2-11 · MEDIUM · VERIFICADO (gate) / INFERIDO (ficha) — K declarada en SMMLV: los contratos en ejecución NO se descuentan
- `capacidadContractualEstimada` (index.html:3894) devuelve null si la K no es COP → `calcularSCE` no corre; el gate compara K bruta («tu perfil: 3.000 SMMLV ✓», `k1.mjs` caso 1) y `empresaParaFicha` (11836) convierte K×SMMLV del año sin SCE ni `kIncompleto` → la ficha dice «capacidad residual (K) disponible» CUMPLE. El GO se frena solo porque «Capacidad vs valor» queda nd.
- Corrección: con K en SMMLV, convertir con el SMMLV vigente y descontar, o marcar «sin descontar contratos en ejecución» (revisar).

### CR2-12 · MEDIUM · VERIFICADO (reglas de header) — Columna de participación no reconocida ⇒ se cuenta el 100 % del valor
- Ubicación: index.html:5514 (`DICC_CONTRATO.participacion`).
- Reproducción (`h1.mjs`): encabezados «Part. %», «% Part.», «Porcentaje», «Aporte (%)» no se detectan → contrato del 30 % con valor 900 M → CUMPLE para mínimo 500 M (con «Participación» da NO CUMPLE). «Revisar interpretación» solo marca «esencial» el objeto.
- Corrección: ampliar sinónimos y, si hay una columna numérica 0-100 candidata o el objeto dice consorcio/UT/«unión temporal», avisar/ND; marcar `participacion` como campo a confirmar.

### CR2-13 · MEDIUM · VERIFICADO — Un mismo contrato acredita requisitos distintos (general y específica) y el mínimo de contratos cuenta filas, no contratos
- `evaluarExperienciaCompleta` (index.html:7218) evalúa cada requisito aislado; nada impide que el contrato `C1` acredite general y específica (`r2.mjs`: ambos CUMPLE, global CUMPLE) aunque el pliego prohíba reutilizarlo o exija «3 + 2 contratos distintos»; la regla se queda como `nota` informativa.
- Reproducción (`e2.mjs` B, `e1.mjs` 11): el mismo `numeroContrato` en 2 filas con valores distintos (adición/acta) cuenta como 2 contratos para «mínimo 2»; `C1`, `C1-ADICION 1`, `C1 Otrosí 2` → 3 contratos, CUMPLE «mínimo 3». `depurarContratos` solo quita filas idénticas en número+valor+fechas.
- Corrección: deduplicar por número de contrato normalizado; detectar «no podrán ser los mismos / contratos distintos» y, si aparece, marcar ND o asignar contratos sin repetición.

### CR2-14 · LOW · INFERIDO — El «Resultado global» (héroe) puede decir GO mientras la tarjeta «Decisión» dice REVISAR
- `resultadoAnalisisHtml` (index.html:11935) usa `veredictoGlobal` de los gates; la ficha determinista solo entra en `resumenDecision` (`d1.mjs`: GO + ficha ND → «REVISAR»). Sin IA no hay gate de completitud (evaluacion.js:307) ni se evalúan patrimonio, capital de trabajo, K no detectada por regex ni garantías: `v1.mjs` da GO con solo liquidez, endeudamiento, experiencia y capacidad vs valor. Dos titulares contradictorios en pantalla.
- Corrección: que el héroe use el mismo `resumenDecision` (peor de ambos) o que el motor incluya la ficha como gates.

### CR2-15 · LOW · VERIFICADO — Patrimonio/capital de trabajo del perfil en SMMLV se leen como pesos
- `Patrimonio: 1.000 SMMLV ($1.750.905.000)` → 1000 (`pf.mjs`). Produce NO CUMPLE falso («te faltan $…») y no CUMPLE falso. Corrección: reconocer unidad SMMLV o ambiguo.

### CR2-16 · INFO — Resultado de experiencia congelado
- `entry.experienciaResultado` se calcula en 14690/14756 y el gate (index.html:7423) solo lo lee; no se invalida al cambiar contratos, empresas marcadas o la fecha («hoy» de la evaluación). `evaluadoEn` solo se imprime en los documentos (RA3-6), no en el veredicto. La ventana «últimos N años» se ancla en «hoy», no en la fecha de cierre del proceso (limitación documentada en el código).

### CR2-17 · INFO — Tubería: no distingue sistema ni tipo
- magnitudes.js: «Tubería PVC presión RDE 21 acueducto 8"» 2.000 ml cuenta para una exigencia de redes de alcantarillado PVC ≥ 8" (`m2.mjs`). Mitigado si el pliego/ficha es explícito; verificar con el texto de la exigencia.

## Explicabilidad («¿por qué cumple?» / «¿qué tendría que cambiar?»)
- Bien: indicadores y K muestran «Pliego ≥ X · tu perfil Y ✓/✗», K con margen/faltante, experiencia con mínimos y contratos evaluados, magnitudes con ítems usados y base (completo/prorrata), `resumenDecision` con acción concreta.
- Falta: (1) Personal `ok` no dice qué palabra coincidió (CR2-1). (2) El NO CUMPLE/CUMPLE de experiencia no dice cuántos contratos/valor faltan o sobran de forma accionable («te falta 1 contrato ≥ $X»); hay evidencia numérica pero no la diferencia. (3) No hay sensibilidad del GO («si el contrato X se pierde, deja de cumplir»), ni indicación de la fecha de corte de los datos de la empresa. (4) En consorcio no se explica qué empresa aporta cada cosa en indicadores/K.

## Controles que SÍ funcionan (con evidencia)
- Construcción vs mantenimiento / rehabilitación / diseños / interventoría, «rígido» vs flexible, «sanitario» vs pluvial: NO DETERMINABLE, no CUMPLE (`e1.mjs` 1-6).
- Valor en consorcio con participación explícita se pondera (30 % de 900 M = 270 M → NO CUMPLE); participación 0,3 (¿30 %?) → ND (`e1.mjs` 7-9).
- SMMLV sin regla del pliego o sin fecha → ND (`e1.mjs` 10, `e2.mjs` N); «En ejecución» y fecha futura → ND; cantidades dimensionales (ml, m², km) → ND (`e2.mjs` D-G); valor en USD → ND.
- `evaluarSumatoriaTramos` / `evaluarUnoPctPO` nunca dan CUMPLE (solo pueden descartar).
- Indicadores: etiqueta repetida con valores distintos → ambiguo (null); `INDETERMINADO` → nd; endeudamiento > 5 sin «%» → nd; operadores estrictos; rentabilidad siempre nd (`pf.mjs`, evaluacion.js:312).
- K 0 es dato real (NO-GO, no «sin dato»); SCE prorratea por participación en consorcio (50 % → descuenta 1.500 M, `k1.mjs`); sin K en el perfil → nd.
- Magnitudes: consorcio sin base explícita → NO DETERMINABLE cuando depende; ml/m² en pozos → ND; materiales/diámetros distintos descartados; cantidad «1.000» ambigua → dudosa.
- `resumenDecision` es más estricto que el héroe: 0 requisitos → NO DETERMINABLE; contradicciones se muestran; GO imposible con puntos por resolver (`d1.mjs`).

## Límites de la auditoría
Cruce de ficha con `empresaParaFicha`/UI y `aplicarRUPaCampos` revisados por lectura (no ejecutables sin DOM). No se probó con pliegos reales completos (solo texto sintético); IA real y Formato Maestro (ya auditado en RA2) fuera de alcance.
