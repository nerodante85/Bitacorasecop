# Formato Maestro de Experiencia — Fase 1: auditoría de los cuatro archivos

Fecha: 2026-10-07. Fuente: los cuatro Excel cargados por el usuario, leídos completos (todas las hojas, celdas combinadas y formatos). Cifras calculadas con SheetJS; "contrato" = fila con un objeto de contrato.

## 1. Resumen

| | Empresa A | Persona B | Empresa C | Empresa D |
|---|---|---|---|---|
| Archivo | archivo de Empresa A (.xlsx) | archivo de Persona B (.xls) | archivo de Empresa C (.xlsx) | archivo de Empresa D (.xls) |
| Quién es | Constructora (RUP); el contratista de muchas filas es una persona natural | **Persona natural** (ingeniera civil): "experiencia profesional", casi todo en consorcios y uniones temporales | Constructora; incluye una hoja de **otra persona** (otra persona natural) y una de **contratos vigentes** | Constructora (obras civiles, vías, redes eléctricas y de gas) |
| Hojas | 4 (2 con datos, 2 vacías) | 19 (una por especialidad) | 8 (una por especialidad + "Hoja1" + "vigentes") | 2 (1 con datos, 1 con 3 cifras sueltas) |
| Contratos (filas) | 176 | 80 | 12 | 56 |
| Columnas de datos | 12 | 12 a 15 según hoja | 11 a 14 según hoja | 28, más ~36 columnas de códigos UNSPSC |
| Cómo se organiza | Una sola lista plana, sin clasificación | Por especialidad (el nombre de la hoja es el dato) | Por especialidad (el nombre de la hoja es el dato) | Una sola lista, con área y tipo de obra |
| Encabezado | Fila 5 (hoja 1) y fila 1 (hoja 2) | Fila 9 en todas las hojas | Fila 6 a 9 según hoja | Fila 4 |

Total: **324 filas de contrato en 4 archivos y 33 hojas**. Cada archivo tiene una estructura distinta; ninguna columna se llama igual en los cuatro.

## 2. Qué dato trae cada archivo (matriz de conceptos)

✓ = lo trae (con su llenado); — = no lo trae.

| Concepto | Empresa A | Persona B | Empresa C | Empresa D |
|---|---|---|---|---|
| Número de contrato | ✓ 100 % | ✓ (6 de 9 en una hoja) | ✓ (vacío en 1) | ✓ 31/56 |
| Objeto | ✓ | ✓ | ✓ | ✓ |
| Entidad contratante | ✓ | ✓ | ✓ | 31/56 |
| Quién ejecutó / cómo se presentó | CONTRATISTA (a veces "persona/CONSORCIO X") | PRESENTACION (texto con los integrantes entre paréntesis) | PRESENTACION | CONTRATISTA + FORMA DE EJECUCIÓN (Individual 23 / Consorcio 7) |
| Valor del contrato | ✓ | ✓ | ✓ | ✓ |
| % de participación | ✓ 100 % | ✓ | ✓ | 30/56 |
| Valor según participación | ✓ (calculado) | dentro del "actualizado" | — | — |
| Valor en SMMLV | ✓ | ✓ ("SMMLV RUP") | ✓ | 25/56 |
| Valor actualizado (a 2026 / a 2013 / otro año) | "AÑO 2026" | "VALOR CONTRATO Actualizado (Según % Participación)" | ídem (en un caso "a 2013") | VALOR ACTUALIZADO 25/56 |
| Fecha de inicio | — | ✓ | ✓ | 27/56 |
| Fecha de terminación | ✓ | ✓ | ✓ | 26/56 (incluye "En Ejecución") |
| Plazo | — | PERIODO (MESES) | PERIODO (MESES) | PLAZO en texto ("6 MEses", "60 Dias") 28/56 |
| Fecha de suscripción | — | — | — | ✓ 27/56 |
| Fecha de liquidación | — | — | — | ✓ 13/56 |
| Valor ejecutado / facturado | — | — | — | ✓ 25/56 y 30/56 |
| Estado | — | — | hoja "vigentes" | ESTADO 23/56 (Liquidado, Terminado) |
| Especialidad / tipo de obra | **no tiene** | nombre de la hoja (19 valores) | nombre de la hoja (8) | AREA CONST. y TIPO DE OBRA (30/56) |
| Número del contrato dentro del RUP | — | ✓ (con vacíos) | ✓ | NUMERO EN EL RUP 25/56 ("NO ESTA INCLUIDO" en algunos) |
| Códigos UNSPSC del contrato | — | — | bloques pegados bajo la fila del contrato | ~36 columnas por segmento (8 contratos marcados) |
| Cantidades principales de obra | — | en algunas hojas (alcantarillado: 9 columnas de ítems) | "CANTIDADES PRINCIPALES: detalle y cantidad" | — |
| Cargo del profesional (director, residente…) | — | a veces aparece en la columna del valor | CARGO | — |
| Certificación | — | — | — | ✓ ("X", "SOLICITADA", "PENDIENTE") |
| Interventor | — | — | — | 2/56 |
| Enlace al soporte | — | — | — | LINK 16/56, rutas locales `file:///D:/…` |
| Observaciones | — | — | — | 8/56 |

