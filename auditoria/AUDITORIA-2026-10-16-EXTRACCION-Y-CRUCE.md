# Auditoría 2026-10-16 — Extracción de requisitos habilitantes y cruce con la empresa

Primera ejecución: **solo inspección y pruebas, no se corrigió nada.** Alcance: pliegos/estudios previos → requisitos → comparación con los datos de la empresa.
Tres auditores independientes con pruebas adversariales ejecutadas contra las funciones reales (`index.html`, `evaluacion.js`, `magnitudes.js`).
Detalle, entradas/salidas y scripts reproducibles (`node tN.mjs`): `auditoria-2026-10-16/{ia,ficha,cruce}/`.

## Veredicto

**BETA CONTROLADA, NO LISTO para confiar en un CUMPLE sin revisar.** El diseño es correcto (la IA extrae, el motor decide, la duda es NO DETERMINABLE) y muchos controles funcionan.
Pero hay **19 hallazgos HIGH** donde el sistema muestra un valor o un CUMPLE equivocado con apariencia de dato. No hay CRITICAL sistemático.

Cota que sí se verificó: con extracción por IA el veredicto global **nunca llega a GO** (siempre queda un gate «por verificar a mano» o «completitud»). Los fallos dan filas en CUMPLE falso o NO-GO falso, no un GO directo. Sin IA (solo ficha determinista) esa cota no existe (CR2-14).

Evidencia: VERIFICADO = reproducido ejecutando. No verificado: comportamiento real del modelo de IA (sin crédito), pliegos reales completos con tablas de pdf.js, navegador real, funciones desplegadas.

## Hallazgos HIGH (prioridad de corrección)

| # | ID | Qué pasa | Dónde | Dirección del error |
|---|---|---|---|---|
| 1 | FI2-1 | `num()` local de la ficha borra todos los puntos: «liquidez ≥ 1.5» → 15, «endeudamiento ≤ 0.70» → 70, «45.5 m» → 455 | index.html:8159 (usos 8278/8383/8398) | Falso NO CUMPLE y falso CUMPLE. Arreglo: usar `parseNumCO` |
| 2 | FI2-2 | «endeudamiento ≤ 70%» se guarda como 70 y se compara con la razón del perfil (0,8) | :8398 y cruce :8056 | **Falso CUMPLE** |
| 3 | IA2-1 | `valor_indicador` no se coteja con «millones»: cita «Patrimonio ≥ $1.200 millones», IA da 1200 → verificada y compara con $300 M | index.html:9015-9021 | **Falso CUMPLE** (patrimonio, K) |
| 4 | IA2-2 | La cita se verifica por *conjunto de cifras*, no por cifra→campo: liquidez 0,6 y endeudamiento 1,5 intercambiados pasan | :9006-9028 | **Falso CUMPLE** |
| 5 | IA2-3 | Coincidencia «aproximada» es bolsa de palabras: acepta citas armadas con celdas de dos filas de una tabla | :8967-8989 | **Falso CUMPLE** (vía normal de las tablas de pdf.js) |
| 6 | IA2-5 | `acumulable`, `regla_conversion_smmlv` y «máximo vs mínimo» no se cotejan con la cita; el prompt no los define | :index.ts:232-267 | CUMPLE/NO CUMPLE falso |
| 7 | CR2-1 | `gatePersonalRequerido` da OK con **una** palabra en común («ingeniero», «civil», «años») | evaluacion.js:212-232 | **Falso CUMPLE** de personal |
| 8 | CR2-2 | Consorcio = «mejor perfil»: experiencia sumada pero indicadores nunca combinados | evaluacion.js:358,381 | **Falso GO** |
| 9 | CR2-3 | `parseValorUnidad` toma el mayor número aunque mezcle unidades: «$2.500.000.000 (1.428 SMMLV)» → 2.500.000.000 SMMLV | index.html:7494-7541 | **Falso CUMPLE** de K |
| 10 | CR2-4 | Indicador del perfil con dos años en una línea toma el primero («0,35 (2022) y 0,82 (2023)» → 0,35) | :9766-9796 | **Falso CUMPLE** |
| 11 | CR2-5 | Sin dedupe entre empresas: un contrato conjunto cargado por A y por B cuenta 2 veces | :4798 | **Falso CUMPLE** de «mínimo N contratos» |
| 12 | CR2-6 | Pozos y conexiones suman componentes (pozo+cono) y suministro+instalación | magnitudes.js:96-100,245 | **Falso CUMPLE** |
| 13 | FI2-3 | Capital de trabajo ignora el % o fórmula del propio documento (aplica 33%/tabla CCE) | :8317-8330 | Valor derivado equivocado |
| 14 | FI2-4 | Cualquier «No se otorgará anticipo…» fuerza «sin anticipo» y K = presupuesto completo | :8252 | Valor derivado equivocado |
| 15 | FI2-5 | RC extracontractual toma el umbral del tramo (1.500 SMMLV) como valor asegurado (200) | :8643 | Dato equivocado |
| 16 | FI2-6 | Personal en tabla por filas: años/contratos se corren un cargo | :8446-8462 | Dato equivocado (solo aviso genérico) |
| 17 | FI2-7 | «diámetro ≥ 8" y ≤ 12"» ignora el máximo; tubería de 24" cumple | magnitudes.js:178 | **Falso CUMPLE** |

