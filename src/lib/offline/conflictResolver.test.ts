import { describe, it, expect } from 'vitest';
import {
  resolveConflict,
  hasConflict,
  getConflictingFields,
  formatConflictMessage,
  batchResolveConflicts,
} from './conflictResolver';

interface TestEntity {
  id: string;
  name: string;
  email: string;
  updated_at: string;
  stripe_payment_link?: string;
}

const localData: TestEntity = {
  id: '1',
  name: 'Local Name',
  email: 'local@test.com',
  updated_at: '2026-02-13T10:00:00Z',
};

const serverData: TestEntity = {
  id: '1',
  name: 'Server Name',
  email: 'server@test.com',
  updated_at: '2026-02-13T12:00:00Z',
};

describe('resolveConflict', () => {
  it('should use server data with server-wins strategy', () => {
    const result = resolveConflict(localData, serverData, 'server-wins');
    expect(result.resolved.name).toBe('Server Name');
    expect(result.hadConflict).toBe(true);
    expect(result.strategy).toBe('server-wins');
    expect(result.message).toContain('Server');
  });

  it('should use local data with client-wins strategy', () => {
    const result = resolveConflict(localData, serverData, 'client-wins');
    expect(result.resolved.name).toBe('Local Name');
    expect(result.hadConflict).toBe(true);
    expect(result.strategy).toBe('client-wins');
  });

  it('should use newer data with last-write-wins (server newer)', () => {
    const result = resolveConflict(localData, serverData, 'last-write-wins');
    expect(result.resolved.name).toBe('Server Name');
    expect(result.hadConflict).toBe(true);
    expect(result.message).toContain('Server version was newer');
  });

  it('should use newer data with last-write-wins (local newer)', () => {
    const newerLocal = { ...localData, updated_at: '2026-02-14T10:00:00Z' };
    const result = resolveConflict(newerLocal, serverData, 'last-write-wins');
    expect(result.resolved.name).toBe('Local Name');
    expect(result.message).toContain('local version was newer');
  });

  it('should default to last-write-wins when no strategy specified', () => {
    const result = resolveConflict(localData, serverData);
    // Server is newer in our test data
    expect(result.resolved.name).toBe('Server Name');
  });

  it('should merge data with merge strategy', () => {
    const result = resolveConflict(localData, serverData, 'merge');
    expect(result.hadConflict).toBe(true);
    expect(result.strategy).toBe('merge');
    expect(result.message).toContain('merged');
    // Merge should prefer local user-editable fields
    expect(result.resolved.name).toBe('Local Name');
    expect(result.resolved.email).toBe('local@test.com');
  });

  it('should not override server-computed fields during merge', () => {
    const localWithLink: TestEntity = {
      ...localData,
      stripe_payment_link: 'local-link',
    };
    const serverWithLink: TestEntity = {
      ...serverData,
      stripe_payment_link: 'server-link',
    };
    const result = resolveConflict(localWithLink, serverWithLink, 'merge');
    // stripe_payment_link is server-computed, should keep server value
    expect(result.resolved.stripe_payment_link).toBe('server-link');
  });

  it('should use later updated_at during merge', () => {
    const result = resolveConflict(localData, serverData, 'merge');
    // Server has later timestamp
    expect(result.resolved.updated_at).toBe('2026-02-13T12:00:00Z');
  });

  it('should fall back to server-wins for unknown strategy', () => {
    const result = resolveConflict(localData, serverData, 'unknown' as any);
    expect(result.resolved.name).toBe('Server Name');
    expect(result.hadConflict).toBe(false);
  });
});

describe('hasConflict', () => {
  it('should detect conflicts', () => {
    expect(hasConflict(localData, serverData)).toBe(true);
  });

  it('should return false when data is identical', () => {
    expect(hasConflict(localData, { ...localData })).toBe(false);
  });

  it('should ignore specified fields', () => {
    const a = { ...localData, name: 'Same' };
    const b = { ...localData, name: 'Same', updated_at: '2099-01-01T00:00:00Z' };
    expect(hasConflict(a, b, ['updated_at', 'deleted_at'])).toBe(false);
  });
});

describe('getConflictingFields', () => {
  it('should return list of conflicting fields', () => {
    const fields = getConflictingFields(localData, serverData);
    expect(fields).toContain('name');
    expect(fields).toContain('email');
    expect(fields).not.toContain('id');
    expect(fields).not.toContain('updated_at');
  });

  it('should return empty array when no conflicts', () => {
    const fields = getConflictingFields(localData, { ...localData });
    expect(fields).toEqual([]);
  });
});

describe('formatConflictMessage', () => {
  it('should format a user-friendly message', () => {
    const msg = formatConflictMessage('invoice', ['amount', 'status']);
    expect(msg).toContain('invoice');
    expect(msg).toContain('amount');
    expect(msg).toContain('status');
  });
});

describe('batchResolveConflicts', () => {
  it('should resolve multiple conflicts', () => {
    const locals = [
      { id: '1', name: 'Local A', updated_at: '2026-01-01T00:00:00Z' },
      { id: '2', name: 'Local B', updated_at: '2026-02-01T00:00:00Z' },
    ];
    const servers = [
      { id: '1', name: 'Server A', updated_at: '2026-01-02T00:00:00Z' },
      { id: '2', name: 'Server B', updated_at: '2026-01-15T00:00:00Z' },
    ];

    const results = batchResolveConflicts(locals, servers);
    expect(results).toHaveLength(2);
    // Item 1: server newer
    expect(results[0].resolved.name).toBe('Server A');
    // Item 2: local newer
    expect(results[1].resolved.name).toBe('Local B');
  });

  it('should keep local items not on server', () => {
    const locals = [
      { id: '3', name: 'New Item', updated_at: '2026-01-01T00:00:00Z' },
    ];
    const servers: typeof locals = [];

    const results = batchResolveConflicts(locals, servers);
    expect(results).toHaveLength(1);
    expect(results[0].hadConflict).toBe(false);
    expect(results[0].resolved.name).toBe('New Item');
  });
});
