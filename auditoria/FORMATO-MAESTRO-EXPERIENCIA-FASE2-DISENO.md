# Formato Maestro de Experiencia — Fase 2: diseño

Fecha: 2026-10-07. Entregable: `plantillas/Formato_Maestro_Experiencia_BitacoraSECOP_v1.xlsx` (plantilla con listas desplegables, fórmulas, validaciones y tres ejemplos ficticios). Parte de la auditoría de la Fase 1 (`FORMATO-MAESTRO-EXPERIENCIA-FASE1-AUDITORIA.md`) y de sus ocho criterios.

## 1. Modelo de datos

```
SUJETOS (empresa o persona)  1 ──< PARTICIPACIONES >── 1  CONTRATOS  1 ──< UNSPSC
                                                                  └──< CANTIDADES
```

| Hoja | Una fila es… | Por qué existe |
|---|---|---|
| `SUJETOS` | una empresa o una persona natural | La experiencia de una persona es profesional y no debe sumarse a la de la empresa sin decidirlo (criterio 2) |
| `CONTRATOS` | un contrato real, **una sola vez** | Dos archivos con el mismo contrato (tres casos reales) eran tres contratos duplicados (criterio 1) |
| `PARTICIPACIONES` | la parte de un sujeto en un contrato | Porcentaje, forma de ejecución (individual, consorcio, unión temporal), cargo y certificación |
| `UNSPSC` | un código de 8 dígitos de un contrato | Pasa de "36 columnas" (Empresa D) o "bloques pegados" (Empresa C) a una lista que se puede cruzar con el pliego (criterio 6) |
| `CANTIDADES` | un ítem de obra con cantidad y unidad | Hoy es texto suelto; los pliegos a veces piden m², ml o m³ (criterio 6) |
| `RESUMEN` | una especialidad para el sujeto elegido | Vista de lectura: total por especialidad, sin contratos en ejecución |
| `LISTAS`, `SMMLV`, `CATALOGO_ENTIDADES` | un valor permitido | Fuente única de las listas desplegables (criterios 4 y 5) |

## 2. Diccionario de campos

Colores del encabezado en el libro: **rojo = obligatorio**, naranja = recomendado, gris = opcional, azul = calculado (no se escribe).

### CONTRATOS

| Campo | Nivel | Tipo / lista | Validación | Uso en el motor |
|---|---|---|---|---|
| ID_CONTRATO | Obligatorio | texto (C-0001) | único | Llave |
| NUMERO_CONTRATO | Obligatorio | texto (`S/N` si no tiene) | detecta duplicado con la entidad | Evita contar dos veces un contrato |
| ENTIDAD | Obligatorio | lista `CATALOGO_ENTIDADES` | aviso si no está en el catálogo | Experiencia con entidades públicas |
| TIPO_CLIENTE | Obligatorio | Público, Privado, Concesionario, Otro | lista | Algunos pliegos solo aceptan experiencia pública |
| OBJETO | Obligatorio | texto | no vacío | Coincidencia de palabras con el requisito |
| ESPECIALIDAD | Obligatorio | 22 valores | lista | Reemplaza el nombre de hoja de Persona B y Empresa C |
| TIPO_ACTIVIDAD | Recomendado | 7 valores (construcción, mantenimiento, …) | lista | Distingue construcción de mantenimiento |
| DEPARTAMENTO, MUNICIPIO | Recomendado | lista de 33 departamentos / texto | lista | Experiencia local o regional |
| FECHA_SUSCRIPCION | Opcional | fecha | 1990–2100 | — |
| FECHA_INICIO | Recomendado | fecha | 1990–2100 | Plazo. Solo recomendado: Empresa A no la trae |
| FECHA_TERMINACION | Obligatorio (salvo en ejecución) | fecha | 1990–2100; ≥ inicio | Antigüedad ("últimos N años") y año del SMMLV |
| ESTADO | Obligatorio | En ejecución, Terminado, Liquidado, Suspendido | lista | Un contrato en ejecución no acredita experiencia |
| FECHA_LIQUIDACION | Opcional | fecha | 1990–2100 | — |
| VALOR_INICIAL | Opcional | número (pesos) | ≥ 0 | — |
| VALOR_CONTRATO | Obligatorio | número (pesos, con adiciones) | ≥ 0, > 0 | Cuantía acreditada |
| VALOR_EJECUTADO | Recomendado (obligatorio si está en ejecución) | número | ≥ 0 | Saldo → Capacidad Residual |
| NUMERO_EN_RUP | Opcional | texto | — | Cruce con el RUP |
| SOPORTE | Recomendado | texto (nombre del documento) | — | Evidencia (no rutas de equipo) |
| INTERVENTOR, OBSERVACIONES | Opcional | texto | — | — |
| ORIGEN | Recomendado | texto (archivo › hoja › fila) | — | Trazabilidad |