(IA2-4 y CR2-7/8/12/13 son MEDIUM pero también producen CUMPLE falso; ver abajo.)

## Hallazgos MEDIUM

- **IA2-4** Fila opcional/alternativa bloqueada por duda NO frena el CUMPLE global de experiencia (:7218-7238).
- **IA2-6** `naturaleza != habilitante` elimina la fila sin cotejar con la cita (:9145-9155); el global sube de REQUIERE REVISIÓN a CUMPLE.
- **IA2-7** `objeto_literal` truncado se acepta («puentes» de «puentes vehiculares») → CUMPLE con peatonales (:9138).
- **IA2-8** `heredarConfirmaciones` conserva la confirmación aunque cambien indicador, naturaleza u objeto (:9239).
- **IA2-9** Nada liga el PDF enviado a la IA con el proceso: tras recargar se puede verificar contra otro documento (:14778-14814).
- **IA2-10** Cronograma: fecha/hora no se cotejan con la cita pero se muestra «cita encontrada».
- **CR2-7** Cantidad mínima suma entre contratos aunque no sea acumulable, ignora unidad y participación (:6963).
- **CR2-8** Contrato sin fecha de terminación acredita; con solo fecha de inicio entra en «últimos N años» (:6111,6195).
- **CR2-9** No existe «año de corte» de los estados financieros; un RUP nuevo no sobrescribe la K existente (:4307).
- **CR2-10** Contrato en ejecución con fecha fin vencida no se descuenta de la capacidad residual (:3852).
- **CR2-11** K declarada en SMMLV: no se descuentan contratos en ejecución.
- **CR2-12** Encabezados «Part. %», «% Part.», «Aporte (%)» no se reconocen: consorcio 30% cuenta 100% (:5514).
- **CR2-13** Un contrato acredita general y específica aunque el pliego lo prohíba; mismo N° con adiciones cuenta varias veces.
- **FI2-8..12** presupuesto derivado, plazo con fases, decimales partidos por pdf.js, base de garantía de anticipo, «ml» total del proyecto (ver informe de ficha).

## LOW / INFO
IA2-11..15, FI2-13..16, CR2-14..17 (adenda omitida por la IA no se detecta; detección de inyección cubre 4 de 10 variantes; >100 págs solo avisa con banner; esquema con exactamente 16 uniones nullable = no agregar campos nullable; SMMLV con el año actual; héroe puede decir GO mientras «Decisión» dice REVISAR; etc.).

## Controles que SÍ funcionan (con evidencia)
Cita inexistente, corta o sin la cifra: no se verifica · mínimo ≤ 0 bloqueado · construcción vs mantenimiento/diseño/interventoría → NO DETERMINABLE · valor ponderado por participación · SMMLV sin regla/fecha → ND · fecha futura / en ejecución no acredita · varios presupuestos → no elige ninguno · operadores no reconocidos → sin valor · garantías en columnas separadas → «cifra no asociada» · K fijado por el documento y conflicto de montos · pliego vs adenda con valores distintos → CONFLICTO · JSON truncado → error explícito · K = 0 es dato real · sumatoria por tramos nunca da CUMPLE · `resumenDecision` más estricto que el héroe.

## Explicabilidad («¿por qué cumple?» / «¿qué cambia para que no cumpla?»)
Bien en indicadores, K y magnitudes (muestran pliego vs perfil y los ítems). **Faltan:** motivo de coincidencia en Personal, «te falta N contrato / $X» en experiencia, sensibilidad («si pierdes el contrato X…») y qué empresa del consorcio aporta qué en indicadores/K.

## Causas raíz (para corregir por familia, no por síntoma)
1. **Lectura numérica duplicada**: la ficha usa `num()` propio en vez de `parseNumCO` (FI2-1/2/10, CR2-3/4/15).
2. **Verificación de cita por conjunto de cifras, no por campo** (IA2-1/2/3/5/10).
3. **Coincidencia por una palabra** (CR2-1, IA2-7).
4. **Consorcio sin modelo único**: indicadores por mejor perfil, contratos sin dedupe, participación por encabezados frágiles (CR2-2/5/12).
5. **Reglas de magnitud solo robustas para tubería** (CR2-6, FI2-7/12).

