# Auditoría enfocada: velocidad, eficiencia y confianza en la lectura de Pliegos/Estudios Previos

**Alcance pedido por el usuario:** "la velocidad y eficiencia de la lectura de los documentos PDF de
pliego de condiciones y de estudios previos... me preocupa la demora y la poca confianza del sistema
que se usa para leer los documentos y extraer la información importante de los requisitos
habilitantes."

**Método:** inspección directa del código real (`index.html`, `supabase/functions/extraer-requisitos/
index.ts`, `supabase/functions/transcribir-pdf/index.ts`) y de `CLAUDE.md` (histórico de pruebas reales
ya documentadas). **No se modificó ningún archivo de la aplicación en esta pasada** — primera auditoría,
solo inspección/documentación (regla 20 del protocolo de auditoría). No se ejecutaron extracciones
reales con crédito de Anthropic en esta sesión; donde la evidencia viene de pruebas anteriores ya
documentadas en `CLAUDE.md`, se cita explícitamente.

Cadena de evidencia reconstruida para el flujo auditado:

**PDF subido → ¿tiene texto real? → extractPdfText / ocrPdfPages / transcribirPaginasConIA (por tandas)
→ texto acumulado en `entry` → (opcional) "Extraer requisitos con IA" recorta el PDF a páginas
"relevantes" calculadas sobre ESE texto acumulado → Edge Function lee el PDF (recortado o completo)
como imagen → requisitos con cita y página → verificación cliente contra el texto real → tabla de
"Requisitos habilitantes" en pantalla.**

---

## Hallazgo 1 — El aviso "lee el documento completo de una sola vez" es falso en el caso que más importa

**Severidad: HIGH** · **Estado de la evidencia: VERIFICADO** (lectura directa del código; no reproducido
con una extracción real en esta sesión, pero la lógica es inequívoca)

**Evidencia:**
- `index.html:9318-9319` — cuando un documento se está leyendo por OCR o por IA en tandas y **todavía
  quedan páginas sin leer** (`entry.pagesRead < entry.numPages`) y aún no se ha usado "Extraer
  requisitos con IA" (`!entry.requisitosIA`), aparece esta nota exacta:
  > 💡 Si solo necesitas la tabla de requisitos habilitantes, no hace falta seguir leyendo aquí — usa
  > "Extraer requisitos con IA" (arriba, en "Requisitos habilitantes"), **que lee el documento completo
  > de una sola vez**.
- Pero `extraerRequisitosConIA` (`index.html:11267`) calcula qué páginas mandarle a la IA así:
  ```js
  const paginasRelevantes = paginasRelevantesParaIA(entry);
  ```
  y `paginasRelevantesParaIA` (`index.html:6336-6355`) busca sus anclas (`TRIGGERS_PAGINAS_IA`,
  `index.html:6308-6325`) **sobre `textoPliegoDe(entry)`** — es decir, sobre el texto que el cliente YA
  leyó hasta ese momento (`entry.text`/`entry.ocrText`, acotado por `entry.pagesRead`), no sobre el PDF
  completo. Si encuentra 4 o más páginas con alguna mención, devuelve solo esas páginas (±1,
  `MARGEN_PAGINAS_IA`); si no, devuelve `null` y ahí sí se manda el PDF completo.
- El servidor (`supabase/functions/extraer-requisitos/index.ts:74-82`) recorta el PDF a exactamente esa
  lista de páginas (`recortarPdfAPaginas`) salvo que la lista cubra ≥90% del documento o esté vacía.

**Consecuencia real:** en un documento largo leído solo parcialmente (el escenario exacto en el que
aparece la nota: "todavía quedan páginas sin leer"), las páginas que la IA puede llegar a ver están
limitadas a las que YA aparecieron en el texto parcial ya leído. Cualquier sección del pliego que esté
**más allá de la última página leída** (ej. una matriz de experiencia en la página 60 de un documento de
112, cuando solo se han leído 8 u 15) **nunca puede ser detectada por el filtro de páginas relevantes**,
porque ese texto todavía no existe en `entry` — y por lo tanto nunca llega a mandarse a la IA, aunque el
usuario crea (por la propia nota de la app) que "se lee el documento completo de una sola vez".

Esto no es un caso límite raro: es precisamente el escenario que la nota señala como el momento correcto
para usar la función ("no hace falta seguir leyendo aquí... lee el documento completo"), y encaja
directamente con la preocupación del usuario sobre la **confianza** en la extracción de requisitos
habilitantes — la app puede reportar con total normalidad "N requisitos extraídos, con sus tokens de
entrada/salida" sin que exista ninguna señal de que el recorte dejó fuera, en silencio, páginas enteras
del documento real.

