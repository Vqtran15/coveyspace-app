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

  const [permission, setPermission]   = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [subscribed, setSubscribed]   = useState(false)
  const [toggling, setToggling]       = useState(false)

  useEffect(() => {
    if (!supported || !userId || !groupId) return
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub))
    )
  }, [supported, userId, groupId])

  async function subscribe() {
    if (!supported) return
    setToggling(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const json = sub.toJSON()
      await supabase.from('push_subscriptions').upsert({
        user_id:            userId,
        community_group_id: groupId,
        endpoint:           json.endpoint,
        subscription:       json,
      }, { onConflict: 'user_id, endpoint' })

      setSubscribed(true)
    } finally {
      setToggling(false)
    }
  }

  async function unsubscribe() {
    setToggling(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } finally {
      setToggling(false)
    }
  }

  function toggle() {
    return subscribed ? unsubscribe() : subscribe()
  }

  return { supported, permission, subscribed, toggling, toggle }
}
