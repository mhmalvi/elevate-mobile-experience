/**
 * Sync event infrastructure.
 *
 * Centralises every window.dispatchEvent call so consumers can listen to a
 * predictable set of CustomEvent types.  Also manages the in-process listener
 * set used by SyncManager.onSyncComplete().
 */

import type { ConflictDetails, SyncProgress } from './syncTypes';

// ---------------------------------------------------------------------------
// Outbound events (window CustomEvents)
// ---------------------------------------------------------------------------

/** Fired whenever sync makes measurable progress. */
export function emitSyncProgress(progress: SyncProgress): void {
  if (typeof window === 'undefined') return;
  const detail = {
    ...progress,
    percentage:
      progress.total > 0
        ? Math.round((progress.completed / progress.total) * 100)
        : 0,
  };
  window.dispatchEvent(new CustomEvent('sync-progress', { detail }));
}

/** Fired when the auth token is invalid / refresh failed during sync. */
export function notifyAuthError(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('sync-auth-error', {
      detail: { message: 'Authentication error during sync' },
    })
  );
}

/** Fired when a data conflict is detected and resolved. */
export function notifyConflict(conflictDetails: ConflictDetails): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('sync-conflict-detected', { detail: conflictDetails })
  );
}

/** Fired when IndexedDB reports a QuotaExceededError. */
export function notifyQuotaExceeded(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('indexeddb-quota-exceeded', {
      detail: { message: 'Storage quota exceeded' },
    })
  );
}

/** Fired when the sync queue appears corrupted. */
export function notifyQueueCorruption(errorCount: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('sync-queue-corrupted', {
      detail: {
        message: 'Sync queue data corrupted. Pending changes may be lost.',
        errorCount,
      },
    })
  );
}

// ---------------------------------------------------------------------------
// In-process subscriber set
// ---------------------------------------------------------------------------

/** Manages callbacks registered via SyncManager.onSyncComplete(). */
export class SyncListenerSet {
  private listeners: Set<() => void> = new Set();

  add(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(): void {
    this.listeners.forEach(cb => cb());
  }
}
