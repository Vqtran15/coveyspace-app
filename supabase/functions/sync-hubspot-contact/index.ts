import { createClient } from 'jsr:@supabase/supabase-js@2'

const HUBSPOT_TOKEN = Deno.env.get('HUBSPOT_PRIVATE_TOKEN')!
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record  = payload.record  // profiles row

    if (!record?.user_id) {
      return new Response('Missing record', { status: 400 })
    }

    // Get email from auth
    const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(record.user_id)
    if (authErr) console.error('getUserById error:', authErr)
    const email = authData?.user?.email
    if (!email) return new Response('No email found', { status: 200 })

    // Get group name
    const { data: group, error: groupErr } = await supabase
      .from('community_groups')
      .select('name')
      .eq('id', record.community_group_id)
      .single()
    if (groupErr) console.error('community_groups lookup error:', groupErr)

    // Split display_name into first / last
    const parts     = (record.display_name ?? '').trim().split(/\s+/)
    const firstname = parts[0] ?? ''
    const lastname  = parts.slice(1).join(' ')

    // HubSpot Date properties require a Unix millisecond timestamp at midnight UTC
    const d = new Date(record.created_at ?? Date.now())
    d.setUTCHours(0, 0, 0, 0)
    const joinedMs = d.getTime()

    // Upsert contact — creates if new, updates if email already exists
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: [{
          idProperty: 'email',
          id: email,
          properties: {
            email,
            firstname,
            lastname,
            coveyspace_group:     group?.name ?? '',
            coveyspace_joined_at: joinedMs,
          },
        }],
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HubSpot error ${res.status}: ${body}`)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error(err)
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
