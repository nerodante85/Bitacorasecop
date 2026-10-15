# Reauditoría — Bitácora SECOP · 2026-10-15

**Estado resultante: BETA CONTROLADA. RA2-1 y RA2-2 (HIGH) quedaron corregidos el mismo día (MG-013 y MG-014, con 8 mutaciones detectadas); siguen abiertos RA2-3 a RA2-7 (2 MEDIUM, 3 LOW).**
Estado anterior: BETA CONTROLADA (2026-09-27). Alcance: lo construido desde la reauditoría anterior
(`magnitudes.js`, Formato Maestro, capacidad residual, tarjeta «Decisión», sincronización por elemento) más
seguridad de la base real y fuentes en vivo.

**Primera ejecución: solo se inspeccionó y se probó. No se modificó ningún archivo del producto.**
Los bancos de prueba quedan en `auditoria/banco-adversarial-2026-10-15/` (se ejecutan con `node <archivo>.cjs`).

## 1. Método y evidencia

| Qué se hizo | Estado | Resultado |
|---|---|---|
| Asesores de seguridad de Supabase (proyecto real) | VERIFICADO | 1 hallazgo útil (RA2-7), el resto INFO |
| Políticas RLS de las 7 tablas + bucket `pliegos` | VERIFICADO | Todas aíslan por `company_members`; bucket privado, solo PDF, 25 MB |
| Banco adversarial de `Magnitudes` (35 casos) | VERIFICADO (ejecutado) | 4 casos dan CUMPLE falso → RA2-1, RA2-2 |
| Banco adversarial de `resumenDecision` (9 casos) | VERIFICADO (ejecutado) | 6 casos dan GO con una contradicción → RA2-3 |
| Importador del Formato Maestro (estados, números, fechas, porcentajes) | VERIFICADO (ejecutado) | RA2-4, RA2-5 |
| SECOP II en vivo con las consultas de la app (S2-001) | VERIFICADO | acueducto 59/59, pavimento 18/18, alcantarillado 52 vs 51 del servidor (la app trae uno más: coincide en otros campos) |
| Pruebas del proyecto | VERIFICADO | smoke 486 ok; el único fallo local es el SRI de los CDN (sin red). CI verde en `main` |

## 2. Hallazgos nuevos

| ID | Sev. | Hallazgo | Confianza | Estado |
|---|---|---|---|---|
| RA2-1 | **HIGH** | `Magnitudes` suma ítems que pueden ser el MISMO tubo: «Suministro de tubería PVC 8"» 600 ml + «Instalación de tubería PVC 8"» 600 ml = 1.200 ml → **CUMPLE** para una exigencia de 1.000,5 ml. Lo mismo con una fila «TOTAL tubería…» que repite el subtotal, y con la misma fila importada dos veces | Alta (ejecutado) | **CORREGIDO 2026-10-15** (MG-013, 8 mutaciones detectadas) |
| RA2-2 | **HIGH** | Cuentan ítems que no son obra instalada: «Retiro de tubería PVC 8" existente» 1.200 ml → **CUMPLE**; «Excavación para pozo de inspección» **40 m³** → **CUMPLE** para «19 pozos» (la unidad de conteo no se valida: m³ se toma como unidades) | Alta (ejecutado) | **CORREGIDO 2026-10-15** (MG-014) |
| RA2-3 | MEDIUM | `resumenDecision` esconde contradicciones: dos filas con el mismo nombre (CUMPLE y NO CUMPLE) se reducen a la primera; una fila de la matriz con el mismo «concepto» que la ficha se descarta (ficha «Patrimonio» CUMPLE oculta «Rentabilidad del patrimonio» NO CUMPLE; ficha «Liquidez» CUMPLE oculta la de la matriz NO CUMPLE); con 0 requisitos y veredicto GO devuelve GO. Defensa en profundidad: el veredicto de entrada ya sale de los gates, así que hace falta una inconsistencia previa para que se vea | Media (ejecutado con entradas construidas; alcance real INFERIDO) | ABIERTO |
| RA2-4 | MEDIUM | El importador del Formato Maestro decide «en ejecución» por **lista negra**: solo `En ejecución` y `Suspendido` impiden acreditar. «Vigente», «Activo», «En curso», «Caducado», «Terminado anticipadamente», «en ejecución.» (con punto) o vacío ACREDITAN. Atenuantes: la plantilla trae lista desplegable, y un contrato con terminación futura no cuenta para el mínimo | Alta (ejecutado) | ABIERTO |
| RA2-5 | LOW | `fechaISO('2024-02-30')` acepta una fecha inexistente; `porcentaje(1)` vale 100 % (convención de Excel, pero 1 % escrito como `1` se sobrestima); `numero('-5')` devuelve −5 (los valores ≤ 0 se descartan después, pero la función base no lo hace) | Alta | ABIERTO |
| RA2-6 | LOW | Una cantidad escrita como texto «1.000» se lee como 1 (el módulo ignora la marca `ambiguo`): da NO CUMPLE falso, no CUMPLE falso. Solo ocurre si la celda es texto; con números de Excel no pasa | Alta | ABIERTO |
| RA2-7 | LOW | `public.handle_new_user()` (función de disparador, `SECURITY DEFINER`) tiene `EXECUTE` para `anon` y `authenticated` por la API REST. Una función de disparador no se puede invocar como RPC, por lo que no es explotable; aun así conviene revocar el permiso. Además: protección contra contraseñas filtradas desactivada (función de plan de pago) y `pg_net` en el esquema `public` | Media (el no poder invocarla es INFERIDO, no se probó) | ABIERTO |

