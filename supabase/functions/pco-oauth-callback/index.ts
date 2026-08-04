import { createClient } from 'jsr:@supabase/supabase-js@2'

const PCO_CLIENT_ID     = Deno.env.get('PCO_CLIENT_ID')!
const PCO_CLIENT_SECRET = Deno.env.get('PCO_CLIENT_SECRET')!
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL           = Deno.env.get('APP_URL') ?? 'https://app.coveyspace.com'

const REDIRECT_URI  = `${SUPABASE_URL}/functions/v1/pco-oauth-callback`
const PCO_TOKEN_URL = 'https://api.planningcenteronline.com/oauth/token'
const PCO_API_BASE  = 'https://api.planningcenteronline.com'

Deno.serve(async (req) => {
  const url     = new URL(req.url)
  const code    = url.searchParams.get('code')
  const stateId = url.searchParams.get('state')

  if (!code || !stateId) {
    return Response.redirect(`${APP_URL}/admin?pco=error`, 302)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Declared outside try so the catch block can redirect to the right origin
  let errorUrl = `${APP_URL}/admin?pco=error`

  try {
    // Validate and immediately consume the state token (one-time use)
    const { data: state } = await supabase
      .from('pco_oauth_states')
      .select('*')
      .eq('id', stateId)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (!state) return Response.redirect(errorUrl, 302)

    // Point error redirect at the same origin the admin came from (staging or prod)
    errorUrl = state.return_url.replace(/[?#].*$/, '') + '?pco=error'

    await supabase.from('pco_oauth_states').delete().eq('id', stateId)

    // Exchange authorization code for tokens
    const tokenRes = await fetch(PCO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:    'authorization_code',
        code,
        client_id:     PCO_CLIENT_ID,
        client_secret: PCO_CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
      }),
    })

    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`)
    const tokens = await tokenRes.json()

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Fetch organization info from PCO People API
    let pcoOrgId: string | null   = null
    let pcoOrgName: string | null = null
    try {
      const orgRes = await fetch(`${PCO_API_BASE}/people/v2`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (orgRes.ok) {
        const orgData = await orgRes.json()
        pcoOrgId   = orgData.meta?.parent?.id   ?? null
        pcoOrgName = orgData.meta?.parent?.name ?? null
      }
    } catch (_) { /* org name is optional — don't fail the whole flow */ }

    await supabase
      .from('planning_center_connections')
      .upsert({
        community_group_id:   state.community_group_id,
        pco_organization_id:  pcoOrgId,
        pco_organization_name: pcoOrgName,
        access_token:         tokens.access_token,
        refresh_token:        tokens.refresh_token,
        token_expires_at:     expiresAt,
        connected_by:         state.created_by,
        connected_at:         new Date().toISOString(),
      }, { onConflict: 'community_group_id' })

    return Response.redirect(state.return_url, 302)
  } catch (err: any) {
    console.error(err)
    return Response.redirect(errorUrl ?? `${APP_URL}/admin?pco=error`, 302)
  }
})
