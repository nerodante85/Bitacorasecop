# RELEASE-BLOCKERS — Bitácora SECOP

Fecha: 2026-09-26 · Estado de la aplicación: **BLOQUEADO** · Detalle de cada ID en `AUDIT-REPORT.md`.

## Registro de correcciones (se actualiza al cerrar cada bloqueador)

| ID | Fecha | Estado | Evidencia |
|---|---|---|---|
| S2-001 | 2026-09-26 | **CORREGIDO, verificado en datos reales** (pendiente: re-auditoría formal y despliegue de `daily-digest`) | La app pide dos consultas por palabra (procesos con cierre de ofertas hoy o después + los 300 publicados más recientes con fecha no nula). Comparado contra el servidor: acueducto 38/38, alcantarillado 35/35, interventoria 56/56, colegio 9/9 abiertos (antes 0 en las cuatro). 5 pruebas nuevas en `tests/smoke.mjs` (98/98) con un servidor de juguete que reproduce "NULL primero en DESC"; verificadas por mutación (quitar el filtro de cierre futuro rompe 2 pruebas; quitar la exclusión de NULL rompe 1). |
| S2-002 | 2026-09-26 | **CORREGIDO, verificado** | El término se envía sin tildes: "pavimentación" y "pavimentacion" envían el mismo `$q` y traen los mismos resultados. Prueba automática incluida. |

| S2-003 | 2026-09-26 | **CORREGIDO, verificado** (pendiente: re-auditoría formal y despliegue de `daily-digest`) | Por defecto solo se muestran los estados que siguen siendo una oportunidad; Cancelado, Borrador, Seleccionado, Suspendido, Aprobado, En aprobación y Evaluación (y los de cierre de SECOP I) quedan desmarcados, con un aviso "N proceso(s) oculto(s) por no estar abiertos" y la posibilidad de marcarlos. Un estado vacío o desconocido no se oculta. Las alertas y el correo diario ya no cuentan como "nuevos" los procesos no vigentes. Comprobado en datos reales ("acueducto": 90 ocultos por defecto; al marcar Seleccionado y Evaluación bajan a 5). 4 pruebas nuevas (102/102), verificadas por mutación. |

| MC-001 | 2026-09-26 | **CORREGIDO, verificado** | Un mínimo en pesos en texto libre ($, "millones", COP/pesos, "valor mínimo N") ya se extrae y compara; varias cifras distintas o ilegibles dan NO DETERMINABLE. Requisito de $500M con contrato de $1M: NO CUMPLE (antes CUMPLE) en las 4 redacciones probadas. |
| MC-002 | 2026-09-26 | **CORREGIDO, verificado** | El mínimo de contratos se lee en letras, con "al menos", "acreditar N", "N (letras)" y "N como mínimo"; un tope ("máximo cinco (5)") no se toma como mínimo; conteos distintos son ambiguos (NO DETERMINABLE). Con 1 contrato, los 5 casos reportados dan NO CUMPLE. |
| MC-003 | 2026-09-26 | **CORREGIDO, verificado** | La ventana "últimos N años" se aplica antes de contar contratos, sumar valor y cantidad. Los contratos sin fecha confiable no se cuentan; si por eso saldría NO CUMPLE, queda NO DETERMINABLE. Los dos casos reportados (valor de 2015 + contrato de 2025; 2 contratos con uno de 2015) dan NO CUMPLE. |
| MC-004 | 2026-09-26 | **CORREGIDO en lo reportado; MC-005/006/007 siguen abiertos** | Los índices se normalizan a razón (60% = 0,6) en el pliego, en la IA y en el perfil; un endeudamiento sin "%" mayor que 5 es ambiguo y queda "requiere verificación". Endeudamiento ≤60% con perfil 0,75: FAIL (antes GO). No se tocó la lectura de umbrales desde fechas/años/normas (MC-005), ni K residual relativo (MC-006), ni años en el perfil (MC-007). |
| RT-001 | 2026-09-26 | **CORREGIDO, verificado** | Valores negativos ("-1.500.000.000", "(1.500.000.000)", "K residual = -1.200.000.000") ya no se vuelven positivos: se leen como sin dato (NO DETERMINABLE). "quince mil (15.000) SMMLV" y guiones entre números siguen funcionando. |
| RT-002 | 2026-09-26 | **CORREGIDO, verificado** (también en navegador) | Se omiten las filas de TOTAL/SUBTOTAL y los contratos repetidos (mismo N° de contrato, contratante, valor y fechas), también entre hojas, y se avisa al usuario cuántos. Dos contratos distintos siguen sumándose. |
| RT-003 | 2026-09-26 | **PARCIAL** (solo en requisitos con ventana temporal) | Fechas invertidas, futuras, anteriores a 1990 o inexistentes ya no acreditan la ventana (NO DETERMINABLE). Sigue abierto el caso general: un contrato en ejecución cuenta como experiencia en requisitos sin ventana (MC-019). |

