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

    // church_messages columns: church_conversation_id, user_id, display_name,
    // body, image_url, audience, target_group_ids
    if (!msg?.church_conversation_id || !msg?.user_id) {
      return new Response('Missing fields', { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // All members of this conversation except the sender
    const { data: convMembers, error: convErr } = await supabase
      .from('church_conversation_members')
      .select('user_id')
      .eq('conversation_id', msg.church_conversation_id)
      .neq('user_id', msg.user_id)

    if (convErr) throw convErr
    if (!convMembers?.length) return new Response('No recipients', { status: 200 })

    let recipientIds: string[] = convMembers.map((m: { user_id: string }) => m.user_id)

    // Targeted broadcasts: filter recipients to members of the specified groups
    if (msg.target_group_ids?.length) {
      const { data: groupMembers } = await supabase
        .from('group_memberships')
        .select('user_id')
        .in('community_group_id', msg.target_group_ids)

      const targeted = new Set((groupMembers ?? []).map((m: { user_id: string }) => m.user_id))
      recipientIds = recipientIds.filter((id: string) => targeted.has(id))
    }

    if (!recipientIds.length) return new Response('No recipients after filter', { status: 200 })

    // Push subscriptions for all recipients (users may have multiple devices)
    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('id, subscription, user_id')
      .in('user_id', recipientIds)

    if (subsErr) throw subsErr
    if (!subs?.length) return new Response('No push subscriptions', { status: 200 })

    const senderName = msg.display_name ?? 'Someone'
    const plainBody = msg.body
      ? msg.body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
      : ''
    const msgPreview = plainBody
      ? (plainBody.length > 100 ? plainBody.slice(0, 97) + '…' : plainBody)
      : '📷 Photo'

    const title = msg.audience === 'admins_only'
      ? `Leaders: ${senderName}`
      : senderName

    const notification = JSON.stringify({ title, body: msgPreview, url: '/chat' })

    const staleIds: string[] = []
    const notifiedUsers = new Set<string>()

    await Promise.allSettled(
      subs.map(async (row: any) => {
        try {
          await webpush.sendNotification(row.subscription, notification)
          notifiedUsers.add(row.user_id)
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) staleIds.push(row.id)
        }
      })
    )

    if (staleIds.length) {
      await supabase.from('push_subscriptions').delete().in('id', staleIds)
    }

    return new Response(
      JSON.stringify({ sent: notifiedUsers.size, stale: staleIds.length }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    console.error(err)
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
