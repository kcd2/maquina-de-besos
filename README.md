# Besitos 💌

Una pequeña página para que dos personas puedan mandarse besos a distancia. Una toca el corazón y la otra recibe un mensaje en su correo.

[Abrir la demo](https://kcd2.github.io/maquina-de-besos/) · [Ver despliegues](https://github.com/kcd2/maquina-de-besos/actions/workflows/pages.yml)

![Estado del despliegue de GitHub Pages](https://github.com/kcd2/maquina-de-besos/actions/workflows/pages.yml/badge.svg)

## Qué incluye

- Registro e inicio de sesión con Supabase Auth.
- Invitación privada mediante un código para conectar dos cuentas.
- Un corazón interactivo que envía un mensaje cariñoso al correo de la otra persona.
- Diseño adaptable a móvil y escritorio, con soporte para movimiento reducido.
- Publicación de la página estática mediante GitHub Pages y GitHub Actions.

## Cómo funciona

1. Una persona crea una cuenta y un espacio de pareja.
2. Comparte el código de invitación en privado.
3. La otra persona crea su cuenta y se une con ese código.
4. Al tocar el corazón, una función de Supabase comprueba la sesión y la pareja, y solicita el envío del correo a EmailJS.

Cada espacio admite como máximo dos cuentas. El correo destinatario se obtiene de Supabase Auth; no se acepta desde el navegador.

## Tecnologías

- HTML, CSS y JavaScript sin framework ni paso de compilación.
- Supabase Auth, Postgres y Edge Functions.
- EmailJS para enviar los mensajes usando un servicio de correo conectado.
- GitHub Pages para alojar la web y GitHub Actions para publicarla.

## Estructura del proyecto

```text
.
├── .github/workflows/pages.yml   # Publicación en GitHub Pages
├── app.js                        # Registro, invitaciones y corazón
├── config.js                     # Supabase público y mensajes
├── index.html                    # Página principal
├── styles.css                    # Estilos responsive y animaciones
└── supabase/
    ├── schema.sql                # Tablas y protección de la base de datos
    └── functions/couple/index.ts # Función segura para parejas y correos
```

## Probar en local

Necesitas Python 3. Desde la carpeta del proyecto, inicia un servidor estático:

```bash
# Windows
py -m http.server 8000

# macOS o Linux
python3 -m http.server 8000
```

Abre <http://localhost:8000/> en el navegador. Para detener el servidor, vuelve a la terminal y pulsa `Ctrl+C`.

> **Importante:** la configuración incluida en este repositorio apunta al proyecto Supabase de la demo. Probar desde `localhost` usa esas cuentas y servicios reales; un envío puede mandar un correo de verdad. Para crear tu propia versión, conecta tus propios servicios y reemplaza la configuración antes de probar.

## Configurar tu propia versión

### 1. Supabase

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, ejecuta [`supabase/schema.sql`](supabase/schema.sql).
3. En **Authentication → URL Configuration**, pon como **Site URL** la dirección de tu sitio. Para GitHub Pages tendrá un formato como `https://TU_USUARIO.github.io/TU_REPOSITORIO/`. En **Redirect URLs**, añade también estas direcciones y guarda:

   ```text
   https://TU_USUARIO.github.io/TU_REPOSITORIO/**
   http://localhost:8000/**
   ```
4. En **Authentication → Sign In / Providers → Email**, configura la confirmación de correo y asegúrate de que la URL de retorno está permitida.
5. Si vas a usar un proyecto Supabase distinto al de la demo, reemplaza en [`config.js`](config.js) `SUPABASE_URL` y `SUPABASE_ANON_KEY` por la URL y la clave **Publishable** de tu proyecto (en proyectos antiguos puede aparecer como `anon`). Estas son credenciales públicas de cliente; las tablas deben permanecer protegidas por RLS.

No pongas una clave `Secret` o `service_role` en `config.js`, en GitHub Pages ni en el navegador.

### 2. EmailJS y secretos de la función

1. En EmailJS, conecta el servicio de correo que quieras usar y crea una plantilla. Configura **To Email** como `{{to_email}}`, **From Name** como `{{from_name}}` y deja **Use Default Email Address** activado. En el contenido puedes usar `{{from_name}}` y `{{message}}`.
2. Copia el **Service ID**, el **Template ID** y la **Public Key**. Actualiza las constantes `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID` y `EMAILJS_PUBLIC_KEY` en [`supabase/functions/couple/index.ts`](supabase/functions/couple/index.ts).
3. En EmailJS, permite las solicitudes desde entornos no navegador y activa la autorización con **Private Key**.
4. En el panel de Supabase, abre **Edge Functions → Secrets** y crea estos secretos:

   | Nombre | Valor |
   | --- | --- |
   | `EMAILJS_PRIVATE_KEY` | La Private Key de EmailJS. No la publiques ni la incluyas en el código. |
   | `ALLOWED_USER_EMAILS` | Los correos autorizados, separados por comas. Ejemplo: `persona1@correo.com,persona2@correo.com`. |

   La lista `ALLOWED_USER_EMAILS` limita el uso de la función a las cuentas indicadas. Para una pareja, añade las dos direcciones que van a iniciar sesión.

5. Instala o ejecuta Supabase CLI, inicia sesión, enlaza el proyecto y despliega la función desde la raíz del repositorio:

   ```bash
   npx supabase login
   npx supabase link --project-ref TU_PROJECT_REF
   npx supabase functions deploy couple
   ```

La función usa las variables de servidor que Supabase proporciona para validar la sesión y consultar la pareja. No copies una clave `service_role` a los archivos del sitio.

### 3. GitHub Pages

1. Sube el proyecto a la rama `main` de tu repositorio.
2. En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como origen.
3. El flujo [`.github/workflows/pages.yml`](.github/workflows/pages.yml) publica los archivos estáticos del sitio. La Edge Function se despliega por separado con Supabase CLI, como se indica arriba.

Cuando termine la acción de publicación, la URL de GitHub Pages aparecerá en **Settings → Pages**.

## Personalizar los mensajes

Edita la lista `KISS_MESSAGES` en [`config.js`](config.js). El asunto y el diseño del correo se editan desde la plantilla de EmailJS.

## Solución de problemas

- **El enlace de confirmación no vuelve a la página:** revisa **Authentication → URL Configuration** en Supabase y añade la URL exacta de GitHub Pages y la URL local.
- **La cuenta no puede crear o unirse a un espacio:** comprueba que el correo con el que iniciaste sesión está escrito en `ALLOWED_USER_EMAILS` y vuelve a desplegar `couple` si cambiaste el código.
- **No llega el mensaje:** consulta los logs de la función `couple` en Supabase y verifica la plantilla, el servicio de EmailJS y el secreto `EMAILJS_PRIVATE_KEY`.
- **Gmail lo clasifica como spam:** en la cuenta receptora, marca el primer mensaje como **No es spam** y añade la dirección remitente a Contactos. La clasificación final depende del proveedor de correo.

## Privacidad y seguridad

- El repositorio y la web son públicos; las cuentas y los datos de las tablas se gestionan en Supabase.
- Los secretos se guardan en **Supabase → Edge Functions → Secrets**. Nunca subas la Private Key de EmailJS, contraseñas o claves de servidor a GitHub.
- La clave Publishable de Supabase puede aparecer en el frontend; no sustituye a las políticas RLS ni debe confundirse con una clave `Secret`/`service_role`.
- Los correos de las cuentas se almacenan en Supabase Auth. Tenlo en cuenta antes de invitar a otra persona.
