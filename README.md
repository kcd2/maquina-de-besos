# Besitos 💌

Una pequeña página privada para mandarnos besos con un toque al corazón.

La interfaz se publica como sitio estático en GitHub Pages. Las cuentas, la unión de las dos cuentas y el correo se gestionan con Supabase y una Supabase Edge Function que envía el mensaje con Resend. Las claves de servidor viven en Supabase, nunca en este repositorio.

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

1. Crea una cuenta en Resend y verifica un dominio o subdominio que puedas usar como remitente.
2. Instala Supabase CLI siguiendo su documentación oficial, inicia sesión y enlaza este proyecto local con el proyecto de Supabase.
3. Guarda como secrets de Supabase Edge Functions `RESEND_API_KEY` y `EMAIL_FROM` (por ejemplo, `Besitos <besitos@correo.tudominio.com>`). `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` deben estar disponibles para la función; si tu proyecto no los expone automáticamente, configúralos también como secrets.
4. Despliega la función `couple` desde esta carpeta con Supabase CLI.

La función valida el token de la usuaria, busca la otra cuenta conectada y envía el correo. El cliente nunca recibe la clave de Resend ni la clave de servicio de Supabase.

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