| IA-001 | 2026-09-26 | **CORREGIDO, verificado** | La coincidencia aproximada exige que cada cifra aparezca en la página como corrida contigua ("15.000.000" ya no pasa por "15.000") y pegada a sus palabras vecinas ("2 contratos", no un "2" suelto de "plazo 2 meses"); además cada cifra debe estar junto a la palabra que la describe (contratos, valor, años…), lo que detecta campos intercambiados. Los 3 casos reportados dejan de verificarse; las filas correctas y las tablas reordenadas legítimas siguen verificándose. |
| IA-002 | 2026-09-26 | **CORREGIDO, verificado** | La unidad debe ser coherente con la cita: "15.000 SMMLV" declarado como COP no se verifica; SMMLV declarado sin SMMLV en la cita tampoco; "$1.200 millones" como 1200 no se verifica y como 1.200.000.000 sí. |
| IA-003 | 2026-09-26 | **CORREGIDO, verificado** (requiere redesplegar `extraer-requisitos`) | Los contratos que aplican se deciden con `objeto_literal` (fragmento que la IA debe copiar de la cita), no con su paráfrasis. Sin objeto literal verificable la fila queda "sin verificar" hasta que el usuario la confirme. Una descripción diluida ("obras civiles") con objeto "puentes vehiculares" ya no da CUMPLE con contratos de andenes. |
| IA-004 | 2026-09-26 | **CORREGIDO, verificado** (también en pantalla) | Dos filas del mismo indicador o requisito con valores distintos (pliego vs adenda) quedan en CONFLICTO, en cualquier orden: el gate pasa a "requiere verificación" en vez de elegir la primera, y el usuario resuelve confirmando la vigente. |
| IA-005 | 2026-09-26 | **CORREGIDO, verificado** (requiere redesplegar `extraer-requisitos`) | Nuevo campo `naturaleza`: solo lo "habilitante" decide (un criterio de puntaje o una obligación contractual ya no da NO CUMPLE global). La obligatoriedad se coteja con la cita: una fila "opcional" sin marcador en la cita, o "obligatoria" con lenguaje de puntaje, queda bloqueada hasta confirmarla. |
| IA-007 | 2026-09-26 | **PARCIAL** | Un mínimo ≤ 0 ya no se verifica y la función envía una instrucción de sistema que trata los documentos como datos. Sigue abierto detectar frases dirigidas a la IA dentro del PDF y medir el comportamiento del modelo real (NO VERIFICADO sin crédito). |
| IA-006 | 2026-09-26 | **PARCIAL** | La confirmación del usuario ahora guarda la fecha y hora. Sigue abierto guardar el hash del PDF y de la cita, mostrar cita y campos lado a lado, y conservar el historial al re-extraer. |

