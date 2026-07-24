import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL       = Deno.env.get('VAPID_EMAIL') ?? 'mailto:vqtran15@gmail.com'
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

Deno.serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Fetch all profile-linked birthdays
    const { data: allBirthdays, error: bdayErr } = await supabase
      .from('birthdays')
      .select('name, birthday, profile_user_id, community_group_id')
      .not('profile_user_id', 'is', null)
      .not('birthday', 'is', null)

    if (bdayErr) throw bdayErr

    // Match by month+day in UTC so the cron time determines the "day"
    const now = new Date()
    const todayMonth = now.getUTCMonth() + 1
    const todayDay = now.getUTCDate()

    const todaysBirthdays = (allBirthdays ?? []).filter(b => {
      const [, m, d] = b.birthday.split('-').map(Number)
      return m === todayMonth && d === todayDay
    })

    if (todaysBirthdays.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No birthdays today' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let totalSent = 0
    const errors: string[] = []

    for (const bday of todaysBirthdays) {
      const firstName = bday.name.split(' ')[0]
      const notification = JSON.stringify({
        title: '🎂 Happy Birthday!',
        body:  `It's ${firstName}'s birthday today! Wish ${firstName} a happy birthday!`,
        url:   '/',
      })

      // Fetch push subscriptions for all group members except the birthday person
      const { data: subs, error: subErr } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, subscription')
        .eq('community_group_id', bday.community_group_id)
        .neq('user_id', bday.profile_user_id)

      if (subErr) {
        errors.push(`subs fetch failed for ${firstName}: ${subErr.message}`)
        continue
      }
      if (!subs?.length) continue

      const staleIds: string[] = []

      await Promise.allSettled(
        subs.map(async (row) => {
          try {
            await webpush.sendNotification(row.subscription, notification)
            totalSent++
          } catch (err: any) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              staleIds.push(row.id)
            } else {
              errors.push(`push failed [${err.statusCode}]: ${err.body ?? err.message}`)
            }
          }
        })
      )

      if (staleIds.length) {
        await supabase.from('push_subscriptions').delete().in('id', staleIds)
      }
    }

    return new Response(
      JSON.stringify({ sent: totalSent, birthdays: todaysBirthdays.length, errors }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error(err)
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
