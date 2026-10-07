# DATA-TRACEABILITY-REPORT — auditoría 2026-10-07

Cadena auditada: **Fuente → extracción → transformación → regla → cálculo → resultado → explicación → acción del usuario.** Estado por eslabón: VERIFICADO · PARCIAL · INFERIDO · NO VERIFICADO.

## 1. Proceso (SECOP II, datos.gov.co `p6dx-8zbt`) — LP-008-2026
| Eslabón | Estado | Evidencia |
|---|---|---|
| Fuente | VERIFICADO | consulta en vivo; dataset actualizado 2026-10-07 02:04 UTC |
| Extracción | VERIFICADO | la ficha coincide con el registro (cuantía, ubicación, modalidad, número, fechas, duración) |
| Transformación | VERIFICADO | `normalize` elige `fecha_de_recepcion_de` para el cierre (definición oficial: "recepción de respuestas") |
| Regla | PARCIAL | "Presentación de oferta" = esa columna; la hora no existe en el dataset |
| Resultado | VERIFICADO | 28 de oct de 2026 (21 días) |
| Explicación | PARCIAL | A7-10: otra fuente pública dice 16-oct 12:00; no se reconcilia con el cronograma del documento |
| Acción | VERIFICADO | "Ver en SECOP" abre la URL del aviso (`noticeUID=CO1.NTC.10975958`) |

## 2. RUP
| Eslabón | Estado | Evidencia |
|---|---|---|
| Fuente | NO VERIFICADO | sin RUP real en el entorno |
| Extracción | PARCIAL | formato Confecámaras sintético: UNSPSC e indicadores correctos (RUP-01); códigos falsos sin encabezado (RUP-02/03); "1.850" → 1850 (RUP-08) |
| Transformación | PARCIAL | los indicadores pasan a texto "Etiqueta: valor" en el perfil; el usuario los revisa |
| Regla | PARCIAL | UNSPSC se compara a 6 dígitos; **vigencia y fecha de corte no existen en el modelo** (A7-08) |
| Cálculo | VERIFICADO | `compararIndiceConUmbral` normaliza % ↔ razón y bloquea ambigüedad |
| Explicación | VERIFICADO | detalle "Pliego: ≥ 1,2 · tu perfil: 2 ✓" |

## 3. RUT
| Eslabón | Estado | Evidencia |
|---|---|---|
| Extracción | PARCIAL | lectura por posición correcta en 4 de 4 casos sintéticos (RUT-01/03/04) |
| Regla | NO VERIFICADO | el RUT solo autocompleta el perfil: **no entra al veredicto** (RUT-05) |
| Control | AUSENTE | DV no validado con el algoritmo oficial (A7-12) |

## 4. Estudio Previo / Pliego → umbrales
| Eslabón | Estado | Evidencia |
|---|---|---|
| Extracción por texto | PARCIAL | de 20 redacciones adversarias (EP-01…15, KR-01…05): **5 erróneas** (EP-07/08/09/15, KR-04); las otras 15 correctas o "sin dato" |
| Transformación | VERIFICADO | fechas, años y normas se descartan; "no será exigido" no produce umbral |
| Cálculo | VERIFICADO | motor determinístico |
| Trazabilidad a la página | **ROTA** | "Página: No identificada" (A7-09) |
| Trazabilidad por IA | VERIFICADO | cita + página + hash al confirmar (IA-006) |
| Documento correcto | PARCIAL | Pliego vs Estudio Previo vs Adenda se rotula, pero el veredicto no distingue (A7-01) |

## 5. Preguntas del método
- **"¿Por qué dijiste que esta empresa cumple?"** → La pantalla responde con requisito, exigencia, dato de la empresa y cita. ✅ En el camino por IA incluye página; ❌ por texto no.
- **"¿Qué tendría que cambiar para que dejara de cumplir?"** → Parcial: el detalle muestra el umbral y el valor del perfil (p. ej. ≥ 1,2 vs 2), de donde se deduce el margen, pero no lo dice explícitamente.
