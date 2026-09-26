# AUDIT-REPORT — Bitácora SECOP (auditoría de pre-lanzamiento)

Fecha: 2026-09-26 · Versión auditada: commit `ad8e641` (main) · Modo: solo lectura (ningún archivo de la aplicación fue modificado)

> Estos estados y conclusiones **no constituyen certificación legal ni de seguridad**. Ninguna parte de este informe afirma que la aplicación sea "100% segura" ni que esté "libre de errores". Lo que no pudo comprobarse está marcado **NO VERIFICADO**.

---

## 1. Informe ejecutivo (para quien no programa)

### Estado de la aplicación: **BLOQUEADO**

La aplicación está bien construida en muchos aspectos (no encontramos fuga de datos entre empresas, ni claves secretas expuestas, ni forma de inyectar código con los datos de SECOP que se probaron). Pero **hoy puede darle a una empresa constructora una conclusión equivocada**, y eso es justo lo que el producto promete evitar. Hay problemas de tres tipos:

**A. La app puede no mostrarle procesos que sí existen.**
Cuando el usuario busca "acueducto", "alcantarillado" o "interventoría", la app trae 300 resultados de SECOP II, pero por un detalle de cómo se ordenan, **esos 300 son casi todos procesos borrados o sin fecha, y ningún proceso abierto real llega a la pantalla**. Comprobamos contra los datos oficiales: existen unos 40 procesos abiertos por cada una de esas palabras, y la app mostraba 0. Las alertas y el correo diario usan la misma consulta, así que también pueden avisar "nada nuevo" cuando sí lo hay. Además, por defecto se muestran como oportunidades procesos cancelados, en borrador o ya adjudicados.

**B. La app puede decir "cumple" cuando no cumple (y, más raramente, "no cumple" cuando sí).**
Ejecutamos el motor con casos reales y encontramos que:
- Un requisito de "$500.000.000" en un pliego en texto libre se ignora: un contrato de $1.000.000 "acredita" el requisito.
- "Dos (2) contratos", "Acreditar 3 contratos" no se entienden: con 1 solo contrato aparece CUMPLE.
- Un contrato de 2015 con el valor exigido más uno de 2025 sin valor se cuentan como "experiencia de los últimos 5 años".
- "Endeudamiento ≤ 60%" en el pliego contra 0,75 en el perfil da CUMPLE (mezcla porcentaje con fracción).
- Un valor negativo en el Excel ("-1.500.000.000") se convierte en positivo y cumple.
- Un mismo contrato repetido en dos filas, o una fila "TOTAL", se suma dos veces.
- Con la IA: 5 caminos distintos donde una fila marcada con ✓ "cita verificada" produce un CUMPLE falso (cifras alteradas, unidad equivocada, descripción diluida, adenda que baja un requisito, requisito mal clasificado).
- La sugerencia de oferta económica usa datos de SECOP I donde el "presupuesto" es igual al valor del contrato: sale 0% de descuento y se presenta como "patrón histórico de la entidad".

**C. Faltan los seguros legales y operativos básicos de cualquier servicio con cuentas de usuarios.**
No hay política de privacidad ni autorización de tratamiento de datos, no hay forma de borrar la cuenta, cualquiera puede crear cuentas con correos ajenos sin verificarlos (lo que además permite gastar el crédito de IA sin límite y enviar correos con texto elegido por el atacante), los documentos generados (carta, anticorrupción, parafiscales) traen **declaraciones bajo juramento ya escritas** que la app no puede saber si son ciertas, no hay avisos si algo falla, y no hay copia de respaldo de los datos del usuario.

### ¿Se puede lanzar?
No al público. Sí sería razonable una **beta muy controlada con usuarios conocidos, tras corregir la ola 0** (sección 6), avisándoles claramente que el resultado es orientativo. La lista corta de lo que debe corregirse antes está en `RELEASE-BLOCKERS.md`.

### Lo que sí está bien (verificado)
- Aislamiento entre empresas (RLS y almacenamiento) y ausencia de secretos en el código e historial git (122 commits).
- Los datos hostiles de SECOP (nombres con código, etc.) **no** ejecutan scripts, salvo el enlace del Plan Anual de Adquisiciones (arreglo simple).
- El diseño "la IA solo extrae, el motor decide" y los estados CUMPLE / NO CUMPLE / NO DETERMINABLE funcionan bien en los casos base: una cita inventada, un PDF escaneado o una unidad ausente dan NO DETERMINABLE.
- El correo diario falla cerrado sin clave; el tope de IA reserva cupo antes de gastar.
- 93 de 93 pruebas automáticas pasan (pero solo cubren una parte del motor; ver QA-001).

### Lo que ninguna auditoría de código puede decir todavía (NO VERIFICADO)
Cómo se comporta **Claude con un pliego real**: cuántas filas quedan sin verificar, si lee bien las adendas, cuánto tarda y cuánto cuesta. Eso requiere cargar crédito y probar. Hasta entonces la función de IA debe considerarse experimental.

---

## 2. Alcance, método y leyenda de evidencia

Diez auditores independientes de solo lectura, cada uno con instrucciones de aportar evidencia reproducible, más este consolidado (auditor principal): SECOP I · SECOP II · integridad y trazabilidad · motor de cumplimiento (requisitos, experiencia, RUP, financiera, residual) · IA y anti-alucinación · generación documental · seguridad y privacidad · UX/rendimiento/escalabilidad · DevOps/QA/arquitectura · red team.

Método: lectura de código; **consultas reales de solo lectura a datos.gov.co** (SECOP I `f789-7hwg`, SECOP II `p6dx-8zbt`, PAA `9sue-ezhx`); consultas anónimas a Supabase (sin crear cuentas); ejecución con Node de las funciones reales extraídas de `index.html` (mismo patrón de `tests/smoke.mjs`) con casos adversariales; pruebas en navegador embebido con datos hostiles simulados. No se llamó a Anthropic. `node tests/smoke.mjs`: 93/93.

Leyenda de confianza: **VERIFICADO** (ejecutado o medido) · **PARCIALMENTE VERIFICADO** · **INFERIDO** (por lectura de código/razonamiento) · **NO VERIFICADO**.

