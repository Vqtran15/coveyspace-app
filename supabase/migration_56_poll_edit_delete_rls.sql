-- Migration 56: RLS policies for poll creator to edit and delete their own polls
--
-- Run this in the Supabase SQL editor:

-- Creator can update their own poll (question, options)
CREATE POLICY "poll_creator_update"
  ON polls FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Creator can delete their own poll
CREATE POLICY "poll_creator_delete"
  ON polls FOR DELETE
  USING (created_by = auth.uid());

-- Poll creator can delete all votes for their poll (needed when editing options)
CREATE POLICY "poll_creator_clear_votes"
  ON poll_votes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM polls
      WHERE polls.id = poll_votes.poll_id
        AND polls.created_by = auth.uid()
    )
  );
