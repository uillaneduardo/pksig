import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  CheckCircle2, XCircle, Loader2, AlertTriangle, Info, 
  ChevronRight, ArrowRight, CornerDownRight, Database, RefreshCw
} from "lucide-react";
import { OperationProgress as OpProgType, OperationStep } from "../types";

// ==========================================
// 1. ProgressBar Component
// ==========================================
interface ProgressBarProps {
  percentage?: number;
  status: OpProgType["status"];
}

export function ProgressBar({ percentage, status }: ProgressBarProps) {
  const isIndeterminate = percentage === undefined;
  const isFailed = status === "failed";
  const isSuccess = status === "success";

  // Color classes based on status
  const barBg = isFailed
    ? "bg-red-500"
    : isSuccess
    ? "bg-emerald-500"
    : "bg-blue-600";

  return (
    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden relative border border-gray-200">
      {isIndeterminate && status === "running" ? (
        <motion.div
          className={`h-full rounded-full ${barBg}`}
          initial={{ left: "-40%", width: "40%" }}
          animate={{ left: "110%" }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: "easeInOut",
          }}
          style={{ position: "absolute" }}
        />
      ) : (
        <motion.div
          className={`h-full rounded-full ${barBg}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage ?? 0}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      )}
    </div>
  );
}

// ==========================================
// 2. OperationSteps Component
// ==========================================
interface OperationStepsProps {
  steps: OperationStep[];
}

export function OperationSteps({ steps }: OperationStepsProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="space-y-2 mt-4 max-h-56 overflow-y-auto pr-1 select-none">
      {steps.map((step, idx) => {
        const isPending = step.status === "pending";
        const isRunning = step.status === "running";
        const isSuccess = step.status === "success";
        const isFailed = step.status === "failed";

        let statusIcon = null;
        let textClass = "text-gray-500";
        let bgClass = "bg-transparent";

        if (isPending) {
          statusIcon = <div className="h-4 w-4 rounded-full border border-gray-300 bg-white shrink-0" />;
          textClass = "text-gray-400";
        } else if (isRunning) {
          statusIcon = <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />;
          textClass = "text-blue-700 font-medium";
          bgClass = "bg-blue-50/50 border border-blue-100/70 rounded px-2 py-0.5 -mx-2";
        } else if (isSuccess) {
          statusIcon = <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
          textClass = "text-gray-700";
        } else if (isFailed) {
          statusIcon = <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
          textClass = "text-red-700 font-medium";
          bgClass = "bg-red-50/50 border border-red-100/70 rounded px-2 py-0.5 -mx-2";
        }

        return (
          <div key={idx} className={`flex flex-col ${bgClass} transition-all duration-200`}>
            <div className="flex items-center space-x-2 text-xs">
              {statusIcon}
              <span className={textClass}>{step.name}</span>
            </div>
            {isFailed && step.error && (
              <div className="ml-6 mt-1 flex items-start space-x-1 text-[10px] text-red-500 bg-red-50 border border-red-100 rounded px-2 py-1">
                <CornerDownRight className="h-3 w-3 shrink-0 mt-0.5" />
                <span className="font-mono leading-relaxed">{step.error}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// 3. OperationResult Component
// ==========================================
interface OperationResultProps {
  status: OpProgType["status"];
  message: string;
  result?: any;
  onClose?: () => void;
  onRetry?: () => void;
}

export function OperationResult({ status, message, result, onClose, onRetry }: OperationResultProps) {
  const isSuccess = status === "success";
  const isFailed = status === "failed";

  if (!isSuccess && !isFailed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-4 p-4 rounded-lg border ${
        isSuccess 
          ? "bg-emerald-50 border-emerald-100 text-emerald-900" 
          : "bg-red-50 border-red-100 text-red-950"
      }`}
    >
      <div className="flex items-start space-x-3">
        {isSuccess ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 space-y-1">
          <h4 className="text-sm font-bold leading-none">
            {isSuccess ? "Operação Concluída!" : "Falha na Operação"}
          </h4>
          <p className="text-xs text-opacity-90 leading-relaxed">
            {message}
          </p>

          {/* Render extra details if present in result, but hide sensitive details */}
          {isSuccess && result && (
            <div className="mt-2.5 pt-2 border-t border-emerald-200/50 text-[10px] text-emerald-700 font-mono space-y-0.5">
              {result.syncedCount !== undefined && (
                <p>• Registros sincronizados: <span className="font-bold">{result.syncedCount}</span></p>
              )}
              {result.backupSize && (
                <p>• Tamanho do backup: <span className="font-bold">{result.backupSize}</span></p>
              )}
              {result.filename && (
                <p>• Arquivo gerado: <span className="font-bold">{result.filename}</span></p>
              )}
              {result.steps && result.steps.length > 0 && (
                <p>• Sub-etapas finalizadas: <span className="font-bold">{result.steps.length}</span></p>
              )}
            </div>
          )}

          {!isSuccess && (
            <div className="mt-2.5 pt-2 border-t border-red-200/50 text-[10px] text-red-700 space-y-1">
              <p className="font-bold">• Sugestão de Recuperação:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[9.5px]">
                <li>Verifique se o servidor de banco de dados MySQL está online.</li>
                <li>Confirme as credenciais de acesso nas configurações.</li>
                <li>Tente recriar o banco novamente ou recarregar a página.</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-end space-x-2">
        {isFailed && onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition cursor-pointer flex items-center space-x-1"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Tentar Novamente</span>
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className={`px-3 py-1.5 text-xs font-bold rounded transition cursor-pointer border ${
              isSuccess
                ? "bg-white hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                : "bg-white hover:bg-red-100 text-red-800 border-red-200"
            }`}
          >
            Fechar
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ==========================================
// 4. OperationProgress Component (Combined view)
// ==========================================
interface OperationProgressProps {
  progress: OpProgType;
  error?: string | null;
  onClose?: () => void;
  onRetry?: () => void;
}

export function OperationProgress({ progress, error, onClose, onRetry }: OperationProgressProps) {
  const { title, status, percentage, message, steps, result } = progress;

  const isCompleted = status === "success" || status === "failed";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center space-x-2">
          {status === "running" ? (
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin shrink-0" />
          ) : status === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          )}
          <div>
            <h3 className="text-sm font-bold text-gray-800">{title}</h3>
            <p className="text-[10px] text-gray-400 capitalize">Status: {status}</p>
          </div>
        </div>
        {percentage !== undefined && (
          <div className="text-right">
            <span className="text-base font-black text-gray-700 font-mono">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>

      {/* Main progress message description */}
      {!isCompleted && message && (
        <p className="text-xs text-gray-600 italic bg-gray-50 border border-gray-100 rounded px-2.5 py-1.5">
          {message}
        </p>
      )}

      {/* Connection Loss error alert */}
      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-md flex items-start space-x-2 animate-pulse">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-[11px]">Problema de Rede</p>
            <p className="text-[10px] mt-0.5 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Visual ProgressBar */}
      <ProgressBar percentage={percentage} status={status} />

      {/* Steps breakdown list */}
      {steps && steps.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Etapas do Processo
          </h4>
          <OperationSteps steps={steps} />
        </div>
      )}

      {/* Expanded completed view */}
      <AnimatePresence>
        {isCompleted && (
          <OperationResult
            status={status}
            message={isCompleted ? (status === "success" ? (result?.message || "Operação realizada com sucesso!") : (progress.error || "A operação falhou.")) : ""}
            result={result}
            onClose={onClose}
            onRetry={onRetry}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// 5. ProgressModal Component
// ==========================================
interface ProgressModalProps {
  isOpen: boolean;
  progress: OpProgType | null;
  error?: string | null;
  onClose?: () => void;
  onRetry?: () => void;
}

export function ProgressModal({ isOpen, progress, error, onClose, onRetry }: ProgressModalProps) {
  if (!isOpen || !progress) return null;

  const isCompleted = progress.status === "success" || progress.status === "failed";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs transition-opacity" 
        onClick={isCompleted ? onClose : undefined} 
      />

      {/* Modal Container */}
      <div className="bg-white rounded-xl shadow-2xl border border-gray-150 w-full max-w-md overflow-hidden relative z-10 p-5 transform transition-all animate-in fade-in duration-200">
        <OperationProgress
          progress={progress}
          error={error}
          onClose={onClose}
          onRetry={onRetry}
        />
      </div>
    </div>
  );
}
