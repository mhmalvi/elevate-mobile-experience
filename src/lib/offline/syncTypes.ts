/**
 * Shared types used across sync modules.
 * Kept in a dedicated file so every module can import without creating circular deps.
 */

/** JSON-safe primitive types that can be stored in IndexedDB */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** Record with string keys and unknown values, representing a database row */
export type SyncRecord = Record<string, unknown>;

/** Conflict field comparison */
export interface ConflictField {
  field: string;
  localValue: unknown;
  serverValue: unknown;
}

/** Conflict notification details */
export interface ConflictDetails {
  entityType: string;
  entityId: string;
  conflictingFields: ConflictField[];
  localData: SyncRecord;
  serverData: SyncRecord;
}

/** Sync progress snapshot */
export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  currentEntity: string;
  phase: 'idle' | 'syncing' | 'fetching';
}

/**
 * Sanitize data for IndexedDB storage.
 * Converts Date objects to ISO strings and removes undefined values.
 */
export function sanitizeDataForIndexedDB(data: unknown): JsonValue {
  if (data === null || data === undefined) {
    return null;
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeDataForIndexedDB(item));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        sanitized[key] = sanitizeDataForIndexedDB(value);
      }
    }
    return sanitized;
  }

  return data as JsonPrimitive;
}
