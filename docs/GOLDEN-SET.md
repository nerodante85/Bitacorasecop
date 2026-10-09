# Golden set de Licitapp / Bitácora

Conjunto de pliegos revisados **a mano** contra los que se mide la app. Un resultado de la app solo vale si coincide con el de un revisor humano que leyó el pliego y el soporte de la empresa.

## 1. Regla de aprobación (no negociable)

| Métrica | Meta | Cómo se mide |
|---|---|---|
| **Falsos CUMPLE** | **0** | Requisitos donde la app dice CUMPLE y el revisor dice NO CUMPLE o no verificable |
| Falsos NO CUMPLE | ≤ 5 % de los requisitos | App dice NO CUMPLE y el revisor dice CUMPLE |
| Requisitos habilitantes detectados | ≥ 90 % | Requisitos del pliego que el revisor lista y la app trae en la ficha |
| Cifras exactas (monto, SMMLV, cantidades, páginas) | 100 % | Cada cifra de la ficha coincide con el pliego |
| NO DETERMINABLE justificado | 100 % | Todo NO DETERMINABLE trae un motivo que el revisor comparte |

Un solo falso CUMPLE bloquea la liberación, sin importar el resto.

## 2. Composición (5 casos, 1 de cada tipo mínimo)

| # | Tipo de proceso | Documento tipo / modalidad | Qué prueba | Estado |
|---|---|---|---|---|
| G-01 | Acueducto/alcantarillado (APSB) | CCE APSB, licitación pública | Experiencia específica por cantidades, consorcio, tubería/pozos/conexiones | **Hecho en parte (Toledo)** |
| G-02 | Vías | Obra pública, licitación o selección abreviada | Longitud intervenida, tipo de pavimento, capacidad residual | Pendiente |
| G-03 | Edificación (colegio, salud, CAI) | Obra pública, m² | Experiencia en m² / SMMLV, grupos UNSPSC | Pendiente |
| G-04 | Interventoría de obra | Concurso de méritos | Experiencia y personal de interventoría, no mezclar con obra | Pendiente |
| G-05 | Proceso con lotes o pliego escaneado | Cualquiera | Lectura por IA/OCR, lotes, tablas no leídas | Pendiente |

Criterios para elegir cada pliego: proceso real de SECOP II ya publicado, pliego completo, que tu empresa o un aliado pudiera presentarse (para tener soporte), y que no sea trivial (al menos 6 requisitos habilitantes).

## 3. Empresas de prueba

- Dora Garay y Gilli (Formato Maestro cargado; soporte documental de Dora en Drive).
- Egida Construcciones (decidida como empresa de prueba; falta cargar su Excel de experiencia).
- Cada caso se evalúa con **una empresa fija**, anotada en la ficha del caso.

## 4. Procedimiento por caso (≈ 60-90 min)

1. Guardar el PDF del pliego y anotar proceso, entidad, valor, fecha de cierre.
2. **Revisor humano primero, sin mirar la app:** llenar la tabla de la sección 5 con el resultado correcto, la página del pliego y la evidencia de la empresa.
3. Cargar el pliego en la app, extraer requisitos y leer la ficha y la matriz.
4. Comparar fila a fila. Clasificar cada diferencia: falso CUMPLE (crítico), falso NO CUMPLE, requisito no detectado, cifra errónea, NO DETERMINABLE injustificado.
5. Cada diferencia crítica o repetida se vuelve una prueba en `tests/smoke.mjs` antes de corregir el código.
6. Registrar el resultado en la sección 6.

## 5. Plantilla de caso (copiar una por pliego)

**Caso:** G-0X · **Proceso:** … · **Entidad:** … · **Empresa evaluada:** … · **Revisor:** … · **Fecha:** …

| Requisito | Qué exige el pliego (cita y pág.) | Evidencia de la empresa | Resultado correcto (CUMPLE / NO CUMPLE / NO DETERMINABLE) | Resultado de la app | Diferencia |
|---|---|---|---|---|---|
| Capacidad jurídica | | | | | |
| Capital de trabajo | | | | | |
| Patrimonio | | | | | |
| Índices financieros (liquidez, endeudamiento, cobertura) | | | | | |
| Capacidad residual (K) | | | | | |
| Experiencia general (SMMLV, nº contratos) | | | | | |
| Experiencia específica (cada magnitud) | | | | | |
| Personal / equipo | | | | | |
| Otros habilitantes | | | | | |

## 6. Registro de resultados

| Caso | Fecha | Requisitos | Falsos CUMPLE | Falsos NO CUMPLE | No detectados | Cifras mal | Aprobado |
|---|---|---|---|---|---|---|---|
| G-01 Toledo (LP-SAPSB-03215-2026) | | | | | | | |

## 7. Caso G-01 — Toledo, avance (2026-10-09)

Empresa: Dora Garay (consorcio con Gilli para capacidad financiera). Resultado esperado hoy:

| Requisito | Resultado correcto | Motivo |
|---|---|---|
| Experiencia específica: tubería PVC ≥ 8" (965,21 ml) | NO DETERMINABLE | C-0170 tiene 1.378 ml PVC 12" pero la base en consorcio (completo/prorrateado, 50 %) no está definida en el pliego; C-0169 de 16" sin material confirmado |
| Pozos de inspección (19 UND) | NO DETERMINABLE | C-0170: 30 UND completo; 15 UND prorrateado |
| Conexiones domiciliarias (129 UND) | NO DETERMINABLE | Sin soporte: sillas yee y cajas domiciliarias no son conexiones |
| Entibados (solo acreditar) | NO DETERMINABLE | Sin contrato que lo acredite en lo cargado |
| Longitud de vía (70 %: 2.004,64 ml) | NO DETERMINABLE | No modelado en `magnitudes.js` |

Pendiente del caso: respuesta de la entidad a la observación sobre la base de cantidades en consorcio; contratos con conexiones y entibados; completar las filas financieras con revisor.
