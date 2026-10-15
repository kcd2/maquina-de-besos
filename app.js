import { KISS_MESSAGES, SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js'

const app = document.querySelector('#app')
const logoutButton = document.querySelector('#logout-button')
const toast = document.querySelector('#toast')
const SESSION_KEY = 'besitos-session-v1'
const isConfigured = SUPABASE_URL.startsWith('https://')
  && !SUPABASE_URL.includes('TU-PROYECTO')
  && SUPABASE_ANON_KEY.length > 20
  && !SUPABASE_ANON_KEY.includes('TU-CLAVE')

let session = null
let authMode = 'signup'
let toastTimer
let lastMessageIndex = -1
let busy = false

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
}

function showToast(message) {
  toast.textContent = message
  toast.classList.add('visible')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 4200)
}

function configMessage() {
  return `<p class="config-note">Para activar las cuentas y el envío de besos, primero hay que conectar este sitio con Supabase. La interfaz ya está preparada; la configuración pendiente se explica en el README.</p>`
}

function setBusy(value) {
  busy = value
  app.querySelectorAll('button').forEach((button) => {
    if (button.dataset.allowBusy !== 'true') button.disabled = value
  })
}

async function responseJson(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data.msg || data.message || data.error_description || data.error || 'No se pudo completar la solicitud.'
    throw new Error(message)
  }
  return data
}

async function authRequest(path, body, accessToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return responseJson(response)
}

function saveSession(nextSession) {
  session = nextSession
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(SESSION_KEY)
  logoutButton.classList.toggle('hidden', !session?.access_token)
}

async function getLiveSession() {
  const stored = localStorage.getItem(SESSION_KEY)
  if (!stored) return null
  try {
    const saved = JSON.parse(stored)
    const expiry = Number(saved.expires_at || 0)
    if (!saved.access_token || !saved.refresh_token) return null
    if (expiry && expiry * 1000 < Date.now() + 60_000) {
      const renewed = await authRequest('token?grant_type=refresh_token', { refresh_token: saved.refresh_token })
      const updated = { ...renewed, expires_at: renewed.expires_at || Math.floor(Date.now() / 1000) + (renewed.expires_in || 3600) }
      saveSession(updated)
      return updated
    }
    saveSession(saved)
    return saved
  } catch {
    saveSession(null)
    return null
  }
}

async function callCoupleFunction(payload) {
  if (!session?.access_token) throw new Error('Tu sesión terminó. Vuelve a entrar para enviar tu besito.')
  const response = await fetch(`${SUPABASE_URL}/functions/v1/couple`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  })
  return responseJson(response)
}

function renderAuth() {
  logoutButton.classList.add('hidden')
  const isSignup = authMode === 'signup'
  app.innerHTML = `
    <section class="screen">
      <p class="eyebrow">Un rincón pequeñito para dos</p>
      <h1>Un beso te encuentra <span class="rose-text">donde estés.</span></h1>
      <p class="lede">Un corazón, un toque y un recordatorio suave de que estoy pensando en ti.</p>
      <div class="panel">
        ${!isConfigured ? configMessage() : ''}
        <div class="auth-tabs" role="tablist" aria-label="Acceso a la cuenta">
          <button class="auth-tab" id="signup-tab" role="tab" aria-selected="${isSignup}" type="button">Crear cuenta</button>
          <button class="auth-tab" id="login-tab" role="tab" aria-selected="${!isSignup}" type="button">Iniciar sesión</button>
        </div>
        <form id="auth-form" novalidate>
          ${isSignup ? `<div class="field"><label for="display-name">¿Cómo te llamas?</label><input id="display-name" name="displayName" autocomplete="name" maxlength="40" placeholder="Tu nombre o apodo" required /></div>` : ''}
          <div class="field"><label for="email">Correo electrónico</label><input id="email" name="email" type="email" autocomplete="email" placeholder="tu@correo.com" required /></div>
          <div class="field"><label for="password">Contraseña</label><input id="password" name="password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" minlength="8" placeholder="Al menos 8 caracteres" required /></div>
          <button class="primary-button" type="submit" ${isConfigured ? '' : 'disabled'}>${isSignup ? 'Crear mi cuenta' : 'Entrar'} <span aria-hidden="true">→</span></button>
        </form>
        <p class="form-footnote">${isSignup ? 'Después conectarás tu cuenta con la de tu novia usando una invitación privada.' : 'Este espacio es solo para vosotras dos.'}</p>
      </div>
    </section>`
  document.querySelector('#signup-tab').addEventListener('click', () => { authMode = 'signup'; renderAuth() })
  document.querySelector('#login-tab').addEventListener('click', () => { authMode = 'login'; renderAuth() })
  document.querySelector('#auth-form').addEventListener('submit', submitAuth)
}

