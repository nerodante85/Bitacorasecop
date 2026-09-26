# RELEASE-CHECKLIST — Bitácora SECOP

Fecha de esta versión: 2026-09-26 · Estado actual: **BLOQUEADO** (ver `RELEASE-BLOCKERS.md`).
Marca una casilla solo con **evidencia** (salida de comando, prueba automática, captura o enlace). "Hecho" sin evidencia = no hecho.

Estados posibles: BLOQUEADO → NO LISTO → BETA CONTROLADA → CANDIDATO A LANZAMIENTO → LANZAMIENTO VERIFICADO. Estos estados no son una certificación legal ni de seguridad.

## 1. Gate de integridad (obligatorio para salir de BLOQUEADO)
- [ ] Ola 0 completa: A, B, D y E de `RELEASE-BLOCKERS.md` cerrados; C cerrado o la IA desactivada por defecto/rotulada "experimental".
- [ ] Cada bloqueador tiene un test automático (entrada → salida) en `tests/smoke.mjs`, verificado por mutación (se rompe el código y el test falla).
- [ ] `node tests/smoke.mjs` en verde y la auditoría repetida sobre los puntos corregidos.

## 2. Datos (SECOP I y SECOP II por separado)
- [ ] SECOP II: los abiertos del servidor están todos en la app para 6 palabras de prueba (S2-001), con y sin tildes (S2-002).
- [ ] SECOP II: estados vigentes por defecto; cancelado/seleccionado nunca "abierto"; "sin fecha de cierre" explícito (S2-003, S2-012).
- [ ] SECOP II: filtro "Licitación pública" cubre obra; departamento con alias (Bogotá) (S2-006, S2-007).
- [ ] SECOP I: consulta por nombre exacto/indexable; dedup por `uid`; solo valor > 0; fechas de firma; moneda y centinelas (SI-001…SI-006).
- [ ] Sugerencia de oferta calculada solo con SECOP II (TR-001).
- [ ] Un fallo o timeout de una fuente se muestra con su nombre; nunca "sin resultados" por error (TR-003, SI-002).
- [ ] Cada pantalla y exportable (informes, CSV, carta, paquete, correo, alertas, PAA) indica dataset, fecha de consulta/actualización y modo vivo/snapshot/demo (TR-007, TR-008, TR-009).
- [ ] Snapshot: banner con antigüedad y alcance; demo no permite generar carta/paquete (S2-009, TR-008).
- [ ] Lista: "Mostrando N de M" y "cargar más"; embudo de filtros en el estado vacío (UX-001, UX-002).

## 3. Motor de cumplimiento
- [ ] Todos los casos de `RELEASE-BLOCKERS.md` sección B pasan.
- [ ] Cada gate financiero muestra fuente, página, cita del pliego y **margen** ("tu 1,40 vs 1,50: falta 0,10") (MC-023).
- [ ] Un requisito opcional/alternativo NO CUMPLE es visible en el resultado global (MC-011).
- [ ] Prueba de estrés con Excel hostil (negativos, duplicados, TOTAL, fechas raras, miles/millones) sin CUMPLE falso (RT-001…RT-003, MC-015).
- [ ] Ejemplo de referencia: liquidez mínima 1,50 con AC 183 y PC 100 → 1,83 → CUMPLE, con la fórmula visible (MC-013).

## 4. IA (si está habilitada)
- [ ] Casos IA-001…IA-005 y IA-008 pasan.
- [ ] Prueba real con un pliego de ≥70 págs y adenda: duración, tokens, costo, filas sin verificar, adenda reflejada — resultados documentados.
- [ ] Confirmación de usuario auditable: quién, cuándo, hash del PDF y de la cita (IA-006).
- [ ] `system` que trata los documentos como datos y rechazo de valores ≤0; aviso ante frases dirigidas a IA (IA-007).
- [ ] Caché por hash de PDF, tope global de gasto y `AbortSignal.timeout` (ESC-003, SEG-002).
- [ ] Consentimiento explícito registrado antes de la primera extracción (IA-014, PRIV-003).

## 5. Documentos generados
- [ ] Sin afirmaciones fácticas fijas; declaraciones marcadas `[CONFIRMAR]`; aviso de riesgo al inicio (DG-003).
- [ ] Anexo de experiencia separado del informe interno y sin textos de la interfaz (DG-001, DG-002).
- [ ] Citas legales validadas por un profesional y fechadas (DG-004).
- [ ] Persona natural / consorcio contemplados o marcados (DG-005); aviso de que el paquete no cubre todos los documentos del pliego (DG-013).
- [ ] RUT/RUP: dirección íntegra, validación de NIT/DV, no mezclar empresas, UNSPSC solo desde la sección de clasificación (DG-006…DG-008) — probado con documentos reales.

