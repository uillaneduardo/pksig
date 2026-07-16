import Dexie, { type Table } from "dexie";

export interface AppMetadata {
  key: string;
  value: string;
  updatedAt: string;
}

export interface CachedRecord {
  localId: string; // UUID (string) or serverId as string
  serverId?: number;
  entityType: string; // e.g. "clients", "equipments", "service_orders", "budget_items"
  payload: any;
  serverUpdatedAt?: string;
  localUpdatedAt: string;
  syncStatus: "synced" | "pending" | "failed" | "syncing";
}

export interface SyncQueueItem {
  id: string; // UUID
  operation: "create" | "update" | "delete";
  entityType: string;
  localId: string;
  serverId?: number;
  payload: any;
  createdAt: string;
  attempts: number;
  lastError?: string;
  status: "pending" | "syncing" | "failed";
}

export interface SyncConflict {
  id: string; // UUID
  entityType: string;
  localId: string;
  localPayload: any;
  serverPayload: any;
  detectedAt: string;
  status: "pending" | "resolved";
}

export class PKSIGLocalDatabase extends Dexie {
  appMetadata!: Table<AppMetadata, string>;
  cachedRecords!: Table<CachedRecord, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  syncConflicts!: Table<SyncConflict, string>;

  constructor() {
    super("PKSIGLocalDatabase");
    this.version(1).stores({
      appMetadata: "key",
      cachedRecords: "localId, serverId, entityType, syncStatus, localUpdatedAt",
      syncQueue: "id, operation, entityType, localId, status, createdAt",
      syncConflicts: "id, entityType, localId, status"
    });
  }
}

export const localDb = new PKSIGLocalDatabase();

// Clean up all local storage data on logout or reset
export async function clearLocalData(): Promise<void> {
  await localDb.transaction("rw", [localDb.appMetadata, localDb.cachedRecords, localDb.syncQueue, localDb.syncConflicts], async () => {
    await localDb.appMetadata.clear();
    await localDb.cachedRecords.clear();
    await localDb.syncQueue.clear();
    await localDb.syncConflicts.clear();
  });
}
