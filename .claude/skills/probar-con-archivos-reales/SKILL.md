---
name: probar-con-archivos-reales
description: Prueba en el navegador real un flujo de Bitácora SECOP que recibe archivos (PDF de pliego, RUP, RUT, Excel/Word de experiencia, Estudio Previo) inyectando un archivo en el input type=file, y limpia todo al terminar. Úsala cuando el usuario pida "pruébalo con un archivo", "sube este PDF/Excel", o cuando un cambio toque la lectura de documentos.
argument-hint: [flujo a probar, ej. "Excel de experiencia" o "pliego PDF escaneado"]
---

# Probar con archivos reales (Bitácora SECOP)

La app es un `index.html` estático. No hay selector de archivos que un navegador sin ventana pueda operar, así que el archivo se inyecta por código. Reporta en español qué se leyó, si la consola quedó limpia y qué NO se pudo probar.

## Proceso

1. **Servidor local desde la raíz del repo**: `python3 -m http.server 8123` en segundo plano. No uses `file://`.
2. **Archivo de prueba**:
   - Si el usuario dio uno real, cópialo a la carpeta servida con un nombre temporal. Son datos de personas reales: no lo agregues al repo ni lo muestres completo.
   - Si no, genéralo: PDF con `fpdf2` (instalar temporal), Excel con `openpyxl`, Word con `python-docx`. Para un PDF escaneado, una imagen con Pillow metida en un PDF sin capa de texto.
   - Desinstala lo instalado al terminar.
3. **Estado previo**: varios flujos tienen compuerta (Experiencia y Personal antes de "Analizar pliego"). Siémbralo escribiendo en `localStorage` con prefijo `bitacora_` y recarga ANTES de disparar acciones que persistan, o la app lo sobrescribe.
4. **Inyección**:
   ```js
   const blob = await (await fetch('archivo-temporal.pdf')).blob();
   const dt = new DataTransfer();
   dt.items.add(new File([blob], 'archivo-temporal.pdf', { type: blob.type }));
   const input = document.getElementById('<id del input>');
   input.files = dt.files;
   input.dispatchEvent(new Event('change', { bubbles: true }));
   ```
   Ids habituales: `bt-perfil-rup-file`, `bt-perfil-rut-file`, `bt-expeval-exp-file`. Para el pliego, el input está en la tarjeta del proceso (cargar datos de ejemplo primero).
5. **Verificar**: texto del estado, conteos, valores en `localStorage`, y consola sin errores (en pestaña nueva: el historial de consola es acumulativo). Mide overflow a 375px si hubo cambio visual.
6. **Límites conocidos**: la lectura con IA necesita sesión y crédito real; sin ellos solo se prueba que el aviso y los botones aparezcan. Tesseract puede ser muy lento en el sandbox: no lo uses para comparar tiempos.

## Limpieza obligatoria

Detén el servidor, borra el archivo temporal y confirma con `git status --porcelain` que solo quedan los cambios reales.