## 6. Seguridad
- [ ] Supabase Auth: confirmación de correo, contraseña mínima ≥8, protección de contraseñas filtradas, CAPTCHA, límites por IP; `[auth]` versionado (SEG-001).
- [ ] Prueba de RLS y Storage **con dos cuentas autenticadas** (cruce de empresas y de rutas de PDF) — NO VERIFICADO hoy.
- [ ] Enlaces externos con `safeHref` (`https:`), `noreferrer` (SEG-005, RT-013).
- [ ] Correo diario solo con conteos, con baja y remitente verificado (SEG-003, PRIV-006).
- [ ] Cotas de tamaño/cantidad en `app_state` y alertas; barrido de PDFs huérfanos (SEG-004, SEG-008).
- [ ] SheetJS ≥0.20.2 y pdf.js actualizado, con SRI recalculado; supabase-js fijado en las funciones (SEG-006).
- [ ] CORS restringido, comparación de secretos en tiempo constante, regex de ruta estricta (SEG-009).

## 7. Privacidad y cumplimiento (con asesoría profesional)
- [ ] Política de tratamiento, aviso de privacidad y términos publicados y enlazados; aceptación registrada (PRIV-001).
- [ ] Eliminar cuenta y datos (incluye Storage) y exportar mis datos (PRIV-002, OPS-008).
- [ ] Encargados y transferencia internacional documentados (Supabase-región, Anthropic, Resend, Google) (PRIV-003).
- [ ] Inventario y retención definidos; advertencia en "Personal" sobre datos de terceros (PRIV-004).
- [ ] Fuentes alojadas por nosotros (PRIV-005).

## 8. UX y accesibilidad
- [ ] Veredicto con motivo y acción visibles sin hover; nombres claros; "Orientativo" y "Leído X/N págs" junto al chip (UX-003, UX-004).
- [ ] 0 controles sin nombre accesible (axe/Lighthouse); contraste AA en todas las vistas; `<main>`, salto al contenido, `aria-live` (UX-005…UX-007).
- [ ] Progreso y cancelación en IA/OCR/verificación (UX-008); mensaje específico cuando falla SECOP (UX-009).
- [ ] Tabla de requisitos probada en 375 y 768 px con un pliego real (UX-011).
- [ ] Probado en Safari/iOS y con teclado/lector de pantalla — NO VERIFICADO hoy.

## 9. Rendimiento, escalabilidad y confiabilidad
- [ ] Carga bajo demanda de Supabase y fuentes reducidas (PERF-001); PDFs grandes sin congelar la interfaz (PERF-004).
- [ ] Análisis en IndexedDB o sin texto completo; gestor de almacenamiento (PERF-005, RT-016).
- [ ] Digest en lotes con concurrencia, `ultimoDigest` por empresa y dominio remitente verificado (ESC-001, OPS-011).
- [ ] Caché/proxy para Socrata; token separado para el cron (ESC-002).
- [ ] Reintento tras falla de CDN sin recargar (REL-001).
- [ ] Prueba de carga simulada de 100 usuarios sin superar cuotas — NO VERIFICADO hoy.

## 10. Operación (necesario para LANZAMIENTO VERIFICADO)
- [ ] Deploy a Pages con `needs: smoke` y rama protegida; staging o vista previa (OPS-001).
- [ ] Deploy de Edge Functions en CI y versión de contrato cliente/función (OPS-003).
- [ ] Captura de errores del cliente; alertas si falla el digest, la IA o datos.gov.co; panel de costo con umbral (OPS-007).
- [ ] Respaldo: exportar/importar en la app; **plan de Supabase y backups confirmados; restauración ensayada con RPO/RTO documentados** (OPS-008) — NO VERIFICADO hoy.
- [ ] Rollback ensayado (<10 min) y tags de release (OPS-002); runbook de incidentes con kill switch de IA y digest (OPS-009).
- [ ] Migraciones idempotentes y orden documentado; proyecto reconstruible desde cero (OPS-004).
- [ ] `schemaVersion` y migraciones de datos locales; sincronización con versión optimista y aviso de fallo (ARQ-002, ARQ-003).
- [ ] Cobertura: ≥3 casos (feliz, límite, inválido) por función crítica, incluidas Edge Functions y generadores (QA-001, QA-002).
- [ ] Revisión posterior al lanzamiento programada (a los 7 y 30 días): errores, costo, precisión del motor y de la IA.

## 11. Cierre
- [ ] Auditoría repetida completa tras las correcciones; los hallazgos solo se cierran con evidencia verificada.
- [ ] Todo lo marcado "NO VERIFICADO" en `AUDIT-REPORT.md` sección 8 tiene una prueba asignada o queda aceptado por escrito como riesgo residual.
