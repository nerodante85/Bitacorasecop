# Guía de pruebas: empresas y pliegos ficticios

Sirve para comprobar, con datos inventados, que el análisis de pliegos da **CUMPLE / NO CUMPLE / NO DETERMINABLE** donde corresponde. Todo lo de esta carpeta es ficticio (empresas, NIT, contratos, entidades). Cada resultado de las tablas de abajo se verificó dos veces: con el motor real (prueba automática `tests/smoke.mjs`) y en un navegador real, subiendo el PDF a la app.

## ⚠️ Antes de empezar: no pises tus datos reales

**«Restaurar un respaldo» reemplaza TODO lo que tengas guardado** (empresas, experiencia, procesos, personal) y, si tienes la sesión iniciada, **también lo que está en tu cuenta**.

- Haz la prueba en una **ventana de incógnito** (o en otro navegador) **sin iniciar sesión**. Ahí no hay nada que pisar y al cerrarla se borra todo.
- Si la haces en tu navegador habitual, primero descarga tu respaldo: *Configuración y ayuda › Descargar respaldo*.

## Cómo probar (5 minutos)

1. Abre la app en una ventana de incógnito: https://nerodante85.github.io/Bitacorasecop/
2. **Configuración y ayuda › Restaurar un respaldo…** y elige `respaldo-empresas-ficticias.json`. Acepta el aviso; la página se recarga sola.
   Quedan cargadas **9 empresas ficticias** (con su experiencia), **4 profesionales** y **3 procesos ficticios** en *Mis procesos*.
3. **Empresa**: marca la casilla de la empresa que quieres probar (de una en una; para el consorcio, marca las dos).
4. **Mis procesos**: en «PRUEBA 1», «PRUEBA 2» o «PRUEBA 3» pulsa **Ver proceso**.
5. Sube el PDF que corresponde (`pliego-1-…`, `pliego-2-…` o `pliego-3-…`) y pulsa **Procesar documento**.
6. Compara el resultado con las tablas. Para probar otra empresa, vuelve al paso 3 y **sube el PDF otra vez** (la experiencia se evalúa al procesar el documento).

> Cada proceso ficticio trae su valor y cierre (cierra en ~6 meses desde la fecha en que se generaron los archivos, 24-oct-2026). Si cargas esto después de abril de 2027, vuelve a generarlos (último apartado).

## Pliego 1 · Pavimentación de vías urbanas (valor $5.000 M)

Exige: liquidez ≥ 1,5 · endeudamiento ≤ 0,60 · cobertura ≥ 2,0 · K residual ≥ $5.000 M · RUP con UNSPSC 72141000 · 2 contratos de construcción de vías urbanas en los últimos 10 años · director de obra ingeniero civil.

✓ cumple · ✗ no cumple · ? no determinable · ⚠ requiere verificación

| Empresa | Qué la hace especial | Liq. | Endeud. | Cobert. | K resid. | Capac. vs valor | UNSPSC | Exper. | Personal | **Resultado** |
|---|---|---|---|---|---|---|---|---|---|---|
| 01 Andina | Cumple todo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **GO** |
| 02 Frontera | Liquidez 1,0; endeudamiento 0,75; cobertura 1,2 | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | **NO-GO** |
| 03 Catatumbo | Solo 1 contrato dentro de 10 años (el otro es de hace 15) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | **NO-GO** |
| 04 Pamplona | Declara K de $6.000 M, pero tiene 2 contratos en ejecución (saldo $4.500 M): disponible $1.500 M | ✓ | ✓ | ✓ | ✗ | ⚠ | ✓ | ✓ | ✓ | **NO-GO** |
| 05 Sardinata | Su RUP está en otra actividad (81101500) | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | **NO-GO** |
| 06 Tibú | Datos dudosos: endeudamiento «45» (¿razón o %?), cobertura «INDETERMINADO», K en SMMLV, fechas ambiguas | ✓ | ? | ? | ? | ? | ✓ | ? | ✓ | **REVISAR** (nunca GO ni un CUMPLE inventado) |
| 07 Ocaña (sola) | 1 contrato de vías | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | **NO-GO** |
| 08 Ábrego (sola) | 1 contrato de vías | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | **NO-GO** |
| **07 + 08 marcadas juntas** | Consorcio: se suman sus contratos (2) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **GO** |
| 09 Nueva | Empresa sin ningún dato cargado | ? | ? | ? | ? | ? | ? (sin RUP cargado) | ? | ✓ (ver nota) | **REVISAR** (nada falla; falta cargar sus datos) |

**Personal.** El punto sale «cumple» aunque la empresa 09 no tenga datos, porque el equipo de trabajo es global (no pertenece a ninguna empresa). Los profesionales se cargan aparte de las empresas (son del equipo, no de cada empresa). Para ver el punto de Personal en «?», restaura `respaldo-sin-personal.json`: Andina pasa de GO a **REVISAR**.

## Pliego 2 · Puente vehicular, experiencia en SMMLV (valor $4.000 M)

