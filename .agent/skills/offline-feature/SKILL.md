---
name: offline-feature
description: Guide for implementing offline-first features using local storage and sync. Use when adding new entities that need to work offline.
---

# Offline Feature Skill

When implementing offline capabilities:

## Architecture
The app uses a dual-write architecture:
1.  **Local First**: Write to Dexie.js (IndexedDB) immediately.
2.  **Sync Queue**: Queue the operation in `syncManager` for background synchronization.

## Implementation Steps

### 1. Define Offline Types
Update `src/lib/offline/db.ts` to include the new entity in the `AppDatabase` interface and schema.

### 2. Create Custom Hook
Create a hook in `src/lib/offline/offlineHooks.ts` following this pattern:

```typescript
export function useOfflineNewEntity(userId: string) {
  const isOnline = useOnlineStatus();
  
  // 1. Read from local DB
  const entities = useLiveQuery(
    () => db.newEntities.where('user_id').equals(userId).toArray(),
    [userId]
  );
  
  // 2. Create mutation function
  const createEntity = useCallback(async (data: Partial<NewEntity>) => {
    // Optimistic Update
    const newEntity = { ...data, id: generateUUID(), status: 'pending' };
    
    // Queue Sync (handles local write + sync queue)
    await syncManager.queueSync('newEntity', newEntity.id, 'create', newEntity);
    
    return newEntity;
  }, [userId]);

  return { entities, createEntity, isOnline };
}
```

## Security
- **Encryption**: If the data is sensitive (PII, financial), use `decryptX` and `encryptX` helpers in `src/lib/offline/encryption.ts`.
- **Validation**: Ensure data is validated before writing to Dexie.
