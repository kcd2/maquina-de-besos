import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
}

// EmailJS identifiers are public integration values, not secret credentials.
const EMAILJS_SERVICE_ID = 'service_fabydji'
const EMAILJS_TEMPLATE_ID = 'template_leglwpe'
const EMAILJS_PUBLIC_KEY = 'Zygc5ekRT-5BUIXTS'

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function cleanName(value: unknown) {
  return String(value || '').trim().slice(0, 40) || 'mi amor'
}

function makeInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const random = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return reply(405, { error: 'Método no permitido.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return reply(500, { error: 'La función privada todavía no está configurada.' })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { data: authData, error: authError } = await userClient.auth.getUser()
    const user = authData.user
    if (authError || !user) return reply(401, { error: 'Inicia sesión para continuar.' })

    const allowedEmails = (Deno.env.get('ALLOWED_USER_EMAILS') || '')
      .split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)
    if (allowedEmails.length === 0) {
      console.error('Couple access denied: ALLOWED_USER_EMAILS secret is not configured.')
      return reply(503, { error: 'El acceso privado aún no está configurado.' })
    }
    const callerEmail = user.email?.trim().toLowerCase()
    if (!callerEmail || !allowedEmails.includes(callerEmail)) {
      return reply(403, { error: 'Esta página está reservada para las dos cuentas autorizadas.' })
    }

    const body = await request.json().catch(() => ({}))
    const action = String(body.action || '')
    const { data: membership, error: memberError } = await admin
      .from('couple_members').select('pair_id').eq('user_id', user.id).maybeSingle()
    if (memberError) throw memberError

    if (action === 'status') {
      if (!membership) return reply(200, { paired: false, inviteCode: null })
      const { data: members, error } = await admin
        .from('couple_members').select('user_id').eq('pair_id', membership.pair_id)
      if (error) throw error
      const partnerId = members?.find((member) => member.user_id !== user.id)?.user_id
      if (!partnerId) {
        const { data: pair, error: pairError } = await admin
          .from('couple_pairs').select('invite_code').eq('id', membership.pair_id).single()
        if (pairError) throw pairError
        return reply(200, { paired: false, inviteCode: pair.invite_code })
      }
      const { data: partnerData, error: partnerError } = await admin.auth.admin.getUserById(partnerId)
      if (partnerError) throw partnerError
      return reply(200, {
        paired: true,
        partnerName: cleanName(partnerData.user.user_metadata?.display_name),
      })
    }

    if (action === 'create') {
      if (membership) return reply(409, { error: 'Ya tienes un espacio de pareja.' })
      let pair
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const inviteCode = makeInviteCode()
        const { data, error } = await admin.from('couple_pairs')
          .insert({ invite_code: inviteCode, created_by: user.id }).select('id, invite_code').single()
        if (!error) { pair = data; break }
        if (error.code !== '23505') throw error
      }
      if (!pair) throw new Error('No se pudo generar un código. Vuelve a intentarlo.')
      const { error: insertError } = await admin.from('couple_members')
        .insert({ user_id: user.id, pair_id: pair.id })
      if (insertError) {
        await admin.from('couple_pairs').delete().eq('id', pair.id)
        throw insertError
      }
      return reply(200, { inviteCode: pair.invite_code })
    }

    if (action === 'join') {
      if (membership) return reply(409, { error: 'Tu cuenta ya está conectada a un espacio.' })
      const inviteCode = String(body.inviteCode || '').trim().toUpperCase()
      if (!/^[A-HJ-NP-Z2-9]{6}$/.test(inviteCode)) return reply(400, { error: 'Ese código no parece válido. Revisa las seis letras o números.' })
      const { data: pair, error: pairError } = await admin.from('couple_pairs')
        .select('id').eq('invite_code', inviteCode).maybeSingle()
      if (pairError) throw pairError
      if (!pair) return reply(404, { error: 'No encontramos ese código. Pídele a tu pareja que compruebe el suyo.' })
      const { count, error: countError } = await admin.from('couple_members')
        .select('user_id', { count: 'exact', head: true }).eq('pair_id', pair.id)
      if (countError) throw countError
      if ((count || 0) >= 2) return reply(409, { error: 'Ese espacio ya tiene dos cuentas conectadas.' })
      const { error: joinError } = await admin.from('couple_members')
        .insert({ user_id: user.id, pair_id: pair.id })
      if (joinError) throw joinError
      return reply(200, { paired: true })
    }

    if (action === 'send-kiss') {
      if (!membership) return reply(403, { error: 'Primero conecta tu cuenta con la de tu pareja.' })
      const { data: members, error } = await admin
        .from('couple_members').select('user_id').eq('pair_id', membership.pair_id)
      if (error) throw error
      const partnerId = members?.find((member) => member.user_id !== user.id)?.user_id
      if (!partnerId) return reply(409, { error: 'Tu pareja aún no se ha unido con el código de invitación.' })

      const { data: partnerData, error: partnerError } = await admin.auth.admin.getUserById(partnerId)
      if (partnerError) throw partnerError
      const recipient = partnerData.user.email
      if (!recipient) return reply(409, { error: 'No encontramos el correo de tu pareja.' })

      const message = String(body.message || '').trim().slice(0, 500)
      if (!message) return reply(400, { error: 'El besito no tiene mensaje.' })
      const sender = cleanName(user.user_metadata?.display_name)
      const emailjsPrivateKey = Deno.env.get('EMAILJS_PRIVATE_KEY')
      if (!emailjsPrivateKey) {
        console.error('EmailJS delivery failed: EMAILJS_PRIVATE_KEY secret is not configured.')
        return reply(500, { error: 'Falta configurar la clave privada del servicio de correo.' })
      }
      const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          accessToken: emailjsPrivateKey,
          template_params: {
            to_email: recipient,
            from_name: sender,
            message,
          },
        }),
      })
      if (!emailResponse.ok) {
        const detail = await emailResponse.text().catch(() => '')
        console.error('EmailJS delivery failed:', detail)
        return reply(502, { error: 'No se pudo entregar el correo. Revisa el servicio y la plantilla de EmailJS.' })
      }
      return reply(200, { sent: true })
    }

    return reply(400, { error: 'Acción desconocida.' })
  } catch (error) {
    console.error('couple function error:', error)
    return reply(500, { error: 'Ha ocurrido un problema. Inténtalo de nuevo dentro de un momento.' })
  }
})
