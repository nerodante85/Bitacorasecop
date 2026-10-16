# Auditoría independiente: extracción determinista de la ficha habilitante (2026-10-16)

Alcance: `fichaHabilitante` y auxiliares (index.html), `extraerKResidualUmbral`, `parseValorUnidad`, `cruceFichaEmpresa`, `magnitudes.js`.
Método: arnés de `tests/smoke.mjs` copiado a este directorio (`h.mjs`, `lib.mjs`) y textos adversariales ejecutados de verdad (`t1.mjs` … `t17.mjs`, reproducibles con `node tN.mjs`). No se modificó nada del repo. No hay PDFs en el repo (`find *.pdf` vacío), así que las entradas son textos sintéticos con el estilo de las pruebas FIN_REAL_/PERSONAL_REAL_/PDFJS_. La frecuencia real de cada redacción es INFERIDA; el comportamiento del código es VERIFICADO.

Resumen: 5 HIGH, 5 MEDIUM, 2 LOW, 2 INFO. Causa raíz más rentable: la ficha usa un `num()` local (index.html:8159) en vez de `parseNumCO`, y varias lecturas "primer número después de la etiqueta" sin cortar por oración.

## HIGH

### FI2-1 HIGH — Decimales con punto (1.5, 0.70, 2.0) se leen ×10 / ×100 en indicadores y en la luz del puente
- Evidencia: VERIFICADO (t1.mjs, t9.mjs, t4.mjs). Ubicación: index.html:8159 (`num`), usado en :8383 (Matriz 2), :8398-8410 (tabla directa) y :8278 (luz del puente). `parseNumCO` (coincidencia.js:13) sí lo hace bien.
- Repro: `INDICADOR PARÁMETRO EXIGIDO Índice de liquidez ≥ 1.5 Índice de endeudamiento ≤ 0.70 Razón de cobertura de intereses ≥ 2.0` con perfil {liquidez 2.0, endeudamiento 0.8, cobertura 3}.
- Salida: `dato.demas.v` = 15 / 70 / 20. Cruce: liquidez "NO CUMPLE (Exigido ≥ 15)", cobertura "NO CUMPLE (≥ 20)", endeudamiento 0.8 ≤ 70 "CUMPLE" (debía NO CUMPLE). Además dispara el aviso "liquidez de 1.5 es inusualmente alta" y una observación redactada a la entidad pidiendo confirmar un valor "muy superior al habitual". En Matriz 2 con "≥1.3 ≥1.4": 13 → "NO DETERMINABLE" falso. Luz de puente "45.5 metros" → 455 m (mínimo 227,5 m en vez de 22,75 m).
- Esperado: 1,5 / 0,70 / 2,0 y ninguna alarma.
- Impacto: falso NO CUMPLE y falso CUMPLE mostrados como dato; carta de observaciones errónea. Los pliegos copiados de Excel con punto decimal son comunes.
- Corrección: reemplazar `num` por `parseNumCO` (dentro de la ficha las cifras de 3 decimales exactos no aparecen en índices; para "1.500" ambiguo, devolver null). Añadir prueba con "1.5", "0.70".
- Confianza: alta (código) / media-alta (frecuencia).

### FI2-2 HIGH — Endeudamiento en porcentaje ("≤ 70%") se guarda como 70 y se compara contra la razón del perfil
- Evidencia: VERIFICADO (t1.mjs caso "endeud %"). Ubicación: index.html:8398 (regex OP ignora el `%`), cruce en :8056 (`pasa(mio, op, u.v)`).
- Repro: `INDICADOR PARÁMETRO EXIGIDO … Índice de endeudamiento ≤ 70% …`, perfil endeudamiento 0,8 (80%).
- Salida: fila "≤ 70" (sin %), cruce **CUMPLE** ("Exigido: demás ≤ 70"). Correcto: 0,8 > 0,7 → NO CUMPLE.
- Impacto: falso CUMPLE (la clase más grave) en un caso muy realista (endeudamiento en % es la forma habitual del RUP).
- Corrección: capturar `%` opcional tras el número; si hay `%`, guardar v/100 y mostrar "70%"; si endeudamiento > 5 sin `%`, no cruzar (como ya hace `compararIndiceConUmbral`, index.html:9807).
- Confianza: alta.

