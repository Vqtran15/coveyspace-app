import { createContext, useContext } from 'react'

export const ChatContext = createContext(null)

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used within a ChatContext.Provider')
  return ctx
}

// Separate context for compose/input state so MessageList doesn't re-render on keystrokes
export const ChatInputContext = createContext(null)

export function useChatInputContext() {
  const ctx = useContext(ChatInputContext)
  if (!ctx) throw new Error('useChatInputContext must be used within a ChatInputContext.Provider')
  return ctx
}
