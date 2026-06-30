const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const TO_EMAIL       = 'vuong.tran@coveyspace.com'
const FROM_EMAIL     = 'feedback@coveyspace.com'

const TYPE_LABELS: Record<string, string> = {
  bug:     '🐛 Bug Report',
  feature: '💡 Feature Idea',
  general: '💬 General Feedback',
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record  = payload.record

    if (!record?.message || !record?.type) {
      return new Response('Missing fields', { status: 400 })
    }

    const typeLabel   = TYPE_LABELS[record.type] ?? record.type
    const displayName = record.display_name ?? 'Unknown'
    const email       = record.email        ?? 'Unknown'
    const groupName   = record.group_name   ?? 'Unknown'
    const submittedAt = new Date(record.created_at).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      dateStyle: 'medium',
      timeStyle: 'short',
    })

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1c1917">
        <div style="background:#f0faf5;border-left:4px solid #16a34a;padding:16px 20px;border-radius:8px;margin-bottom:24px">
          <p style="margin:0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#16a34a">${typeLabel}</p>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px">
          <tr>
            <td style="padding:8px 0;color:#78716c;width:110px">From</td>
            <td style="padding:8px 0;font-weight:600">${displayName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#78716c">Email</td>
            <td style="padding:8px 0">${email}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#78716c">Group</td>
            <td style="padding:8px 0">${groupName}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#78716c">Submitted</td>
            <td style="padding:8px 0">${submittedAt} PT</td>
          </tr>
        </table>

        <div style="background:#f5f5f4;border-radius:8px;padding:16px 20px;font-size:15px;line-height:1.6;white-space:pre-wrap">${record.message}</div>

        <p style="margin-top:24px;font-size:12px;color:#a8a29e">
          Reply directly to ${email} to respond to this feedback.
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
        from:       FROM_EMAIL,
        to:         [TO_EMAIL],
        reply_to:   email !== 'Unknown' ? email : undefined,
        subject:    `[Covey Space] ${typeLabel} from ${displayName}`,
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
