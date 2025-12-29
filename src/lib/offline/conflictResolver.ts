/**
 * Conflict Resolution Utilities
 * Handles conflicts when local and server data differ
 */

export type ConflictStrategy = 'server-wins' | 'client-wins' | 'last-write-wins' | 'merge';

export interface ConflictResult<T> {
  resolved: T;
  hadConflict: boolean;
  strategy: ConflictStrategy;
  message?: string;
}

/**
 * Resolve conflict between local and server data
 */
export function resolveConflict<T extends { updated_at: string }>(
  localData: T,
  serverData: T,
  strategy: ConflictStrategy = 'last-write-wins'
): ConflictResult<T> {
  const localTime = new Date(localData.updated_at);
  const serverTime = new Date(serverData.updated_at);

  switch (strategy) {
    case 'server-wins':
      return {
        resolved: serverData,
        hadConflict: true,
        strategy,
        message: 'Server version was used. Your local changes were discarded.',
      };

    case 'client-wins':
      return {
        resolved: localData,
        hadConflict: true,
        strategy,
        message: 'Your local version was kept.',
      };

    case 'last-write-wins':
      if (serverTime > localTime) {
        return {
          resolved: serverData,
          hadConflict: true,
          strategy,
          message: 'Server version was newer. Your local changes were discarded.',
        };
      } else {
        return {
          resolved: localData,
          hadConflict: true,
          strategy,
          message: 'Your local version was newer and was kept.',
        };
      }

    case 'merge':
      // Merge strategy: combine both versions intelligently
      // This is complex and entity-specific
      const merged = mergeData(localData, serverData);
      return {
        resolved: merged,
        hadConflict: true,
        strategy,
        message: 'Changes were merged automatically.',
      };

    default:
      return {
        resolved: serverData,
        hadConflict: false,
        strategy: 'server-wins',
      };
  }
}

/**
 * Merge two data objects intelligently
 * Uses server data as base and applies non-conflicting local changes
 */
function mergeData<T extends Record<string, any>>(localData: T, serverData: T): T {
  const merged = { ...serverData };

  // For each field in local data
  for (const key in localData) {
    // Skip metadata fields
    if (key === 'id' || key === 'created_at' || key === 'updated_at') {
      continue;
    }

    const localValue = localData[key];
    const serverValue = serverData[key];

    // If values are different, prefer local (user's intent)
    // unless it's clearly a server-side computed value
    if (JSON.stringify(localValue) !== JSON.stringify(serverValue)) {
      // Keep local value for user-editable fields
      if (!isServerComputedField(key)) {
        merged[key] = localValue;
      }
    }
  }

  // Always use the later updated_at timestamp
  const localTime = new Date(localData.updated_at);
  const serverTime = new Date(serverData.updated_at);
  merged.updated_at = localTime > serverTime ? localData.updated_at : serverData.updated_at;

  return merged;
}

/**
 * Check if a field is typically server-computed
 */
function isServerComputedField(fieldName: string): boolean {
  const serverFields = [
    'id',
    'created_at',
    'updated_at',
    'deleted_at',
    'stripe_payment_link',
    'xero_invoice_id',
    'xero_contact_id',
    'last_synced_to_xero',
  ];

  return serverFields.includes(fieldName);
}

/**
 * Check if data has conflicts
 * Returns true if local and server versions differ significantly
 */
export function hasConflict<T extends Record<string, any>>(
  localData: T,
  serverData: T,
  ignoreFields: string[] = ['updated_at', 'deleted_at']
): boolean {
  for (const key in localData) {
    if (ignoreFields.includes(key)) continue;

    const localValue = localData[key];
    const serverValue = serverData[key];

    if (JSON.stringify(localValue) !== JSON.stringify(serverValue)) {
      return true;
    }
  }

  return false;
}

/**
 * Get list of conflicting fields
 */
export function getConflictingFields<T extends Record<string, any>>(
  localData: T,
  serverData: T,
  ignoreFields: string[] = ['updated_at', 'deleted_at']
): string[] {
  const conflicts: string[] = [];

  for (const key in localData) {
    if (ignoreFields.includes(key)) continue;

    const localValue = localData[key];
    const serverValue = serverData[key];

    if (JSON.stringify(localValue) !== JSON.stringify(serverValue)) {
      conflicts.push(key);
    }
  }

  return conflicts;
}

/**
 * Create a user-friendly conflict message
 */
export function formatConflictMessage(
  entityType: string,
  conflictingFields: string[]
): string {
  const fieldList = conflictingFields.join(', ');

  return `This ${entityType} was modified on another device. Fields in conflict: ${fieldList}`;
}

/**
 * Batch resolve conflicts for multiple entities
 */
export function batchResolveConflicts<T extends { updated_at: string }>(
  localItems: T[],
  serverItems: T[],
  strategy: ConflictStrategy = 'last-write-wins'
): ConflictResult<T>[] {
  const results: ConflictResult<T>[] = [];

  // Create a map of server items by ID
  const serverMap = new Map(
    serverItems.map(item => [(item as any).id, item])
  );

  for (const localItem of localItems) {
    const id = (localItem as any).id;
    const serverItem = serverMap.get(id);

    if (serverItem) {
      const result = resolveConflict(localItem, serverItem, strategy);
      results.push(result);
    } else {
      // No server version - keep local
      results.push({
        resolved: localItem,
        hadConflict: false,
        strategy,
      });
    }
  }

  return results;
}
