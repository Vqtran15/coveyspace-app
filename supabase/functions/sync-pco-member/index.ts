import { createClient } from 'jsr:@supabase/supabase-js@2'

const PCO_CLIENT_ID     = Deno.env.get('PCO_CLIENT_ID')!
const PCO_CLIENT_SECRET = Deno.env.get('PCO_CLIENT_SECRET')!
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const PCO_TOKEN_URL = 'https://api.planningcenteronline.com/oauth/token'
const PCO_API_BASE  = 'https://api.planningcenteronline.com'

async function refreshPcoToken(supabase: any, conn: any): Promise<string> {
  const res = await fetch(PCO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type:    'refresh_token',
      refresh_token: conn.refresh_token,
      client_id:     PCO_CLIENT_ID,
      client_secret: PCO_CLIENT_SECRET,
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  const tokens = await res.json()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  await supabase
    .from('planning_center_connections')
    .update({ access_token: tokens.access_token, token_expires_at: expiresAt })
    .eq('id', conn.id)
  return tokens.access_token
}

async function pcoPost(path: string, body: unknown, token: string) {
  return fetch(`${PCO_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: JSON.stringify(body),
  })
}

async function pcoGet(path: string, token: string) {
  return fetch(`${PCO_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept:        'application/json',
    },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    })
  }

  try {
    const payload = await req.json()
    const record  = payload.record as Record<string, any>

    if (!record?.user_id || !record?.community_group_id) {
      return new Response('Missing profile data', { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // Load PCO connection for this group
    const { data: conn } = await supabase
      .from('planning_center_connections')
      .select('*')
      .eq('community_group_id', record.community_group_id)
      .single()

    // Skip if no PCO connection or no sync group configured
    if (!conn?.pco_sync_group_id) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Refresh token if near expiry (60s buffer)
    let accessToken: string = conn.access_token
    if (new Date(conn.token_expires_at).getTime() - 60_000 <= Date.now()) {
      accessToken = await refreshPcoToken(supabase, conn)
    }

    // Get user email from auth
    const { data: authUser } = await supabase.auth.admin.getUserById(record.user_id)
    const email = authUser?.user?.email
    if (!email) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'no email' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Derive names — prefer stored first/last, fall back to splitting display_name
    const parts     = (record.display_name ?? '').trim().split(/\s+/)
    const firstName: string = record.first_name || parts[0] || 'Member'
    const lastName:  string | null = record.last_name || parts.slice(1).join(' ') || null

    // ── 1. Find existing PCO person by email ──────────────────────────────────
    let personId: string | null = null

    const emailSearch = await pcoGet(
      `/people/v2/emails?where[address]=${encodeURIComponent(email)}&include=person&per_page=1`,
      accessToken
    )
    if (emailSearch.ok) {
      const emailData = await emailSearch.json()
      // `included` contains Person records when include=person is used
      if (Array.isArray(emailData.included) && emailData.included.length > 0) {
        personId = emailData.included[0].id
      }
    }

    // ── 2. Create person + email if not found ─────────────────────────────────
    if (!personId) {
      const createRes = await pcoPost('/people/v2/people', {
        data: {
          type: 'Person',
          attributes: {
            first_name: firstName,
            ...(lastName ? { last_name: lastName } : {}),
            status: 'active',
          },
        },
      }, accessToken)

      if (!createRes.ok) {
        const body = await createRes.text()
        throw new Error(`Create PCO person failed ${createRes.status}: ${body}`)
      }
      const created = await createRes.json()
      personId = created.data.id

      // Attach email to the new person
      await pcoPost(`/people/v2/people/${personId}/emails`, {
        data: {
          type: 'Email',
          attributes: { address: email, location: 'Home', primary: true },
        },
      }, accessToken)
    }

    // ── 3. Add person to the PCO Group ────────────────────────────────────────
    const memberRes = await pcoPost(
      `/groups/v2/groups/${conn.pco_sync_group_id}/memberships`,
      {
        data: {
          type: 'Membership',
          attributes: { role: 'member' },
          relationships: {
            person: { data: { type: 'Person', id: personId } },
          },
        },
      },
      accessToken
    )

    // 422 = already a member — not an error
    if (!memberRes.ok && memberRes.status !== 422) {
      const body = await memberRes.text()
      console.error(`Add to PCO group failed ${memberRes.status}: ${body}`)
    }

    return new Response(JSON.stringify({ ok: true, personId }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('sync-pco-member error:', err)
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