| MC-005 | 2026-09-26 | **CORREGIDO, verificado** | El umbral de un índice ya no es "el primer número tras la etiqueta": se descartan fechas (numéricas, con mes escrito o abreviado), años sueltos y referencias a normas/anexos/numerales; "no será exigido / no se exigirá / no aplica" no produce umbral; ante varias cifras sin operador que desempate no se elige una (requiere verificación). "Liquidez con corte a 31 de diciembre de 2023… 1,5" → 1,5 (antes 31); "…establecidos en el Decreto 1082 de 2015" → sin umbral (antes 1082). |
| MC-006 | 2026-09-26 | **CORREGIDO, verificado** (también en pantalla) | La K residual relativa ("1,5 veces el presupuesto oficial", "100% del presupuesto oficial de $3.200M") se convierte con el presupuesto (el que cita el pliego o el del proceso); un porcentaje sin base clara, la negación y las referencias a normas no dan cifra. Con K residual $5.000M vs 1,5 × $1.850M: cumple; con $2.000M: no cumple (NO-GO). |
| MC-007 | 2026-09-26 | **CORREGIDO, verificado** (también en pantalla) | Los indicadores del perfil se leen por etiqueta y solo hasta el siguiente indicador/salto de línea: "Liquidez a 31/12/2024: 0,8" → 0,8 (antes 31), "Endeudamiento a 31 dic 2024: 45%" → 0,45, "Liquidez N/A; Endeudamiento 0.6" no cruza indicadores, dos valores distintos del mismo indicador son ambiguos, y el patrimonio no toma la "Rentabilidad del patrimonio". |
| RT-004 | 2026-09-26 | **CORREGIDO** (pruebas + mutación; sin verificar en pantalla) | El gate "Capacidad vs valor" ya no desaparece sin K residual: siempre existe (`gateCapacidadVsValor`) y sin dato o en SMMLV es "requiere verificación". Sin K residual y con todo lo demás en verde el veredicto es REVISAR, nunca GO. |
| RT-007 | 2026-09-26 | **CORREGIDO** (pruebas + mutación; sin verificar en pantalla) | Un pliego leído en parte (ej. 15 de 76 páginas) agrega el gate "Lectura del pliego" en "revisar" (`gateLecturaParcial`) y el veredicto pasa a REVISAR; la regla vive en `decidirVeredicto` (fail → NO-GO; revisar/nd/sin pliego → REVISAR; solo todo verde con pliego → GO). |
| MC-014 | 2026-09-26 | **CORREGIDO** (pruebas + mutación; sin verificar en pantalla) | Los contratos en ejecución sin saldo o fecha válida ya no se ignoran en silencio: `calcularSCE` los cuenta (`incompletos`), la UI avisa, y tanto "Capacidad vs valor" como "Capacidad K residual" pasan de ok a "revisar" mientras existan. Un fail demostrado no se toca. |
| RT-014 | 2026-09-26 | **CORREGIDO** | Un valor base ≤ 0 ya no sale "ok" en "Valor de la obra": es "requiere verificación". |

| MC-008 | 2026-09-26 | **CORREGIDO** (pruebas + mutación; sin verificar en pantalla) | Se compara la actividad del contrato con la del requisito: "construcción de acueducto" ya no acepta estudios/diseños, interventoría, suministro ni mantenimiento; "mantenimiento" no acepta "construcción"; un contrato con caducidad/terminación anticipada por incumplimiento no acredita. Todos → NO DETERMINABLE con el motivo. Un contrato sin verbo de actividad no se penaliza. |
| MC-009 | 2026-09-26 | **CORREGIDO** | Las condiciones dimensionales reconocen también m, mts, ml, m.l. y cm: "luz mínima de 40 m" ya no da CUMPLE automático. |
| MC-010 | 2026-09-26 | **CORREGIDO** | El valor del contrato se pondera por el % de participación (contrato $900M al 30% = $270M vs mínimo $500M → NO CUMPLE); si la columna leída ya es la "ajustada por participación" no se pondera dos veces. |
| MC-011 | 2026-09-26 | **CORREGIDO** | "No es opcional" / "no puede ser opcional" → obligatorio; "cualquiera de los socios del consorcio" ya no es alternativo; un opcional/alternativo suelto con NO CUMPLE impide un CUMPLE global (pasa a REQUIERE REVISIÓN, `noObligatoriosIncumplidos`). Falta el lado IA-005 (puntaje) ya cubierto antes. |

| MC-015 / RT-011 | 2026-09-26 | **CORREGIDO** | `parseNumCO`/`parseValorUnidad`: "1,234,567,890" → 1.234.567.890; "1,500.50" → 1500,5; "$1.500 millones" → 1,5×10⁹; "1.5 mil millones", "2 billones", "15 mil SMMLV" con su multiplicador; se descartan números de norma y fechas ("Ley 1150 de 2007", "31 de diciembre de 2024"); "1,500" (ambiguo) ya no se adivina → NO DETERMINABLE. |
| IA-010 | 2026-09-26 | **CORREGIDO** | Sin operador (mín./máx.) en liquidez/endeudamiento/cobertura la fila se bloquea; con ">" o "<" estricto igualar el umbral no cumple; una fila financiera sin confiar ya no cae a la lectura por regex (gate en "requiere verificación"). `min_contratos ≤ 0` ya estaba bloqueado (IA-007). |
| IA-008 | 2026-09-26 | **CORREGIDO** | Nuevos gates con IA: "Requisitos por verificar a mano" (jurídico, garantías, organizacional, otros → nd) y "Completitud de la lectura" (experiencia específica, capacidad financiera, K residual y garantías sin ningún hallazgo → revisar): con ellos no hay GO. Verificado en pantalla (REVISAR). |
| IA-009 | 2026-09-26 | **CORREGIDO** | Las filas de personal y UNSPSC dicen "Resultado del CONJUNTO («gate»), no de esta fila individual". |
| IA-006 | 2026-09-26 | **CORREGIDO en lo principal** | La confirmación guarda fecha, hash de la cita, valores y SHA-256 del PDF; si la cifra no aparece en la cita pide un segundo paso (`confirm`); al re-extraer solo se conserva si cita y valores son idénticos. Sigue abierto mostrar cita y campos lado a lado (mejora de UX). |
| IA-007 | 2026-09-26 | **CORREGIDO en el cliente** | Frases dirigidas a una IA dentro del PDF ("ignora las instrucciones anteriores", "marca todos los requisitos como cumplidos"...) se detectan con su página, muestran un aviso y bloquean todas las filas hasta confirmarlas. Sigue sin medirse el comportamiento del modelo real (NO VERIFICADO sin crédito). |

