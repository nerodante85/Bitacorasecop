# Entrega de Bitácora al ingeniero y a la administradora

Estado: **beta controlada** (ver `auditoria/RELEASE-BLOCKERS.md`). Este documento es para quien entrega la app; lo que se manda a las personas usuarias es la guía `guia.html`.

## Qué se les envía

| Qué | Dirección |
| --- | --- |
| Entrada (presentación y botón «Abrir la app») | https://nerodante85.github.io/Bitacorasecop/ |
| La app directamente | https://nerodante85.github.io/Bitacorasecop/app.html |
| Guía de primeros pasos (una página, 7 pasos) | https://nerodante85.github.io/Bitacorasecop/guia.html |

Funciona en computador y celular. No hay nada que instalar.

## Antes de entregar (pasos que solo puede hacer el dueño)

1. **Supabase › Authentication › URL Configuration › Redirect URLs:** añadir `https://nerodante85.github.io/Bitacorasecop/app.html`. Sin esto, el correo de «olvidé mi contraseña» llevaría a la presentación y no a la app.
2. **Decidir cómo entran** (ver abajo, «Cuentas»). Es la decisión que más condiciona la entrega.
3. **Cargar los datos de la empresa una vez** (RUP, RUT, experiencia y personal) en la cuenta con la que van a trabajar, y comprobar que se ven al abrir la app en otro navegador. Así empiezan con datos y no desde cero.
4. **Probar de punta a punta como si fueran ellos:** ventana de incógnito (o el celular), entrar con la cuenta que les va a tocar, buscar un proceso, guardarlo, abrir «Ver proceso» y analizar un pliego real.

## Cuentas

Hechos comprobados en el proyecto real:

- El registro está abierto y **exige confirmar el correo** (`mailer_autoconfirm: false`).
- Mientras Resend siga sin dominio verificado, los correos de confirmación y de recuperación **solo llegan a la dirección del dueño de la cuenta de Resend**. Es decir: una persona nueva no puede registrarse sola ni recuperar su contraseña por correo.
- **Cada cuenta nueva recibe su propia empresa vacía** (el disparador `handle_new_user` crea una empresa por usuario). Dos cuentas distintas no comparten datos.

Opciones:

| Opción | Cómo | Ventajas | Inconvenientes |
| --- | --- | --- | --- |
| **A. Una sola cuenta de la empresa** (recomendada para empezar) | El dueño crea una cuenta desde Supabase › Authentication › Users › Add user (marcando «Auto Confirm User») y se la da a ambos | Ven los mismos datos, sincronizados; cero configuración de correo | Comparten contraseña (guardarla en un gestor de contraseñas); no se sabe quién hizo qué |
| **B. Una cuenta por persona, mismos datos** | Crear dos usuarios igual que en A y añadir a cada uno como miembro de la empresa principal (`company_members`), quitando su empresa vacía | Cada quien con su acceso | Es un paso técnico en la base de datos; se puede pedir a Claude con las cuentas ya creadas |
| **C. Registro libre** | Verificar un dominio en Resend, fijar `DIGEST_FROM_EMAIL` y dejar que se registren | Autoservicio, recuperación de contraseña por correo | Requiere comprar o usar un dominio; cada registro crea una empresa aparte |
| **D. Sin cuenta** | Usar la app tal cual | Inmediato | Los datos quedan solo en ese navegador; si lo limpian o cambian de equipo, se pierden (el respaldo `.json` lo mitiga) |

## Lo que hay que decirles

- Los resultados (GO, REVISAR, NO-GO, NO DETERMINABLE) son **orientativos**: se confirman siempre en el pliego oficial. «No determinable» no significa que cumpla.
- La carta y el paquete de propuesta son **plantillas**: hay que revisar y confirmar cada declaración antes de firmar.
- Leer un PDF escaneado con IA es más lento (en una prueba real, unos 8 segundos por página) y tiene un límite diario por empresa.
- Descargar un respaldo (`Configuración y ayuda › Descargar mis datos (.json)`) cada vez que carguen datos nuevos.
- Si algo falla: escribir a ra.galvis85@gmail.com contando qué estaban haciendo.

## Pendientes conocidos que no bloquean la entrega

- **Política de privacidad:** `privacidad.html` sigue marcada BORRADOR hasta que la revise un abogado. Para uso interno de la propia empresa el riesgo es bajo, pero hay que cerrarlo antes de abrir la app a terceros.
- **Correo diario (`daily-digest`):** solo le llega al dueño de la cuenta de Resend hasta verificar un dominio.
- **Funciones de Supabase:** desplegadas el 2026-10-28 (token renovado). Si el workflow «Desplegar funciones de Supabase» vuelve a fallar, lo primero que hay que revisar es el secret `SUPABASE_ACCESS_TOKEN`.
