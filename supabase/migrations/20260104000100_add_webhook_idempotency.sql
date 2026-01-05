-- Add Webhook Idempotency Tracking
-- SECURITY: Prevents duplicate webhook processing
-- Created: 2026-01-04

-- Create table to track processed webhook events
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL, -- Stripe event ID
  event_type TEXT NOT NULL,
  source TEXT NOT NULL, -- 'connect' or 'platform'
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_event JSONB, -- Store full event for debugging
  processing_result TEXT, -- 'success' or 'error'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast idempotency checks
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events(processed_at);

-- Add cleanup function to remove old webhook events (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS void AS $$
BEGIN
  DELETE FROM webhook_events
  WHERE processed_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON TABLE webhook_events IS 'Tracks processed webhook events for idempotency - prevents duplicate processing';
COMMENT ON COLUMN webhook_events.event_id IS 'Unique event ID from webhook provider (e.g., Stripe event ID)';
COMMENT ON COLUMN webhook_events.source IS 'Source of the webhook: connect, platform, revenuecat, xero';
COMMENT ON COLUMN webhook_events.raw_event IS 'Full event payload for debugging and audit trail';

-- Grant permissions (only service role should write to this)
-- RLS not needed as this table is only accessed from edge functions with service role
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Create policy that allows service role to do everything
CREATE POLICY "Service role can manage webhook events" ON webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
