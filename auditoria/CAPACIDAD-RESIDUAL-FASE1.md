# Capacidad Residual — Fase 1 (informe técnico)

Fecha: 2026-10-07. Rama de trabajo: `claude/sharp-archimedes-8vzd9g`.

## 1. Auditoría previa (lo que ya existía)

| Pieza | Dónde | Estado antes |
|---|---|---|
| K de la empresa | `perfiles[id].kResidual` (texto libre) | Declarada a mano; el RUP no la trae |
| Contratos en ejecución | `perfiles[id].contratosEnEjecucion` | Solo entidad, saldo y fecha de terminación |
| SCE | `calcularSCE` / `capacidadContractualEstimada` (index.html) | Saldo prorrateado a 360 días; sin participación ni validaciones |
| K exigida por el proceso | `extraerKResidualUmbral` y filas IA `k_residual` | Tomaba la primera mención; no detectaba valores distintos |
| Comparación | gates "Capacidad K residual" y "Capacidad vs valor" (`evaluacion.js`) | Existente, sin bloque propio ni fuente/margen |
| Documentos | solo texto del pliego (IndexedDB) | Los archivos del usuario no se guardan |

Decisión previa (Fase 13 del historial): no recalcular K con la fórmula completa porque depende de índices certificados. Se mantiene en Fase 1.

## 2. Qué se agregó

- Sección **Capacidad Residual** en Empresa › Datos: explicación, resumen ("Tu Capacidad Residual", estado, última actualización, "Confirmar que está al día"), alertas y "Ver cómo se calculó".
- **Contratos en ejecución** ampliados: nombre, número, entidad, tipo de cliente, estado, valor inicial/actual/ejecutado, saldo, fechas, consorcio/UT con % de participación y documento soporte (referencia, sin subir archivo).
- **Bloque "Capacidad Residual" en el análisis**: requerida por el proceso vs capacidad de la empresa, resultado (APARENTEMENTE CUMPLE / NO CUMPLE / NO SE PUEDE DETERMINAR / NO SE IDENTIFICÓ), margen o faltante, fuente con documento, página y cita.
- Detección de **valores distintos** de K en el mismo documento (queda NO DETERMINABLE con los valores a la vista).

## 3. Datos

`contratosEnEjecucion[]`: `{id, nombre, numero, entidad, tipoCliente, estado, valorInicial, valorActual, valorEjecutado, saldo, fechaInicio, fechaFin, consorcio, participacion, soporte}`.
`perfil.capacidadActualizada`: fecha ISO (cambia al editar contratos, al cambiar el K o al confirmar). Todo viaja en `perfiles_empresa` (sincroniza con la cuenta bajo RLS). Los contratos viejos (entidad, saldo, fechaFin) siguen funcionando.

## 4. Cálculo (Fase 1)

- Capacidad disponible = K declarada − SCE.
- SCE por contrato = saldo pendiente × factor de plazo × participación. Factor = 360 / días restantes si superan 360 (Ley 1682 de 2013 / Decreto 791 de 2014); participación = % si es consorcio/UT con porcentaje válido, 100 % si falta (se avisa).
- Saldo = el declarado; si falta, valor actual (o inicial) − valor ejecutado.
- **No** se calculan CO, E, CT ni CF: Fase 2, a la espera del texto oficial de la fórmula (no pudo verificarse desde el entorno de desarrollo).

## 5. Estados de confianza

- 🟢 Información completa: K en pesos y sin alertas que afecten.
- 🟡 Cálculo preliminar: contratos incompletos, consorcio sin porcentaje, duplicados, fechas/valores inconsistentes, estado suspendido/otro o más de un año sin actualizar.
- 🔴 No calculable: sin K en pesos.
- Siempre se aclara que la K es declarada por la empresa.

## 6. Validaciones

Negativos; fechas inválidas o inicio posterior a terminación; "en ejecución" con fecha ya vencida; saldo mayor al valor del contrato; ejecutado + saldo que no cuadra con el valor; participación fuera de 0–100 o ausente en consorcio; duplicados (mismo número y entidad, o mismo nombre, entidad y valor); contrato sin saldo; falta de soporte (avisa, no vuelve preliminar).

## 7. Riesgos y pendientes

- La regla de prorratear por participación en consorcio/UT y de contar contratos suspendidos debe confirmarse contra la guía oficial de Colombia Compra Eficiente (Fase 2).
- Una adenda que modifique la K no se distingue: la app analiza un solo texto por proceso; si hay montos distintos queda NO DETERMINABLE.
- No hay historial de versiones del cálculo (solo la fecha de última actualización).
- No se guardan documentos (RUP, estados financieros, contratos): ver Fase 3 (almacenamiento privado, con revisión de seguridad y privacidad).

## 8. Pruebas

`tests/smoke.mjs`: CR-001…CR-007 (saldo, participación en el SCE, validaciones, duplicados, estados de confianza, comparación, conflicto de valores). Verificadas por mutación (7 mutaciones detectadas). `tests/e2e.mjs`: 3 flujos nuevos (bloque en el análisis con fuente y página; cumple con margen y sin K exigida; sección en Empresa con contrato en consorcio). Medido a 375/768/1280 px: sin desborde horizontal.
