import { createClient } from 'jsr:@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_EMAIL     = 'invites@coveyspace.com'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401 })

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) return new Response('Unauthorized', { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .single()

    // Auth: caller must be a church admin (independent of their active group)
    const { data: churchRole } = await supabase
      .from('church_roles')
      .select('church_id')
      .eq('user_id', user.id)
      .single()

    if (!profile || !churchRole) {
      return new Response('Forbidden', { status: 403 })
    }

    const { email, name, invite_url, group_name } = await req.json()
    if (!email || !invite_url) return new Response('Missing required fields', { status: 400 })

    const firstName = (name ?? '').split(' ')[0] || 'there'
    const adminName = profile.display_name ?? 'Your admin'
    const gName     = group_name ?? 'a group'

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1c1917;padding:24px">
        <h2 style="font-size:22px;font-weight:700;margin:0 0 8px">You're invited to ${gName} on Covey Space</h2>
        <p style="color:#57534e;margin:0 0 28px;line-height:1.6">
          Hi ${firstName}, ${adminName} has invited you to join their group on Covey Space —
          a private app for your community to coordinate meals, prayer, events, and more.
        </p>
        <a href="${invite_url}"
           style="display:inline-block;background:#C4622D;color:#fff;font-weight:600;padding:14px 28px;border-radius:12px;text-decoration:none;margin-bottom:24px">
          Join the Group
        </a>
        <p style="font-size:13px;color:#78716c;margin:0 0 24px">
          Or copy this link: <a href="${invite_url}" style="color:#C4622D">${invite_url}</a>
        </p>
        <hr style="border:none;border-top:1px solid #e7e5e4;margin:0 0 16px" />
        <p style="font-size:12px;color:#a8a29e;margin:0">
          Sent by ${adminName} via Covey Space. If you weren't expecting this, you can safely ignore it.
        </p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [email],
        subject: `You're invited to join ${gName} on Covey Space`,
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Resend error ${res.status}: ${body}`)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  } catch (err: any) {
    console.error(err)
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }
})
