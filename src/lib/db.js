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
    fetchAll: (groupId) =>
      supabase.from('events').select('id, title, event_date, event_time, location, description, event_rsvps(event_id, user_id, status, profiles(display_name, avatar_icon, avatar_color, avatar_image_url))').eq('community_group_id', groupId).order('event_date', { ascending: true }),
    insert: (payload) =>
      supabase.from('events').insert(payload),
    update: (id, payload) =>
      supabase.from('events').update(payload).eq('id', id),
    delete: (id) =>
      supabase.from('events').delete().eq('id', id),
    rsvp: (eventId, userId, status, groupId) =>
      supabase.from('event_rsvps').upsert({ event_id: eventId, user_id: userId, status, community_group_id: groupId }, { onConflict: 'event_id,user_id' }),
    removeRsvp: (eventId, userId) =>
      supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', userId),
  },

  profiles: {
    fetch: (userId) =>
      supabase.from('profiles').select('display_name, community_group_id, role, avatar_icon, avatar_color, avatar_image_url, birthday, community_groups(name, church_id, churches(id, name))').eq('user_id', userId).single(),
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

  groupMemberships: {
    fetchAll: (userId) =>
      supabase.from('group_memberships')
        .select('community_group_id, role, joined_at, community_groups(name, church_id, churches(id, name))')
        .eq('user_id', userId)
        .order('joined_at', { ascending: true }),
    joinGroup: (inviteCode) =>
      supabase.rpc('join_additional_group', { p_invite_code: inviteCode }),
    switchActive: (targetGroupId) =>
      supabase.rpc('switch_active_group', { target_group_id: targetGroupId }),
  },

  churches: {
    fetchAll: () =>
      supabase.from('churches').select('id, name').order('name'),
    fetchRole: (userId) =>
      supabase.from('church_roles').select('church_id, role').eq('user_id', userId),
    fetchConversations: (churchId) =>
      supabase.from('church_conversations').select('id, church_id, type, name').eq('church_id', churchId),
    fetchMessages: (convId) =>
      supabase.from('church_messages')
        .select('id, church_id, church_conversation_id, user_id, display_name, body, image_url, audience, target_group_ids, created_at')
        .eq('church_conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(100),
    sendMessage: ({ churchId, convId, userId, displayName, body, audience, targetGroupIds = null, imageUrl = null }) =>
      supabase.from('church_messages').insert({
        church_id: churchId,
        church_conversation_id: convId,
        user_id: userId,
        display_name: displayName,
        body,
        image_url: imageUrl,
        audience,
        target_group_ids: targetGroupIds,
      }).select().single(),
    updateLastRead: (convId, userId) =>
      supabase.from('church_conversation_members')
        .upsert({ conversation_id: convId, user_id: userId, last_read_at: new Date().toISOString() }, { onConflict: 'conversation_id,user_id' }),
  },
}
