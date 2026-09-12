# Bitácora SECOP

Rastreador de licitaciones **SECOP II** (Sistema Electrónico de Contratación
Pública de Colombia) para una empresa constructora en Norte de Santander.
Busca procesos de contratación abiertos, evalúa si la empresa está en
condiciones de participar (experiencia, capacidad financiera, personal) y
analiza el pliego de condiciones de un proceso puntual.

**En vivo:** https://nerodante85.github.io/Bitacorasecop/

[![Tests de humo](https://github.com/nerodante85/Bitacorasecop/actions/workflows/smoke.yml/badge.svg)](https://github.com/nerodante85/Bitacorasecop/actions/workflows/smoke.yml)

## Qué hace

- **Buscar procesos**: consulta en vivo el dataset abierto de SECOP II
  (datos.gov.co) por palabra clave y departamento, con filtros de vigencia,
  modalidad y estado. Si la consulta en vivo falla, muestra un snapshot de
  respaldo (`snapshot.json`) con procesos reales de Norte de Santander.
- **Alertas guardadas**: guarda una combinación de especialidades/
  departamento/valor y revisa cuándo aparecen procesos nuevos que coinciden
  (dentro de la app; sin correo ni notificaciones push por ahora).
- **Perfil de la empresa**: RUP/clasificador y capacidad financiera (K),
  con autocompletado desde el PDF del certificado del RUP. Incluye
  **capacidad contractual estimada**: registra los contratos de obra que la
  empresa tiene actualmente en ejecución y descuenta su saldo pendiente
  (prorrateado a 12 meses si el plazo restante supera ese plazo, regla de la
  Ley 1682 de 2013 / Decreto 791 de 2014) del K residual declarado, para
  saber cuánta capacidad le queda disponible para ofertar a un proceso
  nuevo — una estimación orientativa, no el cálculo certificado oficial.
- **Experiencia**: cruza dos Excel (experiencia ejecutada del proponente +
  matriz de requisitos de un proceso) y determina, requisito por requisito,
  si la empresa CUMPLE / NO CUMPLE / NO DETERMINABLE, con evidencia.
- **Personal**: registro de los perfiles profesionales del equipo de trabajo
  (director de obra, residente, especialistas...).
- **Analizar pliego**: una vez completados Experiencia y Personal, extrae el
  texto de un pliego en PDF (con respaldo de OCR para escaneos), detecta
  requisitos habilitantes y muestra un resumen de compatibilidad (%
  estimado, fortalezas, debilidades, riesgos) además del semáforo GO / NO-GO
  / REVISAR.
- **Ver adjudicaciones de esta entidad** (dentro de "Evaluación"): historial
  de contratos adjudicados por la entidad, combinando SECOP II y SECOP I
  (SECOP I amplía el historial más atrás de 2021, ya que es casi todo
  archivo histórico y no oportunidades abiertas — por eso no se usa en
  "Buscar procesos"). Incluye una sugerencia de oferta económica (escenarios
  conservador/competitivo/agresivo) calculada a partir de ese mismo
  historial — pura aritmética transparente, sin IA.
- **Competencia**: ficha de una empresa que contrata con el Estado (nombre o
  razón social) — contratos totales, valor contratado, principales entidades,
  sectores y evolución por año, combinando SECOP I y SECOP II. Puedes
  **seguir** una empresa y recibir aviso (dentro de la app, con un feed de
  actividad) cuando aparece como contratista en un contrato nuevo. También
  incluye **buscar socios (consorcios)**: por especialidad/sector y
  departamento, un directorio de empresas que ya han sido contratistas en
  esa clasificación (candidatas a consorcio o unión temporal), con acceso
  directo a la ficha completa de cada una.

El flujo completo es: **Experiencia → Análisis de experiencia → Personal →
Analizar pliego → Resultado de compatibilidad** — cada paso queda bloqueado
hasta completar el anterior, con un indicador visible de en qué punto está.

## Arquitectura

Un solo archivo (`index.html`): HTML + CSS + JavaScript, sin backend, sin
base de datos, sin build step ni `npm install`. Corre entero en el navegador
del usuario y se publica tal cual con **GitHub Pages**.

- **Persistencia**: `localStorage` del navegador por defecto — sin servidor
  ni cuenta, los datos (perfiles, experiencia, personal, historial) viven
  solo en el navegador donde se usó la app. Opcionalmente, con una cuenta
  conectada (ver "Cuenta y sincronización" abajo), esos mismos datos se
  sincronizan entre dispositivos vía Supabase.
- **Datos**: dataset abierto "Procesos de Contratación — SECOP II"
  (datos.gov.co / Socrata, dataset `p6dx-8zbt`), consultado en vivo desde el
  propio navegador.
- **Análisis**: reglas y coincidencia de palabras clave (sin LLM/NLP real
  corriendo en el navegador) — se muestra siempre como orientativo, no
  reemplaza revisión humana del pliego completo.
- **Librerías de terceros** (cargadas solo cuando se usan, desde CDN, con
  verificación de integridad — ver más abajo): [pdf.js](https://mozilla.github.io/pdf.js/)
  (lectura de PDF), [Tesseract.js](https://tesseract.projectnaptha.com/) (OCR
  de PDFs escaneados), [SheetJS/xlsx](https://sheetjs.com/) (lectura de
  Excel), [Supabase](https://supabase.com/) (cuenta y sincronización,
  opcional, cargada solo si se configura — ver abajo).

El porqué de cada decisión de arquitectura (por qué no hay backend, cómo se
llegó al diseño actual, bugs reales encontrados y cómo se corrigieron) está
documentado en [`CLAUDE.md`](CLAUDE.md) — pensado como contexto para quien
(persona o asistente de IA) retome el proyecto más adelante.

## Desarrollo local

No hay build step: para probar cambios alcanza con abrir `index.html`
directamente en el navegador, o servirlo con cualquier servidor estático:

```bash
python -m http.server 8123
# abrir http://localhost:8123/index.html
```

### Tests de humo

```bash
node tests/smoke.mjs
```

Corre automáticamente en cada push/PR a `main` (ver
[`.github/workflows/smoke.yml`](.github/workflows/smoke.yml)). Sin
dependencias — usa solo el propio Node. Verifica sintaxis del script
principal, integridad de los `id` referenciados, existencia de las funciones
clave del flujo, cobertura de la política de seguridad (CSP) y que los
hashes de integridad (SRI) de las librerías de terceros sigan coincidiendo
con el archivo real de cada CDN.

Este workflow es una alarma temprana, no un gate: GitHub Pages publica el
cambio igual, sin esperar a que termine.

### App Token de Socrata (opcional)

El dataset de SECOP II es público y no requiere ningún token para
consultarlo. Sin uno, Socrata aplica un límite de tasa más estricto,
compartido con cualquier otra app anónima del mundo. Para subir ese límite:

1. Crear una cuenta (o iniciar sesión) directo en <https://www.datos.gov.co>
   -- el portal de registro separado que existía antes en
   `dev.socrata.com/register` está descontinuado desde 2021; hoy la cuenta se
   maneja en el propio dominio de datos abiertos.
2. En el menú de tu perfil, ir a **"Developer Settings"** → **"Create New App
   Token"** (nombre + descripción; el nombre debe ser único entre todas las
   apps registradas en cualquier dominio Socrata/Data & Insights).
3. Pegar el token generado en la constante `SOCRATA_APP_TOKEN` de
   `index.html` (búscala cerca de `fetchSecopDataset`).

Instrucciones vigentes (verificadas octubre 2025):
<https://support.socrata.com/hc/en-us/articles/210138558-Generating-App-Tokens-and-API-Keys>.

No es una credencial secreta — Socrata los diseña para ir embebidos en
código de cliente — pero mientras quede vacía, la app sigue funcionando
igual, solo sin ese margen extra.

### Cuenta y sincronización (Supabase, opcional)

Por defecto no hace falta cuenta: todo funciona igual que siempre, solo en
este navegador. Para sincronizar perfiles/experiencia/análisis entre
dispositivos:

1. Crear un proyecto gratuito en [supabase.com](https://supabase.com).
2. Correr `supabase/schema.sql` en el SQL Editor del proyecto (una sola vez).
3. Copiar el "Project URL" y la "anon public key" desde Project Settings →
   API (**nunca** la "service_role key" — esa habilita saltarse todos los
   permisos y no debe salir del panel de Supabase).
4. Pegarlos en las constantes `SUPABASE_URL` / `SUPABASE_ANON_KEY` al
   principio del `<script>` de `index.html`.

Detalle de diseño (modelo de datos, seguridad por fila, qué se sincroniza y
qué no) en `CLAUDE.md`, sección "Fase 1: cuentas y sincronización".

## Seguridad

- **CSP** (`<meta http-equiv="Content-Security-Policy">`) restringe a qué
  orígenes puede hablar la página (los 2 CDN usados, Google Fonts,
  datos.gov.co) — pensada especialmente para que ningún script pueda
  exfiltrar lo guardado en `localStorage` a un servidor ajeno.
- **SRI** (`integrity`/`crossorigin`) en los 4 scripts de terceros: el
  navegador verifica que el archivo servido por el CDN sea exactamente el
  esperado antes de ejecutarlo.
- **Row Level Security** en Postgres si se activa la cuenta opcional: cada
  empresa solo puede leer/escribir sus propios datos, exigido por la base de
  datos, no por el frontend.
- Todo el HTML dinámico se escapa antes de insertarse en la página
  (`escapeHtml`), y los enlaces externos se validan contra `http(s)://`
  antes de usarse como `href`.

Detalle completo de estas decisiones en `CLAUDE.md`.

## Licencia

Proyecto interno de uso privado — sin licencia de código abierto declarada.
