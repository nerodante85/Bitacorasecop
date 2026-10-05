---
name: medir-responsive
description: Mide con números (no solo con capturas) si una vista de Bitácora SECOP desborda horizontalmente o tiene controles táctiles pequeños a 375, 768 y 1280 px. Úsala después de cualquier cambio visual, de agregar un ítem de navegación o cuando el usuario pida "revisa el responsive" o "¿desborda en el celular?".
argument-hint: [vista a medir, ej. "Pipeline" o "todas"]
---

# Medir responsive (Bitácora SECOP)

Varios bugs reales de esta app (barra de navegación móvil, textos largos de SECOP) pasaron una revisión visual y solo se vieron midiendo. Mide siempre.

## Proceso

1. **Servidor**: `python3 -m http.server 8123` desde la raíz del repo y abre `http://localhost:8123/index.html`. Si usas el navegador embebido, fija el tamaño exacto (ancho y alto): un preset puede no bajar de ~800 px reales.
2. **Datos**: carga los datos de ejemplo en "Buscar procesos" y desmarca "Solo publicados hace ≤30 días" para que haya tarjetas. Con datos reales de SECOP pueden aparecer cadenas largas sin espacios que los de ejemplo no tienen: prueba también una búsqueda en vivo si hay red.
3. **Medir por cada ancho (375, 768, 1280) y cada vista**:
   ```js
   const de = document.documentElement;
   const desborde = de.scrollWidth - de.clientWidth;               // debe ser 0
   const culpables = [...document.querySelectorAll('body *')]
     .filter(e => e.getBoundingClientRect().right > de.clientWidth + 1 && e.offsetParent)
     .slice(0, 5).map(e => e.tagName + '.' + e.className);
   // Solo móvil. Se excluyen a propósito los enlaces de texto (.link-btn, los <a> de tarjeta) y las
   // casillas dentro de un <label>: su caja visible es chica pero la app amplía la zona sensible a
   // 44 px con un ::after (y la etiqueta entera es clicable). Contarlos da falsos positivos (95 en
   // "Buscar procesos" a 375 px, todos de este tipo).
   const chicos = [...document.querySelectorAll('button, a, input, select, summary')]
     .filter(e => e.offsetParent && !e.matches('.link-btn, a') && !(e.type === 'checkbox' && e.closest('label')))
     .filter(e => e.getBoundingClientRect().height < 44 || e.getBoundingClientRect().width < 44).length;
   ```
   Si quedan controles, mídelos aparte y confirma con `elementFromPoint` que el área extendida no responde:
   los que sí cuentan son botones, campos y `summary` reales.
   Un scroll interno intencional (tabla ancha, tablero del Pipeline) no es desborde de página: confirma que el contenedor tiene su propio `overflow-x`.
4. **Navegación móvil (≤560 px)**: abre el menú desplegable y mide `sidebar.scrollWidth - clientWidth` abierto y cerrado; cada ítem de nav nuevo ya rompió esto antes.
5. **Por JS, no por clic**: cambia de vista con `javascript_tool` buscando el botón por su texto; los clics por coordenadas son inestables.

## Reporte

Tabla vista × ancho con desborde en px, nº de controles táctiles bajo 44 px y errores de consola (en pestaña nueva). Señala los culpables con su clase y propone el arreglo mínimo. Detén el servidor al terminar.
