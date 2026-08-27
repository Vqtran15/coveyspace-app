import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    // Auth: caller must be a church admin (independent of their active group)
    const { data: churchRole } = await supabase
      .from('church_roles')
      .select('church_id')
      .eq('user_id', user.id)
      .single()

    if (!churchRole) return new Response('Forbidden', { status: 403 })

    // Delete the PCO connection for any group in this admin's church
    const { data: churchGroups } = await supabase
      .from('community_groups')
      .select('id')
      .eq('church_id', churchRole.church_id)

    const groupIds = (churchGroups ?? []).map((g: any) => g.id)

    if (groupIds.length) {
      await supabase
        .from('planning_center_connections')
        .delete()
        .in('community_group_id', groupIds)
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