Los scripts de reproducción están en el directorio temporal de la sesión (`scratchpad\si\`, `s2\`, `tr\`, `mc\`, `rt\`, `ia-audit.mjs`, etc.); las líneas de código citadas son de `index.html` salvo que se indique otro archivo, y pueden moverse con cambios futuros.

**Solapes resueltos por el auditor principal** (mismo problema reportado por varios auditores; se conserva el ID más específico): MC-004≈IA-010 (unidades de índices) · MC-015≈RT-010b≈RT-011 (lectura de cifras) · MC-011≈IA-005 (obligatoriedad/puntaje) · TR-008≈S2-009 (snapshot) · UX-004≈RT-007 (GO con lectura parcial) · RT-013≈SEG-005 (enlace PAA) · SEG-006≈OPS-010 (librerías) · ARQ-003≈ESC-005≈RT-015 (sincronización) · PERF-005≈RT-016≈ARQ-005 (cuota de almacenamiento local) · SEG-002≈ESC-003 (costo IA) · ESC-001≈OPS-011≈SEG-004 (correo diario).

**Corrección de conclusiones previas:** rondas anteriores de auditoría (documentadas en CLAUDE.md) no habían consultado los datos reales con la misma consulta que usa la app, por lo que no detectaron S2-001. La afirmación de CLAUDE.md "INVIAS: 46 de SECOP I" **no se reproduce hoy** (SI-001: devuelve 1 de 987 existentes). Tratar esas notas como históricas.

---

## 3. Respuestas al estándar de explicabilidad

- **"¿Por qué dijiste que esta empresa cumple?"** — Para experiencia, parcialmente sí: cada requisito muestra fuente, página, cita y contratos evidencia. Para los indicadores financieros y de capacidad, **no**: solo aparece "Pliego ≥ X · tu perfil Y ✓" sin fuente ni página (MC-023). Para personal, el estado de cada fila es el del gate agregado (IA-009).
- **"¿Qué tendría que cambiar para que dejara de cumplir?"** — No existe (MC-023): no se muestra el margen (cuánto falta o sobra).
- **Cadena Fuente → extracción → regla → resultado:** completa solo en el camino de experiencia con IA verificada; rota en los puntos de S2-001 (la fuente puede no traer el proceso), MC-001/002/003 (la regla no modela la condición) e IA-001..005 (la verificación no comprueba lo que dice comprobar).

---

## 4. Hallazgos CRITICAL (detalle completo)

### S2-001 · CRITICAL · Datos SECOP II — Falso negativo masivo: los procesos abiertos no llegan a la app
- **Descripción:** `fetchSecopDataset` pide `$limit=300&$order=fecha_de_publicacion_del DESC`. En Socrata, el orden descendente pone los valores NULL primero; 127.589 filas tienen esa fecha vacía. Para palabras comunes las 300 filas devueltas son todas NULL.
- **Evidencia:** abiertos reales en el servidor vs. presentes en las 300 filas de la app: acueducto 39→0, alcantarillado 37→0, interventoria 59→0, colegio 9→0 (pavimento 18→18 y "obra civil" 7→7 escapan por ser de baja cardinalidad). Con solo departamento como ancla: 300/300 con fecha NULL, 47 abiertos reales no mostrados.
- **Ubicación:** `index.html:7712-7737`, anclas `7926`, `evaluarAlerta` `7776`; copia idéntica en `supabase/functions/daily-digest/index.ts:141-150`.
- **Reproducir:** `curl -G https://www.datos.gov.co/resource/p6dx-8zbt.json --data-urlencode '$limit=300' --data-urlencode '$q=acueducto' --data-urlencode '$order=fecha_de_publicacion_del DESC'` → todas las filas sin `fecha_de_publicacion_del`. Comparar con `$where=fecha_de_recepcion_de > '2026-09-26' AND estado_del_procedimiento in('Publicado','Abierto')`.
- **Impacto usuario:** ve 0 oportunidades donde hay ~40; concluye que no hay licitaciones. **Negocio:** es la función central (descubrir licitaciones); alertas y digest dan "cero nuevos" falsos.
- **Corrección:** filtrar en servidor (`$where=fecha_de_publicacion_del IS NOT NULL` y/o estados vigentes y recepción futura) antes de ordenar; mismo cambio en `daily-digest`.
- **Criterio de aceptación:** para acueducto, alcantarillado, interventoria y colegio, el conjunto que trae la app contiene todos los abiertos reales del servidor (comparar con `count(*)` del mismo `$where`).
- **Confianza:** VERIFICADO.

### TR-001 · CRITICAL · SECOP I — La sugerencia de oferta usa un "presupuesto" que no es presupuesto
- **Descripción:** En SECOP I, `cuantia_proceso` ≈ `cuantia_contrato`. `deSecopI` lo usa como precio base y `sugerenciaOfertaEconomica` lo mezcla con SECOP II como si fueran la misma magnitud → descuentos 0%.
- **Evidencia:** 400 filas reales: en 385, `cuantia_proceso == cuantia_contrato`. UFPS Cúcuta: 29 registros SECOP I, 29 "comparables", 29 con descuento exactamente 0; la sugerencia sale conservador = competitivo = agresivo = presupuesto (0%), rotulada "29 adjudicaciones comparables (SECOP I+II)".
- **Ubicación:** `index.html:6394-6421`, `6540-6548`, `6559-6600`.
- **Reproducir:** Evaluación → entidad con historial predominantemente SECOP I → "Ver adjudicaciones de esta entidad"; o `node scratchpad\tr\t2.mjs` con los json de `deSecopI/deSecopII`.
- **Impacto usuario:** tres escenarios de oferta idénticos al presupuesto presentados como patrón histórico. **Negocio:** decisión económica basada en un dato espurio.
- **Corrección:** excluir SECOP I del cálculo de descuento (precioBase=null) y calcular solo con SECOP II; mostrar SECOP I como historial informativo.
- **Criterio de aceptación:** con la entidad de la prueba, la sugerencia devuelve `aplica:false`; con ambas fuentes, la nota indica que las comparables son solo SECOP II.
- **Confianza:** VERIFICADO.

### MC-001 · CRITICAL · Motor — Valor mínimo en pesos ignorado en texto libre
- **Descripción:** `construirRequisitoDesdeTexto` solo extrae SMMLV; un mínimo "$500.000.000" no genera `minValor` ni `condicionNoVerificable` → CUMPLE con solo coincidir el objeto.
- **Evidencia:** "Mínimo 1 contrato de construcción de puentes vehiculares por valor mínimo de $500.000.000" + contrato de $1.000.000 → `CUMPLE`. Variante "por $500.000.000" → CUMPLE.
- **Ubicación:** `~4240`, `extraerRequisitosDePliego` `5226`. **Reproducir:** `mc/t3.mjs`.
- **Impacto:** un contrato de $1M "acredita" un requisito de $500M; la empresa se presenta y es descalificada. Afecta a todo usuario sin cuenta (camino sin IA).
- **Corrección:** extraer $/COP/"millones" o poner `condicionNoVerificable` si aparece cifra monetaria sin `minValor`.
- **Criterio de aceptación:** ese requisito con contrato de $1M → NO CUMPLE (o NO DETERMINABLE si no se parsea), nunca CUMPLE.
- **Confianza:** VERIFICADO.

### MC-002 · CRITICAL · Motor — Conteo mínimo de contratos solo se reconoce en 3 redacciones
- **Descripción:** Sin `minContratos`, basta 1 contrato relevante. Solo se reconocen "mínimo N contratos", "N contratos como mínimo", "mínimo palabra (N)".
- **Evidencia:** con un solo contrato relevante, CUMPLE en: "Dos (2) contratos de…", "Acreditar 3 contratos de…", "Acreditar mínimo 2 (dos) contratos de…", "Acreditar dos contratos como mínimo de…".
- **Ubicación:** `4225-4234`. **Reproducir:** `mc/t3.mjs`.
- **Impacto:** falso CUMPLE en la redacción más común de pliegos.
- **Corrección:** ampliar patrones (letras, "al menos", "N (dígito)") o degradar a NO DETERMINABLE ante cualquier numeral cerca de "contrato(s)" sin modelar.
- **Criterio de aceptación:** los 4 casos con 1 contrato → NO CUMPLE.
- **Confianza:** VERIFICADO.

### MC-003 · CRITICAL · Motor — La ventana temporal no está acoplada al valor ni al conteo
- **Descripción:** `evaluarCondicionTemporal` no bloquea si *algún* contrato relevante está en la ventana, aunque no sea el que aporta valor o cantidad.
- **Evidencia:** minValor 500M + "últimos 5 años": contrato A $600M (2015) + contrato B $50M (2025) → CUMPLE ("mejor valor individual 600M"). "Mínimo 2 contratos … últimos 5 años" con uno de 2015 y uno de 2025 → CUMPLE.
- **Ubicación:** `4180`. **Reproducir:** `mc/t4.mjs` casos 1 y 3.
- **Impacto:** experiencia vencida cuenta como vigente.
- **Corrección:** filtrar `relevantes` por ventana **antes** de aplicar minContratos/minValor/minCantidad.
- **Criterio de aceptación:** ambos casos → NO CUMPLE.
- **Confianza:** VERIFICADO.

### MC-004 · CRITICAL · Motor — Unidades de los índices sin normalizar (60% vs 0,60)
- **Descripción:** "menor o igual al 60%" se extrae como 60; el perfil trae 0,75 → 0,75 ≤ 60 → ok. Inverso: pliego 0,60 y perfil "45%" → falla. (`exigenciasDesdeIA` también ignora `unidad_indicador`: IA-010.)
- **Evidencia:** `extraerExigencias("Índice de endeudamiento menor o igual al 60%")` → 60; `evaluarProceso` con perfil 0,75 → "Pliego ≤ 60 · tu perfil 0.75 ✓" → veredicto **GO**.
- **Ubicación:** `5511`, `5651`, `5793-5800`.
- **Impacto:** GO indebido, o descarte de un proceso viable.
- **Corrección:** normalizar % a fracción en ambos lados o marcar nd si la unidad es dudosa.
- **Criterio de aceptación:** "60%" y 0,60 se tratan igual; perfil 0,75 da fail.
- **Confianza:** VERIFICADO (regex y `evaluarProceso`); INFERIDO (camino IA).

### RT-001 · CRITICAL · Motor — Valores negativos se convierten en positivos
- **Descripción:** `parseValorUnidad` extrae con `/\d[\d.,]*\d|\d/g`, sin signo ni paréntesis contables. Aplica a valor del contrato, mínimo del requisito y K residual del perfil.
- **Evidencia:** `parseValorUnidad("-1.500.000.000")` → 1500000000; Excel con Valor "-1.500.000.000" contra mínimo 1.000.000.000 → CUMPLE; `K residual = -1.200.000.000` → `{1200000000, COP}`.
- **Ubicación:** `4966-4973` (usos `3901-3930`, `2564-2572`, `5651`). **Reproducir:** `rt/t2.mjs`, `t4.mjs`.
- **Impacto:** capacidad o experiencia inexistente aparece como plena (ej. K residual negativo tras restar contratos).
- **Corrección:** capturar `-?` y `(…)`; negativo → null + aviso; rechazar negativos en perfil y Excel.
- **Criterio de aceptación:** "-1.5e9", "(1.5e9)" y "K residual = -1.2e9" → null/NO DETERMINABLE, nunca CUMPLE.
- **Confianza:** VERIFICADO.

### RT-002 · CRITICAL · Motor — Contratos duplicados y filas TOTAL se suman
- **Descripción:** `numeroContrato` se lee pero no se usa para deduplicar; en requisitos acumulables el mismo contrato repetido (o una fila "TOTAL…") suma varias veces.
- **Evidencia:** requisito acumulable de 3.000.000.000: un contrato de 1.600.000.000 → NO CUMPLE; el mismo contrato en dos filas → CUMPLE; con una fila "TOTAL pavimentación de vías $1.600.000.000" → CUMPLE.
- **Ubicación:** `3925`, `4495`, `4509`, `3939-3950`. **Reproducir:** `rt/t8.mjs`, `t10.mjs`.
- **Impacto:** experiencia inflada → CUMPLE indebido; riesgo de sanción si se presenta experiencia duplicada.
- **Corrección:** deduplicar por N° contrato+contratante+valor; excluir filas TOTAL/SUBTOTAL o sin contratante y fechas; avisar por N° repetido.
- **Criterio de aceptación:** los tres escenarios cuentan el contrato una sola vez → NO CUMPLE.
- **Confianza:** VERIFICADO.

---

## 5. Hallazgos HIGH (detalle)

Formato: descripción/evidencia · ubicación · reproducción · impacto · corrección · criterio · confianza. (Los impactos usuario/negocio se resumen en una línea cuando coinciden.)

### Datos de SECOP

**S2-002 · HIGH** — El `$q` de Socrata distingue tildes. Evidencia: "pavimentacion" 858 resultados, "pavimentación" 2, "pavimento" 6.493; "pavimentación vías" 0 (AND). Ubicación `7712-7714`, `7926`. Reproducir: `$select=count(*)&$q=pavimentación` vs sin tilde. Impacto: quien escribe con tilde (lo natural) casi no recibe nada. Corrección: enviar `$q` sin tildes y/o raíz; consulta por palabra. Criterio: "pavimentación" y "pavimentacion" con recall equivalente. Confianza: VERIFICADO.

**S2-003 · HIGH** — "Ocultar vencidos" no oculta lo que no tiene fecha de cierre (84% de las filas: 7.794.678 de 9.231.205) y por defecto están marcados todos los estados (Cancelado, Borrador, Seleccionado…). Evidencia: muestra "pavimento": 46 Cancelados, 46 Borrador, 64 Seleccionados; "acueducto": 105/300 Cancelados, 259/300 sin fecha. Ubicación `7412-7487`, `7477`, `scoreRecord 7335-7360`. Impacto: el usuario revisa procesos muertos como oportunidades. Corrección: por defecto solo Publicado/Abierto; Cancelado/Seleccionado/Aprobado/Suspendido nunca vigentes; "Sin fecha de cierre" explícito. Criterio: con filtros por defecto ningún Cancelado/Seleccionado aparece como abierto. Confianza: VERIFICADO (datos) / PARCIALMENTE (UI, por código).

**SI-001 · HIGH** — SECOP I: `$q` de 2 palabras + `$limit=400` y filtro por entidad *después* en el cliente → recuperación deficiente. Evidencia: INVIAS 1 de 987 filas existentes (782 Celebrado, 162 Liquidado…); Universidad Nacional 0; Alcaldía de Medellín 0; Gobernación N. de Santander 2 de 400 (existen 7.395). Ubicación `6394-6396`, `6327-6331`. Reproducir: `node scratchpad\si\t.js "INSTITUTO NACIONAL DE VIAS - INVIAS"`. Impacto: historial vacío para entidades grandes con mensaje "no se encontraron" engañoso; la sugerencia de oferta queda sin datos. Corrección: `$where` por nombre exacto/token distintivo resuelto previamente (`$group`), paginar con `$offset`. Criterio: INVIAS ≥400 filas adjudicadas propias; Cúcuta y Gobernación 100% de la entidad; respuesta <5 s. Confianza: VERIFICADO.

**SI-002 · HIGH** — Latencia de la consulta a SECOP I (107 s y 16 s medidos sobre la misma URL) frente a timeout de 15 s; el fallo es silencioso. Ubicación `6397`, `6426-6428`. Impacto: "0 en SECOP I" sin saber que fue un fallo. Corrección: devolver `{lista, fallas}` y avisar; usar filtros indexables; timeout 25–30 s con reintento. Criterio: con SECOP I bloqueado la UI lo dice y no muestra 0. Confianza: VERIFICADO.

**TR-002 · HIGH** — SECOP I trae filas duplicadas (mismo `uid`) y varias por proceso; `buscarAdjudicaciones` no deduplica. Evidencia: UFPS Cúcuta 29 filas = 15 uid únicos; 14 de 15 referencias repetidas; en 400 filas, 153 de 247 procesos con >1 fila; un `uid` (CAR Quindío) aparece 100 veces. Ubicación `6394-6421`, `6528-6541`. Impacto: se cumple falsamente el mínimo de 3 comparables. Corrección: dedup por `uid`/`id_del_proceso` y exigir valor > 0. Criterio: UFPS muestra 15 filas. Confianza: VERIFICADO (existencia); tasa global NO VERIFICADO.

**TR-003 · HIGH** — Un fallo de una fuente (o de ambas) no se informa: `Promise.allSettled` solo hace `console.error`; con ambas caídas dice "No se encontraron procesos adjudicados". Ubicación `6423-6431`, `6521-6523`, `8362-8376`. Impacto: sugerencia calculada con una sola fuente rotulada "SECOP I+II"; mensaje falso. Corrección: devolver estado por fuente y mostrar aviso. Criterio: con una fuente bloqueada aparece aviso con su nombre. Confianza: VERIFICADO (código).

**TR-007 · HIGH** — Trazabilidad ausente en exportables: `informeEvalTexto`, carta, paquete, CSV, resumen copiable, correo diario, PAA y alertas no citan dataset, fecha de consulta ni modo (vivo/snapshot/demo). Ubicación `6002-6046`, `6054`, `6252`, `7998-8027`, `daily-digest/index.ts:335-345`, `7856-7870`. Impacto: un informe adjuntado a un tercero no es reconstruible. Corrección: pie estándar "Fuente: datos.gov.co, dataset X — consultado ISO — modo …" y columnas Fuente/Dataset/Consultado en CSV. Criterio: los 6 exportables lo incluyen, con test de humo. Confianza: VERIFICADO (lectura).

**TR-008 · HIGH** — Evaluación, informes, carta y paquete no marcan si los datos vienen del snapshot del 03-sep o de la **demo ficticia**; se puede descargar una carta de un proceso de demo. Ubicación `6641-6685`, `7412-7415`, `7912-7962`, `7960`. Corrección: guardar `lastSource` y mostrarlo; bloquear carta/paquete en modo demo. Confianza: PARCIALMENTE VERIFICADO.

### Motor de cumplimiento (sin IA)

**MC-005 · HIGH** — `extraerExigencias` toma el primer número a ≤70 caracteres de la etiqueta: "Índice de liquidez con corte a 31 de diciembre de 2023 mayor o igual a 1,5" → 31 (falso NO-GO); "…índice de endeudamiento y razón de cobertura de intereses, establecidos en el Decreto 1082 de 2015" → 1082 (endeudamiento pasa siempre; cobertura falla siempre). Ubicación `5511`. Corrección: exigir operador antes del número, descartar años y números de norma, nd con varios candidatos. Criterio: ambos casos → nd o 1,5. Confianza: VERIFICADO.

**MC-006 · HIGH** — K residual relativo leído como cifra absoluta: "mínimo 1,5 veces el presupuesto oficial" → {1.5, COP} ✓ con perfil $10; "mayor al 100% del presupuesto de $3.200.000.000" → {100, COP} ✓ con K=$500M. Ubicación `5511-5520`. Corrección: si sigue "veces"/"%"/"presupuesto", no emitir umbral o convertir. Criterio: ambos → nd o comparación correcta. Confianza: VERIFICADO.

**MC-007 · HIGH** — `matrizCapacidad` toma el primer número tras la etiqueta, incluidas fechas: "Liquidez año 2022: 0,9 / Índice de liquidez: 2,0" → 2022; "…a 31/12/2023: 1,2" → 31. (RT-005 lo confirma: "Endeudamiento a 31 dic 2024: 0,85" → 31; "Liquidez N/A; Endeudamiento 0.6" → liquidez 0.6.) Ubicación `5671-5675`. Corrección: exigir `:`/`=` y descartar años/fechas y cruces de etiqueta. Criterio: los 4 textos → 0,8 / 0,9 / 0,85 / null. Confianza: VERIFICADO.

**MC-008 · HIGH** — Verbos de actividad genéricos (construcción, mantenimiento, adecuación, mejoramiento) se filtran de las palabras distintivas: "construcción de acueducto" acepta "Estudios y diseños de acueducto", "Suministro de tubería para acueducto", "Interventoría técnica…"; "mantenimiento de puentes" acepta "Construcción de puentes"; un contrato "terminado anticipadamente por incumplimiento, caducidad declarada" → CUMPLE. Ubicación `3959`. Corrección: hacer distintivos los verbos de actividad del requisito; detectar caducidad/negaciones. Criterio: los 4 primeros → NO DETERMINABLE. Confianza: VERIFICADO.

**MC-009 · HIGH** — Condiciones dimensionales solo reconocen "metros/kilómetros/m2…": "luz mínima de 40 m", "40 mts", "40 m.l.", "40 ml" → CUMPLE. Ubicación `condicionCuantitativaSinModelar`, `UNIDADES_DIMENSIONALES`. Corrección: ampliar unidades o bloquear cualquier número+unidad corta. Criterio: los 4 → NO DETERMINABLE con la condición citada. Confianza: VERIFICADO.

**MC-010 · HIGH** — La participación en consorcio del contrato se lee pero no se usa: contrato $900M con 30% de participación cumple un mínimo de $500M (aportó $270M). Ubicación `4438`, `3926`. Corrección: ponderar o degradar a nd. Criterio: → NO CUMPLE o nd. Confianza: VERIFICADO.

**MC-011 · HIGH** (con IA-005) — Obligatoriedad por regex sin negaciones: "No es opcional" → opcional; "cualquiera de los socios del consorcio…" → alternativo; y un requisito opcional/alternativo que da NO CUMPLE **no afecta el global** (global CUMPLE con [obligatorio CUMPLE + opcional NO CUMPLE]). Ubicación `4222`, `4700-4707`. Corrección: detectar negaciones; un opcional NO CUMPLE debe verse en el global. Criterio: "No es opcional" → obligatorio. Confianza: VERIFICADO.

**MC-014 · HIGH** — `calcularSCE` ignora en silencio contratos en ejecución sin saldo, sin fecha o vencidos; el gate dice "cubre". Evidencia: K residual 2.000M con dos contratos incompletos (uno con saldo $1.500M sin fecha) → SCE=0, "capacidad disponible cubre el valor de la obra". Ubicación `2534`. Corrección: gate nd/revisar con motivo visible. Criterio: con un contrato incompleto el gate no dice ok. Confianza: VERIFICADO.

**RT-003 · HIGH** — Fechas invertidas (inicio 2028, fin 2024), futuras (2035) o 9999-12-31 en el Excel dan CUMPLE en "últimos 5 años"; "12/31/2024" (mm/dd) queda "2024-31-12"; "1/5/22" → null. Ubicación `3886-3894`, `4132-4134`, `4180-4200`. Corrección: validar rango, fin ≥ inicio, fechas futuras = en ejecución (nd), formatos ambiguos marcados. Criterio: esos casos → NO DETERMINABLE con motivo. Confianza: VERIFICADO.

**RT-004 · HIGH** — Con K residual vacío (o valor de obra 0) el gate "Capacidad vs valor" **desaparece** (`if (matriz.kResidual && valor)` sin `else`); con indicadores y experiencia OK el veredicto sale GO sin evaluar capacidad. Ubicación `5770`, `5852-5857`. Corrección: agregar el gate como nd. Criterio: sin K residual el veredicto máximo es REVISAR. Confianza: PARCIALMENTE VERIFICADO (código).

**RT-006 · HIGH** — Umbrales del pliego leídos de referencias/negaciones: "El índice de liquidez no será exigido… según el numeral 4.2" → 4.2; "ver Anexo 3" → 3; "No se exigirá capacidad residual…; el presupuesto es de $2.500.000.000" → K exigido = $2.500M; "conforme al numeral 5.3 (Decreto 1082)" → 5.3 COP (perfil lo "cumple"). Ubicación `5511-5540`. Corrección: excluir números tras numeral/anexo/artículo/Decreto; negación → nd; varios candidatos → avisar. Criterio: los 4 textos → nd con nota. Confianza: VERIFICADO.

**RT-007 · HIGH** (con UX-004) — El chip "GO" de la tarjeta y `resumenEjecutivo` ("SÍ vale la pena participar") ignoran `lecturaParcial(entry)` (solo el detalle lo avisa). Ubicación `5852-5857`, `5868`, `5892`. Corrección: degradar a REVISAR si `pagesRead < numPages` o vía OCR; disclaimer fijo en la tarjeta. Criterio: con lectura parcial el veredicto nunca es GO. Confianza: PARCIALMENTE VERIFICADO.

**RT-009 · HIGH** — `bitacora_historial="null"` (JSON válido de tipo incorrecto) deja "Buscar procesos" rota para siempre con el mensaje "NO SE PUDO CONSULTAR SECOP II". Ubicación `2198-2205`, `7496`, `7946`. Corrección: validar tipo tras `JSON.parse` en todos los loaders. Criterio: con cualquier clave en `null`/`[]`/`"x"`/`5` la app arranca y avisa "dato local dañado". Confianza: VERIFICADO (navegador). (Ver también RT-012.)

### IA

**IA-001 · HIGH** — Verificación de cifras eludible: la ruta "aproximada" acepta la fila si ≥90% de los tokens están en la página y cada cifra aparece *en cualquier parte* de la página; `normHeader` parte "15.000" en "15" y "000". Evidencia (`ia-audit.mjs`): C3d (PDF "mínimo 5 contratos… plazo 2 meses", IA emite min_contratos=2 con cita reordenada) → `verificada=true` y CUMPLE; C4 (×1000) pasa; K y D (columnas o campos intercambiados) pasan. Ubicación `5353-5357`, `5370-5379`. Corrección: n-gramas contiguos para las cifras, cotejar contra la aparición de la cita en el PDF, tablas por fila. Criterio: los 4 casos → no verificada; tests existentes siguen pasando. Confianza: VERIFICADO (motor); frecuencia real con Claude NO VERIFICADO.

**IA-002 · HIGH** — La unidad (COP/SMMLV, "millones") no se verifica contra la cita: cita "15.000 SMMLV" con `unidad=COP` → verificada y CUMPLE (12.000M ≥ 15.000 "pesos"): reintroduce el bug SMMLV vs pesos. Cita "$1.200 millones" con `1200 COP` → verificada; contrato de $5M → CUMPLE. Ubicación `5344-5357`, `5416-5417`, `extraer-requisitos/index.ts:73`. Corrección: cotejo determinista de unidad y multiplicador con regex sobre la cita. Criterio: E1/E3 → NO DETERMINABLE. Confianza: VERIFICADO.

**IA-003 · HIGH** — La `descripcion` parafraseada por la IA decide qué contratos aplican y no se verifica: cita "Puentes vehiculares: mínimo 2 contratos…" con `descripcion="Experiencia en obras civiles"` → palabras distintivas `["civiles"]` → CUMPLE con contratos de andenes. Ubicación `5410`, `4447-4457`, prompt `index.ts:128`. Corrección: construir palabras distintivas desde la cita (o exigir que las de la descripción estén en la cita). Criterio: caso P → NO DETERMINABLE/NO CUMPLE. Confianza: VERIFICADO.

**IA-004 · HIGH** — Adendas: `modificado_por_adenda` es solo una etiqueta (el motor no la lee); "el primero gana" en `exigenciasDesdeIA`; si vienen pliego 1,2 y adenda 1,5 gana el orden (I1 1,2; I2 1,5); pliego "3 contratos" y adenda "2" devueltas ambas → global NO CUMPLE por la fila obsoleta; si la IA solo devuelve el valor viejo no hay contradicción detectable. Ubicación `5479-5483`, `5794`, `6816-6823`. Corrección: detectar filas del mismo indicador con valores distintos → estado CONFLICTO (nd) con ambas citas; `reemplaza_a`. Criterio: dos filas del mismo indicador con valores distintos → CONFLICTO, nunca CUMPLE/NO CUMPLE automático. Confianza: VERIFICADO (motor); comportamiento de Claude con adendas reales NO VERIFICADO.

**IA-005 · HIGH** — `obligatoriedad` y categoría no se verifican contra la cita, y el esquema no distingue habilitante / puntaje / obligación contractual (solo `otro`): un requisito obligatorio marcado `opcional` con NO CUMPLE → **global CUMPLE** (G); un criterio de puntaje ("10 puntos por cada contrato adicional") clasificado como experiencia obligatoria → NO CUMPLE global → falso NO-GO (H). Ubicación `4702-4708`, `5844-5853`, `index.ts:46,62-64`. Corrección: campo `naturaleza`, cotejo de marcadores en la cita, opcional NO CUMPLE visible. Criterio: G → REQUIERE REVISIÓN; `ponderable` nunca produce NO-GO. Confianza: VERIFICADO.

**IA-008 · HIGH** — Completitud no medible y filas "VERIFICAR A MANO" no cuentan en el veredicto: jurídico, garantías, organizacional y `otro` no producen gate; cobertura, patrimonio y capital de trabajo solo si la IA los extrajo; una omisión produce GO ("no se detectó ningún incumplimiento en los puntos evaluados"). Ubicación `5844-5853`, `5804-5809`, `6824-6826`. Corrección: filas manuales cuentan como nd; checklist de categorías esperadas con "NO ENCONTRADO"; contraste con el regex. Criterio: con garantías sin revisar no hay GO. Confianza: INFERIDO (no se ejecutó `evaluarProceso`).

### Documentos generados

**DG-001 · HIGH** — El anexo de experiencia rotula "Contratos que lo acreditan" a los contratos de requisitos NO CUMPLE o NO DETERMINABLE (`contratosEvaluados` = coincidentes por palabras). Evidencia: requisito NO CUMPLE con contrato de valor 0 → "Resultado: NO CUMPLE / Contratos que lo acreditan: - Pavimentación X · $0". Ubicación `6222-6224`. Reproducir: `t2.js` (scratchpad del auditor). Impacto: el usuario firma un anexo que llama "acreditados" a contratos que no cumplen. Corrección: solo mostrar "acreditan" si `resultado==='CUMPLE'`. Criterio: ningún requisito no CUMPLE usa el rótulo. Confianza: VERIFICADO.

**DG-002 · HIGH** — El anexo de experiencia, dirigido "Señores [Entidad]", incluye la autoevaluación interna ("NO CUMPLE… 1 no determinable") y textos de la interfaz ("Ve a 'Buscar procesos'…"); se puede generar con NO CUMPLE global y no lista fechas ni número de contrato. Ubicación `6213-6231`. Corrección: separar informe interno del anexo firmable; aviso si el global no es CUMPLE; notas internas marcadas para borrar. Criterio: el cuerpo firmable no contiene "Buscar procesos" ni "NO DETERMINABLE". Confianza: VERIFICADO.

**DG-003 · HIGH** — Declaraciones bajo juramento y afirmaciones fácticas fijas, sin dato ni verificación, incluso con perfil vacío: carta (ítems 2, 3, 7: sin inhabilidades, información veraz, "bajo la gravedad de juramento"), anticorrupción ítem 6 ("no ha sido sancionada… ni investigada…"), parafiscales ítems 1-3 (aportes pagados, sin sumas pendientes). El aviso de "plantilla" va al final y habla de formato. Ubicación `6076-6081`, `6128`, `6172-6174`. Reproducir: `generarPaqueteTexto(perfilVacio, {}, undefined)`. Impacto: riesgo penal/contractual por declaración falsa; parece listo para firmar. Corrección: casillas `[CONFIRMAR]` o bloque previo "DECLARACIONES QUE DEBES VERIFICAR", aviso al inicio, confirmación al descargar. Criterio: ninguna afirmación fáctica queda como texto fijo sin marca. Confianza: VERIFICADO (contenido); consecuencia legal INFERIDA — **requiere revisión profesional**.

### Seguridad y privacidad (conclusiones jurídicas: requieren revisión profesional)

**SEG-001 · HIGH** — Supabase Auth con `mailer_autoconfirm:true` y `disable_signup:false`: cualquiera crea cuentas con correos ajenos y obtiene sesión inmediata; la UI dice "Revisa tu correo para confirmarla" (falso). Evidencia: `GET /auth/v1/settings` con la anon key. Ubicación `supabase/config.toml` (sin `[auth]`), `index.html:2005-2010`. Impacto: pre-secuestro de cuentas, cuentas ilimitadas (multiplican el cupo de IA, SEG-002), correos a terceros (SEG-003). Corrección: activar "Confirm email", contraseña mínima 8 + protección de contraseñas filtradas, CAPTCHA, límite por IP, versionar `[auth]`. Criterio: `mailer_autoconfirm:false` y `signUp` no devuelve sesión sin confirmar. Confianza: VERIFICADO (configuración); abuso concreto INFERIDO.

**PRIV-001 · HIGH** — No existe política de tratamiento de datos, aviso de privacidad, términos ni autorización al registrarse (Ley 1581/2012 y Decreto 1377/2013). Evidencia: `grep` de "privacidad|términos|1581" solo halla la nota sobre Anthropic (`6886`). Corrección: redactar con asesoría jurídica, casilla obligatoria con registro de aceptación, enlaces en el pie. Confianza: VERIFICADO (ausencia).

**PRIV-002 · HIGH** — No hay borrado de cuenta ni de datos (derecho de supresión); al borrar el usuario `companies`, `app_state` y `ai_usage` quedan huérfanos con datos personales (`companies` no referencia `auth.users`). Corrección: Edge Function `eliminar-cuenta`, cascada, botones "Descargar/Borrar mis datos". Criterio: tras eliminar no queda fila alguna del usuario ni claves `bitacora_*`. Confianza: VERIFICADO (código/esquema); ejecución NO VERIFICADO.

### UX, rendimiento, escalabilidad, confiabilidad

**UX-001 · HIGH** — La lista se trunca a 40 (`slice(0,40)`, `7522`) antes de calcular los contadores; la UI dice "40 procesos · N alta prioridad · X GO / Y NO-GO" sin mencionar el total ni ofrecer "ver más". Corrección: "Mostrando 40 de N", "Cargar más", contadores sobre el total. Confianza: VERIFICADO (código).

**UX-002 · HIGH** — El estado vacío no dice qué filtro eliminó los resultados (282 traídos → 0 mostrados con departamento precargado "Norte de Santander"). Corrección: embudo por filtro con "quitar este filtro". Confianza: VERIFICADO.

**UX-003 · HIGH** — El motivo del veredicto está en un `title`/tooltip con solo la primera razón; jerga "GO/NO-GO". Corrección: nombres claros ("Cumple lo revisado / Falta información / No cumple") y una línea visible con el gate fallido y su acción. Confianza: VERIFICADO (código).

**UX-004 · HIGH** — Un "GO" puede leerse como asesoría; el disclaimer está en el detalle y en el .txt, no junto al chip ni a la cobertura del análisis. Corrección: pie fijo "Orientativo. Confirma con el pliego oficial" y "Leído: X/N págs". (Ver RT-007.) Confianza: PARCIALMENTE VERIFICADO.

**UX-005 · HIGH** — 33 de 43 controles de formulario sin etiqueta programática (solo 4 `for=` en todo el archivo). Corrección: `<label for>`/`aria-label` y `autocomplete`. Criterio: 0 controles sin nombre accesible (axe/Lighthouse). Confianza: VERIFICADO.

**PERF-005 · HIGH** — `analisis_pliegos` es una sola clave con el texto completo de cada pliego: ≈35–40 pliegos de 40 págs antes de llenar ~5 MB (3–4 de 400 págs); una escritura fallida pierde todo el cambio. Corrección: IndexedDB o no persistir `text`, una clave por análisis, gestor de almacenamiento. Confianza: INFERIDO (cálculo); manejo de error VERIFICADO.

**ESC-001 · HIGH** — El digest diario procesa empresas y alertas en serie sin presupuesto de tiempo; con el límite de ejecución de Edge Functions caben ~15–30 empresas por corrida; el remitente `onboarding@resend.dev` solo entrega al dueño de la cuenta Resend. Corrección: cola/lotes con concurrencia, `ultimo_digest` por empresa, dominio verificado. Confianza: INFERIDO (límites de plataforma no consultados).

**ESC-002 · HIGH** — Un solo App Token de Socrata compartido (cliente y cron) y ~3 consultas por visita al Dashboard. Corrección: proxy con caché 5–15 min, token separado para el cron, dedup de anclas. Confianza: INFERIDO.

**ESC-003 · HIGH** — Costos de IA sin tope global ni caché por hash de PDF; sin `AbortSignal.timeout` en la llamada a Anthropic; varias copias en memoria para 24 MB. Corrección: caché por SHA-256, tope global diario/mensual, timeout con liberación de cupo. Confianza: VERIFICADO (código); costos INFERIDOS.

**REL-001 · HIGH** — La falla de un CDN se cachea para siempre (la promesa rechazada queda en `window.__bitacora*Promise`): tras un corte breve, todos los intentos siguientes fallan hasta recargar y perder el trabajo en curso. Corrección: limpiar la promesa en `onerror` y ofrecer "Reintentar". Confianza: VERIFICADO (código).

### DevOps, QA, arquitectura

**OPS-001 · HIGH** — El despliegue a Pages no tiene gate de CI ni staging (`smoke.yml` declara que no bloquea). Corrección: deploy por Actions con `needs: smoke`, rama protegida. Confianza: PARCIALMENTE VERIFICADO (configuración real de Pages no visible).

**OPS-003 · HIGH** — Las Edge Functions se despliegan a mano sin CI ni versión de contrato cliente/función. Corrección: workflow de deploy con secretos de CI, campo `version` validado por el cliente. Confianza: VERIFICADO (ausencia).

**OPS-007 · HIGH** — Sin monitorización: ni captura de errores del cliente, ni alerta si falla el digest (devuelve 200 aunque envíe 0), la IA o datos.gov.co, ni panel de costo. Corrección: logger de errores, digest devuelve 500 si falló alguna empresa, heartbeat externo, vista de gasto sobre `ai_usage`. Criterio: una falla simulada genera notificación en <24 h. Confianza: VERIFICADO (ausencia).

**OPS-008 · HIGH** — Sin respaldo/restauración: sin cuenta todo vive en `localStorage`; no hay exportar/importar JSON; plan y backups de Supabase NO VERIFICADO; sin simulacro de restauración ni RPO/RTO. Corrección: "Exportar/Importar respaldo" sobre `SYNCED_KEYS`; confirmar plan y ensayar restauración. Confianza: VERIFICADO (ausencia); plan NO VERIFICADO.

**QA-001 · HIGH** — Las 93 pruebas no cubren: `evaluarProceso` completo, `aplicarRequisitosIAaEntry`, `parsearRUP`/`parsearRUT`, `buscarAdjudicaciones`, generadores documentales, `contarNuevosDeAlerta`, Edge Functions ni UI/eventos. Corrección: módulo importable para las funciones puras y ≥3 casos (feliz/límite/inválido) por función crítica. Confianza: PARCIALMENTE VERIFICADO (conteo de menciones).

**ARQ-002 · HIGH** — Sin versión de esquema de datos en `localStorage`/`app_state` (12 claves JSON sin `schemaVersion`); dos versiones de la app pueden pisarse. Corrección: `bitacora_schema_version`, `migrar()` al arrancar y no sobrescribir versiones mayores. Confianza: PARCIALMENTE VERIFICADO.

**ARQ-003 · HIGH** (con ESC-005, RT-015) — Sincronización *last-write-wins* por clave completa con reloj del cliente, sin `storage` event ni control de versión; los fallos remotos solo van a `console.error`. Corrección: versión optimista, una fila por elemento, aviso visible de fallo. Criterio: dos pestañas/dispositivos editando elementos distintos conservan ambos cambios. Confianza: PARCIALMENTE VERIFICADO (código; escenario multi-dispositivo NO VERIFICADO).

---

## 6. Hallazgos MEDIUM, LOW e INFO (tabla)

Todos con la confianza indicada; la reproducción y evidencia completas están en los scripts de la sesión y en la referencia de código.

| ID | Sev. | Hallazgo y evidencia | Corrección / criterio | Conf. |
|---|---|---|---|---|
| S2-004 | MEDIUM | `searchable = JSON.stringify(record)`: coincide con entidad/proveedor. Falsos positivos por objeto no coincidente: colegio 179/300, acueducto 73, alcantarillado 79, obra civil 26 (`7286`) | Buscar solo en nombre+descripción(+categorías); FP <5% en las mismas consultas | VERIF. |
| S2-005 | MEDIUM | Alertas: `pub` a las 00:00 (floating_timestamp) `> ultimaRevision` → lo publicado el mismo día de la revisión nunca cuenta; cuenta Cancelados/Borradores (`7786-7797`, `digest:190-192`) | Comparar por día con `>=` y dedup por id; excluir no vigentes | INFER. |
| S2-006 | MEDIUM | "Solo Licitación Pública (Obra pública)" exige /obra/ en modalidad: excluye "Licitación pública" (62.663 filas) frente a "…Obra Publica" (31.610); no usa `tipo_de_contrato='Obra'` (146.417) (`7463-7466`) | Filtrar por `tipo_de_contrato` o renombrar la etiqueta | PARC. |
| S2-007 | MEDIUM | `matchesGeo` igualdad exacta: "Bogotá" no coincide con "Distrito Capital de Bogotá"; 582.457 filas "No Definido" excluidas (`7315-7330`) | Alias o selector cerrado de 34 valores | VERIF. |
| S2-008 | MEDIUM | Aviso de truncamiento no advierte que se trae el 0,4% (300 de 66.769 para acueducto) ni la fecha real de actualización (`rowsUpdatedAt`) (`7754-7758`, `7934-7937`) | Paginar/`$where` y mostrar `rowsUpdatedAt` | VERIF. |
| S2-009 | MEDIUM | `snapshot.json`: 457 procesos, máx. publicación 2026-08-31 (26 días), solo Norte de Santander/Obra, se muestra con cualquier filtro; "vencido" se mide contra su fecha (`3440`, `7943-7948`) | Banner con antigüedad y alcance; marcar "posiblemente cerrado" | VERIF. |
| S2-010 | MEDIUM | PAA por departamento: 57% de entidades sin departamento resuelto (99 en PAA, 43 cruzan) por cruce por nombre con 300 filas (`6501-6512`) | Resolver por `nit_entidad`; ≥90% resueltas | PARC. |
| S2-011 | LOW | 348.526 filas con `precio_base=0` se muestran "$0"; cierre 00:00 se trata como vencido durante casi todo el día (`7216-7230`, `7345-7350`) | "Sin presupuesto"; cierre a fin de día | VERIF./INFER. |
| S2-012 | LOW | Sin `fecha_de_recepcion_de`, `normalize` infiere el "cierre" de cualquier columna `fecha*` (incluida adjudicación) (`7266-7279`) | "Sin fecha de cierre publicada" | PARC. |
| S2-013 | LOW | App Token público embebido (`7699`; también en el digest) | Verificar que no tenga escritura; monitorear/rotar | VERIF. (permisos NO VERIF.) |
| SI-003 | MEDIUM | `coincide`: "GOBERNACION DE NORTE DE SANTANDER" acepta "SANTANDER - GOBERNACIÓN"; "MUNICIPIO DE CUCUTA" acepta la Personería; prefijo "DEPARTAMENTO - " no se normaliza (`6332-6339`) | Quitar prefijo, exigir departamento, excluir subunidades | VERIF. |
| SI-004 | MEDIUM | `fechaMasRecienteDe` devuelve fin de ejecución en 335/398 (84%) de Cúcuta; 8 futuras (`6350-6353`, `6581-6584`) | Usar `fecha_de_firma_del_contrato` | VERIF. |
| SI-005 | MEDIUM | Valor con adiciones ÷ base original (31% de filas de Cúcuta con adiciones); ~9.000 filas en USD, ~490 EUR mostradas como pesos; centinelas ≥1e14 (`6407-6409`, `6534-6535`) | Usar `cuantia_contrato`; filtrar moneda y centinelas | PARC. |
| SI-006 | MEDIUM | Contratista con valor 0 cuenta como adjudicado ("Valor adj.: —"); 575.299 filas con cuantía nula/0 (`6402-6419`) | Exigir valor > 0 y dedup por `uid` | VERIF. |
| SI-007 | LOW | "Adjudicado" = contratista real o valor>0, sin mirar estado; estado "Adjudicado" (22.216) no usado; regla defendible | Mostrar `estado_del_proceso` por fila | VERIF. |
| SI-008 | LOW | Filas SECOP I sin enlace, aunque existe `ruta_proceso_en_secop_i.url` (`6532-6536`) | Renderizar "Ver en SECOP I" | VERIF. |
| SI-009 | LOW | Texto de ayuda dice SECOP I es "histórico"; en 2025-2026 aún ingresan cientos de miles de filas (`1618`, `6542`); dataset actualizado a diario | Reformular ("2018 a hoy, diario") | VERIF. |
| SI-010 / TR-005 | MEDIUM | Lista combinada ordenada solo por valor, muestra 25 mientras la sugerencia usa todas; SECOP II sin `$order` y `$limit=400` (muestra arbitraria) (`6360`, `6395`, `6432-6434`, `6528`) | Orden por fecha; "mostrando 25 de N" | VERIF. |
| TR-004 | MEDIUM | Nombres distintos entre datasets: municipio de Cúcuta → SECOP I devuelve 0 por no cruzar el nombre, se lee como "sin historial" (`6329-6345`, `6531-6541`) | Cruzar por NIT o avisar "no se pudo cruzar por nombre" | VERIF. |
| TR-006 | MEDIUM | Ver SI-004 (fechas de referencia mezclan semánticas) | — | VERIF. |
| TR-009 | MEDIUM | "consultados justo ahora" da la hora de consulta, no la de actualización del dataset (`rowsUpdatedAt` SECOP I 10:08Z, SECOP II 18:04Z) | Mostrar `rowsUpdatedAt` por dataset | VERIF. |
| TR-010 | LOW | `normalize()` no lee `estado_del_proceso` de SECOP I; hoy no aplica (SECOP I no pasa por normalize) | Documentar antes de activar SECOP I en Buscar | VERIF. |
| TR-011 | LOW | Sin id de proceso se usa hash con objeto+fecha: si cambian, el análisis queda huérfano; la entrada no guarda entidad/referencia/fuente (`3427`, `9093`, `7570-7571`) | Guardar entidad+referencia+fuente y advertir si difieren | PARC. |
| TR-012 | MEDIUM | Digest: error de consulta = 0 nuevos sin aviso; un contrato en ambos sistemas se cuenta doble; sin fuente ni corte en el correo (`index.ts:307-320`, `216`, `230`) | Avisar "no pude revisar"; dedup | VERIF. |
| TR-013 | INFO | `evaluarAlerta` no cae a snapshot y marca error: buen diseño (pero usa la misma consulta de S2-001) | — | VERIF. |
| MC-012 | MEDIUM | Sin distinción habilitante/puntaje en texto libre ("Se otorgará puntaje adicional…" → obligatorio) | Detectar puntaje/ponderable y excluir del global | VERIF. |
| MC-013 | MEDIUM | El motor no calcula liquidez desde AC/PC; con AC 183 y PC 100 sin línea de índice → nd/REVISAR; con "Índice de liquidez: 1,83" → GO correcto (`2820`) | Calcular AC/PC y mostrar la fórmula | VERIF. |
| MC-015 | MEDIUM | `parseNumCO`: "1,234,567,890" → 1.234; "$1.500 millones" → 1500; "1.5 mil millones" → 1.5; "1.500" → 1500; "1,500.50" → 1.5005; "K residual 1,200,000,000" → 1.2 (`4953`, `4966`); RT-011: "Valor 800.000 (Ley 1150 de 2007)" → 2007 | Reconocer multiplicadores; ambigüedad → nd; descartar años de norma | VERIF. |
| MC-016 | MEDIUM | Duplicados y `minCantidad` siempre sumada (60+40 viviendas cumple 100 aunque no sea acumulable) (`4480-4520`) | Dedup; aplicar `acumulable` a cantidad | VERIF. |
| MC-017 | MEDIUM | Palabras de relleno ("cuyo", "igual", "superior", "cada", plural/singular) entran como distintivas → casi todo requisito bien redactado da NO DETERMINABLE (dirección segura, poca utilidad) | Stopwords legales y stemming | VERIF. |
| MC-018 | MEDIUM | Ventana temporal solo "últimos N años": ignora "60 meses" y fechas absolutas; se mide desde hoy, no desde el cierre; usa `fechaInicio` si no hay fin | Parsear meses/fechas; anclar al cierre | VERIF. |
| MC-019 | MEDIUM | Un contrato en ejecución (fin futuro) cuenta como experiencia acreditada | nd si `fechaFin > hoy` | VERIF. |
| MC-020 | MEDIUM | `gatePersonalRequerido` da ok si UNA palabra distintiva coincide; no compara años ni titulación (`5704`) | Todas las palabras + años | INFER. |
| MC-021 | LOW/MED | `detectarRedFlags` marca "por debajo del mínimo legal" sin mirar el valor del contrato (tramos >1.000.000 SMMLV); falso negativo de RC 200 SMMLV en contrato de $50.000M (`5042`); mínimos legales NO VERIFICADOS | Cruzar con el valor del proceso | VERIF./NO VERIF. |
| MC-022 | LOW | "No podrán participar consorcios…" (sin "se") no se detecta como prohibición (`5548`) | Ampliar patrón | INFER. |
| MC-023 | MEDIUM | Gates financieros sin fuente/página/cita; sin "qué tendría que cambiar" (margen) (`5793`) | Mostrar fuente y margen | VERIF. |
| MC-024 | LOW | Con `reglaSmmlv='otra'` el mensaje dice "falta la fecha de inicio" | Corregir texto | VERIF. |
| MC-025 | INFO | Cobertura de tests: ver QA-001; faltan minValor en pesos, conteo en letras, m/ml, participación, dedup, `extraerExigencias`, SCE, agregación GO/REVISAR | Agregar casos | VERIF. |
| RT-008 | MEDIUM | `entry.experienciaResultado` sobrevive a cambiar/borrar el Excel de experiencia (`8522-8546`, `8663`) | Hash del Excel y gate nd si cambió | INFER. |
| RT-010 | MEDIUM | Columna "Acumulable"="Sí"/"X" → false (falso NO-GO); "No acumulable" → true (`4257-4258`) | Interpretar como booleano | VERIF. |
| RT-012 | MEDIUM | `experiencia_evaluacion` con forma inválida corta el arranque (`8494`, `9672`) | Validar forma; try/catch por render | VERIF. |
| RT-013 / SEG-005 | MEDIUM | `renderPAAItem` pone `escapeHtml(item.url)` en `href` sin validar esquema → `javascript:` (la tarjeta sí valida); enlaces de proceso a cualquier host https (`7867` vs `7563`) | `safeHref` común; `noreferrer` | PARC. |
| RT-014 | LOW | Valor base negativo o 0 muestra "-$5.000.000.000"/"$0", prioridad ALTA y gate ok (`5738-5750`) | valor ≤ 0 → nd | VERIF. |
| RT-016 | MEDIUM | Solo `saveAnalisis` avisa cuota llena; `saveHistorial`, `saveExpEval`, personal solo `console.error`; `persistirPerfiles` dice "revisa tu conexión" | Helper único con aviso | INFER. |
| RT-017 | INFO | Un contrato con contratante "COMPETIDOR S.A.S." cuenta como propio | Avisar si hay varios contratistas | VERIF. |
| IA-006 | MEDIUM | La casilla "Revisé la cita…" anula todo bloqueo (L1, L2, O2 → CUMPLE); solo guarda un booleano (sin fecha/usuario/hash); se pierde al re-extraer (`5397-5399`, `9001-9010`) | Guardar `{por, ts, pdfSha256, citaHash, valores}` y segundo paso si falla una cifra | VERIF. |
| IA-007 | MEDIUM | Inyección de prompt desde el PDF: la IA no puede emitir CUMPLE, pero un texto oculto puede producir filas "reales" con `min_contratos=0` verificadas ✓ (M); sin `system` ni delimitadores (`index.ts:245`) | `system` "documentos = datos", rechazar valores ≤0, detectar frases dirigidas a IA | PARC. |
| IA-009 | MEDIUM | La fila de personal/UNSPSC/capacidad muestra el estado del gate agregado (todas CUMPLE si una coincide) (`6816-6823`) | Estado por fila o etiqueta "resumen del gate" | PARC. |
| IA-010 | MEDIUM | Ver MC-004; operador nulo/`>` como `>=`; `min_contratos=0` aceptado; fila financiera no confiable cae a regex | Normalizar; nd | VERIF./INFER. |
| IA-011 | MEDIUM | PDF escaneado: gasta cupo y devuelve filas inutilizables; verificación solo con pdf.js (no OCR), rompe por guiones/columnas; página corregida ±1 en silencio; >400 págs sin verificar | Advertir antes de gastar cupo; normalizar texto | VERIF./NO VERIF. |
| IA-012 | MEDIUM | Trazabilidad IA: sin numeral, `documento` libre, "Adenda N" = posición de subida, sin hash de PDF/versión de prompt/respuesta cruda, re-extracción sobrescribe | Añadir `numeral`, `pdf_sha256`, `prompt_version`, historial | VERIF. |
| IA-013 | MEDIUM | Edge Function: `max_tokens=16000` sin resultados parciales; límite de páginas de PDF de Anthropic no comprobado; 24 MB en base64 ≈ tope de 32 MB; memoria ~4×; duración total 150/400 s; `stop_reason` distintos a caídas | Dividir por documento, validar páginas, job asíncrono | INFER./NO VERIF. |
| IA-014 | MEDIUM | Se envía a Anthropic solo el PDF (sin datos de empresa); retención del proveedor y transferencia internacional sin verificar; nota informativa sin consentimiento registrado (`6886`) | Consentimiento explícito; documentar retención | VERIF./NO VERIF. |
| IA-015 | LOW | `path` repetible, `rol` de adendas sin validar, tope por empresa sin global (`index.ts:29-32,34-38`) | Dedup de paths, validar rol | VERIF. |
| IA-016 | INFO | Controles que funcionan: cita inventada, cifra ausente, unidad ausente, SMMLV sin regla, escaneado, confianza baja, operador contradictorio, JWT/company_id/prefijo/cupo/borrado de PDF. `regla_conversion_smmlv` y `acumulable` (que invierten el resultado) tampoco se cotejan con la cita | Cotejar con regex | VERIF. |
| DG-004 | MEDIUM | Cita legal errónea: Ley 190/1995 art. 78 trata la reserva del sumario, no un compromiso anticorrupción (solo en comentario y CLAUDE.md; el texto generado cita "Ley 190 de 1995, Ley 1474 de 2011" sin artículo); los topes de activos/ingresos del revisor fiscal se atribuyen al art. 203 C.Co. pero provienen del art. 13 par. 2 de la Ley 43/1990; Ley 789/2002 art. 50 y Ley 828/2003 **NO VERIFICADAS** contra el texto oficial (`6100-6102`, `6143`, `6151-6152`, `6168`) | Validar con abogado/contador y fechar la verificación | PARC. |
| DG-005 | MEDIUM | Plantillas asumen "sociedad" y "representante legal"; persona natural sale "PEREZ JUAN, sociedad identificada con NIT…"; sin consorcio/UT (`6066-6070`, `6117-6120`, `3079`) | Campo "tipo de proponente" o `[COMPLETAR]` | VERIF. |
| DG-006 | MEDIUM | RUT: `limpiarValorTextoRUT` recorta el último número de la dirección ("CALLE 1 # 2-3 APTO 4" → "…APTO") (`2989-2993`); solo con datos sintéticos | No recortar dígitos en dirección | VERIF. (RUT real NO VERIF.) |
| DG-007 | MEDIUM | `aplicarRUTaCampos` no compara el NIT del RUT con el del perfil (perfil híbrido: NIT de una empresa, nombre de otra) ni valida el DV (`3104-3130`) | Bloquear/confirmar si difiere; validar DV | VERIF. |
| DG-008 | MEDIUM | RUP: sin sección detectada, cualquier número de 8 dígitos (fechas 20260926, cédulas) se toma como UNSPSC; `capResidual` capta texto arbitrario (`2837-2852`) | No usar `permitirBare`; validar catálogo | VERIF. (RUP real NO VERIF.) |
| DG-009 | MEDIUM | PII (cédula, dirección, teléfono, correo) en `localStorage` en claro y en `app_state`; sin aviso específico (`1787-1792`, `1852-1862`) | Aviso/consentimiento, minimizar | PARC. |
| DG-010 | LOW | `generarFormatoExperienciaTexto` lanza TypeError con `experienciaResultado` parcial (`6222`, `6230`, `8353-8358`) | Valores por defecto y try/catch | VERIF. |
| DG-011 | LOW | Cédula `'0'` se imprime; sin validación de formato de NIT/cédula/correo/teléfono (`6066-6072`) | Validar y avisar campos pendientes | VERIF. |
| DG-012 | LOW | Fecha por documento con `new Date()`; `experienciaResultado` puede estar desactualizado (`6057`, `8762`, `8810`) | Una fecha por paquete; indicar Excel y fecha de evaluación | VERIF./INFER. |
| DG-013 | MEDIUM | El paquete es fijo (4 documentos); no lee la lista de documentos que exige el pliego (garantía de seriedad, RUP, RUT, certificado de existencia, propuesta económica, antecedentes…) ni avisa que falta cobertura (`6252-6272`) | Aviso en el índice; a futuro checklist del pliego | VERIF. |
| DG-014–016 | INFO | Disclaimers existen pero al final (ver DG-003); `informeEvalTexto`/`informeAnalisisTexto` solo por lectura (`undefined/undefined` posible sin `pagesRead/numPages`); CSV: `" =x"` (con espacio previo) no se neutraliza | Corregir | VERIF./INFER. |
| SEG-002 | MEDIUM | Tope de IA por `company_id` y cada usuario crea empresa gratis (con SEG-001, gasto no acotado); memoria pico ~24 MB + base64 | Límite de gasto en Anthropic, tope global, cupo por usuario/IP | PARC. |
| SEG-003 | MEDIUM | El correo interpola `a.nombre`/`emp.nombre` (texto libre) hacia correos no verificados: relay de spam/phishing; sin baja ni responsable (`daily-digest:314,321,335-345`) | Solo conteos, verificación de correo, baja | PARC. |
| SEG-004 | MEDIUM | `alertas_guardadas`/`empresas_seguidas` sin cota → fan-out contra Socrata y agotamiento del cron (`digest:156-160,174-178,306-322`) | Límites por empresa y de tiempo; CHECK de tamaño en `app_state` | INFER. |
| SEG-006 / OPS-010 | MEDIUM | SheetJS 0.18.5 (CVE-2023-30533, CVE-2024-22363; corregidos solo fuera de cdnjs); pdf.js 3.11.174 (CVE-2024-4367; mitigado por `isEvalSupported:false` en los 4 `getDocument`, el worker sin SRI); supabase-js flotante en las Edge Functions; CI con Node 20 (fin de vida) y acciones por tag | Alojar SheetJS ≥0.20.2, subir pdf.js, fijar versiones y SHA | VERIF. (versiones) / INFER. (CVE, sin consultar base de datos) |
| SEG-007 | LOW | CSP con `script-src 'unsafe-inline'` (por diseño, JS inline); CSP por `<meta>` no aplica `frame-ancestors`; JWT en `localStorage`; Tesseract sin `langPath` (descarga de idioma de un tercero no incluido en `connect-src`, OCR bajo CSP NO VERIFICADO) (`22`, `3553`) | Hash de script/archivo externo, alojar datos de idioma | VERIF. |
| SEG-008 | LOW | Sin cuotas de Storage ni tamaño en `app_state`; PDFs huérfanos si no se invoca la función | Barrido programado y CHECK | INFER. |
| SEG-009 | LOW | CORS `*`; `DEBUG_SECRET` sin tiempo constante; mensaje de crédito insuficiente visible a cualquier usuario; `d.path.includes('..')` no cubre `%2e%2e` | CORS restringido, regex de ruta estricta | VERIF./INFER. |
| SEG-010 | INFO | `handle_new_user` con `search_path=public` (recomendado `''`); `schema.sql` duplica `ai_usage`; workflow sin `permissions:`; el zip de la landing sin versionar | Endurecer | VERIF. |
| PRIV-003 | MEDIUM | Transferencia internacional y encargados (Supabase-región no verificada, Anthropic, Resend, Google Fonts por IP) sin informar | Política con proveedor/país/finalidad; consentimiento previo a IA | PARC. |
| PRIV-004 | MEDIUM | Inventario sin retención definida: perfil (NIT, cédula del representante), **datos de terceros** (perfiles profesionales: nombre, formación, experiencia), texto completo de pliegos, historial; `ai_usage` sin caducidad | Política de retención, advertencia en Personal, purga | VERIF. (código) |
| PRIV-005 | LOW | Fuentes de Google envían la IP; sin aviso de almacenamiento local | Alojar fuentes propias | VERIF. |
| PRIV-006 | LOW | Correo diario sin baja ni identificación; remitente de pruebas; `detalles` devuelve correos (`digest:241,335-345,350`) | Baja, dominio verificado | VERIF. |
| UX-006 | MEDIUM | Contraste bajo WCAG AA medido: `.stat-card-note` 2,62:1; texto sobre fondo gris 2,32:1; números de "Primeros pasos" 3,96:1; subtítulo 4,14:1 (solo vista Inicio) | Oscurecer `--ink-faint`, `--ink-mute` y el naranja | VERIF. |
| UX-007 | MEDIUM | Sin `<main>`, sin salto al contenido, 7 `<h1>`, `#bt-results` y estados de carga sin `aria-live` (17 usos de role/aria en total); Tab real NO VERIFICADO | Semántica y `role="status"` | VERIF. (estático) |
| UX-008 | MEDIUM | IA/verificación/OCR sin progreso significativo ni cancelar; sin timeout en el cliente (`8836-8880`) | Progreso, `AbortController`, "Reintentar" | VERIF. |
| UX-009 | MEDIUM | Ante cualquier error (hasta ~24 s de espera) se muestra el snapshot; para otro departamento/tipo el resultado es un vacío genérico en vez de "sin conexión" | Mensaje específico; aviso a los 5 s | VERIF. |
| UX-010 | LOW | Falta aviso previo a subir datos sensibles de que sin cuenta todo vive en el navegador (~5 MB) | Aviso de onboarding | PARC. |
| UX-011 | LOW | Tabla de requisitos en móvil/tablet no renderizada (requiere pliego real) | Probar a 375/768 px | NO VERIF. |
| PERF-001 | MEDIUM | `supabase.min.js` (56 KB) y fuentes se cargan siempre, incluso sin cuenta | Carga bajo demanda | VERIF. |
| PERF-002 | INFO | `index.html` 586.992 bytes, 9.704 líneas; DCL 437 ms/load 814 ms (una medición local); 3 consultas Socrata al abrir el Dashboard | — | VERIF. |
| PERF-003 | MEDIUM | Normalizar/puntuar todos los registros y `JSON.stringify` para dedup en cada cambio de filtro | Medir con 1.500 registros | PARC. |
| PERF-004 | MEDIUM | `extractPdfText(file,400)` en hilo principal, secuencial, hasta 6 documentos, sin ceder ni progreso | Ceder el hilo, `page.cleanup()` | INFER. |
| PERF-006 | LOW | OCR: canvas escala 2.0 sin liberar; 4 renders de rotación; descarga WASM+idioma (~10–15 MB en frío, inferido) | Liberar, avisar del peso | INFER. |
| ESC-004 | MEDIUM | Free de Supabase (500 MB DB, 1 GB Storage, pausa por inactividad; cifras a confirmar): `analisis_pliegos` con textos completos y `upsert` del blob completo | No sincronizar `text`; tabla por análisis | INFER. |
| REL-002 | MEDIUM | Sin service worker ni detección offline | Aviso "sin conexión" | VERIF. |
| REL-003 | INFO | Bien resueltos: timeouts 12–15 s con fallback y banner, SRI en 5 librerías, mensaje de PDF con contraseña, aviso de almacenamiento lleno, latido de stream, reserva de cupo, digest fail-closed. `withTimeout` no cancela el `fetch` (LOW) | — | VERIF. |
| OPS-002 | MEDIUM | Sin runbook de rollback ni tags de release | Runbook y ensayo <10 min | INFER. |
| OPS-004 | MEDIUM | `schema.sql` no idempotente (6 `create policy` sin `drop`), no incluye el bucket `pliegos`, migraciones con 8 dígitos (no 14) aplicadas a mano; estado real del proyecto NO VERIFICADO | `db dump`/`db push`, documentar orden | VERIF. (repo) |
| OPS-005 | LOW | Constantes públicas por diseño (anon key, token Socrata); lista de secrets sin procedimiento de rotación | Checklist de secrets | VERIF. |
| OPS-006 | MEDIUM | `cron.sql`: secreto en texto plano en `cron.job.command` al pegarlo; sin reintento ni alerta; estado real del cron NO VERIFICADO | Supabase Vault; `net._http_response`; heartbeat | VERIF. (archivo) |
| OPS-009 | MEDIUM | Sin plan de respuesta a incidentes ni kill switch (solo borrar el secret o `cron.unschedule`) | Runbook probado | INFER. |
| OPS-011 | LOW | El digest nunca actualiza `ultimaRevision`: repite los mismos "nuevos" cada día si el usuario no abre la app (`176-194`, `305-355`) | `ultimoDigest` por empresa | INFER. |
| QA-002 | MEDIUM | Matriz QA con celdas sin prueba: búsqueda en vivo (feliz/vacío/inválido/caída), sync Supabase, digest, RUP/RUT, generadores, migración/restauración, Edge Functions (429, max_tokens, 26 MB) | Fetch simulado y prueba de contrato | PARC. |
| QA-003 | LOW | El smoke descarga 5 CDN reales: falsos rojos por red cuando pase a ser gate | Job de red separado con reintentos | VERIF. |
| ARQ-001 | MEDIUM | Monolito de 587 KB / 9.704 líneas (tests extraen código con regex); `CLAUDE.md` de 324 KB | Módulos ES nativos; dividir la documentación | VERIF. |
| ARQ-004 | MEDIUM | Lógica duplicada entre `index.html` y `daily-digest` (`findField`, `matchesTerm`, `matchesGeo`, `fetchAllForDataset`…) sin prueba de paridad: el correo puede decir "3 nuevos" y la app otro número (`digest:141-236`) | Fuente única o prueba de paridad | VERIF. (duplicación) |
| ARQ-005 | LOW | `localBackend.set` sin `try/catch` (`1707`) | Capturar y avisar | PARC. |

---

## 7. Hoja de ruta de correcciones sugerida

**Ola 0 — antes de cualquier beta (ver RELEASE-BLOCKERS.md):** S2-001, S2-002, S2-003; TR-001, TR-003; MC-001…MC-004, MC-005…MC-011, MC-014; RT-001…RT-007, RT-009; IA-001…IA-005, IA-008 (o desactivar la IA por defecto); DG-001…DG-003; SEG-001; PRIV-001, PRIV-002 (mínimo: política + consentimiento + borrado manual); UX-004.
**Ola 1 — antes del lanzamiento general:** SI-001, SI-002, TR-002, TR-007, TR-008, UX-001…UX-005, PERF-005, OPS-001, OPS-007, OPS-008, QA-001, ARQ-002, ARQ-003, ESC-001…ESC-003, REL-001, SEG-002…SEG-006.
**Ola 2 — endurecimiento:** el resto de la tabla.

Principio para el equipo: **cada corrección de la Ola 0 debe llegar con su caso de prueba** (entrada → salida esperada, de este informe) en `tests/smoke.mjs`, verificado por mutación, y luego repetir esta auditoría antes de cerrar hallazgos.

## 8. Lo que NO se pudo verificar (consolidado)

1. **Claude con un pliego real** (recall, precisión, tasa de "sin verificar", adendas, inyección, duración, tokens y costo, acepta `output_config`/`effort`, límite de páginas de PDF) — requiere crédito.
2. **Supabase real:** autorización entre dos cuentas autenticadas, contraseña mínima, límites de tasa de Auth, Redirect URLs, región, plan/backups/PITR, estado del cron y de las funciones desplegadas, secretos configurados.
3. **RUP y RUT reales** de Confecámaras/DIAN (solo texto sintético en esta auditoría; el RUT real del propietario se probó en sesiones anteriores).
4. **Cifras legales:** SMMLV 2015-2026, mínimos de garantías del Decreto 1082/2015, fórmula de SCE, Ley 789/2002 art. 50, Ley 828/2003 — sin contraste con texto oficial en esta auditoría.
5. **Navegador:** Safari/WebKit real, lector de pantalla, navegación completa por teclado, modo oscuro, tabla de requisitos en móvil, clic real en el `javascript:` del PAA, escenarios multi-pestaña y cuota llena.
6. **Límites de plataforma** (Socrata, Supabase Free, Resend, memoria/tiempo de Edge Functions), CDN caídos, `datos.gov.co` caído o con 429.
7. Tasa global de duplicados en SECOP I, cobertura SECOP I con `$offset` grande, doble conteo real del mismo contrato entre SECOP I y II (0 coincidencias en las muestras, sin clave compartida verificable).
8. Conclusiones jurídicas (Ley 1581, declaraciones bajo juramento, comunicaciones comerciales): **requieren revisión profesional**.
