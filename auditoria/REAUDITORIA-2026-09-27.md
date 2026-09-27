# Reauditoría — Bitácora SECOP · 2026-09-27

**Estado resultante: BETA CONTROLADA (condicionada).** No es candidata a lanzamiento general.
Estado anterior: BLOQUEADO (2026-09-26). Alcance: verificar de forma independiente lo corregido en las
rondas anteriores y buscar fallos nuevos, con pruebas adversariales escritas aparte de las pruebas
del proyecto. Sin cambiar la regla de honestidad: lo que no se pudo ejecutar figura como NO VERIFICADO.

## 1. Método y evidencia

| Qué se hizo | Resultado |
|---|---|
| Pruebas del proyecto (`node tests/smoke.mjs`) | 193/193 en verde tras las correcciones de esta reauditoría |
| Mutaciones (romper el código a propósito y comprobar que alguna prueba falla) | 100 % de las correcciones de esta reauditoría detectadas (una redundante: hay dos patrones que cubren lo mismo) |
| Banco adversarial nuevo (`/tmp/re`, fuera del repo): lectura de cifras (27 casos), motor de experiencia (26 casos), verificación de citas de IA (11), inyección de instrucciones (6), garantías (5), veredicto e índices | Hallazgos abajo |
| Consulta en vivo a SECOP II con las mismas consultas de la app (S2-001) | Sigue trayendo procesos vigentes (4 abiertos para "pavimentación" hoy; 300 recientes) |
| SECOP I por entidad (SI-001), medido en la fase anterior | INVIAS 800 filas en 1,9 s; Gobernación N. de Santander 800 de la entidad correcta |
| Autenticación real (SEG-001) | `mailer_autoconfirm: false` (2 lecturas); mínimo de contraseña 8 (ajustado por la persona responsable, no visible desde fuera) |
| Borrado de cuenta real (PRIV-002) | Probado por la persona responsable con una cuenta desechable: descarga y eliminación correctas |
| Búsqueda de secretos en archivos versionados y en el historial | Ninguno (la anon key de Supabase y el App Token de Socrata son públicos por diseño) |
| CSP | Sin `unsafe-eval`; `connect-src` con el host exacto de Supabase; `frame-src`, `object-src`, `base-uri`, `form-action` en `none` |
| Interfaz a 375 px (Inicio, Buscar, estado vacío con embudo, modal de registro) | 0 px de desborde, 0 controles sin nombre accesible, 0 errores de consola |

## 2. Hallazgos nuevos de esta reauditoría (todos corregidos y con prueba)

| ID | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| RA-1 | **HIGH** (puede dar un CUMPLE falso) | Un mínimo escrito con miles en espacio se leía mal: `1 200 000 000` valía **200**, así que un contrato de $5M "cumplía" un mínimo de $1.200M | Se unen los grupos de 3 dígitos separados por espacio |
| RA-2 | **HIGH** (CUMPLE falso) | `$1.500 M` / `500 MM` / `20 K` se leían como 1500 / 500 / 20 pesos: subestimaba el mínimo | Abreviaturas ambiguas se descartan → NO DETERMINABLE |
| RA-3 | MEDIUM | Participación en consorcio dudosa: `0` o `>100` contaba el contrato entero (sobrestima) y `0,3` valía 0,3 % (subestima) | Valores ≤1 sin "%" , 0 o >100 → no verificable (NO DETERMINABLE) |
| RA-4 | MEDIUM | Obligatoriedad: "No es posible considerarlo opcional" → opcional; "no es complementario ni alternativo" → alternativo; "ninguno de los siguientes" → alternativo (contenía "uno de los siguientes") | Negación en una ventana de 40 caracteres y límites de palabra |
| RA-5 | LOW | "100 mts2" no bloqueaba el CUMPLE automático | Unidad ampliada |
| RA-6 | LOW | Un veredicto sin ningún gate daba GO; una garantía de 0,5 % en contratos >1.000.000 SMMLV (excepción del propio decreto) daba alerta alta | REVISAR sin gates; la excepción no alerta |
| RA-7 | LOW | Inyección: "Estimado asistente de IA…" no se detectaba y "instrucciones anteriores del proponente" daba falso positivo | Patrón afinado |

