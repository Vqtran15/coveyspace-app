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
    const msg = payload.record

    if (!msg?.community_group_id || !msg?.user_id) {
      return new Response('Missing fields', { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    let recipientIds: string[] | null = null

    // If we have a conversation_id, scope to conversation members only
    if (msg.conversation_id) {
      const { data: convMembers, error: convErr } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', msg.conversation_id)
        .neq('user_id', msg.user_id)

      if (convErr) throw convErr
      if (!convMembers?.length) return new Response('No recipients', { status: 200 })
      recipientIds = convMembers.map((m: { user_id: string }) => m.user_id)
    }

    // Fetch push subscriptions for recipients
    let subsQuery = supabase
      .from('push_subscriptions')
      .select('id, endpoint, subscription')
      .eq('community_group_id', msg.community_group_id)
      .neq('user_id', msg.user_id)

    if (recipientIds) {
      subsQuery = subsQuery.in('user_id', recipientIds)
    }

    const { data: subs, error } = await subsQuery
    if (error) throw error
    if (!subs?.length) return new Response('No subscribers', { status: 200 })

    const title = msg.display_name ?? 'New message'
    const body  = msg.body
      ? msg.body.length > 100 ? msg.body.slice(0, 97) + '…' : msg.body
      : '📷 Image'

    const notification = JSON.stringify({ title, body, url: '/chat' })

    const staleIds: string[] = []

    await Promise.allSettled(
      subs.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription, notification)
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleIds.push(row.id)
          }
        }
      })
    )

    if (staleIds.length) {
      await supabase.from('push_subscriptions').delete().in('id', staleIds)
    }

    return new Response(JSON.stringify({ sent: subs.length - staleIds.length }), {
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