**Mitigantes parciales que SÍ existen** (reducen pero no eliminan el riesgo):
- Si el heurístico encuentra menos de 4 páginas (`MIN_PAGINAS_FILTRO_IA`), no recorta — manda el PDF
  completo. Un documento muy corto o con pocas menciones detectables cae aquí.
- Si el recorte cubriría ≥90% del documento, el servidor lo ignora y manda todo (`index.ts:82`).
- El encabezado de la tarjeta sí muestra "`pagesRead`/`numPages` páginas leídas" justo arriba del bloque
  de requisitos de IA (`index.html:9267`) — un usuario atento podría notar que el número no es 100%,
  pero nada conecta explícitamente ese dato con "por eso la tabla de abajo puede estar incompleta".
- El disclaimer de "lectura parcial" (`lecturaParcial()`, `index.html:9150-9153`) sí existe y es
  correcto en su propio ámbito (el VEREDICTO general), pero se renderiza **después** del bloque de
  requisitos de IA (`index.html:9281` vs. `9150`, dentro de `compatHtml`) — es decir, el usuario ve
  primero la tabla de requisitos de IA (sin advertencia propia) y varias secciones más abajo recién
  aparece el aviso de lectura parcial, ya desconectado visualmente de esa tabla.

**Reproducción (sin gastar crédito real):**
1. En consola del navegador, con un `entry` sembrado a mano con `pagesRead: 8`, `numPages: 112`,
   `viaIA: true`, y un `ocrText` de prueba que mencione "garantía de seriedad" en la página 3 pero NO
   mencione nada de "experiencia"/"capacidad financiera" (porque esas secciones reales del documento
   viven en páginas 40-90, nunca leídas): `paginasRelevantesParaIA(entry)` devuelve como máximo las
   páginas cercanas a esa única mención — nunca las páginas 40-90, porque ese texto no existe en
   `entry.ocrText` todavía.
2. Confirmar contra el propio código que `extraerRequisitosConIA` no compara `entry.pagesRead` contra
   `entry.numPages` en ningún punto antes de invocar la función — no hay gate que bloquee o advierta.

**Corrección propuesta** (no aplicada en esta pasada):
- Cambiar el texto de la nota para que sea honesto sobre su propio límite: algo como *"usa 'Extraer
  requisitos con IA' — lee el PDF original completo como imagen (no reutiliza este texto parcial) SOLO
  si el documento es corto o el filtro de páginas no encuentra suficientes zonas relevantes en lo ya
  leído; si el pliego es largo y vas pocas páginas, termina de leerlo primero o esta tabla puede quedar
  incompleta sin avisarte."* — o, mejor aún, que `paginasRelevantesParaIA` devuelva explícitamente un
  indicador de "posible truncado" cuando `entry.pagesRead < entry.numPages` Y el heurístico sí encontró
  páginas (en vez de "null" o "manda todo"), para que `bloqueRequisitosIAHtml` pueda mostrar su propio
  aviso, junto a la tabla, no varias pantallas más abajo.
- Alternativa más simple: no activar el recorte por páginas en absoluto mientras
  `entry.pagesRead < entry.numPages` — en ese caso, mandar siempre el PDF completo (perdiendo el ahorro
  de tiempo/costo, pero garantizando que "lee el documento completo" sea cierto cuando se promete).

**Criterio de aceptación:** con un documento sembrado donde el filtro de páginas detecta menos del 100%
de las páginas del documento, la UI debe mostrar explícitamente cuántas páginas del PDF original
realmente se mandaron a la IA (no solo cuántas había en total), en el mismo bloque donde se muestra la
tabla de requisitos.

---

## Hallazgo 2 — "Leer con IA" (transcripción) no muestra tokens/costo, a diferencia de "Extraer requisitos con IA"

**Severidad: MEDIUM** · **Estado de la evidencia: VERIFICADO**

**Evidencia:**
- La Edge Function `transcribir-pdf` SÍ calcula y guarda el uso real (`supabase/functions/
  transcribir-pdf/index.ts:269-273`, `uso: { input_tokens, output_tokens }` en la respuesta, línea 311).
