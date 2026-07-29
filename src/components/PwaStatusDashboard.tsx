import { useState, useEffect } from "react";
import { 
  Wifi, WifiOff, RefreshCw, CheckCircle, AlertTriangle, 
  Database, Info, ShieldAlert, Download, Trash2, Send, AlertCircle
} from "lucide-react";
import { DataService, type SyncStatus } from "../lib/dataService";
import { localDb, type SyncQueueItem, type SyncConflict } from "../lib/dexieDb";

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
    health: {
      server: "online",
      database: "connected",
      mode: "remoto",
      host: "servidor configurado",
      databaseName: "pksig",
      lastCheckedAt: null,
      canWrite: true,
    },
  });

  const [storageEstimate, setStorageEstimate] = useState<{ used: string; total: string; percent: number } | null>(null);
  const [isPersistent, setIsPersistent] = useState<boolean | null>(null);
  const [legacyQueue, setLegacyQueue] = useState<SyncQueueItem[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string>("");
  const [actionError, setActionError] = useState<string>("");

  // Clear storage modal state
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [confirmClearText, setConfirmClearText] = useState<string>("");

  useEffect(() => {
    const unsubscribe = DataService.subscribe((newStatus) => {
      setStatus(newStatus);
    });

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

    loadLegacyItems();

    return unsubscribe;
  }, []);

  const loadLegacyItems = async () => {
    try {
      const { queue, conflicts: activeConflicts } = await DataService.getLegacyPendingItems();
      setLegacyQueue(queue);
      setConflicts(activeConflicts);
    } catch (err) {
      console.error("Error loading legacy items:", err);
    }
  };

  const handleHealthCheck = async () => {
    setActionMessage("Verificando conexão com o servidor...");
    setActionError("");
    try {
      const health = await DataService.checkHealth();
      if (health.canWrite) {
        setActionMessage("Conexão verificada com sucesso! Servidor e banco MySQL ativos.");
      } else {
        setActionError(`Conexão indisponível: ${health.error || "Servidor ou banco inativo."}`);
      }
    } catch (err: any) {
      setActionError(`Erro de verificação: ${err?.message || "Erro desconhecido"}`);
    }
    setTimeout(() => {
      setActionMessage("");
    }, 4000);
  };

  const handleResendItem = async (itemId: string) => {
    setProcessingId(itemId);
    setActionMessage("");
    setActionError("");
    try {
      const res = await DataService.resendLegacyItem(itemId);
      setActionMessage(res.message);
      await loadLegacyItems();
    } catch (err: any) {
      setActionError(err.message || "Falha ao reenviar item.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleExportPending = async () => {
    try {
      const jsonStr = await DataService.exportLegacyPendingItems();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `pksig-dados-pendentes-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setActionMessage("Arquivo JSON de dados pendentes baixado com sucesso!");
    } catch (err: any) {
      setActionError(`Erro ao exportar dados pendentes: ${err.message}`);
    }
  };

  const handleDiscardItem = async (itemId: string) => {
    if (!window.confirm("Deseja realmente descartar este registro pendente? Esta operação removerá a alteração local do dispositivo.")) {
      return;
    }
    try {
      await DataService.discardLegacyItem(itemId);
      setActionMessage("Item descartado do armazenamento local com sucesso.");
      await loadLegacyItems();
    } catch (err: any) {
      setActionError(`Erro ao descartar item: ${err.message}`);
    }
  };

  const handleConfirmClearStorage = async () => {
    if (confirmClearText.trim() !== "LIMPAR DADOS") {
      setActionError("Para confirmar a limpeza, você deve digitar exatamente 'LIMPAR DADOS'.");
      return;
    }
    try {
      await DataService.clearLegacyStorage();
      setShowClearModal(false);
      setConfirmClearText("");
      setActionMessage("Armazenamento local limpo com sucesso!");
      await loadLegacyItems();
    } catch (err: any) {
      setActionError(`Erro ao limpar armazenamento: ${err.message}`);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 space-y-5 text-xs text-gray-700 max-w-4xl mx-auto">
      
      {/* 1. CONNECTION & HEALTH STATUS HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-100 pb-3 gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            {status.health.canWrite ? (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center space-x-1 font-bold tracking-tight">
                <Wifi className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                <span>BANCO REMOTO CONECTADO</span>
              </div>
            ) : status.health.server === "online" ? (
              <div className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full flex items-center space-x-1 font-bold tracking-tight">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span>BANCO DE DADOS INDISPONÍVEL</span>
              </div>
            ) : (
              <div className="bg-red-50 text-red-800 border border-red-200 px-2.5 py-1 rounded-full flex items-center space-x-1 font-bold tracking-tight">
                <WifiOff className="h-3.5 w-3.5 text-red-600" />
                <span>SERVIDOR INDISPONÍVEL</span>
              </div>
            )}
            <span className="text-[10px] text-gray-400 font-mono">
              Mode: {status.health.mode} ({status.health.databaseName})
            </span>
          </div>
          <p className="text-[10px] text-gray-500">
            Host: <span className="font-mono">{status.health.host}</span> | Última verificação: {status.health.lastCheckedAt || "Agora"}
          </p>
        </div>

        <button
          onClick={handleHealthCheck}
          className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded transition cursor-pointer"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Verificar conexão agora</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded font-semibold text-center">
          {actionMessage}
        </div>
      )}

      {actionError && (
        <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded font-semibold text-center">
          {actionError}
        </div>
      )}

      {!status.health.canWrite && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-md text-[11px] leading-relaxed flex items-start space-x-2">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Atenção:</strong> O servidor/banco MySQL está inacessível. O PKSIG é uma aplicação online-first com gravação obrigatória no MySQL. 
            <strong> Alterações e gravações estão temporariamente bloqueadas</strong> para garantir a integridade dos dados e evitar perdas.
          </div>
        </div>
      )}

      {/* 2. STATS SUMMARY GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gray-50 border border-gray-100 rounded-md p-3">
          <span className="text-[10px] text-gray-400 font-bold block uppercase mb-1">Status do Servidor</span>
          <span className="font-bold text-gray-800 text-xs capitalize">
            {status.health.server === "online" ? "Online" : "Offline / Inacessível"}
          </span>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-md p-3">
          <span className="text-[10px] text-gray-400 font-bold block uppercase mb-1">Status do MySQL</span>
          <span className="font-bold text-gray-800 text-xs capitalize">
            {status.health.database === "connected" ? "Conectado" : "Desconectado"}
          </span>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-md p-3">
          <span className="text-[10px] text-gray-400 font-bold block uppercase mb-1">Registros Pendentes Locais</span>
          <div className="flex items-baseline space-x-1.5">
            <span className={`font-black text-sm ${legacyQueue.length > 0 ? "text-amber-600" : "text-gray-800"}`}>
              {legacyQueue.length}
            </span>
            <span className="text-[9px] text-gray-400 font-medium">no IndexedDB</span>
          </div>
        </div>
      </div>

      {/* 3. LEGACY DATA DIAGNOSTIC & RECOVERY AREA */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-200 pb-2 gap-2">
          <div className="flex items-center space-x-1.5">
            <Database className="h-4 w-4 text-indigo-600" />
            <h4 className="font-bold text-gray-800 text-sm">Diagnóstico e Recuperação de Dados Pendentes Locais</h4>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportPending}
              disabled={legacyQueue.length === 0 && conflicts.length === 0}
              className="flex items-center space-x-1 px-2.5 py-1 bg-white border border-gray-200 text-gray-700 font-bold rounded hover:bg-gray-100 disabled:opacity-50 transition cursor-pointer text-[11px]"
            >
              <Download className="h-3 w-3 text-indigo-600" />
              <span>Exportar JSON</span>
            </button>
            <button
              onClick={() => setShowClearModal(true)}
              disabled={legacyQueue.length === 0 && conflicts.length === 0}
              className="flex items-center space-x-1 px-2.5 py-1 bg-red-50 border border-red-200 text-red-700 font-bold rounded hover:bg-red-100 disabled:opacity-50 transition cursor-pointer text-[11px]"
            >
              <Trash2 className="h-3 w-3 text-red-600" />
              <span>Limpar Local</span>
            </button>
          </div>
        </div>

        {legacyQueue.length === 0 ? (
          <p className="text-gray-500 italic text-[11px] bg-emerald-50/50 border border-emerald-100 p-3 rounded text-center font-medium">
            Nenhum registro pendente retido no navegador. Todos os dados operacionais estão sincronizados diretamente no banco de dados MySQL.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-gray-600">
              Foram identificados <strong>{legacyQueue.length}</strong> registro(s) no IndexedDB local. Você pode reenviá-los ao servidor remoto MySQL ou exportá-los antes de qualquer limpeza.
            </p>
            <div className="overflow-x-auto border border-gray-200 rounded-md bg-white max-h-64 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[9px] font-bold sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Entidade</th>
                    <th className="px-3 py-2 text-left">Operação</th>
                    <th className="px-3 py-2 text-left">ID Local / Data</th>
                    <th className="px-3 py-2 text-left">Resumo do Registro</th>
                    <th className="px-3 py-2 text-left">Último Erro</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-sans">
                  {legacyQueue.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-bold uppercase text-indigo-700">{item.entityType}</td>
                      <td className="px-3 py-2 font-semibold">{item.operation}</td>
                      <td className="px-3 py-2 font-mono text-[10px]">
                        <div>{item.localId}</div>
                        <div className="text-gray-400 text-[9px]">
                          {item.createdAt ? new Date(item.createdAt).toLocaleString("pt-BR") : "-"}
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate text-[10px] text-gray-600 font-mono">
                        {JSON.stringify(item.payload)}
                      </td>
                      <td className="px-3 py-2 text-red-600 text-[10px] max-w-xs truncate">
                        {item.lastError || "Pendente"}
                      </td>
                      <td className="px-3 py-2 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleResendItem(item.id)}
                          disabled={processingId === item.id || !status.health.canWrite}
                          className="px-2 py-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 font-bold text-[10px] inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <Send className="h-2.5 w-2.5" />
                          <span>Reenviar</span>
                        </button>
                        <button
                          onClick={() => handleDiscardItem(item.id)}
                          className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 rounded hover:bg-red-50 hover:text-red-700 font-bold text-[10px] cursor-pointer"
                        >
                          Descartar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* CLEAR STORAGE MODAL */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4 border border-gray-200">
            <div className="flex items-center space-x-2 text-red-600 border-b border-gray-100 pb-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h3 className="font-bold text-sm text-gray-900">Confirmar Limpeza do Armazenamento Local</h3>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Você está prestes a apagar <strong>{legacyQueue.length}</strong> registro(s) pendentes retidos no armazenamento local do seu navegador. 
              Esta operação é <strong>irreversível</strong>. Recomendamos exportar o arquivo de backup em JSON antes de prosseguir.
            </p>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-700">
                Digite exatamente <span className="font-mono text-red-600 bg-red-50 px-1 py-0.5 rounded">LIMPAR DADOS</span> para confirmar:
              </label>
              <input
                type="text"
                value={confirmClearText}
                onChange={(e) => setConfirmClearText(e.target.value)}
                placeholder="LIMPAR DADOS"
                className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => {
                  setShowClearModal(false);
                  setConfirmClearText("");
                }}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded font-bold hover:bg-gray-200 cursor-pointer text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmClearStorage}
                disabled={confirmClearText.trim() !== "LIMPAR DADOS"}
                className="px-3 py-1.5 bg-red-600 text-white rounded font-bold hover:bg-red-700 disabled:opacity-50 cursor-pointer text-xs"
              >
                Limpar Definitive
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
