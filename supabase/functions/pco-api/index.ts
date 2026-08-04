import { createClient } from 'jsr:@supabase/supabase-js@2'

const PCO_CLIENT_ID     = Deno.env.get('PCO_CLIENT_ID')!
const PCO_CLIENT_SECRET = Deno.env.get('PCO_CLIENT_SECRET')!
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const PCO_API_BASE  = 'https://api.planningcenteronline.com'
const PCO_TOKEN_URL = 'https://api.planningcenteronline.com/oauth/token'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Conn = { community_group_id: string; access_token: string; refresh_token: string; token_expires_at: string }

async function refreshToken(supabase: ReturnType<typeof createClient>, conn: Conn): Promise<string> {
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
    .update({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, token_expires_at: expiresAt })
    .eq('community_group_id', conn.community_group_id)
  return tokens.access_token as string
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
      .select('community_group_id, role')
      .eq('user_id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return new Response('Forbidden', { status: 403 })
    }

    const { path, method = 'GET', body: reqBody } = await req.json()

    if (typeof path !== 'string' || !path.startsWith('/')) {
      return new Response('Invalid path', { status: 400 })
    }

    const { data: conn } = await supabase
      .from('planning_center_connections')
      .select('*')
      .eq('community_group_id', profile.community_group_id)
      .single()

    if (!conn) {
      return new Response(JSON.stringify({ error: 'Not connected to Planning Center' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // Refresh access token if expired (with a 60s buffer)
    let accessToken = conn.access_token
    if (new Date(conn.token_expires_at).getTime() - 60_000 <= Date.now()) {
      accessToken = await refreshToken(supabase, conn)
    }

    const pcoRes = await fetch(`${PCO_API_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      ...(reqBody ? { body: JSON.stringify(reqBody) } : {}),
    })

    const data = await pcoRes.json()

    return new Response(JSON.stringify(data), {
      status: pcoRes.status,
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
