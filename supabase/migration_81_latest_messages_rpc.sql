-- BUG-7: ConversationList fetches the latest message per conversation by
-- querying a large page of recent messages and picking the latest per conv_id
-- in JS. This breaks when a conversation has no message in the fetched window.
--
-- This RPC returns exactly one latest message per conversation for a given set
-- of conversation IDs, using DISTINCT ON which is a single index scan.
--
-- Run this in the Supabase SQL editor for project ktmlyzwpgvhrwfgyoeiq.
-- After running, update ConversationList.jsx to call this RPC instead of the
-- current paged messages query.

CREATE OR REPLACE FUNCTION get_latest_messages(p_conv_ids uuid[])
RETURNS SETOF messages
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (conversation_id) *
  FROM messages
  WHERE conversation_id = ANY(p_conv_ids)
  ORDER BY conversation_id, created_at DESC;
$$;

-- Grant execute to authenticated users (RLS on messages still applies to the
-- rows returned, so only messages in groups the caller belongs to are visible).
GRANT EXECUTE ON FUNCTION get_latest_messages(uuid[]) TO authenticated;