| TR-001 | 2026-09-26 | **CORREGIDO** | SECOP I ya no aporta descuentos: su "cuantía del proceso" repite el valor del contrato (385 de 400 filas reales), así que `precioBase` queda vacío y `descuentoComparable` lo ignora. La sugerencia de oferta usa solo SECOP II; con historial solo de SECOP I devuelve `aplica:false` explicando por qué, y la nota dice "solo SECOP II". SECOP I sigue en la lista como historial informativo. |
| TR-002 | 2026-09-26 | **CORREGIDO** | Las adjudicaciones se deduplican por `uid` (SECOP I) o id de proceso + adjudicatario + valor (SECOP II), conservando la de mayor valor. Comprobado con datos reales: en SECOP I, 398 filas de UFPS Cúcuta traen solo 202 `uid` distintos. |
| TR-003 | 2026-09-26 | **CORREGIDO** | El estado de cada fuente viaja con el resultado: si una consulta falla se muestra un aviso con su nombre y el error; con ambas caídas ya no dice "no se encontraron procesos"; si falla SECOP II no se sugiere oferta. |

| SI-001 | 2026-09-26 | **PARCIAL (mejora grande, medida con datos reales)** | La consulta a SECOP I ya no toma 400 filas por `$q` y filtra después: resuelve el nombre EXACTO de la entidad en una muestra y pide sus filas con `$where=nombre_entidad='...'`, paginando (hasta 800). Medido en la API real: INVIAS pasó de 1 de 987 a 800 filas en 1,9 s; Gobernación de Norte de Santander a 800 filas de la entidad correcta (antes se colaba "SANTANDER - GOBERNACIÓN", ahora hay coincidencia estricta). **Sigue abierto:** la Alcaldía de Medellín no se identifica (su nombre en SECOP I no aparece en la muestra de filas recientes); en ese caso la pantalla lo dice ("no se pudo identificar a esta entidad en SECOP I") en vez de mostrar 0 como si no hubiera historial. Falta un índice de nombres de entidad para resolver esos casos, y la muestra `$q` puede tardar 10-30 s en SECOP I. |
| SI-002 | 2026-09-26 | **CORREGIDO** | Timeout de 30 s (antes 15 s) con un reintento; un fallo o timeout ya no es silencioso: se avisa por fuente (TR-003) y, si la entidad no se resuelve, se explica. |

| TR-008 | 2026-09-26 | **CORREGIDO** | La app registra si los datos son en vivo, snapshot o demo; el informe de evaluación, el resumen copiable, el CSV y los textos de carta/paquete lo declaran; en modo demo la carta y el paquete quedan bloqueados (un aviso lo explica). |
| TR-007 | 2026-09-26 | **CORREGIDO en la app y el correo diario** | Pie estándar "Fuente: datos.gov.co, datasets … — consultado <fecha> — modo …" en el informe de evaluación (.txt y pantalla), resumen copiable, carta y paquete (nota interna a borrar), y columnas Fuente/Consultado/Modo en el CSV; el correo diario lo incluye (requiere volver a desplegar `daily-digest`). Sin cambio en PAA y alertas dentro de la pantalla (siguen mostrando su etiqueta de fuente). |
| UX-001 | 2026-09-26 | **CORREGIDO, verificado en pantalla** | "Mostrando 40 de 240 procesos", contadores sobre el total filtrado, botón "Mostrar 40 más"; CSV y resumen usan todos los procesos de alta prioridad, no solo los dibujados. |
| UX-002 | 2026-09-26 | **CORREGIDO, verificado en pantalla** | El estado vacío lista cuánto quitó cada filtro (877 consultados: palabras clave −261, departamento −616) con "quitar este filtro". |
| UX-003 | 2026-09-26 | **CORREGIDO** | El sello dice "Cumple lo revisado / Falta información / No cumple" y cada tarjeta muestra una línea visible con el motivo (gate que falla o lo que falta confirmar). |
| UX-004 | 2026-09-26 | **CORREGIDO** | Cada tarjeta evaluada muestra "Leído: X/N págs" (o "Pliego sin analizar") y "Orientativo. Confirma con el pliego oficial."; el texto de GO ya no dice "SÍ vale la pena participar". |
| UX-005 | 2026-09-26 | **CORREGIDO, verificado** | De 36 controles sin nombre accesible se pasó a 0 (etiquetado automático al cargar y al redibujar, más `autocomplete` en contacto). |

