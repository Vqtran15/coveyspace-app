import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL       = Deno.env.get('VAPID_EMAIL') ?? 'mailto:vqtran15@gmail.com'
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const message = payload.record

    if (!message?.id || !message?.user_id || !message?.community_group_id) {
      return new Response('Missing fields', { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Look up sender's display name
    const { data: sender } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', message.user_id)
      .single()

    const senderName = sender?.display_name ?? 'Someone'
    const msgPreview = message.body
      ? (message.body.length > 80 ? message.body.slice(0, 77) + '…' : message.body)
      : '📷 photo'

    // Fetch push subscriptions for all group members except the sender
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, subscription')
      .eq('community_group_id', message.community_group_id)
      .neq('user_id', message.user_id)

    if (error) throw error
    if (!subs?.length) return new Response('No subscribers', { status: 200 })

    const notification = JSON.stringify({
      title: senderName,
      body:  msgPreview,
      url:   '/chat',
    })

    const staleIds: string[] = []
    const errors: string[]   = []

    await Promise.allSettled(
      subs.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription, notification)
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleIds.push(row.id)
          } else {
            const msg = `push failed [${err.statusCode}]: ${err.body ?? err.message}`
            console.error(msg, row.endpoint)
            errors.push(msg)
          }
        }
      })
    )

    if (staleIds.length) {
      await supabase.from('push_subscriptions').delete().in('id', staleIds)
    }

    const sent = subs.length - staleIds.length - errors.length
    return new Response(JSON.stringify({ sent, stale: staleIds.length, errors }), {
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
