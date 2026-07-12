import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(url, key, {
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