| DG-001 | 2026-09-27 | **CORREGIDO** | El anexo de experiencia solo dice "Contratos que lo acreditan" en requisitos que CUMPLEN (con número de contrato y fechas); en los demás pide `[COMPLETAR]`. |
| DG-002 | 2026-09-27 | **CORREGIDO** | El cuerpo firmable ya no incluye la autoevaluación ni textos de la interfaz: eso va en un bloque "NOTAS INTERNAS -- borra desde aquí" al final, y con un global distinto de CUMPLE hay un aviso interno al inicio. |
| DG-003 | 2026-09-27 | **CORREGIDO en la aplicación; REQUIERE REVISIÓN LEGAL** | Las 7 declaraciones fácticas (inhabilidades, veracidad, juramento, sanciones, aportes pagados, sin sumas pendientes) llevan la marca `[CONFIRMAR]`, cada documento (y el paquete, una sola vez) abre con "ANTES DE FIRMAR" listándolas, y al descargar carta o paquete se pide confirmación. Los textos de las declaraciones mismas deben revisarlos un abogado. |
| SEG-001 | 2026-09-27 | **PARCIAL -- falta un paso tuyo en el panel de Supabase** | En el código: contraseña mínima 8. **El proyecto real sigue con `mailer_autoconfirm: true` (medido hoy con `/auth/v1/settings`)**: hay que activar "Confirm email" en Authentication > Sign In / Providers > Email, subir la longitud mínima a 8 y valorar CAPTCHA (el paso a paso está en `supabase/config.toml`). No lo cambié yo: es la configuración de tu cuenta de Supabase. |
| PRIV-001 | 2026-09-27 | **PARCIAL -- falta el texto jurídico** | El registro exige aceptar la política y guarda versión y fecha en el perfil de la cuenta (`consent_privacidad`); hay una página `privacidad.html` como BORRADOR con los datos, finalidades, terceros (Supabase, Anthropic, Resend), derechos y conservación. Los campos `[COMPLETAR]` (responsable, contacto, transferencia internacional, plazos) y la revisión de un abogado siguen pendientes; mientras tanto es un borrador público. |
| PRIV-002 | 2026-09-27 | **CORREGIDO en el código; NO VERIFICADO hasta desplegar** | Botones "Descargar mis datos (.json)" y "Eliminar mi cuenta y mis datos" (pide escribir ELIMINAR); nueva Edge Function `eliminar-cuenta` que borra Storage, la empresa (con cascada a `company_members`, `app_state`, `ai_usage`) y por último el usuario de Auth. Requiere `npx supabase functions deploy eliminar-cuenta` y probarla con una cuenta desechable. |