async function submitAuth(event) {
  event.preventDefault()
  if (busy || !isConfigured) return
  const form = new FormData(event.currentTarget)
  const email = String(form.get('email') || '').trim().toLowerCase()
  const password = String(form.get('password') || '')
  setBusy(true)
  try {
    if (authMode === 'signup') {
      const displayName = String(form.get('displayName') || '').trim()
      if (!displayName) throw new Error('Escribe tu nombre o apodo para crear la cuenta.')
      const result = await authRequest('signup', { email, password, data: { display_name: displayName } })
      if (!result.access_token) {
        showToast('Cuenta creada. Revisa tu correo para confirmar la dirección y después inicia sesión.')
        authMode = 'login'
        renderAuth()
        return
      }
      saveSession({ ...result, expires_at: result.expires_at || Math.floor(Date.now() / 1000) + (result.expires_in || 3600) })
    } else {
      const result = await authRequest('token?grant_type=password', { email, password })
      saveSession({ ...result, expires_at: result.expires_at || Math.floor(Date.now() / 1000) + (result.expires_in || 3600) })
    }
    await loadPairState()
  } catch (error) {
    showToast(friendlyError(error.message))
  } finally {
    setBusy(false)
  }
}

function friendlyError(message) {
  if (/invalid login credentials/i.test(message)) return 'El correo o la contraseña no coinciden.'
  if (/already registered|user already registered/i.test(message)) return 'Ese correo ya tiene una cuenta. Prueba a iniciar sesión.'
  if (/password.*(weak|short|least)/i.test(message)) return 'La contraseña es demasiado corta; prueba con una de al menos 8 caracteres.'
  if (/email not confirmed/i.test(message)) return 'Primero confirma tu correo desde el mensaje que te envió Supabase.'
  if (/failed to fetch/i.test(message)) return 'No se pudo conectar. Revisa la configuración de Supabase y tu conexión.'
  return message
}

async function loadPairState() {
  try {
    const state = await callCoupleFunction({ action: 'status' })
    if (state.paired) renderKissScreen(state.partnerName)
    else if (state.inviteCode) renderWaiting(state.inviteCode)
    else renderPairing()
  } catch (error) {
    renderPairing(true, error.message)
  }
}

function renderPairing(hasError = false, errorText = '') {
  app.innerHTML = `
    <section class="screen screen-wide">
      <p class="eyebrow">El siguiente paso</p>
      <h2>Este corazón necesita <span class="rose-text">a las dos.</span></h2>
      <p class="lede">Cread un espacio privado compartido. Una invita a la otra y ya podréis mandaros besitos.</p>
      <div class="panel invite-card">
        ${hasError ? `<p class="config-note">${escapeHtml(friendlyError(errorText))} Comprueba que la función privada esté instalada en Supabase.</p>` : ''}
        <div class="invite-actions">
          <button class="primary-button" id="create-pair" type="button">Crear nuestro espacio <span aria-hidden="true">→</span></button>
          <button class="secondary-button" id="show-join" type="button">Tengo un código</button>
        </div>
        <form id="join-form" class="hidden">
          <div class="field"><label for="invite-code">Código de invitación</label><input id="invite-code" name="inviteCode" maxlength="8" autocomplete="off" placeholder="Ej. A7K2M9" required /></div>
          <button class="primary-button" type="submit">Unirme a nuestro espacio <span aria-hidden="true">→</span></button>
        </form>
        <p class="form-footnote">El código solo permite que tu pareja se una a este espacio. No lo compartas con nadie más.</p>
      </div>
    </section>`
  document.querySelector('#create-pair').addEventListener('click', createPair)
  document.querySelector('#show-join').addEventListener('click', () => {
    document.querySelector('#join-form').classList.remove('hidden')
    document.querySelector('#invite-code').focus()
  })
  document.querySelector('#join-form').addEventListener('submit', joinPair)
}

