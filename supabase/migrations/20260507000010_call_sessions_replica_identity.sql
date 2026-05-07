-- BUG-056: Without REPLICA IDENTITY FULL on call_sessions, UPDATE realtime
-- payloads only carry the changed columns. The global call listener filters
-- on payload.new.receiver_id, but receiver_id is rarely the changed column
-- — so the filter would silently drop status-change events from non-current
-- subscribers. Setting FULL replica identity guarantees the full row is
-- always emitted.

ALTER TABLE public.call_sessions REPLICA IDENTITY FULL;