| REL-001 | 2026-09-27 | **CORREGIDO** | Los 5 cargadores de librerías (cuenta, PDF, OCR, Excel, Word) limpian su promesa y quitan el script al fallar: tras un corte breve, el siguiente intento vuelve a pedir la librería sin recargar la página. |
| OPS-008 | 2026-09-27 | **CORREGIDO, verificado en pantalla** | Panel "Respaldo de tus datos" en Inicio: descargar un `.json` y restaurarlo (valida formato, versión y claves permitidas antes de tocar nada, y pide confirmación). Ida y vuelta comprobada. Sigue abierto confirmar el plan y los backups de Supabase y ensayar una restauración de la base. |
| ARQ-002 | 2026-09-27 | **CORREGIDO, verificado en pantalla** | Los datos llevan `schema_version` (1); si los guardó una versión más nueva, esta app avisa y NO escribe, para no pisarlos. Aún no hay migraciones porque 1 es el formato actual. |
| PERF-005 | 2026-09-27 | **PARCIAL** | Si el almacenamiento del navegador se llena, se libera el texto completo de los pliegos más antiguos (se conservan sus resultados) y se reintenta; un aviso lo explica y esos análisis piden volver a cargar el PDF para reevaluarlos. No se migró a IndexedDB ni a una clave por análisis. |
| ARQ-003 | 2026-09-27 | **PARCIAL** | Un fallo de sincronización con la cuenta ahora se avisa en pantalla (antes solo en consola). Sigue la regla "gana la última escritura" por clave completa: dos dispositivos editando a la vez pueden pisarse; requiere versionado por elemento. |
| SEG-005 | 2026-09-27 | **CORREGIDO** | El enlace del PAA solo se usa si es http(s) (`safeHref`) y lleva `noreferrer`. |
| SEG-003 / SEG-004 | 2026-09-27 | **CORREGIDO en el código; requiere redesplegar `daily-digest`** | Los nombres de alertas y empresas se sanean (sin saltos de línea ni enlaces, máx. 60 caracteres) antes de ir en un correo; máximo 10 alertas y 10 empresas seguidas por empresa. Sigue abierto: verificación del correo del destinatario (SEG-001) y enlace de baja. |
| ESC-001 / OPS-007 | 2026-09-27 | **PARCIAL; requiere redesplegar `daily-digest`** | El digest no empieza empresas nuevas pasados 100 s, informa cuántas quedaron pendientes y responde HTTP 500 si hubo errores (antes siempre 200); los correos de destinatarios solo salen en modo debug. Falta un monitor externo que avise, colas por lotes y un dominio verificado en Resend. |
| SEG-006 | 2026-09-27 | **PARCIAL** | El CI usa Node 22 (Node 20 está fuera de soporte). Siguen abiertos SheetJS 0.18.5, pdf.js 3.11, versiones flotantes en las Edge Functions y las acciones de CI por SHA. |
| OPS-001 | 2026-09-27 | **ABIERTO -- requiere un cambio tuyo** | Pages publica en cuanto llega el push, sin esperar a las pruebas. Para que el CI bloquee hay que cambiar en GitHub la fuente de Pages a "GitHub Actions" y añadir un workflow de despliegue con `needs: smoke`. |
| ESC-002, ESC-003, OPS-003, QA-001 | 2026-09-27 | **ABIERTOS** | Caché/token separado de Socrata, tope global y caché de IA por hash de PDF, despliegue automático de funciones con versión de contrato, y ampliar la cobertura de pruebas (`evaluarProceso`, `parsearRUP/RUT`, etc.). ESC-003 conviene decidirlo con la primera prueba real de la IA. |

Verificación de esta ronda: 188/188 pruebas (7 nuevas) y 9 mutaciones detectadas; respaldo (descargar y restaurar) y bloqueo por esquema más nuevo comprobados en pantalla; el bloque de almacenamiento lleno (PERF-005) y los cambios de `daily-digest` no se pudieron probar de extremo a extremo.

Verificación de DG-001..003, SEG-001, PRIV-001/002: 181/181 pruebas (5 nuevas) y 10 mutaciones detectadas; el modal de registro verificado en pantalla (consentimiento y contraseña mínima); la función `eliminar-cuenta` no se pudo ejecutar (sin Deno).

Verificación de TR-007/008 y UX-001..005: 176/176 pruebas (4 nuevas) y 5 mutaciones detectadas; UX-001, 002 y 005 comprobados en pantalla con datos reales.

Verificación de SI-001/002: 172/172 pruebas (5 nuevas) y 5 mutaciones detectadas; consultas reales a SECOP I con tres entidades.

Verificación de TR-001..003: 167/167 pruebas (5 nuevas) y 4 mutaciones detectadas; `uid` y duplicados confirmados contra la API real de SECOP I.

Verificación de MC-015 e IA-006..010: 162/162 pruebas (5 nuevas) y 13 mutaciones detectadas.

Verificación de MC-008..011: 157/157 pruebas (7 nuevas) y 10 mutaciones detectadas.

Verificación de MC-005/006/007: 142/142 pruebas (8 nuevas) y 8 mutaciones detectadas. Verificación de RT-004/RT-007/MC-014: 150/150 pruebas (8 nuevas) y 7 mutaciones detectadas. Sigue abierto MC-015 (formatos de número con miles/millones en el resto de la app).

Verificación del bloque de IA: 134/134 pruebas (15 nuevas); cada uno de los 9 arreglos comprobado por mutación. **Importante:** el esquema y el prompt de `extraer-requisitos` cambiaron (campos `objeto_literal` y `naturaleza`); hay que redesplegar la función. Con la función vieja desplegada, ninguna fila de experiencia traería objeto literal y todas quedarían "sin verificar" (seguro, pero inútil).

