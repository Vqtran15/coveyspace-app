import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const TO_EMAIL       = 'vuong.tran@coveyspace.com'
const FROM_EMAIL     = 'feedback@coveyspace.com'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record  = payload.record  // profiles row

    if (!record?.user_id) {
      return new Response('Missing record', { status: 400 })
    }

    // Look up the user's email
    const { data: { user } } = await supabase.auth.admin.getUserById(record.user_id)
    const userEmail   = user?.email ?? 'Unknown'
    const displayName = record.display_name ?? 'Unknown'

    // Look up the group name and invite code
    const { data: group } = await supabase
      .from('community_groups')
      .select('name, invite_code')
      .eq('id', record.community_group_id)
      .single()
    const groupName  = group?.name        ?? 'Unknown'
    const inviteCode = group?.invite_code ?? 'Unknown'

    // Determine if they created or joined (first member = creator)
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('community_group_id', record.community_group_id)
    const action = count === 1 ? 'Created group' : 'Joined group'

    const joinedAt = new Date(record.created_at).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      dateStyle: 'medium',
      timeStyle: 'short',
    })

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1c1917">
        <div style="background:#f0faf5;border-left:4px solid #16a34a;padding:16px 20px;border-radius:8px;margin-bottom:24px">
          <p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#16a34a">New User Signed Up</p>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px">
          <tr>
            <td style="padding:8px 0;color:#78716c;width:120px">Name</td>
            <td style="padding:8px 0;font-weight:600">${displayName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#78716c">Email</td>
            <td style="padding:8px 0">${userEmail}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#78716c">Group</td>
            <td style="padding:8px 0;font-weight:600">${groupName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#78716c">Invite Code</td>
            <td style="padding:8px 0;font-family:monospace;font-weight:700;letter-spacing:0.1em">${inviteCode}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#78716c">Action</td>
            <td style="padding:8px 0">${action}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#78716c">Signed up</td>
            <td style="padding:8px 0">${joinedAt} PT</td>
          </tr>
        </table>

        <p style="margin-top:24px;font-size:12px;color:#a8a29e">
          Covey Space — automated notification
        </p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [TO_EMAIL],
        subject: `[Covey Space] New user: ${displayName} → ${groupName}`,
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Resend error ${res.status}: ${body}`)
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
