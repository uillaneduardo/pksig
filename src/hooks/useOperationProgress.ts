import { useState, useEffect, useRef, useCallback } from "react";
import { OperationProgress } from "../types";

export interface UseOperationProgressOptions {
  interval?: number; // polling interval in ms (default: 800)
  onSuccess?: (progress: OperationProgress) => void;
  onFailure?: (progress: OperationProgress) => void;
}

export function useOperationProgress(
  initialOperationId: string | null = null,
  options: UseOperationProgressOptions = {}
) {
  const { interval = 800, onSuccess, onFailure } = options;

  const [operationId, setOperationId] = useState<string | null>(initialOperationId);
  const [progress, setProgress] = useState<OperationProgress | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveFailuresRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setOperationId(null);
    setProgress(null);
    setError(null);
    consecutiveFailuresRef.current = 0;
  }, [stopPolling]);

  const poll = useCallback(async (id: string) => {
    try {
      // Ensure we request through Network Only (preventing SW caches)
      const response = await fetch(`/api/operations/${id}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data: OperationProgress = await response.json();
      setProgress(data);
      consecutiveFailuresRef.current = 0; // reset failures on success
      setError(null);

      if (data.status === "success") {
        stopPolling();
        if (onSuccess) {
          onSuccess(data);
        }
      } else if (data.status === "failed") {
        stopPolling();
        if (onFailure) {
          onFailure(data);
        }
      }
    } catch (err: any) {
      consecutiveFailuresRef.current += 1;
      console.warn(`Polling attempt failed (${consecutiveFailuresRef.current}):`, err);

      // Only show error if we have failed multiple times consecutively, to handle transient connection drops gracefully
      if (consecutiveFailuresRef.current >= 4) {
        setError("Perda de conexão temporária com o servidor. Tentando reconectar...");
      }

      if (consecutiveFailuresRef.current >= 15) {
        stopPolling();
        setError("Falha de conexão persistente com o servidor. Operação interrompida.");
      }
    }
  }, [stopPolling, onSuccess, onFailure]);

  const startPolling = useCallback((id: string) => {
    reset();
    setOperationId(id);
    setIsLoading(true);
    poll(id); // initial poll immediately

    timerRef.current = setInterval(() => {
      poll(id);
    }, interval);
  }, [interval, poll, reset]);

  // Clean up on unmount
  useEffect(() => {
    if (initialOperationId) {
      startPolling(initialOperationId);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [initialOperationId, startPolling]);

  return {
    operationId,
    progress,
    isLoading,
    error,
    startPolling,
    stopPolling,
    reset
  };
}
