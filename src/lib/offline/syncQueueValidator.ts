import type { SyncQueueItem } from './db';

const VALID_ENTITY_TYPES = ['job', 'quote', 'invoice', 'client'] as const;
const VALID_ACTIONS = ['create', 'update', 'delete'] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DATA_SIZE_BYTES = 500 * 1024; // 500KB

/**
 * Validate a sync queue item before adding to the queue.
 * Returns validation result with specific error messages.
 */
export function validateSyncQueueItem(item: Partial<SyncQueueItem>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required: entity_type
  if (!item.entity_type) {
    errors.push('Missing required field: entity_type');
  } else if (!VALID_ENTITY_TYPES.includes(item.entity_type as any)) {
    errors.push(`Invalid entity_type: "${item.entity_type}". Must be one of: ${VALID_ENTITY_TYPES.join(', ')}`);
  }

  // Required: entity_id (must be non-empty string, UUID-like)
  if (item.entity_id === null || item.entity_id === undefined) {
    errors.push('Missing required field: entity_id');
  } else if (typeof item.entity_id !== 'string') {
    errors.push(`entity_id must be a string, got: ${typeof item.entity_id}`);
  } else if (item.entity_id.trim() === '') {
    errors.push('entity_id must not be empty');
  } else if (!UUID_PATTERN.test(item.entity_id)) {
    errors.push(`entity_id does not match UUID pattern: "${item.entity_id}"`);
  }

  // Required: action
  if (!item.action) {
    errors.push('Missing required field: action');
  } else if (!VALID_ACTIONS.includes(item.action as any)) {
    errors.push(`Invalid action: "${item.action}". Must be one of: ${VALID_ACTIONS.join(', ')}`);
  }

  // Required: data (must be a plain object, not null/array)
  if (item.data === null || item.data === undefined) {
    errors.push('Missing required field: data');
  } else if (typeof item.data !== 'object') {
    errors.push(`data must be an object, got: ${typeof item.data}`);
  } else if (Array.isArray(item.data)) {
    errors.push('data must be a plain object, not an array');
  } else {
    // Check data size to prevent IndexedDB quota issues
    try {
      const serialized = JSON.stringify(item.data);
      const sizeBytes = new Blob([serialized]).size;
      if (sizeBytes > MAX_DATA_SIZE_BYTES) {
        errors.push(`data exceeds maximum size: ${Math.round(sizeBytes / 1024)}KB > ${MAX_DATA_SIZE_BYTES / 1024}KB`);
      }
    } catch {
      errors.push('data contains non-serializable values (possible circular reference)');
    }
  }

  // Optional: retry_count (must be non-negative integer)
  if (item.retry_count !== undefined && item.retry_count !== null) {
    if (typeof item.retry_count !== 'number' || !Number.isInteger(item.retry_count) || item.retry_count < 0) {
      errors.push(`retry_count must be a non-negative integer, got: ${item.retry_count}`);
    }
  }

  // Optional: created_at (must be valid ISO timestamp if present)
  if (item.created_at !== undefined && item.created_at !== null) {
    const date = new Date(item.created_at);
    if (isNaN(date.getTime())) {
      errors.push(`created_at is not a valid ISO timestamp: "${item.created_at}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