## Siguiente paso propuesto (cuando lo autorices)
Ronda de corrección por familias, con prueba que falle primero y verificación por mutación: **(1)** `parseNumCO` + porcentaje en la ficha → **(2)** anclar cifra a su campo y a «millones» en la verificación de citas → **(3)** umbral de coincidencia de personal → **(4)** dedupe y combinación de indicadores en consorcio → **(5)** magnitudes de pozos/conexiones. Después, repetir esta auditoría y cerrar solo lo verificado. Sigue pendiente (NO VERIFICADO) una extracción real con la IA y 3–5 pliegos reales completos con texto de pdf.js.

---

# Cierre de la ronda de correcciones (2026-10-16)

Método: prueba primero (falla), corrección, prueba pasa, **mutación** (cada arreglo se rompió a propósito y una prueba lo detectó), `node tests/smoke.mjs` (554 ok; el único fallo es el SRI por falta de red en el sandbox) y `node tests/e2e.mjs` (38 ok). Una **re-auditoría independiente** volvió a ejecutar las reproducciones originales y buscó variantes; lo que halló se corrigió en el commit «Re-auditoría».

## Estado por hallazgo

| Estado | IDs |
|---|---|
| **CERRADO (verificado por la re-auditoría)** | FI2-1, FI2-3, FI2-4, FI2-5, FI2-7, IA2-2, IA2-4, IA2-7 (repro), CR2-2, CR2-4, CR2-5, CR2-6 (repros) |
| **CERRADO tras la re-auditoría (variantes corregidas; sin una 3.ª pasada independiente)** | FI2-2 («por ciento», «≤ 70» sin %), IA2-1 (MM, billones), IA2-3 (la coincidencia aproximada ya no decide sola), IA2-5 («más de N», «hasta N contratos»), IA2-6 (informativo con lenguaje de exigencia), CR2-1 (palabra «obra» distintiva, umbral 60 %), CR2-3 (unidad del K), CR2-12 (más encabezados) |
| **PARCIAL (sigue abierto en parte)** | FI2-6 (si el último cargo no trae datos, se puede desplazar), CR2-8 (requisito **sin** ventana + contrato sin fecha de terminación todavía cuenta), CR2-12 (encabezados sueltos como «Porcentaje» o «Part.» no se reconocen: chocarían con otras columnas), IA2-7 (literal «puentes» dentro de «puentes de concreto reforzado vehiculares»), CR2-6 (otros componentes de pozo no listados) |
| **NO ATENDIDO en esta ronda** | IA2-8, IA2-9, IA2-10, IA2-11..15, CR2-7, CR2-9, CR2-10, CR2-11, CR2-13..17, FI2-8..16 (ver informes detallados) |

## Cambios de comportamiento que el usuario notará (decisiones de diseño)

- **Coincidencia «aproximada» de una cita (tablas con otro orden de lectura) ya no decide sola:** la fila queda «sin confirmar» hasta que el usuario compare la cita con el PDF. Más confirmaciones manuales en tablas desordenadas; a cambio, una cita armada con celdas de dos filas ya no produce CUMPLE/NO-GO.
- **Dos o más empresas marcadas (consorcio):** el resultado nunca es GO; un gate «Consorcio / unión temporal» explica que los indicadores y la K no se combinan por participación (la app no modela aún el porcentaje de cada integrante) y muestra el resultado por empresa. El mismo contrato cargado por dos integrantes cuenta **una** vez, con la participación sumada.
- **Personal:** el gate exige cargo coincidente, varias palabras distintivas y años suficientes; si no, dice qué coincidió y qué falta (ND).
- **Capital de trabajo:** usa el % que escribe el documento; si no hay % ni fórmula no supone 33 %.
- **Anticipo:** «no se otorgará anticipo por un valor superior…» o contradicciones ya no se leen como «sin anticipo».
- **Montos con unidades mezcladas o dos montos distintos** («$2.500 M (1.428 SMMLV)», «2022: …; 2023: …») dan «no determinable» en vez de elegir el mayor.
- **Verificación de citas:** el valor monetario debe respetar «millones/MM/billones», el indicador debe estar junto a su nombre, y `acumulable`, tope-vs-mínimo y regla de conversión SMMLV deben tener respaldo en la cita o el pliego (la regla SMMLV se busca en el texto leído del PDF: con un pliego leído a medias puede quedar sin verificar).

## Límites de esta verificación (NO VERIFICADO)
Comportamiento real del modelo de IA (sin crédito), pliegos reales completos con el texto de pdf.js, función `extraer-requisitos` desplegada. Todas las pruebas usan texto sintético con el estilo de los pliegos reales y los fragmentos reales ya presentes en `tests/smoke.mjs`.
