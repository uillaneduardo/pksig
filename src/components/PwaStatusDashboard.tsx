import { useState, useEffect } from "react";
import { 
  Wifi, WifiOff, RefreshCw, CheckCircle, AlertTriangle, 
  Database, Info, ShieldAlert, Sparkles, UserCheck 
} from "lucide-react";
import { DataService, type SyncStatus } from "../lib/dataService";
import { localDb, type SyncConflict } from "../lib/dexieDb";

interface PwaStatusDashboardProps {
  onClose?: () => void;
}

export default function PwaStatusDashboard({ onClose }: PwaStatusDashboardProps) {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    conflictCount: 0,
  });

  const [storageEstimate, setStorageEstimate] = useState<{ used: string; total: string; percent: number } | null>(null);
  const [isPersistent, setIsPersistent] = useState<boolean | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string>("");

  useEffect(() => {
    // Subscribe to sync service status
    const unsubscribe = DataService.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    // Load storage estimate
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        const usedBytes = est.usage || 0;
        const totalBytes = est.quota || 1;
        const usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
        const totalMB = (totalBytes / (1024 * 1024)).toFixed(0);
        const percent = Math.min(100, Math.round((usedBytes / totalBytes) * 100));
        setStorageEstimate({ used: usedMB, total: totalMB, percent });
      });

      if (navigator.storage.persisted) {
        navigator.storage.persisted().then((persisted) => {
          setIsPersistent(persisted);
        });
      }
    }

    // Load active conflicts
    loadConflicts();

    return unsubscribe;
  }, []);

  const loadConflicts = async () => {
    try {
      const activeConflicts = await localDb.syncConflicts.where("status").equals("pending").toArray();
      setConflicts(activeConflicts);
    } catch (err) {
      console.error("Failed to load sync conflicts:", err);
    }
  };

  const handleSyncNow = async () => {
    setSyncMessage("Sincronizando...");
    try {
      await DataService.sync();
      setSyncMessage("Sincronização concluída com sucesso!");
      loadConflicts();
    } catch (err: any) {
      setSyncMessage(`Erro ao sincronizar: ${err?.message || "Erro desconhecido"}`);
    }
    setTimeout(() => setSyncMessage(""), 4000);
  };

  const handleRequestPersistence = async () => {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
      try {
        const granted = await navigator.storage.persist();
        setIsPersistent(granted);
        alert(
          granted 
            ? "Sucesso! O navegador agora protege o armazenamento local do PKSIG contra remoção automática." 
            : "Permissão de persistência negada pelo navegador."
        );
      } catch (err) {
        console.error("Failed to request storage persistence:", err);
      }
    }
  };

  const handleResolveConflict = async (conflictId: string, decision: "local" | "server") => {
    setResolvingId(conflictId);
    try {
      const conflict = await localDb.syncConflicts.get(conflictId);
      if (!conflict) return;

      if (decision === "local") {
        // Keep local: re-add operation to queue as a standard update to push local over server
        await localDb.syncQueue.put({
          id: conflictId, // reuse ID
          operation: "update",
          entityType: conflict.entityType,
          localId: conflict.localId,
          payload: conflict.localPayload,
          createdAt: new Date().toISOString(),
          attempts: 0,
          status: "pending",
        });
      } else {
        // Keep server: overwrite local cache with server payload
        await localDb.cachedRecords.put({
          localId: conflict.localId,
          entityType: conflict.entityType,
          payload: conflict.serverPayload,
          localUpdatedAt: new Date().toISOString(),
          syncStatus: "synced",
        });
      }

      // Mark conflict as resolved
      conflict.status = "resolved";
      await localDb.syncConflicts.put(conflict);
      
      // Reload conflicts and sync if we chose local
      await loadConflicts();
      if (decision === "local") {
        await DataService.sync();
      }
    } catch (err) {
      console.error("Error resolving conflict:", err);
      alert("Erro ao resolver conflito.");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-5 text-xs text-gray-700">
      
      {/* 1. CONNECTION & SYNC HEADER */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center space-x-2">
          {status.isOnline ? (
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center space-x-1 font-bold tracking-tight">
              <Wifi className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
              <span>SISTEMA CONECTADO</span>
            </div>
          ) : (
            <div className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full flex items-center space-x-1 font-bold tracking-tight">
              <WifiOff className="h-3.5 w-3.5 text-amber-600" />
              <span>TRABALHANDO OFFLINE</span>
            </div>
          )}
        </div>
        <button
          onClick={handleSyncNow}
          disabled={status.isSyncing || !status.isOnline}
          className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded transition cursor-pointer"
        >
          <RefreshCw className={`h-3 w-3 ${status.isSyncing ? "animate-spin" : ""}`} />
          <span>Sincronizar agora</span>
        </button>
      </div>

      {syncMessage && (
        <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-800 rounded font-semibold text-center animate-pulse">
          {syncMessage}
        </div>
      )}

      {/* 2. STATS SUMMARY GRID */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 border border-gray-100 rounded-md p-3">
          <span className="text-[10px] text-gray-400 font-bold block uppercase mb-1">Última Sincronização</span>
          <span className="font-bold text-gray-800 text-xs">
            {status.lastSyncAt || "Nunca Sincronizado"}
          </span>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-md p-3">
          <span className="text-[10px] text-gray-400 font-bold block uppercase mb-1">Operações Pendentes</span>
          <div className="flex items-baseline space-x-1.5">
            <span className={`font-black text-sm ${status.pendingCount > 0 ? "text-amber-600 animate-bounce" : "text-gray-800"}`}>
              {status.pendingCount}
            </span>
            <span className="text-[9px] text-gray-400 font-medium">aguardando rede</span>
          </div>
        </div>
      </div>

      {/* 3. STORAGE AND PERSISTENCE (ETAPA 7) */}
      <div className="border border-gray-150 rounded-lg p-3.5 space-y-2.5 bg-gray-50/50">
        <div className="flex items-center space-x-1.5 border-b border-gray-200/50 pb-1.5">
          <Database className="h-4 w-4 text-indigo-600" />
          <h4 className="font-bold text-gray-800">Armazenamento Local IndexedDB (PWA)</h4>
        </div>

        {storageEstimate && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Espaço Utilizado:</span>
              <span className="font-mono font-bold text-gray-800">
                {storageEstimate.used} MB / {storageEstimate.total} MB ({storageEstimate.percent}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-indigo-600 h-1.5 rounded-full" 
                style={{ width: `${storageEstimate.percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-start space-x-2 text-[10px] text-gray-500 pt-1 leading-relaxed">
          <Info className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
          <div>
            <p>O navegador gerencia os dados do PKSIG de forma local para funcionamento offline.</p>
            <p className="mt-1">
              A persistência reduz o risco de remoção automática do banco de dados em dispositivos com pouco espaço, mas <strong>não substitui backup</strong>.
            </p>
          </div>
        </div>

        {isPersistent !== null && (
          <div className="pt-1.5 flex items-center justify-between text-[10px]">
            <div className="flex items-center space-x-1">
              <span className={`h-2 w-2 rounded-full ${isPersistent ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span className="font-bold text-gray-700">
                {isPersistent ? "Armazenamento Protegido (Persistente)" : "Armazenamento Volátil"}
              </span>
            </div>
            {!isPersistent && (
              <button
                onClick={handleRequestPersistence}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
              >
                Solicitar proteção
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. SYNC CONFLICT RESOLUTION (ETAPA 5) */}
      <div className="space-y-2.5">
        <div className="flex items-center space-x-1.5 border-b border-gray-100 pb-2">
          <ShieldAlert className="h-4 w-4 text-red-500" />
          <h4 className="font-bold text-gray-800 uppercase tracking-tight">
            Conflitos de Sincronização ({conflicts.length})
          </h4>
        </div>

        {conflicts.length === 0 ? (
          <p className="text-gray-400 italic text-[11px] bg-emerald-50/20 border border-emerald-100/50 p-2.5 rounded text-center">
            Nenhum conflito estrutural ou de sincronização ativo atualmente.
          </p>
        ) : (
          <div className="space-y-3 overflow-y-auto max-h-56 pr-1">
            {conflicts.map((c) => (
              <div key={c.id} className="border border-red-200 bg-red-50/10 rounded-md p-3 space-y-2 text-[11px]">
                <div className="flex justify-between items-center text-[10px] font-bold text-red-800 bg-red-100/40 px-2 py-0.5 rounded">
                  <span>Tabela: {c.entityType?.toUpperCase()}</span>
                  <span>ID Local: {c.localId}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-white border border-gray-150 rounded p-2">
                    <span className="text-gray-400 font-bold block mb-1">CÓPIA NO DISPOSITIVO:</span>
                    <pre className="font-mono text-[9px] max-h-20 overflow-y-auto whitespace-pre-wrap">
                      {JSON.stringify(c.localPayload, null, 2)}
                    </pre>
                  </div>
                  <div className="bg-white border border-gray-150 rounded p-2">
                    <span className="text-gray-400 font-bold block mb-1">CÓPIA NO SERVIDOR:</span>
                    <pre className="font-mono text-[9px] max-h-20 overflow-y-auto whitespace-pre-wrap">
                      {JSON.stringify(c.serverPayload, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-1 text-[10px]">
                  <button
                    onClick={() => handleResolveConflict(c.id, "server")}
                    disabled={resolvingId === c.id}
                    className="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 rounded hover:bg-gray-50 transition font-bold disabled:opacity-50"
                  >
                    Ficar com Servidor
                  </button>
                  <button
                    onClick={() => handleResolveConflict(c.id, "local")}
                    disabled={resolvingId === c.id}
                    className="px-2.5 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition font-bold disabled:opacity-50"
                  >
                    Ficar com Dispositivo
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
