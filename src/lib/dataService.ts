import { localDb, type CachedRecord, type SyncQueueItem, type SyncConflict } from "./dexieDb";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface SystemHealthStatus {
  server: "online" | "offline";
  database: "connected" | "disconnected";
  mode: string;
  host: string;
  databaseName: string;
  lastCheckedAt: string | null;
  canWrite: boolean;
  error?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  conflictCount: number;
  health: SystemHealthStatus;
}

type SyncListener = (status: SyncStatus) => void;

class DataServiceClass {
  private listeners = new Set<SyncListener>();
  private _isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private _isSyncing = false;

  public healthStatus: SystemHealthStatus = {
    server: "online",
    database: "disconnected",
    mode: "remoto",
    host: "servidor configurado",
    databaseName: "pksig",
    lastCheckedAt: null,
    canWrite: false,
    error: undefined,
  };

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.checkHealth());
      window.addEventListener("offline", () => this.checkHealth());
      window.addEventListener("focus", () => this.checkHealth());

      // Initial health check
      this.checkHealth().catch(console.error);

      // Periodic health check every 10 seconds
      setInterval(() => {
        this.checkHealth().catch(console.error);
      }, 10000);
    }
  }

  public async checkHealth(): Promise<SystemHealthStatus> {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const canWrite = data.server === "online" && data.database === "connected";
        this.healthStatus = {
          server: data.server || "online",
          database: data.database || "disconnected",
          mode: data.mode || "remoto",
          host: data.host || "servidor configurado",
          databaseName: data.databaseName || "pksig",
          lastCheckedAt: new Date().toLocaleTimeString("pt-BR"),
          canWrite,
          error: data.error,
        };
        this._isOnline = canWrite;
      } else {
        this.healthStatus = {
          server: "offline",
          database: "disconnected",
          mode: "remoto",
          host: "servidor configurado",
          databaseName: "pksig",
          lastCheckedAt: new Date().toLocaleTimeString("pt-BR"),
          canWrite: false,
          error: `Servidor retornou código HTTP ${res.status}`,
        };
        this._isOnline = false;
      }
    } catch (err: any) {
      this.healthStatus = {
        server: "offline",
        database: "disconnected",
        mode: "remoto",
        host: "servidor configurado",
        databaseName: "pksig",
        lastCheckedAt: new Date().toLocaleTimeString("pt-BR"),
        canWrite: false,
        error: "Falha de conexão com o servidor backend.",
      };
      this._isOnline = false;
    }

    this.broadcast();
    return this.healthStatus;
  }

  public isOnline(): boolean {
    return this.healthStatus.canWrite;
  }

  public isSyncing(): boolean {
    return this._isSyncing;
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
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

    const lastSyncMeta = await localDb.appMetadata.get("last_sync_at");
    const lastSyncAt = lastSyncMeta ? lastSyncMeta.value : null;

    return {
      isOnline: this.healthStatus.canWrite,
      isSyncing: this._isSyncing,
      pendingCount,
      lastSyncAt,
      conflictCount,
      health: this.healthStatus,
    };
  }

  // --- API CALL ENGINE WITH IDEMPOTENCY ---

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
      let errMsg = `Falha na requisição (${res.status})`;
      try {
        const parsed = JSON.parse(errText);
        errMsg = parsed.error || parsed.message || errMsg;
      } catch (e) {}
      throw new Error(errMsg);
    }

    return res.json();
  }

  private ensureOnlineOrThrow() {
    if (!this.healthStatus.canWrite) {
      throw new Error(
        "Não foi possível salvar o registro no banco de dados remoto. Nenhuma alteração foi confirmada. Verifique sua conexão e tente novamente."
      );
    }
  }

  // --- CLIENT OPERATIONS (ONLINE-FIRST) ---

  public async listClients(search: string = ""): Promise<any[]> {
    await this.checkHealth();

    let list: any[] = [];
    let isFromCache = false;

    if (this.healthStatus.canWrite) {
      try {
        const url = `/api/clients?search=${encodeURIComponent(search)}`;
        list = await this.apiRequest(url, "GET");

        await localDb.cachedRecords.put({
          localId: "clients_list_cached",
          entityType: "clients",
          payload: list,
          localUpdatedAt: new Date().toISOString(),
          syncStatus: "synced",
        });

        isFromCache = false;
      } catch (err) {
        console.warn("Error fetching clients from server, using local cache:", err);
      }
    }

    if (!isFromCache && list.length === 0 && !this.healthStatus.canWrite) {
      const cached = await localDb.cachedRecords.get("clients_list_cached");
      if (cached && Array.isArray(cached.payload)) {
        list = cached.payload;
        if (search) {
          const queryNorm = search.toLowerCase().trim();
          list = list.filter(
            (c: any) =>
              (c.name && c.name.toLowerCase().includes(queryNorm)) ||
              (c.code && c.code.toLowerCase().includes(queryNorm)) ||
              (c.cpf_cnpj && c.cpf_cnpj.includes(queryNorm))
          );
        }
        isFromCache = true;
      }
    }

    const res = Array.isArray(list) ? list : [];
    (res as any).isFromCache = isFromCache;
    return res;
  }

  public async getClient(id: string | number): Promise<any> {
    const idStr = String(id);
    await this.checkHealth();

    if (this.healthStatus.canWrite) {
      try {
        const data = await this.apiRequest(`/api/clients/${id}`, "GET");

        await localDb.cachedRecords.put({
          localId: `client_detail_${idStr}`,
          entityType: "client_details",
          payload: data,
          localUpdatedAt: new Date().toISOString(),
          syncStatus: "synced",
        });

        if (data && typeof data === "object") {
          data.isFromCache = false;
        }
        return data;
      } catch (err) {
        console.warn(`Error fetching client ${id} from server, using local cache:`, err);
      }
    }

    const cached = await localDb.cachedRecords.get(`client_detail_${idStr}`);
    if (cached && cached.payload) {
      const data = cached.payload;
      if (data && typeof data === "object") {
        data.isFromCache = true;
      }
      return data;
    }

    throw new Error("Cliente não está disponível no cache local e o servidor está inacessível.");
  }

  public async createClient(payload: any): Promise<any> {
    await this.checkHealth();
    this.ensureOnlineOrThrow();

    try {
      const result = await this.apiRequest("/api/clients", "POST", payload);

      if (result && result.clientId) {
        const realClient = { ...payload, id: result.clientId, code: result.code, syncStatus: "synced" };
        await this.addOrUpdateInListCache("clients_list_cached", realClient);
      }

      return {
        success: true,
        clientId: result.clientId,
        code: result.code,
        message: "Cliente salvo com sucesso no banco de dados remoto.",
      };
    } catch (err: any) {
      console.error("createClient error:", err);
      throw new Error(
        err.message ||
          "Não foi possível salvar o registro no banco de dados remoto. Nenhuma alteração foi confirmada. Verifique sua conexão e tente novamente."
      );
    }
  }

  public async updateClient(id: string | number, payload: any): Promise<any> {
    await this.checkHealth();
    this.ensureOnlineOrThrow();

    try {
      const result = await this.apiRequest(`/api/clients/${id}`, "PUT", payload);
      await this.updateInListCache("clients_list_cached", id, payload);

      return {
        success: true,
        clientId: id,
        message: "Cliente atualizado com sucesso no banco de dados remoto.",
      };
    } catch (err: any) {
      console.error("updateClient error:", err);
      throw new Error(
        err.message ||
          "Não foi possível salvar o registro no banco de dados remoto. Nenhuma alteração foi confirmada. Verifique sua conexão e tente novamente."
      );
    }
  }

  // --- EQUIPMENT OPERATIONS (ONLINE-FIRST) ---

  public async createEquipment(payload: any): Promise<any> {
    await this.checkHealth();
    this.ensureOnlineOrThrow();

    try {
      const result = await this.apiRequest("/api/equipment", "POST", payload);

      if (result && result.equipmentId && payload.client_id) {
        await this.addEquipmentToClientCache(payload.client_id, {
          ...payload,
          id: result.equipmentId,
          code: result.code,
        });
      }

      return {
        success: true,
        equipmentId: result.equipmentId,
        code: result.code,
        message: "Equipamento cadastrado com sucesso no banco de dados remoto.",
      };
    } catch (err: any) {
      console.error("createEquipment error:", err);
      throw new Error(
        err.message ||
          "Não foi possível salvar o registro no banco de dados remoto. Nenhuma alteração foi confirmada. Verifique sua conexão e tente novamente."
      );
    }
  }

  public async updateEquipment(id: string | number, payload: any): Promise<any> {
    await this.checkHealth();
    this.ensureOnlineOrThrow();

    try {
      const result = await this.apiRequest(`/api/equipment/${id}`, "PUT", payload);

      return {
        success: true,
        equipmentId: id,
        message: "Equipamento atualizado com sucesso no banco de dados remoto.",
      };
    } catch (err: any) {
      console.error("updateEquipment error:", err);
      throw new Error(
        err.message ||
          "Não foi possível salvar o registro no banco de dados remoto. Nenhuma alteração foi confirmada. Verifique sua conexão e tente novamente."
      );
    }
  }

  // --- SERVICE ORDER OPERATIONS (ONLINE-FIRST) ---

  public async listServiceOrders(search: string = "", status: string = ""): Promise<any[]> {
    await this.checkHealth();

    let list: any[] = [];
    let isFromCache = false;

    if (this.healthStatus.canWrite) {
      try {
        const url = `/api/service-orders?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;
        list = await this.apiRequest(url, "GET");

        await localDb.cachedRecords.put({
          localId: "service_orders_list_cached",
          entityType: "service_orders",
          payload: list,
          localUpdatedAt: new Date().toISOString(),
          syncStatus: "synced",
        });

        isFromCache = false;
      } catch (err) {
        console.warn("Error fetching service orders, using local cache:", err);
      }
    }

    if (!isFromCache && list.length === 0 && !this.healthStatus.canWrite) {
      const cached = await localDb.cachedRecords.get("service_orders_list_cached");
      if (cached && Array.isArray(cached.payload)) {
        list = cached.payload;
        if (search) {
          const q = search.toLowerCase().trim();
          list = list.filter(
            (o: any) =>
              (o.code && o.code.toLowerCase().includes(q)) ||
              (o.client_name && o.client_name.toLowerCase().includes(q)) ||
              (o.brand && o.brand.toLowerCase().includes(q)) ||
              (o.model && o.model.toLowerCase().includes(q))
          );
        }
        if (status) {
          list = list.filter((o: any) => o.status_name === status);
        }
        isFromCache = true;
      }
    }

    const res = Array.isArray(list) ? list : [];
    (res as any).isFromCache = isFromCache;
    return res;
  }

  public async getServiceOrder(id: string | number): Promise<any> {
    const idStr = String(id);
    await this.checkHealth();

    if (this.healthStatus.canWrite) {
      try {
        const data = await this.apiRequest(`/api/service-orders/${id}`, "GET");

        await localDb.cachedRecords.put({
          localId: `service_order_detail_${idStr}`,
          entityType: "service_order_details",
          payload: data,
          localUpdatedAt: new Date().toISOString(),
          syncStatus: "synced",
        });

        if (data && typeof data === "object") {
          data.isFromCache = false;
        }
        return data;
      } catch (err) {
        console.warn(`Error fetching OS ${id} from server, using local cache:`, err);
      }
    }

    const cached = await localDb.cachedRecords.get(`service_order_detail_${idStr}`);
    if (cached && cached.payload) {
      const data = cached.payload;
      if (data && typeof data === "object") {
        data.isFromCache = true;
      }
      return data;
    }

    throw new Error("Ordem de serviço não está disponível no cache local e o servidor está inacessível.");
  }

  public async createServiceOrder(payload: any): Promise<any> {
    await this.checkHealth();
    this.ensureOnlineOrThrow();

    try {
      const result = await this.apiRequest("/api/service-orders", "POST", payload);

      if (result && result.osId) {
        const realOS = { ...payload, id: result.osId, code: result.code, syncStatus: "synced" };
        await this.addOrUpdateInListCache("service_orders_list_cached", realOS);
      }

      return {
        success: true,
        osId: result.osId,
        code: result.code,
        message: "Ordem de serviço criada com sucesso no banco de dados remoto.",
      };
    } catch (err: any) {
      console.error("createServiceOrder error:", err);
      throw new Error(
        err.message ||
          "Não foi possível salvar o registro no banco de dados remoto. Nenhuma alteração foi confirmada. Verifique sua conexão e tente novamente."
      );
    }
  }

  public async updateServiceOrder(id: string | number, payload: any): Promise<any> {
    await this.checkHealth();
    this.ensureOnlineOrThrow();

    try {
      const result = await this.apiRequest(`/api/service-orders/${id}`, "PUT", payload);

      return {
        success: true,
        osId: id,
        statusName: result.statusName,
        message: "Ordem de serviço atualizada com sucesso no banco de dados remoto.",
      };
    } catch (err: any) {
      console.error("updateServiceOrder error:", err);
      throw new Error(
        err.message ||
          "Não foi possível salvar o registro no banco de dados remoto. Nenhuma alteração foi confirmada. Verifique sua conexão e tente novamente."
      );
    }
  }

  public async deleteServiceOrder(id: string | number): Promise<any> {
    await this.checkHealth();
    this.ensureOnlineOrThrow();

    try {
      const result = await this.apiRequest(`/api/service-orders/${id}`, "DELETE");
      await localDb.cachedRecords.delete(`service_order_detail_${id}`);

      return {
        success: true,
        message: result.message || "Ordem de serviço excluída com sucesso no banco de dados remoto.",
      };
    } catch (err: any) {
      console.error("deleteServiceOrder error:", err);
      throw new Error(
        err.message ||
          "Não foi possível excluir o registro no banco de dados remoto. Nenhuma alteração foi realizada. Verifique sua conexão e tente novamente."
      );
    }
  }

  // --- BUDGET ITEM OPERATIONS (ONLINE-FIRST) ---

  public async addBudgetItem(osId: string | number, payload: any): Promise<any> {
    await this.checkHealth();
    this.ensureOnlineOrThrow();

    try {
      const result = await this.apiRequest(`/api/service-orders/${osId}/budget`, "POST", payload);

      return {
        success: true,
        itemId: result.itemId,
        message: "Item de orçamento adicionado com sucesso no banco de dados remoto.",
      };
    } catch (err: any) {
      console.error("addBudgetItem error:", err);
      throw new Error(
        err.message ||
          "Não foi possível salvar o item no banco de dados remoto. Nenhuma alteração foi confirmada. Verifique sua conexão e tente novamente."
      );
    }
  }

  public async updateBudgetItem(osId: string | number, itemId: string | number, payload: any): Promise<any> {
    await this.checkHealth();
    this.ensureOnlineOrThrow();

    try {
      const result = await this.apiRequest(`/api/service-orders/${osId}/budget/${itemId}`, "PUT", payload);

      return {
        success: true,
        itemId,
        message: "Item de orçamento atualizado com sucesso no banco de dados remoto.",
      };
    } catch (err: any) {
      console.error("updateBudgetItem error:", err);
      throw new Error(
        err.message ||
          "Não foi possível atualizar o item no banco de dados remoto. Nenhuma alteração foi confirmada. Verifique sua conexão e tente novamente."
      );
    }
  }

  public async deleteBudgetItem(osId: string | number, itemId: string | number): Promise<any> {
    await this.checkHealth();
    this.ensureOnlineOrThrow();

    try {
      const result = await this.apiRequest(`/api/service-orders/${osId}/budget/${itemId}`, "DELETE");

      return {
        success: true,
        message: "Item de orçamento removido do banco de dados remoto com sucesso.",
      };
    } catch (err: any) {
      console.error("deleteBudgetItem error:", err);
      throw new Error(
        err.message ||
          "Não foi possível remover o item no banco de dados remoto. Nenhuma alteração foi confirmada. Verifique sua conexão e tente novamente."
      );
    }
  }

  // --- PAYMENT GUIDE & FINANCIAL OPERATIONS (ONLINE-FIRST) ---

  public async createPaymentGuide(osId: string | number, payload: any): Promise<any> {
    await this.checkHealth();
    this.ensureOnlineOrThrow();

    try {
      const result = await this.apiRequest(`/api/service-orders/${osId}/guide`, "POST", payload);

      return {
        success: true,
        guideId: result.guideId,
        message: "Guia de pagamento gerada com sucesso no banco de dados remoto.",
      };
    } catch (err: any) {
      throw new Error(
        err.message ||
          "Não foi possível gerar a guia de pagamento no banco de dados remoto. Verifique sua conexão e tente novamente."
      );
    }
  }

  public async payPaymentGuide(guideId: string | number, payload: any): Promise<any> {
    await this.checkHealth();
    this.ensureOnlineOrThrow();

    try {
      const result = await this.apiRequest(`/api/payment-guides/${guideId}/pay`, "POST", payload);

      return {
        success: true,
        paymentId: result.paymentId,
        message: "Pagamento registrado com sucesso no banco de dados remoto.",
      };
    } catch (err: any) {
      throw new Error(
        err.message ||
          "Não foi possível registrar o pagamento no banco de dados remoto. Verifique sua conexão e tente novamente."
      );
    }
  }

  public async createTransaction(payload: any): Promise<any> {
    await this.checkHealth();
    this.ensureOnlineOrThrow();

    try {
      const result = await this.apiRequest("/api/finance/transactions", "POST", payload);

      return {
        success: true,
        id: result.id,
        message: "Transação financeira registrada com sucesso no banco de dados remoto.",
      };
    } catch (err: any) {
      throw new Error(
        err.message ||
          "Não foi possível registrar a transação no banco de dados remoto. Verifique sua conexão e tente novamente."
      );
    }
  }

  public async createWarranty(osId: string | number, payload: any): Promise<any> {
    await this.checkHealth();
    this.ensureOnlineOrThrow();

    try {
      const result = await this.apiRequest(`/api/service-orders/${osId}/warranty`, "POST", payload);

      return {
        success: true,
        warrantyId: result.warrantyId,
        message: "Garantia gerada com sucesso no banco de dados remoto.",
      };
    } catch (err: any) {
      throw new Error(
        err.message ||
          "Não foi possível gerar o termo de garantia no banco de dados remoto. Verifique sua conexão e tente novamente."
      );
    }
  }

  // --- LEGACY INDEXEDDB DIAGNOSTIC AND RECOVERY AREA ---

  public async getLegacyPendingItems(): Promise<{ queue: SyncQueueItem[]; conflicts: SyncConflict[] }> {
    const queue = await localDb.syncQueue.toArray();
    const conflicts = await localDb.syncConflicts.toArray();
    return { queue, conflicts };
  }

  public async resendLegacyItem(queueItemId: string): Promise<{ success: boolean; message: string }> {
    await this.checkHealth();
    if (!this.healthStatus.canWrite) {
      throw new Error("O banco de dados remoto está inacessível no momento. Não é possível reenviar o item.");
    }

    const item = await localDb.syncQueue.get(queueItemId);
    if (!item) {
      throw new Error("Item pendente não localizado no armazenamento local.");
    }

    item.status = "syncing";
    await localDb.syncQueue.put(item);

    try {
      await this.resolveDependencies(item);
      const { operation, entityType, localId, payload } = item;
      let result: any = null;

      if (entityType === "clients") {
        if (operation === "create") {
          result = await this.apiRequest("/api/clients", "POST", payload, item.id);
          if (result && result.clientId) {
            await this.updateOfflineIdReference("clients", localId, result.clientId);
          }
        } else if (operation === "update") {
          result = await this.apiRequest(`/api/clients/${localId}`, "PUT", payload, item.id);
        }
      } else if (entityType === "equipment") {
        if (operation === "create") {
          result = await this.apiRequest("/api/equipment", "POST", payload, item.id);
          if (result && result.equipmentId) {
            await this.updateOfflineIdReference("equipment", localId, result.equipmentId);
          }
        }
      } else if (entityType === "service_orders") {
        if (operation === "create") {
          result = await this.apiRequest("/api/service-orders", "POST", payload, item.id);
          if (result && result.osId) {
            await this.updateOfflineIdReference("service_orders", localId, result.osId);
          }
        } else if (operation === "update") {
          result = await this.apiRequest(`/api/service-orders/${localId}`, "PUT", payload, item.id);
        }
      } else if (entityType === "budget_items") {
        if (operation === "create") {
          const osIdValue = payload.osId || localId;
          result = await this.apiRequest(`/api/service-orders/${osIdValue}/budget`, "POST", payload, item.id);
        }
      }

      await localDb.syncQueue.delete(item.id);
      this.broadcast();
      return { success: true, message: "Item sincronizado e confirmado no banco MySQL com sucesso!" };
    } catch (err: any) {
      item.status = "failed";
      item.attempts += 1;
      item.lastError = err.message || "Erro de sincronização";
      await localDb.syncQueue.put(item);
      this.broadcast();
      throw new Error(`Falha ao reenviar item ao servidor: ${err.message}`);
    }
  }

  public async exportLegacyPendingItems(): Promise<string> {
    const queue = await localDb.syncQueue.toArray();
    const conflicts = await localDb.syncConflicts.toArray();

    const exportData = {
      app: "PKSIG PWA - Diagnóstico de Dados Locais",
      exportDate: new Date().toISOString(),
      pendingCount: queue.length,
      conflictCount: conflicts.length,
      syncQueue: queue,
      syncConflicts: conflicts,
    };

    return JSON.stringify(exportData, null, 2);
  }

  public async discardLegacyItem(itemId: string): Promise<void> {
    await localDb.syncQueue.delete(itemId);
    await localDb.syncConflicts.delete(itemId);
    this.broadcast();
  }

  public async clearLegacyStorage(): Promise<void> {
    await localDb.syncQueue.clear();
    await localDb.syncConflicts.clear();
    this.broadcast();
  }

  // --- INTERNAL CACHE HELPERS ---

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
        syncStatus: "synced",
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
      await localDb.cachedRecords.put(cached);
    }
  }

  private async resolveDependencies(item: SyncQueueItem) {
    const { payload } = item;
    if (payload.client_id && String(payload.client_id).startsWith("client_off_")) {
      const mappingKey = `mapping_clients_${payload.client_id}`;
      const mappedVal = await localDb.appMetadata.get(mappingKey);
      if (mappedVal) {
        payload.client_id = parseInt(mappedVal.value);
      }
    }
    if (payload.equipment_id && String(payload.equipment_id).startsWith("equip_off_")) {
      const mappingKey = `mapping_equipment_${payload.equipment_id}`;
      const mappedVal = await localDb.appMetadata.get(mappingKey);
      if (mappedVal) {
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

  private async updateOfflineIdReference(entityType: string, oldId: string, newId: number) {
    await localDb.appMetadata.put({
      key: `mapping_${entityType}_${oldId}`,
      value: String(newId),
      updatedAt: new Date().toISOString(),
    });

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
  }
}

export const DataService = new DataServiceClass();