Calculados: `PLAZO_MESES`, `ANO_SMMLV`, `SMMLV_DEL_ANO`, `VALOR_EN_SMMLV`, `VALOR_ACTUALIZADO`, `SALDO_PENDIENTE` y `ALERTAS`.

### PARTICIPACIONES

| Campo | Nivel | Validación |
|---|---|---|
| ID_CONTRATO, ID_SUJETO | Obligatorio | Listas de `CONTRATOS` y `SUJETOS` (aviso si no existen) |
| FORMA_EJECUCION | Obligatorio | Individual, Consorcio, Unión temporal, Otra |
| NOMBRE_FIGURA | Recomendado | Texto |
| PORCENTAJE | Obligatorio | 0,01 % a 100 %; la suma por contrato ≤ 100 %; individual = 100 % |
| ROL_EN_FIGURA | Opcional | Líder, Integrante |
| CARGO_PROFESIONAL | Opcional (alerta si el sujeto es persona) | Lista de 7 cargos |
| CERTIFICACION | Recomendado | Sí, Solicitada, Pendiente, No |
| EN_RUP, SOPORTE_PARTICIPACION | Recomendado / Opcional | Sí/No; texto |

Calculados: valor participado, SMMLV participados, valor actualizado participado, suma de porcentajes, especialidad y estado (traídos del contrato) y alertas.

### SUJETOS · UNSPSC · CANTIDADES

- **SUJETOS**: ID_SUJETO, TIPO (Empresa / Persona natural), NOMBRE y DOCUMENTO obligatorios; REGISTRO (RUP o matrícula), CUENTA_PARA y observaciones opcionales. `CUENTA_PARA` (solo personas) indica la empresa a la que se le cuenta la experiencia de esa persona (por ejemplo, su representante o socio); vacío significa que la experiencia es solo de la persona. Calcula nº de contratos y valor actualizado propios, y los "con vinculados" (propios + los de las personas que cuentan para el sujeto). Un contrato compartido no se cuenta dos veces: cada uno aporta solo su porcentaje. La hoja `RESUMEN` permite incluir o excluir a las personas vinculadas.
- **UNSPSC**: ID_CONTRATO y CODIGO_UNSPSC (8 dígitos, validado) obligatorios; descripción opcional; calcula segmento y familia.
- **CANTIDADES**: ID_CONTRATO, ITEM, CANTIDAD (≥ 0) y UNIDAD (m, ml, m², m³, km, un, kg, ton, global, otra) obligatorios.

## 3. Cálculos

- `PLAZO_MESES = (terminación − inicio) / 30,4375`.
- `ANO_SMMLV` = año de terminación; **vacío si está en ejecución** (no se convierte: no acredita).
- `VALOR_EN_SMMLV = VALOR_CONTRATO / SMMLV del año de terminación`.
- `VALOR_ACTUALIZADO = VALOR_EN_SMMLV × SMMLV del año de referencia` (celda `SMMLV!E2`, por defecto 2026). Un solo lugar para cambiar la referencia en todo el libro (en los archivos antiguos cada uno usaba una fecha distinta).
- Por participación: valor, SMMLV y valor actualizado × porcentaje.
- `SALDO_PENDIENTE = VALOR_CONTRATO − VALOR_EJECUTADO` solo en contratos en ejecución.

Verificado con datos reales de los archivos de origen: el valor actualizado por participación que calcula el formato coincide con el que traían los archivos (diferencias de centavos a pesos por el redondeo de SMMLV a dos decimales en los archivos antiguos; el formato calcula sin redondeo intermedio).

## 4. Qué se conserva, divide, normaliza y elimina