- El cliente (`transcribirPaginasConIA`, `index.html:4349`) recibe esa respuesta pero la descarta:
  ```js
  return { text: data.text, numPages: data.numPages, pagesRead: data.pagesRead, paginaOffsets: data.paginaOffsets || [] };
  ```
  `data.uso`/`data.modelo` nunca llegan a `autoLeerConIA` ni a ningún lugar de la interfaz.
- En cambio, `extraerRequisitosConIA` SÍ expone esto al usuario (`bloqueRequisitosIAHtml`,
  `index.html:9005`): *"N requisitos extraído(s) por IA · X tokens de entrada / Y de salida"*.

**Consecuencia real:** mientras el usuario espera "Leer todo el documento con IA" (que puede ser hasta
~14 tandas para un documento de 112 páginas, cada tanda tardando hasta ~140 s según el timeout
configurado — `TIMEOUT_ANTHROPIC_MS` en `transcribir-pdf/index.ts:49`), no tiene ninguna señal de cuánto
está costando ni cuán "pesada" resultó cada tanda — justo la preocupación de "poca confianza" que
plantea el usuario: no hay transparencia sobre el trabajo que la IA está haciendo en el camino más caro
y más lento de los tres disponibles (texto normal, OCR, IA).

**Reproducción:** leer el código de `transcribirPaginasConIA`/`autoLeerConIA` confirma que `uso`/`modelo`
nunca se propagan; no requiere ejecución real para confirmarlo.

**Corrección propuesta:** propagar `uso`/`modelo` igual que ya hace `extraerRequisitosConIA`, y
acumularlo en `entry` (ej. `entry.transcripcionUso = { input_tokens, output_tokens }` sumado por tanda)
para mostrar un total visible, igual que ya se hace para la extracción de requisitos.

---

## Hallazgo 3 — Sin exclusión mutua entre "Leer todo el documento con IA" y "Extraer requisitos con IA" para el mismo proceso

**Severidad: MEDIUM** · **Estado de la evidencia: PARCIALMENTE VERIFICADO** (confirmado por lectura de
código; no reproducido en vivo por no requerir gasto de crédito real para confirmarlo con certeza)

**Evidencia:**
- `autoLeerConIA(id, slot)` (`index.html:4363`) se protege contra sí mismo con
  `iaAutoLeerCancelado[id]`, pero esa bandera solo decide si el propio bucle debe detenerse, no si
  puede arrancar mientras otra operación larga está en curso.
- `extraerRequisitosConIA(id, slot)` (`index.html:11225`) se protege con una bandera DISTINTA,
  `iaEnCurso[id]` (`index.html:11229`): *"Ya hay una extracción en curso para este proceso; espera a que
  termine."*
- Ninguna de las dos funciones consulta la bandera de la otra. Nada impide que un usuario dispare
  "Leer todo el documento con IA" (bucle de varios minutos) y, mientras corre, haga clic en "Extraer
  requisitos con IA" para el mismo proceso — ambas llamarían a Anthropic en paralelo, usando ambas el
  mismo cupo diario de la empresa (`ai_usage`, compartido entre las dos funciones) y pudiendo competir
  por llegar primero a escribir sobre `analisis[id]`.
