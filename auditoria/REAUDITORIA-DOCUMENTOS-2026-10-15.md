# Ronda adversarial de documentos generados — Bitácora SECOP · 2026-10-15

**Alcance:** carta de presentación, compromiso anticorrupción, certificación de aportes, formato de experiencia, paquete y hoja de vida
(`generarCartaTexto`, `generarAnticorrupcionTexto`, `generarParafiscalesTexto`, `generarFormatoExperienciaTexto`, `generarPaqueteTexto`,
`generarHojaDeVidaTexto` en `index.html`). **Primera pasada: se inspeccionó y se ejecutó el motor real; no se modificó el producto.**
La sonda reproducible está en `auditoria/banco-adversarial-2026-10-15/documentos-sonda.snippet.js` (instrucciones en su cabecera).

Regla de oro que se midió: *un documento generado no puede contener información que la aplicación no pueda justificar con datos de la
empresa, el proceso o un cálculo reproducible.*

## Qué se probó y salió bien (VERIFICADO, ejecutado)

| Prueba | Resultado |
|---|---|
| Paquete con perfil, proceso y evaluación vacíos | 0 fugas de «undefined», «null», «NaN» o «[object»; 13 campos `[COMPLETAR]`; 9 marcas `[CONFIRMAR]`; el bloque «ANTES DE FIRMAR» aparece una sola vez |
| Valor de la oferta y plazo ofrecido | Siempre `[COMPLETAR]`: nunca se rellenan con el presupuesto oficial |
| Cuerpo firmable | No incluye la autoevaluación ni textos de la interfaz (DG-002 se mantiene) |
| Requisito que NO cumple | No se listan contratos «que lo acreditan» (DG-001 se mantiene) |
| Texto de SECOP dentro del documento | Salida en texto plano (`.txt`): no hay HTML que escapar |

## Hallazgos

| ID | Sev. | Hallazgo | Evidencia | Confianza |
|---|---|---|---|---|
| RA3-1 | **HIGH** | El formato de experiencia, que va dirigido a la entidad y se firma, lista bajo «Contratos que lo acreditan» **todos los contratos relevantes por palabras**, no solo los que cumplen. Con el requisito «un contrato de puentes por valor mínimo de $500 millones» y tres contratos, el documento incluye uno de **$100 millones** (no alcanza) y otro **todavía en ejecución** (termina en 2027, no acredita). Con «mínimo dos contratos de ≥ $500 millones» lista también el de $100 millones | Sonda, casos A, B y C: `contratosEvaluados` = `relevantes` (index.html, `evaluarRequisito`) y el documento lo toma completo cuando el requisito sale CUMPLE | Alta (ejecutado) | **CORREGIDO 2026-10-15** (DG-RA3-1; 7 mutaciones detectadas) |
| RA3-2 | MEDIUM | **El número de contrato nunca llega al documento.** `contratosEvaluados` copia fila, objeto, contratante, valor, cantidad y fechas, pero no `numeroContrato`; el generador sí lo busca. Las pruebas existentes pasan porque su contrato de ejemplo trae el número ya puesto. El documento tampoco avisa con `[COMPLETAR]` que falta | Sonda: Excel con «CT-045-2022» → el contrato lo lee, `contratosEvaluados[0]` no lo trae, el documento no lo imprime | Alta (ejecutado) | **CORREGIDO 2026-10-15** (DG-RA3-2) |
| RA3-3 | MEDIUM | **Consorcio / unión temporal:** la experiencia evaluada es la suma de los contratos de todas las empresas marcadas para comparar (cada contrato lleva `_perfilNombre`), pero el documento solo dice «Proponente: <una empresa> · NIT» y no conserva de quién es cada contrato. La carta y el paquete se generan con un solo perfil (el mejor) | Lectura del código: `recalcularExpevalActivo` combina; `descargarPaqueteDeProceso` usa `perfiles[perfilId]` y `analisis[id].experienciaResultado` | Media (INFERIDO por lectura; no se ejecutó en el navegador) |
| RA3-4 | MEDIUM | La carta dice siempre «**sociedad** identificada con NIT» y «**representante legal**», y el formato de experiencia firma como «Representante Legal». Para una **persona natural** es incorrecto, y el perfil no tiene un campo de tipo de persona | Sonda: perfil de persona natural → ambas frases aparecen | Alta (ejecutado) |
| RA3-5 | LOW | El ítem 1 de la carta («**conozco y acepto** el pliego de condiciones, sus anexos, adendas y demás documentos del proceso») es una afirmación de hecho que solo el firmante puede verificar, pero no lleva `[CONFIRMAR]` ni figura en el aviso «ANTES DE FIRMAR». El ítem 4 es un compromiso futuro y no lo necesita | Sonda: lista de declaraciones sin marca | Alta |
| RA3-6 | LOW | **Resultado de experiencia desactualizado:** el documento usa el resultado guardado al evaluar. Si después cambian los contratos cargados o las empresas marcadas, el documento no lo refleja ni indica a qué fecha corresponde la evaluación | Lectura del código; no se probó cómo avisa la pantalla | Baja (NO VERIFICADO) |

## Corrección propuesta y criterio de aceptación (no aplicada)

| ID | Corrección | Criterio de aceptación |
|---|---|---|
| RA3-1 | `evaluarRequisito` devuelve además `contratosQueAcreditan` (los que cumplen el criterio numérico, están terminados y dentro de la ventana). El documento lista solo esos; si no hay criterio por contrato (por ejemplo valor acumulado), lista todos los que suman y lo dice | Caso A: solo el de $900 millones; caso B: no aparece el de 2027; caso C: aparecen los dos que cumplen |
| RA3-2 | Copiar `numeroContrato` (y `_perfilNombre`) a `contratosEvaluados`; si falta el número, escribir `[COMPLETAR: número de contrato]` en esa línea | La sonda imprime «Contrato No. CT-045-2022»; sin número aparece el `[COMPLETAR]`; la prueba existente deja de usar un ejemplo con el número ya puesto |
| RA3-3 | Con más de una empresa marcada, anteponer a cada contrato la empresa a la que pertenece y un aviso interno de que el documento es de un consorcio y debe adaptarse | Caso de dos empresas: cada contrato muestra su empresa |
| RA3-4 | Campo «tipo de persona» en el perfil, o texto neutro («identificado(a) con NIT», «obrando en nombre propio o como representante legal») mientras no exista el campo | La carta de una persona natural no dice «sociedad» |
| RA3-5 | Marcar el ítem 1 con `[CONFIRMAR]` y añadirlo a `DECLARACIONES_CARTA` | Sale en el bloque «ANTES DE FIRMAR» |
| RA3-6 | Imprimir en las notas internas la fecha de la evaluación y cuántas empresas y contratos se usaron | La nota interna lo muestra |

## NO VERIFICADO
1. Cómo se ve cada documento en el navegador real y qué hace la pantalla cuando el resultado quedó desactualizado (RA3-6).
2. RA3-3 con una evaluación real de consorcio.
3. Contenido jurídico de las declaraciones: requiere abogado, como ya figura en `RELEASE-BLOCKERS.md` (DG-003).
4. Descarga real del `.txt` y su codificación (tildes y «═»), no solo el texto generado.
5. La hoja de vida solo vuelca lo que el usuario escribió en «Personal»; no se encontró nada inventado, pero no se probó con un perfil real.

## Estado
RA3-1 (HIGH) y RA3-2 (MEDIUM) quedaron corregidos el mismo día; siguen abiertos RA3-3, RA3-4 (MEDIUM) y RA3-5, RA3-6 (LOW). Texto anterior: un HIGH y tres MEDIUM en documentos que se firman. La carta y el paquete ya advierten que son plantillas orientativas con `[CONFIRMAR]` y
`[COMPLETAR]`, lo que atenúa pero no elimina RA3-1: el formato de experiencia sale con contratos que no acreditan el requisito. Con la corrección, la lista contiene solo contratos que el motor acredita; sigue siendo una plantilla que el firmante debe revisar.