async function createPair() {
  if (busy) return
  setBusy(true)
  try {
    const result = await callCoupleFunction({ action: 'create' })
    renderWaiting(result.inviteCode)
  } catch (error) { showToast(friendlyError(error.message)) }
  finally { setBusy(false) }
}

async function joinPair(event) {
  event.preventDefault()
  if (busy) return
  const code = new FormData(event.currentTarget).get('inviteCode')
  setBusy(true)
  try {
    await callCoupleFunction({ action: 'join', inviteCode: String(code || '').trim().toUpperCase() })
    showToast('Ya estáis conectadas. Ahora podéis mandaros besos.')
    await loadPairState()
  } catch (error) { showToast(friendlyError(error.message)) }
  finally { setBusy(false) }
}

function renderWaiting(inviteCode) {
  app.innerHTML = `
    <section class="screen screen-wide">
      <p class="eyebrow">La invitación está lista</p>
      <h2>Solo falta que llegue <span class="rose-text">tu chica.</span></h2>
      <p class="lede">Mándale este código por vuestro chat. Cuando se una, podréis usar el corazón.</p>
      <div class="panel invite-card">
        <div class="code-box"><div><span class="code-label">Vuestro código</span><strong class="invite-code">${escapeHtml(inviteCode)}</strong></div><button id="copy-code" class="code-copy" type="button">Copiar</button></div>
        <p class="waiting-note"><span class="waiting-icon" aria-hidden="true">♡</span> Tu espacio ya está creado y es privado.</p>
        <div class="invite-actions">
          <button id="check-pair" class="primary-button" type="button">Ya se unió, comprobar</button>
          <button id="share-code" class="secondary-button" type="button">Compartir invitación</button>
        </div>
      </div>
    </section>`
  document.querySelector('#copy-code').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(inviteCode); showToast('Código copiado.') }
    catch { showToast(`Tu código es ${inviteCode}`) }
  })
  document.querySelector('#check-pair').addEventListener('click', loadPairState)
  document.querySelector('#share-code').addEventListener('click', async () => {
    const shareData = { title: 'Mi invitación de besitos', text: `Únete a nuestro espacio de besitos con este código: ${inviteCode}`, url: location.href }
    if (navigator.share) {
      try { await navigator.share(shareData) } catch (error) { if (error.name !== 'AbortError') showToast('No se pudo abrir el menú para compartir.') }
    } else {
      try { await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`); showToast('Invitación copiada para enviársela.') }
      catch { showToast(`Envíale este código: ${inviteCode}`) }
    }
  })
}

function randomMessage() {
  if (KISS_MESSAGES.length < 2) return KISS_MESSAGES[0] || 'Te mando un beso.'
  let index
  do { index = Math.floor(Math.random() * KISS_MESSAGES.length) } while (index === lastMessageIndex)
  lastMessageIndex = index
  return KISS_MESSAGES[index]
}

function heartMarkup() {
  return `<svg class="heart-svg" viewBox="0 0 240 220" role="presentation" aria-hidden="true">
    <defs><linearGradient id="heartGradient" x1=".18" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#f5c7cc"/><stop offset=".42" stop-color="#df91a0"/><stop offset="1" stop-color="#b85f79"/></linearGradient></defs>
    <path class="heart-main" d="M120 204C103 188 25 127 18 75 13 37 42 18 71 20c24 1 40 17 49 36 10-19 27-35 50-36 29-2 58 17 53 55-7 52-85 113-103 129Z" />
    <path class="heart-shine" d="M48 62c5-16 20-23 35-20"/><path class="heart-shine" d="M39 79c1-3 2-6 3-8" />
  </svg>`
}

function renderKissScreen(partnerName) {
  const safePartner = escapeHtml(partnerName || 'mi amor')
  app.innerHTML = `
    <section class="kiss-screen screen">
      <p class="eyebrow">Un besito para ti</p>
      <h1>Hola, <span class="rose-text">${safePartner}.</span></h1>
      <p class="kiss-subtitle">Cuando quieras sentirme cerquita, toca el corazón.</p>
      <div class="heart-stage">
        <div class="heart-halo" aria-hidden="true"></div><div class="heart-ring" aria-hidden="true"></div>
        <button id="kiss-button" class="heart-button" type="button" aria-label="Enviar un beso a ${safePartner}">${heartMarkup()}</button>
      </div>
      <p class="kiss-hint">TOCA EL CORAZÓN PARA MANDAR UN BESO</p>
      <p id="sent-message" class="sent-message" role="status">Cada toque lleva un poquito de mí hasta ti.</p>
      <p class="partner-label">Conectadas como <strong>${safePartner} y tú</strong></p>
    </section>`
  const heart = document.querySelector('#kiss-button')
  heart.addEventListener('click', sendKiss)
}

function spawnSparks() {
  const stage = document.querySelector('.heart-stage')
  const symbols = ['♡', '✦', '♥', '·', '♡']
  for (let i = 0; i < 8; i += 1) {
    const spark = document.createElement('span')
    spark.className = 'spark'
    spark.setAttribute('aria-hidden', 'true')
    spark.textContent = symbols[Math.floor(Math.random() * symbols.length)]
    spark.style.left = `${37 + Math.random() * 26}%`
    spark.style.top = `${38 + Math.random() * 22}%`
    spark.style.setProperty('--dx', `${Math.round((Math.random() - .5) * 190)}px`)
    spark.style.setProperty('--dy', `${Math.round(-60 - Math.random() * 150)}px`)
    stage.append(spark)
    window.setTimeout(() => spark.remove(), 900)
  }
}

async function sendKiss() {
  if (busy) return
  const heart = document.querySelector('#kiss-button')
  const messageBox = document.querySelector('#sent-message')
  const message = randomMessage()
  setBusy(true)
  heart.classList.remove('is-sending')
  void heart.offsetWidth
  heart.classList.add('is-sending')
  spawnSparks()
  try {
    await callCoupleFunction({ action: 'send-kiss', message })
    messageBox.textContent = message
    messageBox.classList.add('active')
    showToast('Besito enviado. Ya va de camino a su correo. 💌')
  } catch (error) {
    showToast(friendlyError(error.message))
  } finally {
    setBusy(false)
    const currentHeart = document.querySelector('#kiss-button')
    if (currentHeart) currentHeart.classList.remove('is-sending')
  }
}

logoutButton.addEventListener('click', async () => {
  try {
    if (session?.access_token && isConfigured) await authRequest('logout', {}, session.access_token)
  } catch { /* La sesión local se cierra aunque el servidor ya la haya invalidado. */ }
  saveSession(null)
  renderAuth()
})

async function start() {
  if (!isConfigured) {
    saveSession(null)
    renderAuth()
    return
  }
  session = await getLiveSession()
  if (session?.access_token) {
    logoutButton.classList.remove('hidden')
    await loadPairState()
  } else renderAuth()
}

start().catch((error) => {
  renderAuth()
  showToast(friendlyError(error.message))
})