### FI2-3 HIGH — Capital de trabajo: se ignora la cifra/fórmula del propio documento y se aplica 33% o la tabla de apalancamiento CCE
- Evidencia: VERIFICADO (t3.mjs). Ubicación: index.html:8317-8330 (`mCt` solo exige la frase "capital de trabajo demandado").
- Repro A: `… capital de trabajo demandado será igual al cuarenta por ciento (40%) del presupuesto oficial`, plazo 4 meses, PO $3.185.389.625 → ficha: "33% del presupuesto oficial (plazo menor de 12 meses) = $1.051.178.576" (correcto con 40%: $1.274.155.850).
- Repro B: `Capital de trabajo demandado: 15% del presupuesto oficial`, plazo 18 meses, PO $6.000 M → ficha "Presupuesto ÷ plazo × 4 meses = $1.333.333.333" (correcto: $900.000.000).
- Impacto: el valor entra al cruce con la empresa (`dato.clave='capitalTrabajo'`) y se muestra como lo que exige el pliego. Solo hay aviso si el texto trae las dos fórmulas CCE.
- Corrección: calcular solo si el texto contiene la fórmula CCE (`CTd =` / "meses de apalancamiento") y, si el texto trae otro porcentaje junto a "capital de trabajo", no calcular y avisar.
- Confianza: alta (código) / media (frecuencia: la frase "demandado" es de documentos tipo, pero otras entidades la copian con otros porcentajes).

### FI2-4 HIGH — Anticipo: cualquier "No se otorgará anticipo…" (aunque sea "…por un valor superior al 30%", otro contrato o una condición) se toma como "no hay anticipo"
- Evidencia: VERIFICADO (t3.mjs, t8.mjs). Ubicación: index.html:8252 (`sinAnticipo`), efectos en :8317 (CT), :8345 (K/CRPC), :8300 (fila Anticipo).
- Repro: `… No se otorgará anticipo por un valor superior al treinta por ciento (30%) del valor del contrato.` y `… No se entregará anticipo hasta tanto el contratista presente el plan de inversión… El anticipo será del 30%.` y obra con anticipo 30% + frase "en el contrato de interventoría no se otorgará anticipo".
- Salida: fila "Anticipo: No hay anticipo ni pago anticipado", K = presupuesto completo ($6.000 M) y CT calculado. Correcto: hay anticipo; K = POE − anticipo; CT/K no calculables sin su valor.
- Impacto: dato falso afirmativo ("no hay anticipo") y cifras derivadas erróneas. `conAnticipo` solo se usa si `sinAnticipo` es falso, así que la contradicción no se avisa.
- Corrección: exigir que la negación cierre la oración (`no se otorgará anticipo\s*(?:ni|[.;,]|$)`), y si el documento también contiene "anticipo del N%"/"anticipo equivalente", tratarlo como contradicción: no calcular y avisar.
- Confianza: alta.

### FI2-5 HIGH — Responsabilidad civil extracontractual: se toma el umbral del tramo ("1.500 SMMLV") como valor asegurado
- Evidencia: VERIFICADO (t6.mjs, t7.mjs). Ubicación: index.html:8643 (primer `N SMMLV` de la ventana; solo se saltan "deducible|franquicia|tope máximo|superiores a").
- Repro: `Responsabilidad civil extracontractual: para contratos cuyo valor sea inferior a 1.500 SMMLV, el valor asegurado será de 200 SMMLV.` y la variante tabla `hasta 1.500 SMMLV: 200 SMMLV; entre 1.501 y 2.500: 300…`.
- Salida: "Garantía de responsabilidad civil extracontractual | 1500 SMMLV". Correcto: 200 SMMLV (o la tabla de tramos sin elegir).
- Impacto: dato 7,5 veces mayor al real, presentado sin aviso. La redacción por tramos es la del Decreto 1082.
- Corrección: descartar números precedidos de "inferior/menor/hasta/superior/mayor/entre … a" o seguidos de "…,"/":"; con más de una cifra SMMLV en la ventana, listar todas ("tramos") sin elegir.
- Confianza: alta.

### FI2-6 HIGH — Personal por tabla con el cargo ANTES de sus datos (orden por filas): años y contratos se desplazan un cargo
- Evidencia: VERIFICADO (t10.mjs). Ubicación: index.html:8446-8462 (`seg = ventana.slice(desde, mc.i)` asigna a cada cargo lo que está ANTES de su nombre).
- Repro: `Requisitos del personal CARGO FORMACIÓN … General Específica DIRECTOR DE OBRA Ingeniero civil (5) años (2) contratos RESIDENTE DE OBRA Ingeniero civil (3) años (1) contratos INSPECTOR DE OBRA Tecnólogo (2) años (1) contratos`.
- Salida: Director "ver la tabla"; Residente "2 contratos · 5 años" (del Director); Inspector "1 contrato · 3 años" (del Residente). Los datos del último cargo se pierden.
- Impacto: años/contratos equivocados por cargo. Solo hay un aviso genérico de "confirma contra el original". Correcto en el layout de los anexos CCE validados (celda del cargo centrada verticalmente, así los datos preceden al nombre), pero CLAUDE.md ya documenta que pdf.js entrega las tablas por filas y otros documentos alinean el cargo arriba.
- Corrección: si queda texto con `(N) años|contratos` después del último cargo (señal de que el orden es cargo→datos), no asignar nada (o asignar hacia adelante solo con prueba real). Verificar con un PDF top-aligned.
- Confianza: alta (código), media (frecuencia).

