import { OperationProgress, OperationStatus, OperationStep } from "../types.js";

const operations = new Map<string, OperationProgress>();

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + "-" + Date.now().toString(36);
}

// Cleanup old operations (older than 2 hours)
function cleanupOldOperations() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  for (const [id, op] of operations.entries()) {
    if (new Date(op.startedAt) < twoHoursAgo) {
      operations.delete(id);
    }
  }
}

export function createOperation(
  type: string,
  title: string,
  totalSteps?: number,
  stepNames?: string[]
): OperationProgress {
  cleanupOldOperations();
  const operationId = generateId();
  
  const steps: OperationStep[] | undefined = stepNames
    ? stepNames.map((name) => ({ name, status: "pending" as const }))
    : undefined;

  const operation: OperationProgress = {
    operationId,
    type,
    title,
    status: "running",
    currentStep: 1,
    totalSteps,
    completedSteps: 0,
    percentage: totalSteps && totalSteps > 0 ? 0 : undefined,
    message: "Iniciando operação...",
    startedAt: new Date().toISOString(),
    steps,
  };

  operations.set(operationId, operation);
  return operation;
}

export function getOperation(operationId: string): OperationProgress | undefined {
  return operations.get(operationId);
}

export function updateOperation(
  operationId: string,
  updates: Partial<Omit<OperationProgress, "operationId" | "startedAt">>
): OperationProgress | undefined {
  const op = operations.get(operationId);
  if (!op) return undefined;

  const updated = { ...op, ...updates };

  // Calculate percentage if possible
  if (updated.totalSteps && updated.totalSteps > 0 && typeof updated.completedSteps === "number") {
    updated.percentage = Math.min(100, Math.round((updated.completedSteps / updated.totalSteps) * 100));
  }

  operations.set(operationId, updated);
  return updated;
}

export function updateStepStatus(
  operationId: string,
  stepName: string,
  status: OperationStep["status"],
  error?: string
): OperationProgress | undefined {
  const op = operations.get(operationId);
  if (!op || !op.steps) return op;

  const updatedSteps = op.steps.map((step) => {
    if (step.name === stepName) {
      return { ...step, status, error };
    }
    return step;
  });

  // Automatically adjust completedSteps as count of successful steps
  const completedSteps = updatedSteps.filter((s) => s.status === "success").length;

  return updateOperation(operationId, {
    steps: updatedSteps,
    completedSteps,
  });
}

export function failOperation(operationId: string, error: string, result?: any): OperationProgress | undefined {
  return updateOperation(operationId, {
    status: "failed",
    error,
    finishedAt: new Date().toISOString(),
    result,
  });
}

export function successOperation(operationId: string, result?: any, message = "Operação concluída com sucesso!") {
  const op = operations.get(operationId);
  if (!op) return undefined;
  
  // Mark all pending steps as success if completed successfully
  let updatedSteps = op.steps;
  if (updatedSteps) {
    updatedSteps = updatedSteps.map((step) => {
      if (step.status === "pending" || step.status === "running") {
        return { ...step, status: "success" as const };
      }
      return step;
    });
  }

  const completed = updatedSteps ? updatedSteps.length : op.totalSteps || 0;

  return updateOperation(operationId, {
    status: "success",
    message,
    steps: updatedSteps,
    completedSteps: completed,
    percentage: 100,
    finishedAt: new Date().toISOString(),
    result,
  });
}