Observado y dejado a propósito: "reconstrucción" cuenta como "construcción" (no se penaliza un contrato sin verbo
contradictorio); es una decisión de recall documentada en MC-008.

## 3. Estado de los bloqueadores de la auditoría original

- **Corregidos y verificados con evidencia propia:** S2-001/002/003, MC-001…MC-015, RT-001…RT-007, RT-014,
  IA-001…IA-010 (en lo que no depende del modelo real), TR-001…TR-003, TR-007/008, SI-001 (parcial)/SI-002,
  DG-001…DG-003, UX-001…UX-005, SEG-001, SEG-003…SEG-005, PRIV-002, REL-001, OPS-008, ARQ-002.
- **Parciales:** SI-001 (entidades como la Alcaldía de Medellín no se identifican en SECOP I; se avisa),
  PERF-005 (libera texto, no migra a IndexedDB), ARQ-003 (avisa el fallo, sigue "gana la última escritura"),
  ESC-001/OPS-007 (sin monitor externo ni colas), SEG-006 (siguen SheetJS 0.18.5, pdf.js 3.11), PRIV-001 (falta el texto jurídico).
- **Abiertos:** ESC-002, ESC-003, OPS-001 (requiere cambiar Pages a "GitHub Actions"), OPS-003, QA-001.

## 4. Lo que NO se pudo verificar (NO VERIFICADO)

1. **Extracción con IA contra un pliego real** (sin crédito de Anthropic): duración frente al límite de la función,
   costo por pliego, comportamiento del modelo ante texto inyectado. Es el mayor riesgo pendiente.
2. Correos de confirmación y recuperación de contraseña de punta a punta (el correo integrado de Supabase no
   llegó a una dirección ajena al equipo; falta un remitente SMTP propio).
3. Plan, respaldos y restauración de la base de Supabase; comportamiento con varios dispositivos editando a la vez.
4. Safari/iOS y lectores de pantalla reales; rendimiento con listas muy largas y muchos análisis guardados.
5. El texto legal (`privacidad.html`) y las declaraciones de los documentos: requieren revisión de un abogado.
6. El bloque de "almacenamiento lleno" (PERF-005) y el digest con muchas empresas (solo revisados por lectura y pruebas parciales).

## 5. Decisión de estado

**BETA CONTROLADA (condicionada)** — porque los fallos que podían llevar a una recomendación errónea (GO/CUMPLE falsos)
están cerrados y verificados por mutación, el aislamiento de datos y el borrado de cuenta funcionan, y no hay secretos ni XSS
hallados. **No** es CANDIDATO: quedan puntos sin verificar que dependen de terceros (IA real, correo, texto legal).

Condiciones para operar la beta:
1. Usuarios conocidos y en número limitado, informados de que el resultado es orientativo (ya aparece junto a cada veredicto).
2. Antes de invitar a nadie: completar y hacer revisar `privacidad.html`, o recoger un consentimiento por escrito aparte.
3. No presentar documentos generados sin borrar `[CONFIRMAR]`/`[COMPLETAR]` y sin revisión de un abogado o contador.
4. La extracción con IA queda **fuera** de la beta hasta la primera prueba real (no está desplegado su secreto).
5. Configurar un remitente SMTP propio para que lleguen los correos de confirmación.
6. Vigilar el digest (respuesta HTTP 500 = problema) y tener a mano el respaldo de datos (Inicio → Respaldo).

Para pasar a CANDIDATO: prueba real de la IA, cierre de OPS-001/003 y QA-001, SMTP y texto legal listos, restauración de
Supabase ensayada, y una nueva ronda adversarial sin hallazgos de severidad HIGH.
