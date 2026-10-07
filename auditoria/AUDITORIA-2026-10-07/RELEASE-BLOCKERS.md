# RELEASE-BLOCKERS — auditoría 2026-10-07

**Estado de la aplicación: BLOQUEADO para lanzamiento general** (antes: BETA CONTROLADA). Motivo: cinco riesgos de integridad HIGH que pueden producir una conclusión empresarial incorrecta. No hay CRITICAL. Detalle de cada ID en `AUDIT-REPORT.md`; las auditorías anteriores (`auditoria/RELEASE-BLOCKERS.md`) siguen siendo el registro histórico y sus pendientes (SEG-001, PRIV-001, SEG-006…) **no se re-evaluaron hoy**.

> Lectura honesta: el bloqueo es por **rutas concretas**, no por la calidad general. Los cinco arreglos son pequeños o medianos. Con ellos hechos y verificados, el estado vuelve a BETA CONTROLADA y puede avanzar a CANDIDATO.

| ID | Sev | Qué puede pasar | Cierra cuando… | Estado |
|---|---|---|---|---|
| A7-01 | HIGH | Un análisis **solo con Estudio Previo** muestra **GO**. | Con Estudio Previo el resultado máximo es REVISAR (o "GO preliminar") y el resumen lo dice. Prueba: UI-01/VER-01. | ABIERTO |
| A7-02 | HIGH | El umbral sale de un **promedio del sector**, una "referencia" o la **primera** de varias apariciones, sin avisar. | EP-07/08/09/15 y KR-04 dan "sin dato" o "conflicto"; nunca un valor. | ABIERTO |
| A7-03 | HIGH | Una fila de IA con el **indicador cruzado** (liquidez↔endeudamiento) queda verificada y fija el umbral. | IA-03/04/05 quedan bloqueadas; IA-01 sigue verificándose; **y una extracción real** sin regresión. | ABIERTO |
| A7-04 | HIGH | "co**rup**ción" se trata como RUP y un número de 8 dígitos da **NO-GO por UNSPSC**; el requisito real puede perderse. | CAT-01/02/03 pasan; un requisito UNSPSC real con 3 códigos se evalúa igual. | ABIERTO |
| A7-05 | HIGH | Por texto, capital de trabajo, patrimonio, rentabilidad y garantías **detectados no bloquean el GO**. | VER-02 y UI-02 dan REVISAR. | ABIERTO |

## No bloquean, pero deben cerrarse antes de un lanzamiento general
A7-06 (códigos UNSPSC falsos desde cédulas/fechas), A7-07 (índice "1.850" leído como 1850), A7-08 (vigencia/fecha de corte del RUP no capturada), A7-09 (umbral por texto sin página), A7-10 (fecha de cierre sin reconciliar con el cronograma).

## Pendientes de verificación (NO VERIFICADO)
- Formato real del RUP y del RUT (A7-06, A7-07, A7-08, A7-11, A7-12).
- Comportamiento del modelo real en indicadores (A7-03): requiere crédito de Claude.
- Fecha de cierre vigente de LP-008-2026 (A7-10).
- Seguridad, privacidad, rendimiento y operación: no se re-ejecutaron hoy.
