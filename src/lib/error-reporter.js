import { supabase } from './supabase'

const _seen = new Map() // message -> timestamp, for throttling

export async function reportError(error, context = {}) {
  if (!import.meta.env.PROD) return
  const message = error instanceof Error ? error.message : String(error)
  if (!message || message === 'undefined' || message === 'null') return

  const now = Date.now()
  if (_seen.has(message) && now - _seen.get(message) < 5000) return
  _seen.set(message, now)

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return // unauthenticated users can't insert; auth errors aren't app bugs
    let display_name = null
    if (user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle()
      display_name = profile?.display_name ?? null
    }
    await supabase.from('client_errors').insert({
      user_id: user?.id ?? null,
      display_name,
      error_message: message,
      error_stack: error instanceof Error ? (error.stack ?? null) : null,
      component: context.component ?? null,
      route: window.location.pathname,
      metadata: context.metadata ?? null,
    })
  } catch {
    // never let error reporting break the app
  }
}