Exige: liquidez ≥ 1,2 · endeudamiento ≤ 0,70 · 1 contrato de construcción de puentes vehiculares de **al menos 900 SMMLV**, en los últimos 10 años. El pliego manda convertir con el SMMLV del año de terminación del contrato.

| Empresa | Contrato de puente | En SMMLV | **Resultado** |
|---|---|---|---|
| 01 Andina | $1.500 M, hace 3 años | ≈ 1.293 SMMLV | **GO** (experiencia CUMPLE) |
| 02 Frontera | $600 M | ≈ 517 SMMLV (< 900) | **NO-GO** (experiencia NO CUMPLE, y además falla liquidez y endeudamiento) |
| 03 Catatumbo | $1.800 M pero de hace 15 años | fuera de la ventana de 10 años | **NO-GO** (experiencia NO CUMPLE) |
| 07 Ocaña | $3.000 M con **30 %** de participación | aporta $900 M ≈ 776 SMMLV (< 900) | **NO-GO** (experiencia NO CUMPLE) |
| 06 Tibú | $1.600 M **sin fecha de terminación** | no se puede convertir sin el año | **REVISAR** (experiencia NO DETERMINABLE) |
| 09 Nueva | no tiene contratos ni indicadores | — | **NO DETERMINABLE** |

Pamplona, Sardinata y Ábrego no tienen puentes: la experiencia queda **NO DETERMINABLE** (sin ningún contrato afín nunca se declara NO CUMPLE).

## Pliego 3 · Requisitos sin cifras

El pliego habla de «capacidad financiera suficiente» y «trayectoria adecuada», sin un solo número.

| Empresa | **Resultado** | Por qué |
|---|---|---|
| 01 Andina | **REVISAR** | Tiene K suficiente para el valor, pero no hay umbrales contra los cuales comparar |
| 06 Tibú, 09 Nueva | **NO DETERMINABLE** | No hay umbrales ni K utilizable: nada se puede afirmar |

## Importar la experiencia por tu cuenta (opcional)

El respaldo ya trae la experiencia cargada. Para probar los **importadores reales**:

- `experiencia-por-empresa/*.xlsx`: un Excel por empresa (*Empresa › Experiencia › subir Excel*, con esa empresa seleccionada). Debe dar lo mismo que el respaldo.
- `Formato_Maestro_ficticio.xlsx`: las 9 empresas en un solo libro; la app pregunta a qué sujeto corresponde la empresa. Casos incluidos:
  - Pamplona: 2 contratos **«En ejecución»** → no acreditan experiencia y pasan a *Capacidad Residual*.
  - Tibú: un contrato en estado **«Vigente»** (no se reconoce) → no acredita y se avisa.
  - Ocaña + Ábrego: un contrato en **consorcio sin porcentaje** → entra sin valor (no se adivina el reparto).

## Lo que estos archivos NO prueban

- **Rentabilidad del patrimonio / del activo**: el perfil no las guarda; cuando un pliego las pide, siempre salen NO DETERMINABLE.
- **Mipyme** (umbral distinto): el perfil no tiene ese dato.
- **Patrimonio, capital de trabajo y garantías como puntos de decisión**: sin IA solo aparecen en la tabla «Requisitos habilitantes»; no cambian el GO / NO-GO.
- **«Extraer requisitos con IA»**: necesita sesión y crédito. Con esa ruta el GO es muy difícil de alcanzar (siempre quedan filas por verificar).
- **Lectura de PDF escaneados (OCR / IA)**: estos PDF son de texto digital.

## Notas sobre el comportamiento del motor (para que decidas)

1. **Empresa sin RUP cargado (ajustado).** Si el pliego pide un código UNSPSC y la empresa no tiene **ningún** código cargado, el punto sale **NO DETERMINABLE** («cárgalos desde el RUP»), no NO CUMPLE. Una empresa con códigos de OTRA actividad (Sardinata) sí sale NO CUMPLE.
2. **El texto del requisito importa.** Un requisito escrito «contratos *ejecutados y terminados* de construcción de vías…» deja la experiencia en NO DETERMINABLE, porque «ejecutados» y «terminados» se exigen como palabras del objeto del contrato. Es conservador (no da CUMPLE de más), pero puede parecer rígido.
3. **Personal nunca da NO CUMPLE**: solo «cumple» o «por verificar», y basta una palabra en común entre el requisito y el perfil del profesional.
4. **La experiencia no se recalcula sola** al cambiar de empresa después de procesar el pliego: por eso hay que subir el PDF otra vez (paso 6).

## Regenerar los archivos

```
node ejemplos/pruebas-pliegos/generar.mjs            # fechas relativas a hoy
node ejemplos/pruebas-pliegos/generar.mjs 2026-10-24 # fecha fija (la que usan las pruebas)
```

Las empresas, contratos y textos de los pliegos viven en `escenarios.mjs`. `node tests/smoke.mjs` comprueba que cada resultado de estas tablas sigue siendo el que da el motor.