| Decisión | Campo de origen | Destino |
|---|---|---|
| **Divide** | `PRESENTACION` ("UNION TEMPORAL X (EMPRESA C 90% - PERSONA B 10%)") | FORMA_EJECUCION + NOMBRE_FIGURA + una fila de PARTICIPACIONES por integrante con su porcentaje |
| **Divide** | `CONTRATISTA` de Empresa A ("NOMBRE DE PERSONA/CONSORCIO X") | Sujeto + figura |
| **Divide** | `PLAZO` en texto de Empresa D ("6 MEses") | Fecha de inicio y terminación; el plazo se calcula |
| **Divide** | `CANTIDADES PRINCIPALES` (detalle / cantidad) | Filas de CANTIDADES con unidad |
| **Divide** | Columnas de códigos de Empresa D (≈36) y bloques de Empresa C | Filas de UNSPSC |
| **Convierte en campo** | Nombre de la hoja (ALCANTARILLADO, VIAS, ACUEDUCTO…) y AREA CONST./TIPO DE OBRA de Empresa D | ESPECIALIDAD y TIPO_ACTIVIDAD |
| **Convierte en campo** | `CARGO` de Empresa C | CARGO_PROFESIONAL (en PARTICIPACIONES) |
| **Normaliza** | Fechas (4 formatos, "En Ejecución") | Fecha real; "En Ejecución" pasa a ESTADO |
| **Normaliza** | Valores y porcentajes como texto | Número y porcentaje |
| **Normaliza** | Entidades | Catálogo (161 formas en los archivos); **sin unificar automáticamente**: "Gobernación de Santander" y "Gobernación de Norte de Santander" parecen iguales y no lo son |
| **Calcula (elimina la columna)** | VALOR PARTICIPACION, VALOR EN SMLMV, VALOR EN SMLMV SEGÚN %, AÑO 2026, SMMLV RUP, VALOR ACTUALIZADO, AÑO TERMINACIÓN | Fórmulas |
| **Elimina** | `#` consecutivo, hojas vacías (Hoja3, Hoja4, Hoja1 de Empresa D), celdas sueltas con el SMMLV | — |
| **Elimina (revisar)** | `VALOR FACTURADO Empresa D` | Se deriva de valor × porcentaje; si el archivo difiere, queda en OBSERVACIONES |
| **Reemplaza** | `LINK` (rutas `file:///D:/…`) | SOPORTE (nombre del documento) |
| **Conserva** | OBSERVACIONES, INTERVENTOR, CERTIFICACIÓN, FECHA DE LIQUIDACIÓN, NUMERO EN EL RUP | Campos opcionales o recomendados |

## 5. Listas desplegables (12)

Tipo de cliente, estado, forma de ejecución, rol en la figura, certificación, Sí/No, tipo de sujeto, cargo, especialidad (22), tipo de actividad (7), unidad (10) y departamento (33), más el catálogo de entidades y la tabla de SMMLV (1990–2026). Se agregan opciones nuevas en la hoja `LISTAS`.

## 6. Validaciones y alertas en el libro

Bloquean al escribir: fechas fuera de rango, valores negativos o con texto, porcentajes fuera de 0–100 %, código UNSPSC que no tenga 8 dígitos, valores fuera de las listas. Avisan (columna ALERTAS y celda rosa): campos obligatorios vacíos, terminación anterior al inicio, "en ejecución" con terminación vencida, contrato en ejecución sin valor ejecutado, posible duplicado (mismo número y entidad), contrato sin participaciones, porcentajes que suman más de 100 %, individual distinto de 100 %, consorcio con 100 %, participación repetida, persona natural sin cargo, y año sin SMMLV en la tabla.

Probado: se cargó un libro con datos defectuosos y todas las alertas aparecieron; los ejemplos reales dan cero errores de fórmula (recalculado con LibreOffice).

## 7. Cómo alimentará al motor (Fase 3, no implementada)

El importador de la app leerá este formato en lugar de adivinar columnas: `CONTRATOS`+`PARTICIPACIONES` reemplazan el arreglo plano de contratos (hoy `{objeto, contratante, valor, fechaFin, …}`), el porcentaje deja de ser un texto interpretado y los contratos `En ejecución` pasan directo a la Capacidad Residual. Los códigos UNSPSC y las cantidades habilitan requisitos que hoy no se pueden evaluar. Hasta entonces la app sigue leyendo los Excel antiguos como hoy.

## 8. Riesgos y decisiones pendientes

1. **SMMLV por verificar**: 1991, 1992, 2019, 2022, 2024 y 2025 están marcados "por verificar contra el decreto". Los demás años (1990, 1993–2018, 2020, 2021, 2023, 2026) coinciden con los valores implícitos en los archivos de experiencia. Detalle: en Empresa A, algunos contratos de 2022 a 2024 traen un SMMLV que no corresponde al año de terminación; conviene revisarlos.
2. **Año de conversión**: se usa el año de terminación, como hacen los archivos. Si la guía de la entidad o el RUP exige otro criterio (fecha de suscripción), se ajusta en `ANO_SMMLV`.
3. **Persona natural**: se registra aparte y solo cuenta para una empresa si se indica en `CUENTA_PARA` (decisión del usuario: la experiencia de las personas de uno de los archivos cuenta para su empresa). Cuando la app importe el formato, deberá respetar esa relación y permitir apagarla.
4. **Datos que llegarán incompletos**: 25 de las 56 filas de Empresa D (sin número, entidad ni fechas), algunas de Persona B y los contratos de Empresa D sin valor ejecutado. El formato no los inventa: salen con alertas.
5. **Entidades**: el catálogo (161 nombres de los archivos, con "posibles relacionadas") necesita una revisión humana antes de unificar.
6. **Ejemplos**: las tres filas de ejemplo de la plantilla son ficticias (el repositorio es público; los datos reales no se publican).
7. **Migración**: convertir los 324 registros de los cuatro archivos al formato es una tarea aparte (propuesta: script con revisión fila a fila de las alertas).
