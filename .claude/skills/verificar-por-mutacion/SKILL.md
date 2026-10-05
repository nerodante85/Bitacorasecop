---
name: verificar-por-mutacion
description: Comprueba que una prueba nueva de tests/smoke.mjs realmente detecta el bug, rompiendo a propósito el código real y confirmando que la prueba falla; luego revierte. Úsala después de escribir o cambiar una prueba, o cuando el usuario pida "verifica que el test sirve" o "prueba por mutación".
argument-hint: [función o comportamiento cubierto, ej. "esEstadoNoVigente"]
---

# Verificar por mutación (Bitácora SECOP)

Una prueba que pasa no prueba nada si también pasaría con el bug. Este repo exige mutación antes de dar un cambio de lógica por bueno.

## Proceso

1. **Línea base**: `node tests/smoke.mjs` y anota cuántas pasan. En este entorno la prueba de SRI de los CDN puede fallar solo por la red: no es regresión, pero repórtalo.
2. **Elegir la mutación**: la mínima que reintroduce el bug que la prueba dice cubrir (quitar una condición, invertir un comparador, borrar una línea del arreglo). Debe ser en el código real (`index.html`, `evaluacion.js`, `lectura.js`, `coincidencia.js`, las Edge Functions), no en la prueba.
3. **Aplicar y correr**: haz la mutación con Edit, corre `node tests/smoke.mjs` y confirma que falla EXACTAMENTE la prueba esperada, no otra por accidente.
4. **Revertir siempre**: restaura el código (`git diff` debe mostrar solo tus cambios reales; si hace falta, `git checkout -p`). Corre de nuevo y confirma la línea base.
5. **Si la prueba no falla**, es débil: ajústala (datos que ejerciten ese camino) y repite.

## Reglas

- Si una prueba extrae funciones por anclas de texto, verifica también que la mutación no rompió el ancla (fallaría por otra causa).
- Reporta en español: qué se mutó, qué prueba falló, y que se revirtió. Con `coincidencia.js`, recuerda que existe una copia en `supabase/functions/daily-digest/` que debe seguir idéntica.
