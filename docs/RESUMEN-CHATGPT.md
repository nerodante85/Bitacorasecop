# Bitácora SECOP: resumen para ChatGPT

**Qué es:** Una aplicación web para una constructora de Norte de Santander (Cúcuta). Rastrea licitaciones públicas de Colombia en SECOP I y SECOP II. Ayuda a decidir si la empresa debe presentarse a un proceso, comparando los requisitos del pliego con el perfil, la experiencia y el personal de la empresa.

**Usuario:** Un gerente de constructora, no un desarrollador. Se le habla en español, de forma directa y consultiva.

**Sitio en producción:** https://nerodante85.github.io/Bitacorasecop/ (repositorio `nerodante85/Bitacorasecop`).

## Problema de negocio
Leer pliegos de 50 a 300 páginas y cruzarlos a mano con el RUP, la experiencia y el personal es lento y propenso a errores. La app automatiza esa lectura. Entrega un veredicto GO / REVISAR / NO-GO con la evidencia citada.

## Flujo del producto
1. **Perfil de la empresa:** RUP, capacidad residual (K), datos legales y contratos en ejecución. Se autocompleta desde los PDF oficiales del RUP y del RUT, sin IA (OCR solo como respaldo).
2. **Experiencia:** El usuario sube Excel, PDF o Word con los contratos, por empresa. Un consorcio o unión temporal suma los contratos de sus integrantes.
3. **Personal:** Perfiles profesionales. Junto con Experiencia, es requisito previo para analizar un pliego.
4. **Buscar procesos:** Consulta SECOP II en vivo vía Socrata (datos.gov.co), con filtros por palabra clave, departamento y municipio.
5. **Analizar pliego:** Carga el PDF del pliego o del Estudio Previo. Lo lee con texto, OCR o IA, por tandas.
6. **Tarjeta de análisis:** Muestra el veredicto, los requisitos habilitantes, el cronograma, los riesgos y la coincidencia con los perfiles. Genera plantillas orientativas de carta de presentación y paquete de propuesta.
7. **Extras:** Alertas guardadas con correo diario, PAA (Plan Anual de Adquisiciones), Pipeline Kanban, sugerencia de oferta económica y adjudicaciones históricas de la entidad.

## Principio central: la IA extrae, el motor decide
- La IA (Claude) solo **extrae** requisitos, con cita textual y número de página.
- El navegador **verifica cada cita** contra el texto real del PDF. Una fila sin verificar o de baja confianza nunca produce CUMPLE ni NO CUMPLE. Queda como NO DETERMINABLE hasta que el usuario la confirme.
- El **motor determinista** (`evaluacion.js`) calcula el veredicto. Solo da GO si todos los requisitos están en verde y el pliego fue leído. Cualquier requisito dudoso da REVISAR. Un fallo claro da NO-GO.
- Regla de oro: **ante la duda, NO DETERMINABLE. Nunca se inventa un CUMPLE ni un dato.**

## Arquitectura técnica

| Capa | Detalle |
|---|---|
| **Frontend** | Sitio **estático**: HTML, CSS y JS puro, sin build ni framework. `index.html` (~12.500 líneas) más `lectura.js`, `evaluacion.js` y `coincidencia.js`. Se publica en GitHub Pages. |
| **Librerías** | pdf.js, Tesseract.js (OCR), mammoth.js (Word), SheetJS (Excel) y supabase-js. Los CDN se cargan con integridad SRI. |
| **Datos públicos** | SECOP II (`p6dx-8zbt`), SECOP I (`f789-7hwg`, solo para adjudicaciones) y PAA (`9sue-ezhx`), todos vía Socrata. |
| **Persistencia** | `localStorage` con prefijo `bitacora_`. Con cuenta conectada, sincroniza a Supabase. El texto completo de los pliegos queda en IndexedDB, local al navegador. |
| **Backend (opcional)** | Supabase con cuentas, Postgres con RLS (única barrera entre empresas) y 4 Edge Functions. |
| **Edge Functions** | `extraer-requisitos` (IA lee el PDF), `transcribir-pdf` (IA transcribe páginas escaneadas), `daily-digest` (correo diario vía Resend más cron) y `eliminar-cuenta`. |
| **Seguridad** | CSP por `<meta>`, CORS restringido al dominio de GitHub Pages, `verify_jwt` y cupo diario de IA reservado antes de llamar a Claude. Los secretos viven solo en Supabase. |
| **CI/CD** | GitHub Actions: `pages.yml` (pruebas y despliegue) y `funciones-supabase.yml` (despliegue de funciones). |

## Calidad y pruebas
- `tests/smoke.mjs`: pruebas sin dependencias. Cubren el motor de veredicto con Excel sintéticos, lectura, Edge Functions (lógica pura), accesibilidad y contraste.
- `tests/e2e.mjs`: flujos reales en un navegador con Playwright.
- Metodología: prueba primero y verificación **por mutación**, es decir, romper el código a propósito para confirmar que la prueba falla.

## Diseño
Tema oscuro "Taller" con acento ámbar, basado en tokens CSS. Fuentes: Outfit, JetBrains Mono y Space Grotesk (solo en el logotipo). Requisitos: contraste AA, área táctil de 44 px en celular y nada bajo 12 px.

## Decisiones y limitaciones abiertas
- **Descartados por costo/valor:** el Radar de Afinidad IA y la búsqueda en lenguaje natural.
- **Límite de tiempo:** los pliegos de más de 70 páginas con matrices extensas pueden exceder los ~150 s del plan gratuito de Supabase.
- **Tablas de experiencia:** pueden no leerse como texto. La app avisa con "posible tabla no leída".
- **Correo diario:** solo llega al dueño de la cuenta de Resend hasta que se verifique un dominio.
- **Privacidad:** `privacidad.html` es un borrador con campos `[COMPLETAR]` y falta revisión legal.
- **Documentos de propuesta:** son plantillas orientativas, no documentos finales.

## Documentación interna
`CLAUDE.md` (guía vigente), `docs/HISTORIAL.md` (decisiones y bugs reales), `README.md`, `PRODUCT.md`, `DESIGN.md` y `auditoria/RELEASE-BLOCKERS.md`.
