/**
 * Webhook Idempotency Helper
 *
 * SECURITY: Prevents duplicate webhook processing by tracking event IDs
 * Webhooks can be retried multiple times, so we need to ensure idempotency
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
 * Check if a webhook event has already been processed
 * @returns Object indicating if event was already processed
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
      // On error, allow processing to prevent blocking webhooks
      return { isProcessed: false };
    }

    if (data) {
      console.log(`Webhook event ${eventId} already processed with result: ${data.processing_result}`);
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
 * Mark a webhook event as processed
 * @param result - 'success' or 'error'
 * @param errorMessage - Optional error message if result is 'error'
 */
export async function markWebhookProcessed(
  supabase: SupabaseClient,
  event: WebhookEvent,
  result: 'success' | 'error',
  errorMessage?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('webhook_events')
      .insert({
        event_id: event.event_id,
        event_type: event.event_type,
        source: event.source,
        raw_event: event.raw_event || null,
        processing_result: result,
        error_message: errorMessage || null,
      });

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
 * Wrapper function to handle webhook with idempotency
 * Use this to wrap your webhook processing logic
 */
export async function processWebhookWithIdempotency<T>(
  supabase: SupabaseClient,
  event: WebhookEvent,
  handler: () => Promise<T>
): Promise<{ success: boolean; data?: T; error?: string; isDuplicate: boolean }> {
  // Check if already processed
  const idempotencyCheck = await checkWebhookIdempotency(supabase, event.event_id);

  if (idempotencyCheck.isProcessed) {
    console.log(`Skipping duplicate webhook event: ${event.event_id}`);
    return {
      success: idempotencyCheck.previousResult === 'success',
      isDuplicate: true,
    };
  }

  // Process the webhook
  try {
    const result = await handler();

    // Mark as successfully processed
    await markWebhookProcessed(supabase, event, 'success');

    return {
      success: true,
      data: result,
      isDuplicate: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error processing webhook:', errorMessage);

    // Mark as processed with error
    await markWebhookProcessed(supabase, event, 'error', errorMessage);

    return {
      success: false,
      error: errorMessage,
      isDuplicate: false,
    };
  }
}

/**
 * Cleanup old webhook events (older than 90 days)
 * Should be called periodically (e.g., via cron job)
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
