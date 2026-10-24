# Prototipos de rediseño

Tres maquetas estáticas (HTML + CSS, datos ficticios) de la misma página con cuatro secciones: Inicio/Buscar con tarjeta de proceso, Mis procesos, Análisis (GO) y Empresa/pie. **No tocan `index.html` ni el sitio publicado**; la carpeta no está en `pages.yml`.

| | Referencia | Color | Tipografía | Rasgo memorable |
|---|---|---|---|---|
| A · Obra | Imagen 1 | Pizarra `#16212E`, amarillo `#F2B705` | Barlow Condensed (títulos) + Barlow (texto) | Placa amarilla «N días para el cierre»; botones y tarjetas casi rectos |
| B · Páramo | Imagen 2 | Bosque `#22382A`, papel `#F4F1E8`, musgo `#4F6B49` | Newsreader + Instrument Sans | Curvas de nivel (SVG) |
| C · Plano | Mezcla | Pizarra `#1D2B36`, amarillo `#F2B705` | IBM Plex Sans Condensed (títulos) + IBM Plex Sans (texto) | Cuantía acotada con línea de cota y flechas |

Los estados (Cumple / No cumple / Revisar / No determinable) conservan los colores y glifos actuales de la app.

## Medido (1280, 768 y 375 px)
Sin desborde horizontal, sin objetivos táctiles menores de 44 px, contraste AA en cada texto, foco visible, sin errores de consola y `prefers-reduced-motion` respetado.

## Para llevarlo a la app
- Tokens en `index.html` (~53-120); los prototipos usan los mismos nombres (`--accent`, `--surface`, `--bg`, `--text*`, `--radius-*`).
- Cambiar también `.brand-mark` y el favicon (colores fijos).
- Pruebas que fijan lima, Inter + Archivo y el degradado de `.view-header`: `tests/smoke.mjs` y `tests/e2e.mjs`.
- La CSP solo permite Google Fonts: Las dos son familias nuevas respecto a la app (que usa Inter + Archivo), así que A y C requieren cambiar el `<link>` y las pruebas que fijan esas fuentes.
- Solo color y tipografía: ~120 líneas. Si cambia la estructura: 400-600.