INFO (intencional, sin acción): `ai_usage` y `digest_runs` tienen RLS sin políticas, es decir, cerradas al navegador; solo las toca la clave de servicio.

### Reproducción
- RA2-1 y RA2-2: `node auditoria/banco-adversarial-2026-10-15/mag.cjs` (casos A4, A5, A6, A12, B3 con `FALLA`).
- RA2-3: `node auditoria/banco-adversarial-2026-10-15/dec.cjs` (E1–E5).
- RA2-4: `node auditoria/banco-adversarial-2026-10-15/fm2.cjs`.
- RA2-5: `node auditoria/banco-adversarial-2026-10-15/fm.cjs`.
- Fuente en vivo: `node auditoria/banco-adversarial-2026-10-15/live.cjs` (necesita red).

### Impacto
RA2-1/2: la fila de magnitud sale CUMPLE aunque el contrato no alcance, y el principio del producto es «nunca inventar un CUMPLE». Atenuantes reales: solo ocurre cuando la empresa cargó cantidades en la hoja CANTIDADES, el detalle cita los ítems usados y el texto pide verificar contra el acta final. Aun así, quien lee solo el sello se lleva un CUMPLE falso.

### Corrección propuesta y criterio de aceptación
| ID | Corrección | Criterio de aceptación |
|---|---|---|
| RA2-1 | Descartar filas TOTAL/SUBTOTAL y filas idénticas (mismo ítem, cantidad y unidad) dentro de un contrato; cuando un ítem de «Suministro» y otro de «Instalación» coinciden en material y diámetro, no sumarlos: tomar el mayor y dejar el contrato para confirmar (mismo criterio que ya se usa para las capas de vía) | A4, A5, A6 → NO DETERMINABLE o NO CUMPLE; A1 sigue CUMPLE |
| RA2-2 | Excluir verbos de retiro, desmonte, demolición, reposición y excavación; para conteo (pozos, conexiones) exigir unidad de conteo (und, un, pozo) y descartar m, m², m³ | A12 y B3 → NO DETERMINABLE; B1, B4 siguen CUMPLE |
| RA2-3 | No deduplicar por nombre sin comparar estado: si dos filas del mismo nombre o concepto discrepan, conservar la peor; con 0 requisitos devolver NO DETERMINABLE | E1–E5 → no GO |
| RA2-4 | Lista blanca: solo estados reconocidos como terminados acreditan; vacío o desconocido → no acredita y se avisa | `Vigente`, `Activo`, vacío → no acreditan; `Terminado`, `Liquidado` sí |
| RA2-5/6 | Validar el calendario real, descartar negativos en `numero`, y tratar como ambiguo el texto «1.000» sin coma | Casos de `fm.cjs` y A8 |
| RA2-7 | `REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;` (una sentencia, ya que el disparador corre con el dueño) | El asesor deja de listar el aviso |

Cada corrección se hace con la prueba primero y se verifica por mutación, como pide `CLAUDE.md`.

## 3. Estado de los bloqueadores anteriores

Sin cambios respecto a `RELEASE-BLOCKERS.md`. En esta pasada se confirmó de nuevo S2-001 en vivo y que RLS aísla las tablas.

## 4. NO VERIFICADO

1. Comportamiento del modelo real ante texto malicioso dentro de un PDF (IA-007): requiere crédito y un PDF de prueba.
2. Correos de registro y recuperación con un remitente propio (depende del dominio de Resend, pospuesto).
3. Sincronización con dos dispositivos reales y restauración de un backup de Supabase.
4. Safari/iOS y lectores de pantalla reales.
5. Texto legal de `privacidad.html` y de las declaraciones de la carta y el paquete: requieren abogado.
6. Cuánto de RA2-3 es alcanzable en el producto real: se probó con entradas construidas a mano, no con un pliego que genere esa inconsistencia.
7. Qué parte del universo de pliegos CCE escribe sus exigencias de forma que `parsearExigencia` las lea: se usaron frases del propio `tests/smoke.mjs`, no pliegos nuevos.

## 5. Decisión de estado

**BETA CONTROLADA.** No hay bloqueadores CRITICAL. Los dos HIGH (RA2-1 y RA2-2) se corrigieron con la prueba primero y verificación por mutación; la fila de magnitud sigue siendo orientativa (se calcula con las cantidades que carga la empresa). Quedan RA2-3 a RA2-7, de menor severidad.
