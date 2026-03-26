-- Atomic usage tracking to fix race condition in send-email and send-notification.
-- Uses a single UPDATE with a WHERE guard so concurrent calls cannot exceed the limit.
CREATE OR REPLACE FUNCTION increment_usage_if_under_limit(
  p_user_id UUID,
  p_field TEXT,
  p_limit INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  current_val INTEGER;
BEGIN
  EXECUTE format(
    'UPDATE usage_tracking SET %I = COALESCE(%I, 0) + 1 WHERE user_id = $1 AND COALESCE(%I, 0) < $2 RETURNING %I',
    p_field, p_field, p_field, p_field
  )
  INTO current_val
  USING p_user_id, p_limit;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