## 3. Campos calculados (no son datos de entrada)

- **SMMLV del contrato** = valor del contrato ÷ salario mínimo del año de terminación (Empresa A, Persona B, Empresa C, Empresa D).
- **Valor actualizado** = SMMLV × salario mínimo vigente de la fecha de referencia (en los cuatro archivos aparece `1.750.905` en una celda suelta; es el SMMLV 2026). Se verificó con la columna "AÑO 2026" de Empresa A: SMMLV × 1.750.905 da exactamente ese valor.
- **Valor según participación** = valor × % (Empresa A). En Persona B/Empresa C el "actualizado según %" ya combina SMMLV, salario vigente y porcentaje (SMMLV × 1.750.905 × porcentaje).
- **Año de terminación** (Empresa D) = año de la fecha de terminación.
- **Periodo en meses** = fecha de terminación − fecha de inicio (a veces con decimales: 10,5; 15,73).

Consecuencia: el formato maestro debe guardar los datos de entrada y **calcular** estos valores; hoy cada archivo los digita a mano y la fecha de referencia del salario es distinta en cada uno (2013, 2019, 2026).

## 4. Problemas de calidad de datos (con ejemplos reales)

1. **Fechas en cuatro formatos**: número de serie con formato m/d/aa ("12/2/94" es 2 de diciembre, no el 12 de febrero), `1/04/1996` (ambiguo), texto en español ("4 DE JUNIO DE 2014", "22 DE ENERO DE2024") y texto en la columna de fecha ("En Ejecución").
2. **Valores como texto**: `$ 000,000,000`, `0,000,000,000.00`, `$ -`. En Persona B, siete filas traen **"Constructor"**, "Contratista" o "Residente de obra" en la columna del valor y el monto en la columna siguiente (desplazamiento de columnas por mezclar experiencia de persona y de empresa).
3. **Porcentajes como texto** ("60%", "100.0%") y vacíos en Empresa D (26 de 56).
4. **Entidades escritas de varias formas**: ALCALDIA DE CUCUTA / ALCALDIA DE SAN JOSE DE CUCUTA / SECRETARIA DE INFRAESTRUCTURA MUNICIPIO DE CUCUTA / "ALCADIA MUNICIPAL"; errores como "SAN JSOE DE CUCUTA".
5. **Contratista y forma de presentación mezclados** en un texto libre: "CONSORCIO X (NOMBRE DE LA PERSONA …)". Los integrantes y sus porcentajes no están separados.
6. **Duplicados dentro de un mismo archivo**: 5 en Empresa A (mismo número y entidad), 1 en Persona B; 8 números repetidos en total.
7. **Datos incompletos**: Empresa D tiene 25 de 56 filas sin número de contrato, entidad ni fechas (solo objeto y valor); Persona B tiene filas de polideportivos sin entidad ni fechas.
8. **Hoja con encabezado doble** (CANTIDADES PRINCIPALES → Detalle/Cantidad; CARGO 1/2) y celdas combinadas (hasta 68 en una hoja).
9. **Referencias inútiles fuera del equipo del usuario**: LINK `file:///D:/Users/Dorian/...`; observaciones tipo "ACTUALIZAR VALOR DE SALARIOS MÍNIMOS".

