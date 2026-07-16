import { localDb, type CachedRecord, type SyncQueueItem, type SyncConflict } from "./dexieDb";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  conflictCount: number;
}

type SyncListener = (status: SyncStatus) => void;

class DataServiceClass {
  private listeners = new Set<SyncListener>();
  private _isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private _isSyncing = false;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleNetworkChange(true));
      window.addEventListener("offline", () => this.handleNetworkChange(false));
      // Auto-sync on startup
      setTimeout(() => {
        this.sync().catch(console.error);
      }, 2000);
      // Auto-sync periodically every 30 seconds
      setInterval(() => {
        if (this._isOnline) {
          this.sync().catch(console.error);
        }
      }, 30000);
    }
  }

  private async handleNetworkChange(online: boolean) {
    this._isOnline = online;
    this.broadcast();
    if (online) {
      await this.sync();
    }
  }

  public isOnline(): boolean {
    return this._isOnline;
  }

  public isSyncing(): boolean {
    return this._isSyncing;
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Initial emit
    this.getSyncStatus().then(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async broadcast() {
    const status = await this.getSyncStatus();
    this.listeners.forEach((l) => l(status));
  }

  public async getSyncStatus(): Promise<SyncStatus> {
    const pendingCount = await localDb.syncQueue.where("status").equals("pending").count();
    const conflictCount = await localDb.syncConflicts.where("status").equals("pending").count();
    
    // Get last sync from metadata
    const lastSyncMeta = await localDb.appMetadata.get("last_sync_at");
    const lastSyncAt = lastSyncMeta ? lastSyncMeta.value : null;

    return {
      isOnline: this._isOnline,
      isSyncing: this._isSyncing,
      pendingCount,
      lastSyncAt,
      conflictCount,
    };
  }

  // --- API CALLS WITH RETRY / IDEMPOTENCY ---

  private async apiRequest(url: string, method: string, body?: any, idempotencyKey?: string): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (idempotencyKey) {
      headers["X-Idempotency-Key"] = idempotencyKey;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let errMsg = `Request failed: ${res.status}`;
      try {
        const parsed = JSON.parse(errText);
        errMsg = parsed.error || errMsg;
      } catch (e) {}
      throw new Error(errMsg);
    }

    return res.json();
  }

  // --- CLIENT OPERATIONS ---

  public async listClients(search: string = ""): Promise<any[]> {
    if (this._isOnline) {
      try {
        const url = `/api/clients?search=${encodeURIComponent(search)}`;
        const data = await this.apiRequest(url, "GET");
        
        // Cache the list in IndexedDB
        await localDb.cachedRecords.put({
          localId: "clients_list_cached",
          entityType: "clients",
          payload: data,
          localUpdatedAt: new Date().toISOString(),
          syncStatus: "synced",
        });

        return data;
      } catch (err) {
        console.warn("Failed to fetch clients from server, falling back to local cache:", err);
      }
    }

    // Offline fallback / Cache search
    const cached = await localDb.cachedRecords.get("clients_list_cached");
    if (cached && Array.isArray(cached.payload)) {
      let list = cached.payload;
      if (search) {
        const queryNorm = search.toLowerCase().trim();
        list = list.filter((c: any) => 
          (c.name && c.name.toLowerCase().includes(queryNorm)) ||
          (c.code && c.code.toLowerCase().includes(queryNorm)) ||
          (c.cpf_cnpj && c.cpf_cnpj.includes(queryNorm))
        );
      }
      return list;
    }

    return [];
  }

  public async getClient(id: string | number): Promise<any> {
    const idStr = String(id);
    if (this._isOnline) {
      try {
        const data = await this.apiRequest(`/api/clients/${id}`, "GET");
        
        // Cache detailed view
        await localDb.cachedRecords.put({
          localId: `client_detail_${idStr}`,
          entityType: "client_details",
          payload: data,
          localUpdatedAt: new Date().toISOString(),
          syncStatus: "synced",
        });

        return data;
      } catch (err) {
        console.warn(`Failed to fetch client ${id} detail from server, falling back to cache:`, err);
      }
    }

    // Offline load from cache
    const cached = await localDb.cachedRecords.get(`client_detail_${idStr}`);
    if (cached) {
      return cached.payload;
    }

    // If client was created offline and list has it
    const listCached = await localDb.cachedRecords.get("clients_list_cached");
    if (listCached && Array.isArray(listCached.payload)) {
      const item = listCached.payload.find((c: any) => String(c.id) === idStr);
      if (item) {
        return { client: item, equipments: [], orders: [], guides: [], warranties: [] };
      }
    }

    throw new Error("Cliente não está disponível no cache local.");
  }

  public async createClient(payload: any): Promise<any> {
    if (this._isOnline) {
      const idempotencyKey = generateUUID();
      const data = await this.apiRequest("/api/clients", "POST", payload, idempotencyKey);
      
      // Update locally confirmed status
      await this.addOrUpdateInListCache("clients_list_cached", { ...payload, id: data.clientId, code: data.code });
      return data;
    }

    // Offline flow
    const localId = `client_off_${generateUUID().substring(0, 8)}`;
    const tempCode = `CLI-OFF-${Math.floor(1000 + Math.random() * 9000)}`;
    const mockClient = {
      ...payload,
      id: localId,
      code: tempCode,
      status: payload.status || "ativo",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pending: true,
    };

    // Save offline client to local store
    await this.addOrUpdateInListCache("clients_list_cached", mockClient);
    
    // Cache details as well
    await localDb.cachedRecords.put({
      localId: `client_detail_${localId}`,
      entityType: "client_details",
      payload: { client: mockClient, equipments: [], orders: [], guides: [], warranties: [] },
      localUpdatedAt: new Date().toISOString(),
      syncStatus: "pending",
    });

    // Enqueue
    await localDb.syncQueue.put({
      id: generateUUID(),
      operation: "create",
      entityType: "clients",
      localId,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: "pending",
    });

    this.broadcast();
    return { success: true, clientId: localId, code: tempCode, pending: true };
  }

  public async updateClient(id: string | number, payload: any): Promise<any> {
    const idStr = String(id);
    if (this._isOnline && !idStr.startsWith("client_off_")) {
      const idempotencyKey = generateUUID();
      const data = await this.apiRequest(`/api/clients/${id}`, "PUT", payload, idempotencyKey);
      await this.updateInListCache("clients_list_cached", id, payload);
      return data;
    }

    // Offline update flow
    await this.updateInListCache("clients_list_cached", id, payload);
    
    const cachedDetail = await localDb.cachedRecords.get(`client_detail_${idStr}`);
    if (cachedDetail) {
      cachedDetail.payload.client = { ...cachedDetail.payload.client, ...payload };
      cachedDetail.syncStatus = "pending";
      await localDb.cachedRecords.put(cachedDetail);
    }

    await localDb.syncQueue.put({
      id: generateUUID(),
      operation: "update",
      entityType: "clients",
      localId: idStr,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: "pending",
    });

    this.broadcast();
    return { success: true, pending: true };
  }

  // --- SERVICE ORDERS ---

  public async listServiceOrders(search: string = ""): Promise<any[]> {
    if (this._isOnline) {
      try {
        const url = `/api/service-orders?search=${encodeURIComponent(search)}`;
        const data = await this.apiRequest(url, "GET");
        
        await localDb.cachedRecords.put({
          localId: "service_orders_list_cached",
          entityType: "service_orders",
          payload: data,
          localUpdatedAt: new Date().toISOString(),
          syncStatus: "synced",
        });

        return data;
      } catch (err) {
        console.warn("Failed to fetch service orders from server, falling back to cache:", err);
      }
    }

    const cached = await localDb.cachedRecords.get("service_orders_list_cached");
    if (cached && Array.isArray(cached.payload)) {
      let list = cached.payload;
      if (search) {
        const queryNorm = search.toLowerCase().trim();
        list = list.filter((o: any) => 
          (o.code && o.code.toLowerCase().includes(queryNorm)) ||
          (o.client_name && o.client_name.toLowerCase().includes(queryNorm)) ||
          (o.problem_reported && o.problem_reported.toLowerCase().includes(queryNorm))
        );
      }
      return list;
    }

    return [];
  }

  public async getServiceOrder(id: string | number): Promise<any> {
    const idStr = String(id);
    if (this._isOnline) {
      try {
        const data = await this.apiRequest(`/api/service-orders/${id}`, "GET");
        
        await localDb.cachedRecords.put({
          localId: `service_order_detail_${idStr}`,
          entityType: "service_order_details",
          payload: data,
          localUpdatedAt: new Date().toISOString(),
          syncStatus: "synced",
        });

        return data;
      } catch (err) {
        console.warn(`Failed to fetch service order ${id} detail from server, falling back to cache:`, err);
      }
    }

    const cached = await localDb.cachedRecords.get(`service_order_detail_${idStr}`);
    if (cached) {
      return cached.payload;
    }

    throw new Error("Ordem de serviço não está disponível no cache local.");
  }

  public async createServiceOrder(payload: any): Promise<any> {
    if (this._isOnline && !String(payload.client_id).startsWith("client_off_") && !String(payload.equipment_id).startsWith("equip_off_")) {
      const idempotencyKey = generateUUID();
      const data = await this.apiRequest("/api/service-orders", "POST", payload, idempotencyKey);
      return data;
    }

    // Offline / Pending dependencies flow
    const localId = `os_off_${generateUUID().substring(0, 8)}`;
    const tempCode = `OS-OFF-${Math.floor(1000 + Math.random() * 9000)}`;
    const mockOS = {
      ...payload,
      id: localId,
      code: tempCode,
      status_id: 1,
      status_name: "Aberto",
      entry_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pending: true,
    };

    // Add to service orders cached list
    await this.addOrUpdateInListCache("service_orders_list_cached", mockOS);

    // Cache detailed view
    await localDb.cachedRecords.put({
      localId: `service_order_detail_${localId}`,
      entityType: "service_order_details",
      payload: { order: mockOS, items: [], guides: [], warranties: [] },
      localUpdatedAt: new Date().toISOString(),
      syncStatus: "pending",
    });

    // Enqueue
    await localDb.syncQueue.put({
      id: generateUUID(),
      operation: "create",
      entityType: "service_orders",
      localId,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: "pending",
    });

    this.broadcast();
    return { success: true, osId: localId, code: tempCode, pending: true };
  }

  public async updateServiceOrder(id: string | number, payload: any): Promise<any> {
    const idStr = String(id);
    if (this._isOnline && !idStr.startsWith("os_off_")) {
      const idempotencyKey = generateUUID();
      const data = await this.apiRequest(`/api/service-orders/${id}`, "PUT", payload, idempotencyKey);
      return data;
    }

    // Offline update flow
    const cachedDetail = await localDb.cachedRecords.get(`service_order_detail_${idStr}`);
    if (cachedDetail) {
      cachedDetail.payload.order = { ...cachedDetail.payload.order, ...payload };
      cachedDetail.syncStatus = "pending";
      await localDb.cachedRecords.put(cachedDetail);
    }

    await localDb.syncQueue.put({
      id: generateUUID(),
      operation: "update",
      entityType: "service_orders",
      localId: idStr,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: "pending",
    });

    this.broadcast();
    return { success: true, pending: true };
  }

  // --- EQUIPMENTS ---

  public async createEquipment(payload: any): Promise<any> {
    if (this._isOnline && !String(payload.client_id).startsWith("client_off_")) {
      const idempotencyKey = generateUUID();
      const data = await this.apiRequest("/api/equipment", "POST", payload, idempotencyKey);
      
      // Update client cache list with equipment
      await this.addEquipmentToClientCache(payload.client_id, { ...payload, id: data.equipmentId, code: data.code });
      return data;
    }

    // Offline / Dependency creation
    const localId = `equip_off_${generateUUID().substring(0, 8)}`;
    const tempCode = `EQ-OFF-${Math.floor(1000 + Math.random() * 9000)}`;
    const mockEquip = {
      ...payload,
      id: localId,
      code: tempCode,
      status: payload.status || "Disponível",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pending: true,
    };

    // Save in Client Cache Detail
    await this.addEquipmentToClientCache(payload.client_id, mockEquip);

    // Enqueue
    await localDb.syncQueue.put({
      id: generateUUID(),
      operation: "create",
      entityType: "equipment",
      localId,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: "pending",
    });

    this.broadcast();
    return { success: true, equipmentId: localId, code: tempCode, pending: true };
  }

  public async updateEquipment(id: string | number, payload: any): Promise<any> {
    const idStr = String(id);
    if (this._isOnline && !idStr.startsWith("equip_off_")) {
      const idempotencyKey = generateUUID();
      const data = await this.apiRequest(`/api/equipment/${id}`, "PUT", payload, idempotencyKey);
      return data;
    }

    // Offline update flow
    await localDb.syncQueue.put({
      id: generateUUID(),
      operation: "update",
      entityType: "equipment",
      localId: idStr,
      payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: "pending",
    });

    this.broadcast();
    return { success: true, pending: true };
  }

  // --- BUDGET / PAYMENTS ---

  public async addBudgetItem(osId: string | number, payload: any): Promise<any> {
    const osIdStr = String(osId);
    if (this._isOnline && !osIdStr.startsWith("os_off_")) {
      const idempotencyKey = generateUUID();
      const data = await this.apiRequest(`/api/service-orders/${osId}/budget`, "POST", payload, idempotencyKey);
      return data;
    }

    // Offline budg item creation
    const localId = `budget_off_${generateUUID().substring(0, 8)}`;
    const mockItem = {
      ...payload,
      id: localId,
      service_order_id: osId,
      total_value: parseFloat(payload.quantity) * parseFloat(payload.unit_value),
      created_at: new Date().toISOString(),
      pending: true,
    };

    const cachedDetail = await localDb.cachedRecords.get(`service_order_detail_${osIdStr}`);
    if (cachedDetail) {
      cachedDetail.payload.items = cachedDetail.payload.items || [];
      cachedDetail.payload.items.push(mockItem);
      cachedDetail.syncStatus = "pending";
      await localDb.cachedRecords.put(cachedDetail);
    }

    await localDb.syncQueue.put({
      id: generateUUID(),
      operation: "create",
      entityType: "budget_items",
      localId,
      payload: { ...payload, osId },
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: "pending",
    });

    this.broadcast();
    return { success: true, itemId: localId, pending: true };
  }

  public async updateBudgetItem(osId: string | number, itemId: string | number, payload: any): Promise<any> {
    const osIdStr = String(osId);
    const itemIdStr = String(itemId);
    if (this._isOnline && !osIdStr.startsWith("os_off_") && !itemIdStr.startsWith("budget_off_")) {
      const idempotencyKey = generateUUID();
      const data = await this.apiRequest(`/api/service-orders/${osId}/budget/${itemId}`, "PUT", payload, idempotencyKey);
      return data;
    }

    // Offline logic
    const cachedDetail = await localDb.cachedRecords.get(`service_order_detail_${osIdStr}`);
    if (cachedDetail && Array.isArray(cachedDetail.payload.items)) {
      cachedDetail.payload.items = cachedDetail.payload.items.map((item: any) => {
        if (String(item.id) === itemIdStr) {
          return { ...item, ...payload, total_value: parseFloat(payload.quantity) * parseFloat(payload.unit_value) };
        }
        return item;
      });
      cachedDetail.syncStatus = "pending";
      await localDb.cachedRecords.put(cachedDetail);
    }

    await localDb.syncQueue.put({
      id: generateUUID(),
      operation: "update",
      entityType: "budget_items",
      localId: itemIdStr,
      payload: { ...payload, osId, itemId },
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: "pending",
    });

    this.broadcast();
    return { success: true, pending: true };
  }

  public async deleteBudgetItem(osId: string | number, itemId: string | number): Promise<any> {
    const osIdStr = String(osId);
    const itemIdStr = String(itemId);
    if (this._isOnline && !osIdStr.startsWith("os_off_") && !itemIdStr.startsWith("budget_off_")) {
      const data = await this.apiRequest(`/api/service-orders/${osId}/budget/${itemId}`, "DELETE");
      return data;
    }

    // Offline logic
    const cachedDetail = await localDb.cachedRecords.get(`service_order_detail_${osIdStr}`);
    if (cachedDetail && Array.isArray(cachedDetail.payload.items)) {
      cachedDetail.payload.items = cachedDetail.payload.items.filter((item: any) => String(item.id) !== itemIdStr);
      cachedDetail.syncStatus = "pending";
      await localDb.cachedRecords.put(cachedDetail);
    }

    await localDb.syncQueue.put({
      id: generateUUID(),
      operation: "delete",
      entityType: "budget_items",
      localId: itemIdStr,
      payload: { osId, itemId },
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: "pending",
    });

    this.broadcast();
    return { success: true, pending: true };
  }

  // --- CORE SYSTEM SYNCHRONIZATION (ETAPA 5) ---

  public async sync(): Promise<void> {
    if (this._isSyncing) return;
    if (!this._isOnline) return;

    this._isSyncing = true;
    this.broadcast();

    try {
      // Get all pending operations chronologically
      const queue = await localDb.syncQueue
        .where("status")
        .equals("pending")
        .sortBy("createdAt");

      if (queue.length === 0) {
        // Successful sync, update timestamp
        await localDb.appMetadata.put({
          key: "last_sync_at",
          value: new Date().toLocaleString("pt-BR"),
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      console.log(`[PWA Sync] Processing ${queue.length} items from syncQueue...`);

      for (const item of queue) {
        // Mark as syncing
        item.status = "syncing";
        await localDb.syncQueue.put(item);

        try {
          // Resolve internal references for offline dependent entities
          await this.resolveDependencies(item);

          let result: any = null;
          const { operation, entityType, localId, payload } = item;

          if (entityType === "clients") {
            if (operation === "create") {
              result = await this.apiRequest("/api/clients", "POST", payload, item.id);
              const serverId = result.clientId;
              
              // Map old offline ID to real server ID in our cached records and sync queues!
              await this.updateOfflineIdReference("clients", localId, serverId);
              await this.replaceCachedClientDetail(localId, serverId, { ...payload, id: serverId, code: result.code });
            } else if (operation === "update") {
              result = await this.apiRequest(`/api/clients/${localId}`, "PUT", payload, item.id);
            }
          } else if (entityType === "equipment") {
            if (operation === "create") {
              result = await this.apiRequest("/api/equipment", "POST", payload, item.id);
              const serverId = result.equipmentId;

              await this.updateOfflineIdReference("equipment", localId, serverId);
            }
          } else if (entityType === "service_orders") {
            if (operation === "create") {
              result = await this.apiRequest("/api/service-orders", "POST", payload, item.id);
              const serverId = result.osId;

              await this.updateOfflineIdReference("service_orders", localId, serverId);
              await this.replaceCachedOSDetail(localId, serverId, { ...payload, id: serverId, code: result.code });
            } else if (operation === "update") {
              result = await this.apiRequest(`/api/service-orders/${localId}`, "PUT", payload, item.id);
            }
          } else if (entityType === "budget_items") {
            if (operation === "create") {
              const osIdValue = payload.osId || localId;
              result = await this.apiRequest(`/api/service-orders/${osIdValue}/budget`, "POST", payload, item.id);
            }
          }

          // Successful dispatch! Delete from queue
          await localDb.syncQueue.delete(item.id);

        } catch (err: any) {
          console.error(`[PWA Sync Error] Item ${item.id} failed:`, err);
          
          if (err.message && (err.message.includes("409") || err.message.toLowerCase().includes("conflito"))) {
            // Conflict found! Save to conflicts table for user manual resolution
            await localDb.syncConflicts.put({
              id: generateUUID(),
              entityType: item.entityType,
              localId: item.localId,
              localPayload: item.payload,
              serverPayload: err.serverData || { error: "Versão conflitante no servidor" },
              detectedAt: new Date().toISOString(),
              status: "pending",
            });
            item.status = "failed";
            item.lastError = `Conflito de dados: ${err.message}`;
            await localDb.syncQueue.put(item);
          } else if (err.message && (err.message.includes("400") || err.message.includes("422") || err.message.toLowerCase().includes("validation"))) {
            // Irrecoverable validation error, mark as failed, do not repeat infinitely
            item.status = "failed";
            item.attempts += 1;
            item.lastError = `Erro de validação: ${err.message}`;
            await localDb.syncQueue.put(item);
          } else {
            // Temporary network/server failure. Put back to pending, increment attempts
            item.status = "pending";
            item.attempts += 1;
            item.lastError = err.message || "Erro de conexão temporário";
            await localDb.syncQueue.put(item);
            
            // Stop syncing subsequent items to preserve chronological order
            break;
          }
        }
      }

      // Sync completed. Update timestamp.
      await localDb.appMetadata.put({
        key: "last_sync_at",
        value: new Date().toLocaleString("pt-BR"),
        updatedAt: new Date().toISOString(),
      });

    } finally {
      this._isSyncing = false;
      this.broadcast();
    }
  }

  // --- OFFLINE HELPER METHODS ---

  private async addOrUpdateInListCache(key: string, item: any) {
    const cached = await localDb.cachedRecords.get(key);
    if (cached && Array.isArray(cached.payload)) {
      const idx = cached.payload.findIndex((x: any) => String(x.id) === String(item.id));
      if (idx !== -1) {
        cached.payload[idx] = { ...cached.payload[idx], ...item };
      } else {
        cached.payload.unshift(item);
      }
      cached.localUpdatedAt = new Date().toISOString();
      await localDb.cachedRecords.put(cached);
    } else {
      await localDb.cachedRecords.put({
        localId: key,
        entityType: "list",
        payload: [item],
        localUpdatedAt: new Date().toISOString(),
        syncStatus: "pending",
      });
    }
  }

  private async updateInListCache(key: string, id: string | number, updates: any) {
    const cached = await localDb.cachedRecords.get(key);
    if (cached && Array.isArray(cached.payload)) {
      const idx = cached.payload.findIndex((x: any) => String(x.id) === String(id));
      if (idx !== -1) {
        cached.payload[idx] = { ...cached.payload[idx], ...updates };
        cached.localUpdatedAt = new Date().toISOString();
        await localDb.cachedRecords.put(cached);
      }
    }
  }

  private async addEquipmentToClientCache(clientId: string | number, equip: any) {
    const clientIdStr = String(clientId);
    const cached = await localDb.cachedRecords.get(`client_detail_${clientIdStr}`);
    if (cached) {
      cached.payload.equipments = cached.payload.equipments || [];
      const idx = cached.payload.equipments.findIndex((e: any) => String(e.id) === String(equip.id));
      if (idx !== -1) {
        cached.payload.equipments[idx] = { ...cached.payload.equipments[idx], ...equip };
      } else {
        cached.payload.equipments.unshift(equip);
      }
      cached.syncStatus = "pending";
      await localDb.cachedRecords.put(cached);
    }
  }

  // Resolves pending dependencies dynamically for offline objects
  private async resolveDependencies(item: SyncQueueItem) {
    const { payload } = item;
    if (payload.client_id && String(payload.client_id).startsWith("client_off_")) {
      const mappingKey = `mapping_clients_${payload.client_id}`;
      const mappedVal = await localDb.appMetadata.get(mappingKey);
      if (mappedVal) {
        console.log(`[PWA Dependency Resolver] Mapping client_id ${payload.client_id} -> ${mappedVal.value} on sync item ${item.id}`);
        payload.client_id = parseInt(mappedVal.value);
      }
    }
    if (payload.equipment_id && String(payload.equipment_id).startsWith("equip_off_")) {
      const mappingKey = `mapping_equipment_${payload.equipment_id}`;
      const mappedVal = await localDb.appMetadata.get(mappingKey);
      if (mappedVal) {
        console.log(`[PWA Dependency Resolver] Mapping equipment_id ${payload.equipment_id} -> ${mappedVal.value} on sync item ${item.id}`);
        payload.equipment_id = parseInt(mappedVal.value);
      }
    }
    if (payload.osId && String(payload.osId).startsWith("os_off_")) {
      const mappingKey = `mapping_service_orders_${payload.osId}`;
      const mappedVal = await localDb.appMetadata.get(mappingKey);
      if (mappedVal) {
        payload.osId = parseInt(mappedVal.value);
      }
    }
  }

  // Scans the queue and cached records to translate temporary IDs to real database IDs
  private async updateOfflineIdReference(entityType: string, oldId: string, newId: number) {
    // Save reference mapping in appMetadata
    await localDb.appMetadata.put({
      key: `mapping_${entityType}_${oldId}`,
      value: String(newId),
      updatedAt: new Date().toISOString(),
    });

    // 1. Scan remaining sync queue payloads and translate old IDs
    const queue = await localDb.syncQueue.where("status").equals("pending").toArray();
    for (const qItem of queue) {
      let modified = false;
      const payload = qItem.payload;

      if (entityType === "clients" && String(payload.client_id) === oldId) {
        payload.client_id = newId;
        modified = true;
      }
      if (entityType === "equipment" && String(payload.equipment_id) === oldId) {
        payload.equipment_id = newId;
        modified = true;
      }
      if (entityType === "service_orders" && String(payload.osId) === oldId) {
        payload.osId = newId;
        modified = true;
      }

      if (modified) {
        await localDb.syncQueue.put(qItem);
      }
    }

    // 2. Scan and translate cached list IDs
    if (entityType === "clients") {
      const listCached = await localDb.cachedRecords.get("clients_list_cached");
      if (listCached && Array.isArray(listCached.payload)) {
        const item = listCached.payload.find((c: any) => String(c.id) === oldId);
        if (item) {
          item.id = newId;
          item.pending = false;
          await localDb.cachedRecords.put(listCached);
        }
      }
    } else if (entityType === "service_orders") {
      const listCached = await localDb.cachedRecords.get("service_orders_list_cached");
      if (listCached && Array.isArray(listCached.payload)) {
        const item = listCached.payload.find((o: any) => String(o.id) === oldId);
        if (item) {
          item.id = newId;
          item.pending = false;
          await localDb.cachedRecords.put(listCached);
        }
      }
    }
  }

  private async replaceCachedClientDetail(oldId: string, newId: number, fullRecord: any) {
    const cached = await localDb.cachedRecords.get(`client_detail_${oldId}`);
    if (cached) {
      await localDb.cachedRecords.delete(`client_detail_${oldId}`);
      cached.localId = `client_detail_${newId}`;
      cached.payload.client = { ...cached.payload.client, ...fullRecord, id: newId, pending: false };
      cached.syncStatus = "synced";
      await localDb.cachedRecords.put(cached);
    }
  }

  private async replaceCachedOSDetail(oldId: string, newId: number, fullRecord: any) {
    const cached = await localDb.cachedRecords.get(`service_order_detail_${oldId}`);
    if (cached) {
      await localDb.cachedRecords.delete(`service_order_detail_${oldId}`);
      cached.localId = `service_order_detail_${newId}`;
      cached.payload.order = { ...cached.payload.order, ...fullRecord, id: newId, pending: false };
      cached.syncStatus = "synced";
      await localDb.cachedRecords.put(cached);
    }
  }
}

export const DataService = new DataServiceClass();
