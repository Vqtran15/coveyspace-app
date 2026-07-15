import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

// Cookie-based storage so the session is shared between Safari and the
// installed PWA standalone context on iOS (localStorage is not shared).
const secure = location.protocol === 'https:' ? '; Secure' : ''
const cookieStorage = {
  getItem(key) {
    const match = document.cookie.match(
      new RegExp('(?:^|; )' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
    )
    return match ? decodeURIComponent(match[1]) : null
  },
  setItem(key, value) {
    const expires = new Date(Date.now() + 365 * 864e5).toUTCString()
    document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`
  },
  removeItem(key) {
    document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax${secure}`
  },
}

export const supabase = createClient(url, key, {
  auth: {
    storage: cookieStorage,
    persistSession: true,
  },
  global: {
    fetch: async (input, init = {}) => {
      try {
        return await fetch(input, { ...init, cache: 'no-store' })
      } catch (err) {
        // Only report non-auth network failures; auth 400s/401s are expected session events
        const url = typeof input === 'string' ? input : input?.url ?? ''
        if (!url.includes('/auth/v1/')) {
          import('./error-reporter').then(({ reportError }) =>
            reportError(err, { component: 'supabase-network' })
          )
        }
        throw err
      }
    },
  },
})
