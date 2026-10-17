import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { haptic } from '../lib/haptic.js'

export function useReactionHandlers({ convId, groupId, myId, closeMenu }) {
  const [reactions, setReactions] = useState({})
  const [justReacted, setJustReacted] = useState({})
  const justReactedTimers = useRef({})

  useEffect(() => {
    setReactions({})
    setJustReacted({})
  }, [convId])

  useEffect(() => {
    return () => { Object.values(justReactedTimers.current).forEach(clearTimeout) }
  }, [])

  useEffect(() => {
    const rxCh = supabase
      .channel(`chat-rx:${convId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'reactions',
        filter: `community_group_id=eq.${groupId}`,
      }, ({ new: r }) => {
        setReactions(prev => ({
          ...prev,
          [r.message_id]: {
            ...(prev[r.message_id] ?? {}),
            [r.emoji]: [...(prev[r.message_id]?.[r.emoji] ?? []), r],
          },
        }))
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'reactions',
        filter: `community_group_id=eq.${groupId}`,
      }, ({ old: r }) => {
        setReactions(prev => {
          if (!prev[r.message_id]) return prev
          const byEmoji = { ...prev[r.message_id] }
          const filtered = (byEmoji[r.emoji] ?? []).filter(x => x.id !== r.id)
          if (filtered.length) byEmoji[r.emoji] = filtered
          else delete byEmoji[r.emoji]
          return { ...prev, [r.message_id]: byEmoji }
        })
      })
      .subscribe()
    return () => supabase.removeChannel(rxCh)
  }, [convId, groupId])

  async function toggleReaction(messageId, emoji) {
    const existing = reactions[messageId]?.[emoji]?.find(r => r.user_id === myId)
    haptic()
    closeMenu()
    if (existing) {
      // Optimistic remove — the realtime DELETE handler also fires and is a no-op.
      setReactions(prev => {
        if (!prev[messageId]?.[emoji]) return prev
        const byEmoji = { ...prev[messageId] }
        const filtered = byEmoji[emoji].filter(r => r.id !== existing.id)
        if (filtered.length) byEmoji[emoji] = filtered
        else delete byEmoji[emoji]
        return { ...prev, [messageId]: byEmoji }
      })
      const { error } = await supabase.from('reactions').delete().eq('id', existing.id)
      if (error) {
        setReactions(prev => ({
          ...prev,
          [messageId]: {
            ...(prev[messageId] ?? {}),
            [emoji]: [...(prev[messageId]?.[emoji] ?? []), existing],
          },
        }))
      }
    } else {
      const key = `${messageId}:${emoji}`
      setJustReacted(prev => ({ ...prev, [key]: true }))
      clearTimeout(justReactedTimers.current[key])
      justReactedTimers.current[key] = setTimeout(() => {
        setJustReacted(prev => { const n = { ...prev }; delete n[key]; return n })
        delete justReactedTimers.current[key]
      }, 650)
      await supabase.from('reactions').insert({
        message_id: messageId,
        community_group_id: groupId,
        user_id: myId,
        emoji,
      })
    }
  }

  return { reactions, setReactions, justReacted, toggleReaction }
}
