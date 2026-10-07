# RELEASE-CHECKLIST — auditoría 2026-10-07

Leyenda: ✅ verificado hoy · 🟡 parcial · ❌ falla · ⬜ no revisado hoy (ver auditorías previas) · ➖ no aplica

## Fuentes de datos
- ✅ SECOP II: la ficha de LP-008-2026 coincide con el registro oficial (cuantía, ubicación, modalidad, número, fechas, duración).
- 🟡 Fecha de cierre: fiel al dataset, pero difiere de colombialicita (A7-10).
- ➖ SECOP I: retirado. 🟡 Quedan residuos en el correo diario (A7-14).
- ⬜ Paginación, límites y caché de la búsqueda: verificados en S2-001…003 (2026-09-26), no repetidos.

## Lectura de documentos
- ✅ RUP bien formado: UNSPSC e indicadores se leen tal cual (RUP-01).
- ❌ RUP sin encabezado: códigos falsos desde cédulas/fechas (A7-06). ❌ Índice "1.850" → 1850 (A7-07).
- ❌ RUP: fecha de corte y vigencia no capturadas (A7-08).
- ✅ RUT: NIT, razón social, persona natural y casilla vacía (RUT-01/03/04). 🟡 DV sin validar (A7-12).
- ❌ Estudio Previo / Pliego por texto: umbral desde narrativa o primera aparición (A7-02).
- ✅ Referencias normativas, "no aplica" y montos distintos → sin dato o conflicto.

## Interpretación y veredicto
- ✅ Sin K residual → nunca GO (VER-04). ✅ Gate de experiencia depende solo del conteo del motor (VER-06).
- ❌ Estudio Previo solo → GO (A7-01). ❌ Requisitos detectados sin evaluar → GO (A7-05). ❌ "rup" subcadena → NO-GO sin sustento (A7-04).
- ✅ SMMLV sin regla explícita → sin conversión (VER-05).

## IA (extractor)
- ✅ Cita inventada → sin verificar (IA-02). ✅ Prompt exige literalidad y null ante la duda.
- ❌ Indicador cruzado verificado (A7-03). ⬜ Tasa de error del modelo real: sin medir.

## Trazabilidad
- ✅ Por IA: documento + página + cita verificada.
- ❌ Por texto: "Página: No identificada" (A7-09).

## Documentos generados
- ✅ Carta con perfil vacío: solo `[PLACEHOLDER]` (DOC-01). 🟡 Persona natural dice "sociedad" (A7-13).
- ⬜ Anexo de experiencia, hojas de vida, paquete: verificados en DG-001…003 (2026-09-27), no repetidos.

## Seguridad / privacidad / operación
- ⬜ No re-ejecutado hoy. Pendientes conocidos: SEG-001, PRIV-001 (texto jurídico), SEG-006, monitor externo del correo.
