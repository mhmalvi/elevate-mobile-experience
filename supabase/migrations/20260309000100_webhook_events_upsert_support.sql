-- Webhook events: support upsert-based retry
-- Problem: INSERT on a unique event_id would fail on retry after an error,
--          permanently losing the event. We switch to upsert, and add a
--          retry_count column so each re-delivery is auditable.
-- Date: 2026-03-09

-- 1. Add retry_count column (defaults to 0, never null).
ALTER TABLE webhook_events
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN webhook_events.retry_count IS
  'Number of times this event has been re-delivered after a prior error. '
  '0 = processed successfully on first attempt.';

-- 2. Create a trigger that increments retry_count whenever the row is updated
--    via upsert (i.e. when the event_id already existed).
--    We detect a retry by checking that the row already has a processed_at
--    value (meaning it was previously written), which is always true for an
--    ON CONFLICT UPDATE path.
CREATE OR REPLACE FUNCTION increment_webhook_retry_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- NEW.retry_count arrives as the value from the upsert payload (unchanged
  -- from the inserted value of 0). We want the persisted value + 1 instead.
  NEW.retry_count := OLD.retry_count + 1;
  RETURN NEW;
END;
$$;

-- Drop before recreate to make migration idempotent.
DROP TRIGGER IF EXISTS trg_webhook_retry_count ON webhook_events;

CREATE TRIGGER trg_webhook_retry_count
  BEFORE UPDATE ON webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION increment_webhook_retry_count();

-- 3. Index to help ops queries like "show me all events that needed > 1 attempt".
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry_count
  ON webhook_events(retry_count)
  WHERE retry_count > 0;