### FI2-7 HIGH — Magnitudes: rango "≥ 8\" y ≤ 12\"" ignora el máximo → CUMPLE con tubería de 24"
- Evidencia: VERIFICADO (t17.mjs). Ubicación: magnitudes.js:178 (`md`) y :181 (solo el patrón "entre X y Y" llena `diametroMaxPulg`).
- Repro: exigencia `… longitud de tubería de 800,5 ml el cual corresponde a PVC con diámetro mayor o igual a 8" y menor o igual a 12"`, contrato con `Tubería PVC alcantarillado Ø24" 1500 ml`.
- Salida: **CUMPLE** (diametroMax = null). Con "entre 8" y 12"" correctamente no cuenta.
- Impacto: falso CUMPLE en experiencia específica.
- Corrección: leer "menor/igual o inferior a N"" y "máximo de N"" en `diametroMaxPulg`; si el texto contiene "menor", "máximo", "inferior" y no se leyó máximo, devolver NO DETERMINABLE.
- Confianza: alta (código), media (frecuencia).

## MEDIUM

### FI2-8 MEDIUM — Presupuesto tomado de un monto derivado ("10% del presupuesto oficial, es decir $318.538.962")
- Evidencia: VERIFICADO (t2.mjs, t3.mjs). Ubicación: index.html:8177 (`rePO`: primer `$` ≥ 50 M tras "presupuesto oficial" dentro de 360 caracteres).
- Repro: texto con "valor estimado del contrato $3.185.389.625" y "garantía de seriedad … 10% del presupuesto oficial, es decir $318.538.962" → "Presupuesto oficial $318.538.962 (181,9 SMMLV)" y arrastra CT, patrimonio y K. Si además aparece el presupuesto real junto a "presupuesto oficial", la ficha no da ninguno y avisa "grupos o fases" (seguro, pero diagnóstico equivocado).
- Corrección: excluir montos precedidos por "% del", "es decir", "equivalente a" dentro de la ventana; priorizar la tabla 1.1.
- Confianza: alta (código), baja-media (frecuencia, requiere que el presupuesto real no esté escrito junto a "presupuesto oficial").

### FI2-9 MEDIUM — Plazo: toma el primer "(N) meses" aunque haya fases o suma de etapas
- Evidencia: VERIFICADO (t2.mjs "plazo fases"). Ubicación: index.html:8211.
- Repro: `El plazo de ejecución del contrato será de TRES (3) MESES para la fase de preconstrucción y NUEVE (9) MESES para la fase de construcción` → "3 meses" y CT al 33% (plazo < 12); correcto 12 meses. Tampoco compara palabra y número ("CUATRO (5) MESES" pasa) como sí hace la ruta de la tabla 1.1 (:8227). Plazos en semanas o días sueltos no producen fila ni aviso (seguro).
- Corrección: si tras el primer "(N) meses" hay otro "(M) meses" dentro de 150 caracteres sin "prórroga", no dar plazo y avisar; validar palabra=número.
- Confianza: alta (código), media (frecuencia).

### FI2-10 MEDIUM — Decimales partidos por pdf.js ("0,0 3", "1,0 5") se truncan en los indicadores
- Evidencia: VERIFICADO con entrada sintética (t11.mjs); el comentario de `cifrasCandidatas` (index.html:9601) afirma que el fenómeno ocurre en PDF reales. Ubicación: index.html:8398 (no aplica el parche `(\d,0)\s+(\d)`).
- Salida: "Rentabilidad ≥ 0,0" (por 0,03/0,06); "Liquidez ≥ 1,0" (por 1,05) y cruce CUMPLE con perfil 1,02.
- Corrección: aplicar el mismo parche de `cifrasCandidatas` antes de leer indicadores; o NO DETERMINABLE cuando el número va seguido de un dígito suelto.
- Confianza: media (frecuencia no medida en PDF reales).

### FI2-11 MEDIUM — Garantía con base equivocada: "100% del valor del anticipo" se muestra como "100% del valor del contrato"
- Evidencia: VERIFICADO (t5.mjs "amparo cumplimiento tras buen manejo"). Ubicación: index.html:8654 (`cola` = 100 caracteres sin cortar en el fin de la oración; `bCto` se activa con "valor del contrato" de la frase siguiente).
- Salida: "Garantía de buen manejo y correcta inversión del anticipo | 100% del valor del contrato" (correcto: 100% del valor del anticipo).
- Corrección: cortar `cola` en el primer `.`/`;`/mención de otra garantía; si la cola dice "del anticipo", usar esa base.
- Confianza: alta (código).

