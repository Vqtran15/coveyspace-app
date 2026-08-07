import { supabase } from './supabase.js'

const MSG_SELECT = '*, reply_message:reply_to_id(id, body, display_name, image_url)'

export const db = {
  messages: {
    fetchPage: (convId, limit, before = null) => {
      let q = supabase
        .from('messages')
        .select(MSG_SELECT)
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (before) q = q.lt('created_at', before)
      return q
    },
    send: ({ groupId, convId, userId, displayName, body, imageUrl = null, replyToId = null, imageWidth = null, imageHeight = null, pollId = null }) =>
      supabase.from('messages').insert({
        community_group_id: groupId,
        conversation_id: convId,
        user_id: userId,
        display_name: displayName || 'Member',
        body,
        image_url: imageUrl,
        reply_to_id: replyToId,
        image_width: imageWidth,
        image_height: imageHeight,
        poll_id: pollId,
      }).select(MSG_SELECT).single(),
    update: (id, body) =>
      supabase.from('messages').update({ body }).eq('id', id),
    delete: (id) =>
      supabase.from('messages').delete().eq('id', id),
  },

  reactions: {
    fetch: (messageIds) =>
      supabase.from('reactions').select('id, message_id, emoji, user_id').in('message_id', messageIds),
    add: ({ messageId, groupId, userId, emoji }) =>
      supabase.from('reactions').insert({ message_id: messageId, community_group_id: groupId, user_id: userId, emoji }),
    remove: (reactionId) =>
      supabase.from('reactions').delete().eq('id', reactionId),
  },

  polls: {
    fetch: (pollIds) => Promise.all([
      supabase.from('polls').select('id, question, options').in('id', pollIds),
      supabase.from('poll_votes').select('poll_id, user_id, option_index').in('poll_id', pollIds),
    ]),
    insert: ({ groupId, convId, userId, question, options }) =>
      supabase.from('polls').insert({
        community_group_id: groupId,
        conversation_id: convId,
        question,
        options: options.map(text => ({ text })),
        created_by: userId,
      }).select('id').single(),
    update: (id, { question, options }) =>
      supabase.from('polls').update({ question, options: options.map(text => ({ text })) }).eq('id', id),
    delete: (id) =>
      supabase.from('polls').delete().eq('id', id),
    vote: (pollId, userId, optionIndex) =>
      supabase.from('poll_votes').upsert({ poll_id: pollId, user_id: userId, option_index: optionIndex }),
    resetVotes: (pollId) =>
      supabase.from('poll_votes').delete().eq('poll_id', pollId),
  },

  events: {
    fetch: (groupId) =>
      supabase.from('events').select('*').eq('community_group_id', groupId).order('event_date', { ascending: true }),
    fetchWithRsvps: (eventIds) => Promise.all([
      supabase.from('events').select('id, title, event_date, event_time, location').in('id', eventIds),
      supabase.from('event_rsvps').select('event_id, user_id, status, profiles(display_name, avatar_icon, avatar_color, avatar_image_url)').in('event_id', eventIds),
    ]),
    insert: (payload) =>
      supabase.from('events').insert(payload),
    update: (id, payload) =>
      supabase.from('events').update(payload).eq('id', id),
    delete: (id) =>
      supabase.from('events').delete().eq('id', id),
    rsvp: (eventId, userId, status) =>
      supabase.from('event_rsvps').upsert({ event_id: eventId, user_id: userId, status }, { onConflict: 'event_id,user_id' }),
    removeRsvp: (eventId, userId) =>
      supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', userId),
    fetchRsvps: (eventIds) =>
      supabase.from('event_rsvps').select('event_id, user_id, status, profiles(display_name, avatar_icon, avatar_color, avatar_image_url)').in('event_id', eventIds),
  },

  profiles: {
    fetch: (userId) =>
      supabase.from('profiles').select('display_name, community_group_id, role, avatar_icon, avatar_color, avatar_image_url, birthday, community_groups(name)').eq('user_id', userId).single(),
    updateDisplayName: (userId, name) =>
      supabase.from('profiles').update({ display_name: name }).eq('user_id', userId),
    updateAvatar: (userId, { icon, color, imageUrl }) =>
      supabase.from('profiles').update({ avatar_icon: icon, avatar_color: color, avatar_image_url: imageUrl }).eq('user_id', userId),
  },

  groupSettings: {
    fetch: (groupId) =>
      supabase.from('group_settings').select('*').eq('group_id', groupId).maybeSingle(),
    upsert: (groupId, changes) =>
      supabase.from('group_settings').upsert({ group_id: groupId, ...changes }, { onConflict: 'group_id' }),
  },
}
