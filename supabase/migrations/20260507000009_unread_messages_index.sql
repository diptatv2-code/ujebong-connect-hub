-- BUG-055: Partial index for unread message counts. The bell/badge query
-- ("how many unread messages does this user have?") filters by receiver_id
-- AND read_at IS NULL — a partial index on the unread subset stays small
-- and avoids scanning all the read messages.

CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON public.messages(receiver_id)
  WHERE read_at IS NULL;