Verificación del bloque del motor: 119/119 pruebas (17 nuevas), cada arreglo comprobado por mutación (al desactivarlo, al menos una prueba falla). Pendiente de todos: re-auditoría formal.

Nota: el cambio también está en `supabase/functions/daily-digest/index.ts` (con deduplicación, para que el correo no cuente un proceso dos veces). **Solo surte efecto en el correo diario cuando se redespliega esa función.**

Regla del gate: cualquier hallazgo CRITICAL, o cualquier riesgo de integridad que pueda producir conclusiones empresariales incorrectas, bloquea el lanzamiento. Un bloqueador se considera cerrado solo cuando su **criterio de aceptación pasó** y quedó un **caso de prueba automático** (entrada → salida) en `tests/smoke.mjs`, y la auditoría se repitió sobre ese punto. No se cierra por "ya lo arreglé".

## A. Datos que la app no muestra o muestra mal (el usuario no ve oportunidades reales)

| ID | Sev. | Bloqueador | Criterio de aceptación |
|---|---|---|---|
| S2-001 | CRITICAL | Los procesos abiertos no llegan a la app (orden descendente con fechas nulas primero) | Para acueducto, alcantarillado, interventoria y colegio, la app trae todos los abiertos del servidor (`count(*)` con el mismo `$where`); igual en alertas y digest |
| S2-002 | HIGH | La búsqueda distingue tildes ("pavimentación" 2 vs "pavimento" 6.493) | "pavimentación" y "pavimentacion" con recall equivalente |
| S2-003 | HIGH | Se muestran cancelados/borradores/adjudicados como oportunidades; "vencidos" no se ocultan sin fecha | Con filtros por defecto ningún Cancelado/Seleccionado aparece como abierto |
| TR-001 | CRITICAL | La sugerencia de oferta usa `cuantia_proceso` de SECOP I (= valor del contrato) → 0% "histórico" | Con SECOP I la sugerencia devuelve `aplica:false`; con ambas fuentes usa solo SECOP II |
| TR-003 | HIGH | Un fallo de fuente no se informa; con ambas caídas dice "no se encontraron" | Aviso explícito por fuente; nunca "sin resultados" si hubo error |

## B. El motor puede decir "cumple / GO" cuando no corresponde (o descartar un proceso viable)

| ID | Sev. | Bloqueador | Criterio de aceptación |
|---|---|---|---|
| MC-001 | CRITICAL | Mínimo en pesos ignorado en texto libre | Requisito de $500M con contrato de $1M → NO CUMPLE/NO DETERMINABLE |
| MC-002 | CRITICAL | Conteo de contratos en letras / "al menos" / "acreditar N" no se modela | Los 4 casos con 1 contrato → NO CUMPLE |
| MC-003 | CRITICAL | Ventana temporal desacoplada de valor y conteo | Contrato de 2015 con el valor + contrato de 2025 sin valor → NO CUMPLE |
| MC-004 | CRITICAL | Unidad de índices sin normalizar (60% vs 0,60) | "60%" y 0,60 equivalentes; perfil 0,75 → fail |
| RT-001 | CRITICAL | Valores negativos se vuelven positivos | "-1.5e9", "(1.5e9)", "K residual = -1.2e9" → null/NO DETERMINABLE |
| RT-002 | CRITICAL | Contratos duplicados y filas TOTAL se suman | Los 3 escenarios cuentan el contrato una sola vez |
| MC-005 | HIGH | Umbral financiero leído de fechas, años y números de norma (31, 1082) | Ambos casos → nd o 1,5 |
| MC-006 | HIGH | K residual relativo ("1,5 veces", "100% del presupuesto") leído como pesos | → nd o comparación correcta |
| MC-007 / RT-005 | HIGH | Indicadores del perfil toman años/fechas como valor | "Liquidez a 31/12/2024: 0,8" → 0,8 |
| RT-006 | HIGH | Umbrales de "ver Anexo 3", "numeral 4.2", negaciones | → nd con nota |
| MC-008 | HIGH | Verbos de actividad genéricos: interventoría/estudios/suministro acreditan obra | Los 4 casos → NO DETERMINABLE |
| MC-009 | HIGH | Unidades m/ml/mts/m.l. no bloquean CUMPLE | Los 4 casos → NO DETERMINABLE |
| MC-010 | HIGH | Participación en consorcio ignorada | 30% de $900M vs mínimo $500M → NO CUMPLE/nd |
| MC-011 / IA-005 | HIGH | Obligatoriedad por regex (negaciones); opcional/puntaje afecta o no el global indebidamente | "No es opcional" → obligatorio; puntaje nunca produce NO-GO; un opcional NO CUMPLE es visible |
| MC-014 | HIGH | SCE ignora en silencio contratos en ejecución incompletos → "cubre" | Con un contrato incompleto el gate no dice ok |
| RT-003 | HIGH | Fechas invertidas/futuras/9999 pasan la ventana temporal | → NO DETERMINABLE con motivo |
| RT-004 | HIGH | Sin K residual desaparece el gate de capacidad y sale GO | Sin K residual el veredicto máximo es REVISAR |
| RT-007 / UX-004 | HIGH | GO con el pliego leído en parte; disclaimer no junto al veredicto | Con lectura parcial nunca hay GO; pie fijo con "orientativo" y "Leído X/N" |
| RT-009 | HIGH | `historial="null"` rompe "Buscar procesos" con un mensaje que culpa a SECOP | Con cualquier clave dañada la app arranca y avisa |