### FI2-12 MEDIUM — Magnitudes: toma el ÚLTIMO "N ml" de la frase como exigencia aunque sea el total del proyecto
- Evidencia: VERIFICADO (t17.mjs "total despues"). Ubicación: magnitudes.js:158 (`ultimaCifra`).
- Repro: `… longitud de tubería mayor o igual a 965,21 ml, de un total de 1.930,42 ml en el proyecto…` → cifra 1.930,42 → contrato de 1.000 ml da **NO CUMPLE** (correcto: CUMPLE). Dirección conservadora (no es falso CUMPLE), pero afirma NO CUMPLE sin que sea cierto. Si la frase trae "(50%)" y total, el control cruzado lo atrapa (probado: devuelve NO DETERMINABLE).
- Corrección: si hay más de una cifra en ml con operadores distintos, NO DETERMINABLE salvo que el control cruzado la confirme.
- Confianza: media.

## LOW / INFO

- FI2-13 LOW: `SMMLV` de conversión usa `new Date().getFullYear()` (index.html:11813 `fichaHabilitanteDe`, :11838) y no el año del proceso; un pliego de dic-2025 analizado en 2026 se convierte con el SMMLV 2026 (el año sí se muestra en la fila). También decide Rango 1/2 (poSmmlv < 40000) en el límite. VERIFICADO (lectura). Corrección: usar el año de publicación del proceso cuando se conozca.
- FI2-14 LOW: `unoPctPresupuestoDeTexto` (index.html:6717) ancla al primer "por lo menos el N% del valor del presupuesto oficial" tras "por lo menos uno (1) de los contratos"; en "uno ≥ 50% del presupuesto oficial …, el restante por lo menos el 20% del valor del presupuesto oficial" devuelve 20% (t12.mjs). Redacción poco común. VERIFICADO.
- FI2-15 INFO: `parseValorUnidad` (index.html:7494) devuelve el MÁXIMO de todos los números del texto: "Mínimo 500 SMMLV (50% del presupuesto de 1.000 SMMLV)" → 1000; "suma ≥ 2.000 SMMLV y cada contrato ≥ 300 SMMLV" → 2000 (el requisito sale con `acumulable` y `porContrato` a la vez). Fuera del núcleo de la ficha; el efecto en `evaluarRequisito` no se midió (INFERIDO). Sobrestima el mínimo (error hacia NO CUMPLE/ND, no hacia CUMPLE).
- FI2-16 INFO: `fichaHabilitanteDe` (index.html:11813) fusiona pliego y estudio previo por nombre de requisito: gana el pliego y una discrepancia entre ambos documentos (otro presupuesto, otro plazo) no se avisa. INFERIDO.

## Controles que sí funcionan (con evidencia)
- Varios presupuestos (obra + interventoría): no elige ninguno y avisa (t2.mjs).
- Operadores ASCII (`>=`, `<=`) y "Mayor o igual a": no producen fila o dan NO DETERMINABLE "operador no reconocido", nunca un valor (t1.mjs).
- Tabla Matriz 2 con coma decimal: rango, Mipyme y "cumples solo uno" correctos (t9.mjs).
- CTd con tres rangos de presupuesto: lee el porcentaje del rango correcto (t3.mjs).
- K fijado por el documento con cifra: contrasta o usa la fuente, "veces", "%" y "millones" se interpretan sin confundir con pesos (t4.mjs); varios montos distintos → conflicto.
- Garantías: amparos con cifra en columnas separadas → "cifra no asociada" en lugar de adivinar; seriedad exige base presupuesto oficial; RC "200 SMMLV para contratos cuyo valor…" correcta (t5.mjs).
- `parseValorUnidad`: "1,500 SMMLV" → null (ambiguo), negativos y años/leyes ignorados (t13.mjs).
- Magnitudes: sin diámetro mínimo o material leído → NO DETERMINABLE; "entre 8" y 12"" respeta el máximo; cifra con separador de miles ambiguo → NO DETERMINABLE; incoherencia % vs total → NO DETERMINABLE (t16.mjs, t17.mjs).
- Plazos en días/semanas o redacciones no reconocidas: sin fila (ni dato falso) (t2.mjs).

## Archivos de reproducción
`/tmp/claude-0/-home-user-Bitacorasecop/2b019993-22e8-5ec0-ac23-67e936083858/scratchpad/auditor-ficha/` (`h.mjs` arnés, `lib.mjs`, `t1.mjs`…`t17.mjs`, `INFORME.md`).