- Mitigante real que sí existe: `extraerRequisitosConIA` relee `analisis[id]` justo antes de escribir su
  resultado (`const actual = analisis[id] || entry;`, `index.html:11347`, con el comentario explícito
  *"durante 1-2 minutos el usuario pudo re-analizar el pliego... guardar el entry capturado al inicio
  pisaría ese análisis nuevo con el viejo"*) — esto reduce el riesgo de que una sobrescriba por completo
  el progreso de la otra, pero no evita el gasto duplicado de cupo/costo ni la confusión de ver dos
  indicadores de carga simultáneos sin relación entre sí.

**Consecuencia real:** en el peor caso, dos operaciones de IA de pago corriendo en paralelo sobre el
mismo documento, consumiendo el cupo diario (10 extracciones o 40 tandas según la función,
`LIMITE_DIARIO` en cada Edge Function) más rápido de lo que el usuario esperaría, sin ningún mensaje que
le diga "ya hay una lectura con IA en curso para este proceso, espera a que termine antes de extraer
requisitos".

**Corrección propuesta:** una sola bandera compartida por proceso (`iaOperacionEnCurso[id]`) que ambas
funciones revisen antes de arrancar, con un mensaje único.

---

## Hallazgo 4 — Cero instrumentación de tiempo: no hay forma de saber objetivamente si una lectura es lenta

**Severidad: MEDIUM (observabilidad)** · **Estado de la evidencia: VERIFICADO**

**Evidencia:** una búsqueda de `performance.now()`, `console.time`, o cualquier medición de duración
alrededor de `extractPdfText`, `ocrPdfPages`, `transcribirPaginasConIA` o `extraerRequisitosConIA` en
`index.html` no encuentra ningún resultado. Del lado del servidor, ninguna de las dos Edge Functions
(`extraer-requisitos`, `transcribir-pdf`) registra cuánto tardó la llamada a Anthropic más allá de
compararla contra el timeout fijo para decidir si abortar.

**Consecuencia real:** toda la evidencia de velocidad que existe hoy sobre este sistema es anecdótica —
un puñado de pruebas manuales documentadas en `CLAUDE.md` con tiempos aproximados ("~60 s", "~80 s",
"130-145 s agotando el tiempo") de **unos pocos documentos reales probados una sola vez cada uno**. No
hay manera de distinguir, para un usuario que reporta "se demora mucho", si ese caso puntual es normal
para el tamaño/tipo de su documento o una regresión real — ni para el propio equipo de desarrollo, sin
pedirle al usuario que describa manualmente cuánto tardó.

**Esto es, en sí mismo, la raíz más probable de la "poca confianza"** que menciona el usuario: sin datos,
cualquier demora se siente arbitraria, y no hay manera de verificar si mejoró o empeoró entre una sesión
y otra salvo por percepción subjetiva.

**Corrección propuesta:** agregar al menos duración (`Date.now()` antes/después) a:
- `entry.transcripcionUso`/`entry.ocrDuracionMs` (cliente) por cada tanda de OCR/IA.
- un campo de duración en `ai_usage` (servidor, ambas Edge Functions) — ya existe la tabla y se
  actualiza con tokens; agregar `duration_ms` es un cambio pequeño sobre una tabla que ya se escribe.
Con eso, una consulta simple a `ai_usage` respondería objetivamente "¿cuánto tarda en promedio leer un
pliego de N páginas por este camino?", en vez de depender de memoria de pruebas puntuales.

---

## Hallazgo 5 — El umbral "¿parece escaneado?" solo mira las primeras 40 páginas (TEXT_BATCH_PAGES)

**Severidad: LOW** · **Estado de la evidencia: INFERIDO** (plausible por lectura de código; no se ha
encontrado ni reproducido con un documento real que presente este patrón exacto)

**Evidencia:** `extractPdfText(file, TEXT_BATCH_PAGES)` (`index.html:11685`) lee como máximo las primeras
40 páginas en el primer intento; si el texto resultante tiene menos de 200 caracteres
(`index.html:11686`), la app concluye "parece escaneado" y ofrece OCR/IA. Un documento con una portada,
índice o páginas de separación de baja densidad de texto en esas primeras 40 páginas (plausible en un
Pliego o Estudio Previo largo, con anexos al inicio) podría cruzar ese umbral aunque el cuerpo real del
documento (después de la página 40) sí tenga texto extraíble normal — empujando innecesariamente al
usuario hacia el camino más lento/costoso (OCR o IA) para un documento que en realidad no lo necesitaba.

**Corrección propuesta:** si las primeras 40 páginas dan <200 caracteres, probar una muestra más allá
(ej. 5 páginas alrededor de la mitad del documento) antes de concluir "escaneado" — mismo principio ya
aplicado en otras partes del proyecto de "no decidir con una muestra que puede no ser representativa".

---

## Hallazgo 6 — La velocidad real de OCR (Tesseract) en producción sigue sin medirse

**Severidad: INFO** · **Estado de la evidencia: DESCONOCIDO**

El propio `CLAUDE.md` documenta explícitamente que la única vez que se intentó cronometrar OCR, el
entorno de pruebas resultó "muchísimo más lento de lo normal" y la medición se descartó como no
representativa. No existe, en ningún documento del proyecto, un tiempo real de OCR por página medido en
producción (navegador real del usuario). Esto es relevante porque OCR sigue siendo la ÚNICA vía sin costo
monetario para pliegos escaneados — si en la práctica es tan lento que nadie la usa de verdad, los únicos
caminos viables para esos documentos pasan a ser de pago (IA), lo cual cambia la propuesta de valor del
producto sin que eso se haya decidido explícitamente.

**No es una corrección de código — es una brecha de evidencia.** Recomendación: la próxima vez que el
usuario (o alguien con un documento real) use "Intentar con OCR" en producción, registrar cuánto tardó
(aunque sea manualmente, hasta que exista el Hallazgo 4) para tener al menos un dato real de referencia.

---

## Hallazgo 7 — `autoLeerConIA` repite el análisis regex completo después de CADA tanda, no solo al final

**Severidad: INFO** · **Estado de la evidencia: VERIFICADO**

**Evidencia:** dentro del `while` de `autoLeerConIA` (`index.html:4397-4403`), cada iteración (hasta ~14
para un documento de 112 páginas) vuelve a ejecutar `analizarTexto`, `compararConPerfiles`,
`detectarRedFlags` y `calcularViabilidad` sobre el texto acumulado COMPLETO hasta ese punto, aunque el
usuario no vea ese resultado intermedio (el `slot` muestra solo el indicador de progreso de la tanda
siguiente). Solo al salir del `while` se llama a `evaluarExperienciaDeProceso` (la función más pesada,
que sí corre una sola vez al final, correctamente).

**Impacto real:** bajo — son operaciones de regex sobre texto, del orden de milisegundos incluso con
documentos grandes, insignificante frente a los 1-2 minutos de espera por cada llamada a la IA. Se
documenta como mejora de limpieza, no como causa real de la demora percibida por el usuario.

**Corrección propuesta:** mover esas 4 llamadas fuera del `while`, ejecutarlas una sola vez al terminar
el bucle completo (como ya se hace con `evaluarExperienciaDeProceso`).

---

## Lo que SÍ funciona bien (verificado, no solo supuesto)

Para no sesgar el informe solo hacia problemas — esto se revisó explícitamente y se confirmó correcto:

- **La verificación de citas (`verificarFilaIA`) es sólida**: exige coincidencia exacta o aproximada de
  la cita contra el texto real del PDF (verificado con `extractPdfText(archivo_original, 400)`, hasta
  400 páginas — independiente de cuánto se haya "leído" para el análisis), rechaza cifras que no
  aparecen en la cita, rechaza mínimos no positivos (protección contra texto inyectado), y nunca deja
  pasar una fila sin cita o con cita demasiado corta sin marcarla "sin verificar". Esto es
  estructuralmente distinto del Hallazgo 1 (que es sobre qué páginas se le MANDAN a la IA, no sobre
  cómo se verifica lo que devuelve).
- **El remapeo de páginas tras el recorte server-side es correcto**: `recortarPdfAPaginas` guarda el
  mapa posición-en-el-recorte → página real, y la función lo aplica antes de responder — las citas que
  SÍ llegan traen la página real del documento original, no la del PDF recortado.
- **Reserva de cupo antes de gastar**: ambas Edge Functions reservan el cupo diario (`ai_usage`) ANTES
  de llamar a Anthropic, no después — evita que peticiones paralelas se cuelen contando "0 usadas" en
  todas a la vez (hallazgo de una auditoría anterior, ya corregido y confirmado en el código actual).
- **Veredicto nunca es GO con lectura parcial**: confirmado en `auditoria/RELEASE-BLOCKERS.md` (RT-007)
  y en el propio código (`lecturaParcial`) — el problema del Hallazgo 1 es específico de la tabla de
  "Requisitos habilitantes (IA)", no del veredicto GO/NO-GO general, que sí está protegido.

---

## Resumen priorizado

| ID | Hallazgo | Severidad | Confianza |
|---|---|---|---|
| PDF-01 | "Extraer requisitos con IA" puede no leer el documento completo pese a decirlo, en pliegos largos leídos solo en parte | **HIGH** | Verificado |
| PDF-02 | "Leer con IA" no muestra tokens/costo (a diferencia de "Extraer requisitos") | MEDIUM | Verificado |
| PDF-03 | Sin exclusión mutua entre las dos operaciones de IA del mismo proceso | MEDIUM | Parcialmente verificado |
| PDF-04 | Cero instrumentación de tiempo (cliente y servidor) | MEDIUM | Verificado |
| PDF-05 | Umbral "¿escaneado?" solo mira las primeras 40 páginas | LOW | Inferido |
| PDF-06 | Velocidad real de OCR en producción, nunca medida | INFO | Desconocido |
| PDF-07 | Reanálisis regex repetido en cada tanda de `autoLeerConIA` | INFO | Verificado |

**Ninguno de estos hallazgos se corrigió en esta pasada** (primera auditoría: inspeccionar y documentar,
no modificar). Cuando decidas qué atacar primero, dime el orden y lo implemento uno por uno, verificando
cada uno por separado antes de pasar al siguiente — igual que el resto de este proyecto.