## C. IA (si se ofrece a usuarios): hasta cerrar esto, mantenerla desactivada o rotulada "experimental"

| ID | Sev. | Bloqueador | Criterio de aceptación |
|---|---|---|---|
| IA-001 | HIGH | Cifras alteradas pasan la verificación aproximada (C3d, C4, K, D) | Los 4 casos → no verificada |
| IA-002 | HIGH | Unidad COP/SMMLV/"millones" no verificada contra la cita (E1, E3) | E1 y E3 → NO DETERMINABLE |
| IA-003 | HIGH | La `descripcion` parafraseada decide qué contratos aplican (caso P) | Caso P → NO DETERMINABLE |
| IA-004 | HIGH | Adendas: valores contradictorios sin detectar; `modificado_por_adenda` no cambia nada | Dos filas del mismo indicador con valores distintos → CONFLICTO |
| IA-005 | HIGH | Clasificación (obligatoriedad, puntaje vs habilitante) no verificada (casos G y H) | G → REQUIERE REVISIÓN; `ponderable` nunca produce NO-GO |
| IA-008 | HIGH | Omisiones invisibles; filas "VERIFICAR A MANO" no bloquean GO | Con garantías/jurídicas sin revisar no hay GO; categorías esperadas ausentes se muestran |
| — | — | **Prueba real con crédito** (NO VERIFICADO): duración, tokens, costo, tasa de "sin verificar", adendas | Pliego real de ≥70 págs con adenda; informe de resultados adjunto |

## D. Documentos generados

| ID | Sev. | Bloqueador | Criterio de aceptación |
|---|---|---|---|
| DG-001 | HIGH | "Contratos que lo acreditan" aparece bajo requisitos NO CUMPLE/NO DETERMINABLE | Solo con `resultado==='CUMPLE'` |
| DG-002 | HIGH | El anexo dirigido a la entidad incluye autoevaluación interna y textos de la interfaz | El cuerpo firmable no contiene "Buscar procesos" ni "NO DETERMINABLE"; aviso si el global no es CUMPLE |
| DG-003 | HIGH | Declaraciones bajo juramento ya escritas, incluso con perfil vacío | Ninguna afirmación fáctica sin marca `[CONFIRMAR]`; aviso al inicio; confirmación al descargar. **Requiere revisión legal profesional** |

## E. Seguridad, privacidad y cumplimiento (conclusiones jurídicas: requieren revisión profesional)

| ID | Sev. | Bloqueador | Criterio de aceptación |
|---|---|---|---|
| SEG-001 | HIGH | Registro sin verificación de correo (`mailer_autoconfirm:true`), abierto, sin CAPTCHA | `/auth/v1/settings` con `mailer_autoconfirm:false`; `signUp` no devuelve sesión hasta confirmar; CAPTCHA |
| PRIV-001 | HIGH | Sin política de tratamiento de datos, aviso, términos ni autorización | El registro exige aceptar la versión vigente y queda registrada |
| PRIV-002 | HIGH | Sin borrado de cuenta/datos; quedan datos huérfanos al borrar el usuario | Tras "Eliminar cuenta" no queda fila del usuario en `companies`, `company_members`, `app_state`, `ai_usage`, ni Storage |

## F. Condición mínima para beta controlada (además de A–E)
Aviso visible y permanente de "resultado orientativo" junto a cualquier veredicto; usuarios conocidos y limitados; exportar/importar respaldo (OPS-008); y captura de errores/alertas básicas (OPS-007).
