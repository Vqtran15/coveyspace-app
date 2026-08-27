import { createClient } from 'jsr:@supabase/supabase-js@2'

const PCO_CLIENT_ID = Deno.env.get('PCO_CLIENT_ID')!
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/pco-oauth-callback`
const PCO_SCOPES   = 'people groups giving'

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
      .select('community_group_id, role')
      .eq('user_id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return new Response('Forbidden', { status: 403 })
    }

    const { return_url } = await req.json()

    const { data: state, error: stateErr } = await supabase
      .from('pco_oauth_states')
      .insert({
        community_group_id: profile.community_group_id,
        created_by: user.id,
        return_url: return_url ?? `${Deno.env.get('APP_URL') ?? 'https://app.coveyspace.com'}/admin?pco=connected`,
      })
      .select('id')
      .single()

    if (stateErr || !state) throw new Error('Failed to create OAuth state')

    const params = new URLSearchParams({
      client_id:     PCO_CLIENT_ID,
      redirect_uri:  REDIRECT_URI,
      response_type: 'code',
      scope:         PCO_SCOPES,
      state:         state.id,
    })

    const auth_url = `https://api.planningcenteronline.com/oauth/authorize?${params}`

    return new Response(JSON.stringify({ auth_url }), {
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
