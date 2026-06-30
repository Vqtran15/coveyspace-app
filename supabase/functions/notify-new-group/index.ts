const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const TO_EMAIL       = 'vuong.tran@coveyspace.com'
const FROM_EMAIL     = 'feedback@coveyspace.com'

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record  = payload.record

    if (!record?.id) {
      return new Response('Missing record', { status: 400 })
    }

    const groupName  = record.name      ?? 'Unknown'
    const groupId    = record.id        ?? 'Unknown'
    const inviteCode = record.invite_code ?? 'Unknown'
    const createdAt  = new Date(record.created_at).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      dateStyle: 'medium',
      timeStyle: 'short',
    })

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1c1917">
        <div style="background:#f0faf5;border-left:4px solid #16a34a;padding:16px 20px;border-radius:8px;margin-bottom:24px">
          <p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#16a34a">New Group Created</p>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px">
          <tr>
            <td style="padding:8px 0;color:#78716c;width:120px">Group Name</td>
            <td style="padding:8px 0;font-weight:600">${groupName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#78716c">Group ID</td>
            <td style="padding:8px 0;font-family:monospace;font-size:13px">${groupId}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#78716c">Invite Code</td>
            <td style="padding:8px 0;font-family:monospace;font-weight:700;letter-spacing:0.1em">${inviteCode}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#78716c">Created</td>
            <td style="padding:8px 0">${createdAt} PT</td>
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
        subject: `[Covey Space] New group: ${groupName}`,
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
