/**
 * Webhook Idempotency Helper
 *
 * SECURITY: Prevents duplicate webhook processing by tracking event IDs.
 * Webhooks can be retried multiple times, so we need to ensure idempotency.
 *
 * Retry semantics:
 *   - Events that previously succeeded are deduplicated (skipped silently).
 *   - Events that previously errored are re-processed so transient failures
 *     do not permanently lose events. The row is upserted so the unique
 *     constraint on event_id is never violated on a retry.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface WebhookEvent {
  event_id: string;
  event_type: string;
  source: 'connect' | 'platform' | 'revenuecat' | 'xero' | 'other';
  raw_event?: Record<string, any>;
}

export interface IdempotencyCheckResult {
  isProcessed: boolean;
  previousResult?: 'success' | 'error';
  error?: string;
}

/**
 * Check if a webhook event has already been processed.
 * Returns isProcessed=true for both success and error outcomes so callers
 * can decide whether to retry based on previousResult.
 */
export async function checkWebhookIdempotency(
  supabase: SupabaseClient,
  eventId: string
): Promise<IdempotencyCheckResult> {
  try {
    const { data, error } = await supabase
      .from('webhook_events')
      .select('processing_result, error_message')
      .eq('event_id', eventId)
      .maybeSingle();

    if (error) {
      console.error('Error checking webhook idempotency:', error);
      // On DB error, allow processing to prevent blocking webhooks
      return { isProcessed: false };
    }

    if (data) {
      console.log(`Webhook event ${eventId} already exists with result: ${data.processing_result}`);
      return {
        isProcessed: true,
        previousResult: data.processing_result as 'success' | 'error',
      };
    }

    return { isProcessed: false };
  } catch (error) {
    console.error('Exception checking webhook idempotency:', error);
    return { isProcessed: false };
  }
}

/**
 * Mark a webhook event as processed.
 *
 * Uses UPSERT (insert + on-conflict update) so that:
 *   - First attempt: inserts a new row.
 *   - Retry after a prior error: overwrites processing_result, error_message,
 *     processed_at, and increments retry_count so the event can succeed on a
 *     subsequent delivery rather than being permanently lost.
 *   - Retry after a prior success: also overwrites, but callers should prevent
 *     this via checkWebhookIdempotency before calling markWebhookProcessed.
 *
 * @param result - 'success' or 'error'
 * @param errorMessage - Optional error detail when result is 'error'
 */
export async function markWebhookProcessed(
  supabase: SupabaseClient,
  event: WebhookEvent,
  result: 'success' | 'error',
  errorMessage?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('webhook_events')
      .upsert(
        {
          event_id: event.event_id,
          event_type: event.event_type,
          source: event.source,
          raw_event: event.raw_event || null,
          processing_result: result,
          error_message: errorMessage || null,
          processed_at: now,
          // retry_count starts at 0 on first insert; the DB DEFAULT handles it.
          // On conflict the trigger/generated column increments it — see migration.
        },
        {
          onConflict: 'event_id',
          // ignoreDuplicates: false ensures the UPDATE actually runs on conflict.
          ignoreDuplicates: false,
        }
      );

    if (error) {
      console.error('Error marking webhook as processed:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception marking webhook as processed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Wrapper function to handle a webhook with idempotency.
 *
 * Deduplication behaviour:
 *   - Prior success  → skip handler, return isDuplicate=true.
 *   - Prior error    → re-run handler so transient failures can be retried.
 *   - No prior record → run handler normally.
 */
export async function processWebhookWithIdempotency<T>(
  supabase: SupabaseClient,
  event: WebhookEvent,
  handler: () => Promise<T>
): Promise<{ success: boolean; data?: T; error?: string; isDuplicate: boolean }> {
  const idempotencyCheck = await checkWebhookIdempotency(supabase, event.event_id);

  // Only deduplicate events that already succeeded — errored events must be retried.
  if (idempotencyCheck.isProcessed && idempotencyCheck.previousResult === 'success') {
    console.log(`Skipping already successfully processed webhook event: ${event.event_id}`);
    return {
      success: true,
      isDuplicate: true,
    };
  }

  if (idempotencyCheck.isProcessed && idempotencyCheck.previousResult === 'error') {
    console.log(`Re-processing previously errored webhook event: ${event.event_id}`);
  }

  // Process the webhook
  try {
    const result = await handler();

    // Upsert: will insert on first attempt, or overwrite the error row on retry.
    await markWebhookProcessed(supabase, event, 'success');

    return {
      success: true,
      data: result,
      isDuplicate: false,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Error processing webhook:', errMsg);

    // Upsert: will insert on first attempt, or overwrite a prior error on retry.
    await markWebhookProcessed(supabase, event, 'error', errMsg);

    return {
      success: false,
      error: errMsg,
      isDuplicate: false,
    };
  }
}

/**
 * Cleanup old webhook events (older than 90 days).
 * Should be called periodically (e.g., via cron job).
 */
export async function cleanupOldWebhookEvents(
  supabase: SupabaseClient
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { error, count } = await supabase
      .from('webhook_events')
      .delete()
      .lt('processed_at', ninetyDaysAgo.toISOString());

    if (error) {
      console.error('Error cleaning up webhook events:', error);
      return { success: false, error: error.message };
    }

    console.log(`Cleaned up ${count || 0} old webhook events`);
    return { success: true, deletedCount: count || 0 };
  } catch (error) {
    console.error('Exception cleaning up webhook events:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
