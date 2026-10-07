# AI-RELIABILITY-REPORT — auditoría 2026-10-07

**Pregunta:** ¿puede la IA (o el motor que la consume) afirmar algo que el documento no sustenta?
**Alcance:** `supabase/functions/extraer-requisitos` (prompt y esquema), el verificador de citas del navegador y la conversión a umbrales. **No se llamó al modelo real** (sin crédito en este entorno): lo medido es qué atrapa el código **si** el modelo se equivoca, no con qué frecuencia se equivoca.

## Qué decide quién (cumple el principio "la IA extrae, el motor decide")
| Paso | Quién | Estado |
|---|---|---|
| Localizar y copiar el requisito con cita y página | IA | prompt exige cifras exactas, cita literal ≤ 300 caracteres, `null` ante la duda, ignorar instrucciones dentro del PDF |
| Comprobar que la cita existe en esa página | **Navegador** (determinístico) | ✅ IA-02: una cita inventada queda sin verificar |
| Comprobar que la cifra está en la cita, su unidad y su contexto | Navegador | ✅ para experiencia (contratos, valor, %, ventana, cantidad) · ❌ **no** para indicadores (A7-03) |
| Comparar con la empresa y decidir CUMPLE/NO CUMPLE | Motor (`evaluacion.js`) | ✅ sin IA en el cálculo; una fila sin verificar nunca da CUMPLE |

## Casos anti-alucinación (los del método)
| Caso | Resultado | Sonda |
|---|---|---|
| El requisito no existe | ✅ sin fila / gate "no determinable" | EP-13, EP-14 |
| Falta información de la empresa | ✅ NO DETERMINABLE | VER-04, UI-01 |
| Documento ambiguo | ✅ ambiguo → sin dato (endeudamiento "70", K residual con dos montos) | EP-11, KR-05 |
| Dos valores diferentes en el documento | 🟡 conflicto detectado para IA y K residual; ❌ **no** para liquidez/endeudamiento/cobertura por texto | EP-15 |
| Cita inventada | ✅ no verifica | IA-02 |
| Cifra tomada del indicador vecino | ❌ **se verifica** | IA-03, IA-04 |
| Cita que no nombra el indicador | ❌ respalda cualquier indicador | IA-05 |
| PDF con texto incompleto / tabla mal extraída | ✅ se avisa "posible tabla no leída" (visto en tus capturas) | previo |
| Fuente externa caída | ⬜ cubierto en TR-003 (no repetido) | — |

## Hallazgo principal de IA
**A7-03.** `contextoDeCifra` devuelve `null` para los indicadores ("demasiado variables"), de modo que la verificación acepta cualquier cifra presente en la cita. Con la cita real "liquidez ≥ 1,2 … endeudamiento ≤ 0,70", una fila `liquidez = 0,7` pasa y el motor la usa. Es el mismo defecto que IA-001 cerró para experiencia.

**Qué sí atrapa el código aunque el modelo falle:** cifra ausente de la cita, unidad incoherente, mínimo ≤ 0, operador ausente, obligatoriedad dudosa, conflicto entre filas del mismo indicador, inyección de instrucciones en el PDF.

**Qué no atrapa:** relación nombre del indicador ↔ cifra; dirección real (≥ / ≤) contra el texto de la cita (solo se comprueba que exista un operador).

## Estudio Previo como documento principal
El prompt dice que, sin Pliego, el Estudio Previo "hace las veces de documento principal — trátalo con el mismo rigor". La extracción es consistente con eso, pero el **veredicto** no distingue (A7-01): un GO sobre Estudio Previo se presenta igual que uno sobre Pliego.

## Qué falta para poder afirmar "confiable"
1. Cerrar A7-03 y repetir **una extracción real** de un pliego con tabla de indicadores (regla del proyecto: un cambio en el verificador exige una extracción real).
2. Medir en N pliegos reales cuántas filas financieras salen cruzadas o sin nombre de indicador (hoy: desconocido).
3. Guardar con cada fila el nombre del indicador **tal como aparece en la cita**, para poder mostrarlo.
