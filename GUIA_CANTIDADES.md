# Guía: cómo nombrar los ítems de la hoja CANTIDADES

El cruce de experiencia específica clasifica cada ítem por su **nombre** y su **unidad**. Si el nombre es ambiguo, el resultado es NO DETERMINABLE (nunca un CUMPLE falso).

| Actividad | Escribe así | Evita |
|---|---|---|
| Tubería | `PVC para alcantarillado 12"`, `Tubería gres Ø8"`, `Tubería concreto D=24"` — unidad **ml** | Omitir material o diámetro (`Tubería de 16"`) |
| Pozos | `Pozo de inspección tipo III` — unidad **und** | `Pozos` genérico sin "inspección" |
| Conexiones domiciliarias | `Conexión domiciliaria alcantarillado sanitario` — unidad **und** | `Cajas`, `sillas`, `yee`, `codos` (son accesorios, no cuentan como conexión) |
| Longitud de vía | `Mejoramiento de vía placa huella` — unidad **ml** o **km** (km se convierte a ml) | Ítems en m² o m³ (no dan longitud); cunetas, bordillos y señalización |
| Entibados | `Entibado` (solo se acredita, no tiene cantidad exigida) | — |

Reglas:
- Vía: si un contrato tiene varios ítems de longitud (base, subbase, carpeta), la app no los suma, porque pueden ser capas del mismo tramo: toma el mayor. Pon una sola fila con la longitud intervenida real del contrato.
- Una fila por ítem del acta final; no sumes tú los ítems (la app suma los del mismo material).
- Pon en NOTAS el documento fuente (acta, página).
- Si el material del tubo no está en el acta, no lo adivines: déjalo sin material.
- Un contrato en ejecución no se cuenta.
- En consorcio, la app no asume si el pliego cuenta el contrato completo o prorrateado: usa el selector "Cantidades en consorcio" de la ficha solo con confirmación escrita de la entidad.
