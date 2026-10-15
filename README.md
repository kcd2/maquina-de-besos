# Besitos 💌

Una pequeña página privada para mandarnos besos con un toque al corazón.

La interfaz se publica como sitio estático en GitHub Pages. Las cuentas, la unión de las dos cuentas y el envío de besos se gestionan con Supabase. Una Supabase Edge Function valida la pareja y llama a EmailJS para enviar el correo usando el servicio Gmail conectado en tu cuenta de EmailJS.

## Estado

La interfaz está lista. Para que funcionen el registro, el inicio de sesión y los correos, hace falta completar la configuración privada que aparece más abajo.

## Preparar Supabase

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, abre y ejecuta el contenido de `supabase/schema.sql`.
3. **Autoriza las direcciones de la web para la confirmación de cuenta.** En el menú lateral entra en **Authentication → URL Configuration**. En **Site URL** pon `https://kcd2.github.io/maquina-de-besos/`. En **Redirect URLs**, añade estas dos direcciones, una por línea, y guarda:

   ```text
   https://kcd2.github.io/maquina-de-besos/**
   http://localhost:8000/**
   ```

   Después, en **Authentication → Sign In / Providers → Email**, comprueba que **Confirm email** está activado. Así Supabase puede mandar el enlace de confirmación y volver a la web.
4. **Conecta el código de la web a este proyecto.** Abre **Project Settings → API Keys** (o **Project Settings → API** si esa es la sección que aparece en tu panel). Copia la **Project URL** y la clave **Publishable** (`sb_publishable_…`; en proyectos antiguos puede llamarse `anon`). Abre `config.js` en la carpeta de Descargas y reemplaza los dos textos de ejemplo:

   ```js
   export const SUPABASE_URL = 'https://jhyblpmdspyuhtvfuikp.supabase.co'
   export const SUPABASE_ANON_KEY = 'PEGA_AQUI_TU_CLAVE_PUBLICA'
   ```

   La URL de ejemplo ya corresponde al identificador de tu proyecto; copia la clave pública desde tu propio panel. Aunque la variable del código se llame `SUPABASE_ANON_KEY`, puedes pegar ahí la clave nueva `Publishable`. **No pegues nunca una clave `Secret`/`service_role` en `config.js`, en GitHub ni en este chat.** Esas claves dan acceso privilegiado y van únicamente en los secrets de la función privada de Supabase.

## Preparar el envío de correos

1. Crea una cuenta en EmailJS y conecta el Gmail que quieras usar como remitente desde **Email Services → Add New Service**. No necesitas comprar un dominio para este flujo.
2. Crea una plantilla desde **Email Templates**. Configura **To Email** como `{{to_email}}`, **From Name** como `{{from_name}}` y deja seleccionado **Use Default Email Address**. En el contenido puedes usar `{{from_name}}` y `{{message}}`. Deja **Reply To**, **Bcc** y **Cc** vacíos si no los necesitas.
3. Copia el **Service ID**, el **Template ID** y la **Public Key** de EmailJS. Actualiza las constantes `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID` y `EMAILJS_PUBLIC_KEY` al principio de `supabase/functions/couple/index.ts`. Estos identificadores y la Public Key de EmailJS identifican la integración; no pongas aquí contraseñas, la Private Key de EmailJS ni claves secretas de Supabase.
4. En **Account → Security** de EmailJS, activa el acceso para solicitudes desde entornos no navegador y la autorización con **Private Key**. Copia la Private Key y guárdala como secreto `EMAILJS_PRIVATE_KEY` en **Supabase → Edge Functions → Secrets**. Nunca la añadas al repositorio ni la compartas en capturas o mensajes.
5. Para que solo las dos cuentas de la pareja puedan usar la función, añade también el secreto `ALLOWED_USER_EMAILS` en **Supabase → Edge Functions → Secrets**. Como valor, escribe los dos correos autorizados separados por una coma, sin espacios si quieres; por ejemplo: `persona1@correo.com,persona2@correo.com`. Si una de las cuentas cambia de correo, actualiza este secreto.
6. Instala Supabase CLI si aún no la tienes, inicia sesión y enlaza esta carpeta con el proyecto de Supabase. Después despliega la función actualizada:

   ```sh
   supabase login
   supabase link --project-ref jhyblpmdspyuhtvfuikp
   supabase functions deploy couple
   ```

La función valida la sesión, obtiene el correo de la otra cuenta conectada desde Supabase y lo pasa como destinatario a la plantilla. La clave de servicio de Supabase nunca se incluye en el repositorio ni se envía al navegador.

## Publicar en GitHub Pages

1. En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como origen.
2. Sube este proyecto a la rama `main`. El flujo `.github/workflows/pages.yml` publica automáticamente `index.html`, `app.js`, `styles.css` y `config.js`.
3. Cuando Actions termine, la página estará en `https://kcd2.github.io/maquina-de-besos/`.

## Probar en local

Desde esta carpeta puedes ejecutar `py -m http.server 8000` y abrir `http://localhost:8000/`. Configura también esta URL como permitida en la autenticación de Supabase. Para terminar el servidor, pulsa `Ctrl+C` en esa terminal.

## Privacidad

- El repositorio y la interfaz son públicos, pero no deben contener datos de inicio de sesión ni secretos.
- La función Edge limita cada espacio de pareja a dos cuentas y no permite al navegador leer directamente las tablas privadas.
- Los correos de ambas se almacenan en Supabase Auth. Revisa las políticas de privacidad y las condiciones de los servicios que uses antes de activarlos.


