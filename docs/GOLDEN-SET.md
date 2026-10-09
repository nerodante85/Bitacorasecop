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

### 2.1 Documentos recibidos el 2026-10-09 (primera pasada, solo detección)

Los 4 PDF son del sector agua potable y saneamiento básico (APSB); ninguno es de vías, edificación ni interventoría, así que esos tipos siguen pendientes. Dos son estudios previos de EPC (entidad departamental con lotes), uno es el borrador del pliego de Toledo y otro el estudio previo de Zapatoca. «Detectó la app» es lo que sale hoy de la ficha, no un resultado validado.

| Caso | Documento | Proceso | Valor / plazo | Qué detectó la app | Brecha vs. lectura del documento |
|---|---|---|---|---|---|
| G-01 | Borrador pliego Toledo (23 sep, 74 págs.) | LP-SAPSB-03215-2026, Gobernación de Norte de Santander | $3.185.389.625 · 4 meses · sin anticipo | 15 filas: objeto, presupuesto, plazo, anticipo, sumatoria 75/120/150 %, 5 específicas, UNSPSC 721511, capital de trabajo y K | Ninguna conocida. Comparar contra el pliego definitivo (puede haber cambiado). |
| G-02 | Estudio previo EPC con apropiación (124 págs.) | Acueductos y alcantarillados, Cundinamarca, 2 lotes (Grupo 1 y 2) | $34.261.036.316 en total; lote 1 $28.456.095.935 | 5 filas: anticipo, sumatoria, UNSPSC, aviso de 2 lotes | **No detecta** la experiencia específica de tubería (lote 1: 7.254 ml, 50 % = 3.627 ml en PVC o PEAD, 8\" a 12\"; lote 2: 993 ml, 3\" a 4\"); tampoco el valor por lote, capital de trabajo (CT ≥ 10 % del PO) ni la capacidad residual |
| G-03 | Estudio previo EPC, alcantarillado y PTAR (84 págs.) | Plan maestro Ubaque fase II y PTAR San Cayetano, 2 lotes | $25.920.432.799 en total | 8 filas: sumatoria, magnitud (13 l/s), tubería (2.701 ml), sedimentadores, UNSPSC | **No detecta que son 2 lotes** (lista de lotes vacía) y por eso avisa «varios presupuestos» sin dejar elegir lote; no calcula capital de trabajo ni K |
| G-04 | Estudio previo Zapatoca (35 págs.) | LP-006-2026, optimización y mejoramiento del acueducto | $1.046.012.009 · 2 meses | 2 filas: presupuesto y UNSPSC (72151100, 72151900) | Es un estudio previo: solo nombra los requisitos (RUP, experiencia, liquidez, endeudamiento, cobertura, capital de trabajo, ROE, ROA, capacidad residual) **sin cifras**, así que NO DETERMINABLE es lo correcto. Falta leer el plazo cuando está en letras («DOS MESES») y el objeto |

Qué enseña este lote:
1. Los estudios previos de EPC repiten el texto de la plantilla CCE con huecos sin llenar («(F%)», «[la Entidad establecerá…]»). La app debe leer solo el bloque «Requisito de Experiencia a acreditar» con cifras reales y nunca los huecos.
2. EPC admite dos materiales («PVC o PEAD») y rango de diámetros (8\" a 12\"); `magnitudes.js` hoy solo modela un material y un diámetro mínimo.
3. Con lotes, la ficha debe dejar elegir lote y recalcular valor, capital de trabajo, K y magnitud por lote.
4. Una cifra en letras («DOS MESES», «TREINTA Y CUATRO MIL…») no se lee hoy.

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
