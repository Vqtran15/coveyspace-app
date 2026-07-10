import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL       = Deno.env.get('VAPID_EMAIL') ?? 'mailto:vqtran15@gmail.com'
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

function jwtRole(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.role ?? null
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  // Supabase verifies the JWT signature before the function runs.
  // We only need to check that the verified JWT carries the service_role claim.
  const role = jwtRole(req.headers.get('Authorization') ?? '')
  if (role !== 'service_role') {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const { group_id, title, body, url } = await req.json()

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'Missing title or body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    let subsQuery = supabase.from('push_subscriptions').select('id, subscription, user_id')

    if (group_id) {
      // Resolve current members from profiles to avoid stale community_group_id on subscriptions
      const { data: members, error: mErr } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('community_group_id', group_id)
      if (mErr) throw mErr
      const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id)
      if (!memberIds.length) {
        return new Response(JSON.stringify({ sent: 0, stale: 0 }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      subsQuery = subsQuery.in('user_id', memberIds)
    }

    const { data: subs, error } = await subsQuery
    if (error) throw error
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, stale: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const notification = JSON.stringify({ title, body, url: url || '/' })

    const staleIds: string[] = []
    const notifiedUsers = new Set<string>()

    await Promise.allSettled(
      subs.map(async (row) => {
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

    return new Response(JSON.stringify({ sent: notifiedUsers.size, stale: staleIds.length }), {
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
