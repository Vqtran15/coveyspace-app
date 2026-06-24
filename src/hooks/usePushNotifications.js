import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function usePushNotifications(userId, groupId) {
  const supported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && !!VAPID_PUBLIC_KEY
    && window.matchMedia('(display-mode: standalone)').matches

  const [permission, setPermission]   = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [subscribed, setSubscribed]   = useState(false)
  const [toggling, setToggling]       = useState(false)

  useEffect(() => {
    if (!supported || !userId || !groupId) return
    const timer = setTimeout(() => {
      Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 5000)),
      ])
        .then(reg => reg.pushManager.getSubscription())
        .then(sub => setSubscribed(!!sub))
        .catch(() => {})
    }, 2000)
    return () => clearTimeout(timer)
  }, [supported, userId, groupId])

  async function swReady() {
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Service worker timed out')), 10000)
      ),
    ])
  }

  async function subscribe() {
    if (!supported || !userId || !groupId) return
    setToggling(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      const reg = await swReady()
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const json = sub.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id:            userId,
        community_group_id: groupId,
        endpoint:           json.endpoint,
        subscription:       json,
      }, { onConflict: 'user_id,endpoint' })

      if (error) throw error
      setSubscribed(true)
    } catch (err) {
      console.error('Push subscribe error:', err)
      alert(`Notification setup failed: ${err?.message ?? err}`)
    } finally {
      setToggling(false)
    }
  }

  async function unsubscribe() {
    setToggling(true)
    try {
      const reg = await swReady()
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (err) {
      console.error('Push unsubscribe error:', err)
    } finally {
      setToggling(false)
    }
  }

  function toggle() {
    return subscribed ? unsubscribe() : subscribe()
  }

  return { supported, permission, subscribed, toggling, toggle }
}
