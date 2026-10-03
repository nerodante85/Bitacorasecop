# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Gerentes e ingenieros de empresas constructoras colombianas (hoy, sobre todo en Norte de Santander) que deciden a qué licitaciones de obra pública presentarse. Trabajan desde el escritorio y también desde el celular (iPhone/Android). Su trabajo: encontrar procesos abiertos en SECOP I y II, saber rápido si la empresa cumple los requisitos habilitantes del pliego o del estudio previo (experiencia, capacidad financiera y organizacional, K residual, personal, garantías) y, si vale la pena, armar la propuesta. La marca se presenta como "Consultoría en contratación pública"; una consultora que asesora a varias constructoras es un usuario posible pero no el principal.

## Product Purpose

Ahorrar a la constructora el tiempo y el riesgo de decidir si participa en un proceso: reunir procesos de SECOP I y II, leer los documentos del proceso (pliego de condiciones o estudio previo, incluso escaneados) y comparar sus requisitos contra los datos reales de la empresa (RUP, RUT, experiencia acreditada, personal), con un veredicto orientativo (GO / REVISAR / NO-GO) y los documentos básicos de la propuesta. El éxito es que el ingeniero pueda decidir en minutos y confiar en por qué.

## Positioning

Cada conclusión de cumplimiento se puede rastrear hasta la página y la cita del documento del proceso, y ante la falta de evidencia la respuesta es "requiere verificación", nunca un cumplimiento inventado. La IA solo lee y cita; un motor de reglas verificable decide contra los datos de la empresa.

## Operating Context

- Fuentes: datos abiertos de SECOP I y SECOP II en datos.gov.co (se actualizan una vez al día); documentos del proceso en PDF (pliego, estudio previo, adendas), muchos escaneados; certificados de la empresa (RUP de la Cámara de Comercio, RUT de la DIAN) y su experiencia en Excel/PDF/Word.
- El producto es para otras empresas: tiene cuentas por empresa (Supabase opcional), política de privacidad y datos aislados por empresa; sin cuenta funciona solo en el navegador.
- Las funciones de IA son de pago por uso (lectura de escaneados y extracción de requisitos) y se limitan por empresa.
- Normativa colombiana (Ley 1150 de 2007, Decreto 1082 de 2015, Documentos Tipo de Colombia Compra Eficiente); lo jurídico que genera la app es orientativo y se debe revisar con un profesional.

## Capabilities and Constraints

- Capacidades: búsqueda de procesos con filtros, alertas y Plan Anual de Adquisiciones; lectura de pliegos y estudios previos (texto, OCR o IA); extracción de requisitos habilitantes con cita verificada; evaluación de experiencia, capacidad financiera, K residual y personal por empresa (incluidos consorcios y uniones temporales); veredicto por proceso; carta de presentación y paquete de propuesta; pipeline comercial por etapas.
- Restricciones duraderas confirmadas: no inventar datos (cifras, contratos, documentos o cumplimiento sin respaldo; ante la duda, "requiere verificación"); funciona bien en celular (375px); todo en español de Colombia, en pesos colombianos y con normas colombianas.
- Arquitectura actual (hecho, no restricción confirmada): sitio estático en GitHub Pages sin paso de build, con Supabase como backend opcional.
- Decisión abierta: ninguna registrada en esta ronda.

## Brand Commitments

Nombre "Bitácora" (SECOP). Existe un logo propio, el monograma "B", diseñado aparte por el usuario, que forma parte de la identidad actual. Tono en español de Colombia, directo y profesional.

## Evidence on Hand

- Datos abiertos reales de SECOP I y II consultados en vivo.
- Pliegos, estudios previos, RUP, RUT y Excel de experiencia reales del usuario usados en pruebas (no se versionan; contienen datos de terceros).
- Mediciones reales de lectura con IA en producción (por ejemplo, 8,1 s por página en un escaneado de 112 páginas).
- No hay testimonios, clientes, cifras de adopción ni precios publicados: no deben fabricarse.

## Product Principles

1. Evidencia antes que conclusión: toda afirmación de cumplimiento cita su fuente y su regla.
2. La incertidumbre se muestra, no se esconde: "requiere verificación" es una respuesta válida y preferible a una conclusión inventada.
3. La IA propone, las reglas deciden: lo que se puede calcular de forma determinista no se deja a un modelo.
4. Ahorrar tiempo de decisión: lo esencial (veredicto, qué falta y por qué) primero, el detalle a un toque.
5. Los datos de la empresa son suyos: aislados por empresa, exportables y eliminables.

## Accessibility & Inclusion

Uso frecuente desde celular y con teclado; controles con etiquetas accesibles y contraste suficiente. Sin estándar formal exigido por el usuario.
