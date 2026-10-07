# DOCUMENT-GENERATION-REPORT — auditoría 2026-10-07

**Regla de oro del método:** un documento generado no puede contener información que la aplicación no pueda justificar con datos de la empresa, fuente oficial, documento del proceso o un cálculo reproducible.

## Qué se probó hoy
| Prueba | Resultado |
|---|---|
| DOC-01 · Carta de presentación con **perfil vacío** | ✅ Representante, cédula, razón social, NIT, dirección, teléfono, correo, valor de la oferta y plazo salen como `[PLACEHOLDER]`. No se inventa nada. |
| DOC-02 · Carta con **persona natural** | 🟡 Dice "sociedad identificada con NIT" y "representante legal" (A7-13). Dato correcto, tratamiento jurídico incorrecto. |

## Qué ya estaba verificado (2026-09-27, no repetido hoy)
DG-001 (el anexo de experiencia solo acredita contratos en requisitos que CUMPLEN), DG-002 (el cuerpo firmable no incluye notas internas ni la autoevaluación), DG-003 (las 7 declaraciones fácticas llevan `[CONFIRMAR]`, cada documento abre con "ANTES DE FIRMAR" y se pide confirmación al descargar).

## Pendientes
1. **Revisión legal** de los textos de las declaraciones (inhabilidades, juramento, sanciones, aportes): la app lo declara como plantilla orientativa; un abogado debe validarlos.
2. **A7-13:** distinguir persona natural de jurídica (el RUT ya trae el tipo de documento: `parsearRUT().tipoDocumento`).
3. **Consistencia entre documentos y proceso:** la carta toma entidad, modalidad, número y objeto del dato de SECOP. Con la fecha de cierre discutida (A7-10) conviene que ningún documento la imprima sin la fuente.
4. Los documentos **no** comprueban qué formatos exige el proceso concreto (los formatos oficiales varían por entidad): es una plantilla, no el formato del pliego. Está rotulado así en el pie de la carta.