## 5. Cruces entre archivos (hallazgo importante)

Tres contratos aparecen **en más de un archivo con la misma identidad pero distinto porcentaje**, porque cada empresa o persona es integrante de la misma unión temporal o consorcio:

| Contrato | Archivo A | Archivo B | Observación |
|---|---|---|---|
| Contrato 1 (centro de integración ciudadana) | Persona B 5 % | Empresa C 45 % | El valor difiere en unos pesos entre archivos: error de digitación |
| Contrato 2 (aula y batería sanitaria) | Persona B 10 % | Empresa C 90 % | Suman 100 % |
| Contrato 3 (intersección vial) | Empresa A 5 % | Persona B 10 % | Mismo valor en ambos archivos |

El contrato es **una sola cosa**; lo que cambia por archivo es la **participación** de cada integrante. El formato maestro no debería repetir el contrato por empresa.

## 6. Información que aparece solo en un archivo (y por qué puede valer)

- **Códigos UNSPSC por contrato** (Empresa D, Empresa C): permiten comparar con los códigos que pide un pliego. Aparecen como columnas por segmento o como bloques pegados.
- **Cantidades principales** (Persona B, Empresa C): los pliegos exigen a veces cantidades (m² de pavimento, ml de tubería). Hoy solo hay texto suelto.
- **Cargo del profesional** (Empresa C): sirve para experiencia del equipo de trabajo.
- **Fecha de liquidación, valor ejecutado/facturado, estado, certificación** (Empresa D): distinguen contrato terminado, liquidado, en ejecución y con soporte; la app ya usa "En Ejecución" para no acreditar experiencia.
- **Contratos vigentes** (hoja "vigentes" de Empresa C): alimentan la capacidad residual (SCE), que acabamos de construir.
- **Experiencia de personas** (Persona B entera, "Hoja1" de Empresa C): es experiencia **profesional**, no de la empresa; no debe sumarse como experiencia de la empresa sin saberlo.
- **Especialidad** (nombre de hoja en Persona B/Empresa C): se pierde al aplanar si no se vuelve un campo.

## 7. Lectura de la app hoy frente a estos archivos

La app ya lee las cuatro con fechas reales y "En Ejecución"; reconoce 169 + 80 + 12 + 56 contratos, pero **descarta** especialidad, cantidades, cargo, estado, códigos UNSPSC por contrato, entidad normalizada y la distinción entre contrato y participación. Por eso no puede cruzar hoy "experiencia en acueductos" o "m² de pavimento" salvo por texto del objeto.

## 8. Implicaciones preliminares para el diseño (aún no es el formato)

1. Separar **Contrato** (único) de **Participación** (por empresa o persona, con %).
2. Separar **Sujeto de la experiencia**: empresa o persona natural.
3. Guardar fechas ISO y valores numéricos; calcular SMMLV y valor actualizado con una **fecha de referencia explícita**.
4. Convertir en listas: estado, tipo de cliente, forma de ejecución (individual / consorcio / unión temporal), especialidad, tipo de obra, certificación.
5. Normalizar entidades (catálogo) y detectar duplicados por número + entidad + valor.
6. Conservar códigos UNSPSC y cantidades como campos estructurados (lista y pares detalle/cantidad/unidad).
7. Marcar el origen de cada fila (archivo, hoja, fila) para poder volver al Excel original.

## 9. Pendiente

El mensaje recibido llegó cortado en la lista de la Fase 1 ("… campos duplicados; campos calculados;"), así que **no tengo las fases siguientes** del encargo (diseño del formato, listas, obligatorios, migración, integración con el motor). Esta auditoría cubre la Fase 1 completa; el diseño espera el resto del encargo o la confirmación del usuario de seguir con el plan de la sección 8.
