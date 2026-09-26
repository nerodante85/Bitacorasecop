# RELEASE-BLOCKERS — Bitácora SECOP

Fecha: 2026-09-26 · Estado de la aplicación: **BLOQUEADO** · Detalle de cada ID en `AUDIT-REPORT.md`.

## Registro de correcciones (se actualiza al cerrar cada bloqueador)

| ID | Fecha | Estado | Evidencia |
|---|---|---|---|
| S2-001 | 2026-09-26 | **CORREGIDO, verificado en datos reales** (pendiente: re-auditoría formal y despliegue de `daily-digest`) | La app pide dos consultas por palabra (procesos con cierre de ofertas hoy o después + los 300 publicados más recientes con fecha no nula). Comparado contra el servidor: acueducto 38/38, alcantarillado 35/35, interventoria 56/56, colegio 9/9 abiertos (antes 0 en las cuatro). 5 pruebas nuevas en `tests/smoke.mjs` (98/98) con un servidor de juguete que reproduce "NULL primero en DESC"; verificadas por mutación (quitar el filtro de cierre futuro rompe 2 pruebas; quitar la exclusión de NULL rompe 1). |
| S2-002 | 2026-09-26 | **CORREGIDO, verificado** | El término se envía sin tildes: "pavimentación" y "pavimentacion" envían el mismo `$q` y traen los mismos resultados. Prueba automática incluida. |

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
