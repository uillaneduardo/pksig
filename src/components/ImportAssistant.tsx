import React, { useState, useRef } from "react";
import { 
  Database, 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  FileJson, 
  FileText, 
  ArrowRight, 
  Loader, 
  Check, 
  Info, 
  AlertCircle, 
  RefreshCw, 
  ChevronRight, 
  Trash2, 
  Download,
  HelpCircle,
  FileCode
} from "lucide-react";

interface ImportAssistantProps {
  onDatabaseUpdated?: () => void;
  loadSettingsData?: () => Promise<void>;
}

// Available target tables in the application for mapping
const SYSTEM_TABLES = [
  { id: "clients", name: "Clientes (clients)", description: "Cadastro de clientes PF e PJ" },
  { id: "equipments", name: "Equipamentos (equipments)", description: "Bens e ativos sob manutenção" },
  { id: "service_orders", name: "Ordens de Serviço (service_orders)", description: "Ordens de serviço e diagnósticos" },
  { id: "budget_items", name: "Itens de Orçamento (budget_items)", description: "Serviços e peças das OSs" },
  { id: "payment_guides", name: "Guias de Pagamento (payment_guides)", description: "Faturamento e controle de OSs" },
  { id: "payment_installments", name: "Parcelas (payment_installments)", description: "Desmembramento das faturas" },
  { id: "payments", name: "Pagamentos (payments)", description: "Transações físicas recebidas" },
  { id: "financial_categories", name: "Categorias Financeiras (financial_categories)", description: "Fluxo de caixa corporativo" },
  { id: "financial_transactions", name: "Transações Financeiras (financial_transactions)", description: "Lançamentos de caixa" },
  { id: "system_settings", name: "Configurações do Sistema (system_settings)", description: "Parâmetros globais" },
  { id: "company_settings", name: "Dados da Empresa (company_settings)", description: "Cabeçalho e dados de contato" },
  { id: "equipment_categories", name: "Categorias de Equipamentos (equipment_categories)", description: "Tipos de aparelhos" },
  { id: "payment_methods", name: "Formas de Pagamento (payment_methods)", description: "Métodos de acerto" },
  { id: "warranty_rules", name: "Termos de Garantia (warranty_rules)", description: "Regras e prazos legais" },
  { id: "reception_accessories", name: "Checklist de Acessórios (reception_accessories)", description: "Checklist estético de entrada" },
  { id: "sequences", name: "Controle de Sequências (sequences)", description: "Números sequenciais internos" },
];

export default function ImportAssistant({ onDatabaseUpdated, loadSettingsData }: ImportAssistantProps) {
  // Wizard Steps: 1 = Upload, 2 = Mapping, 3 = Validation, 4 = Execution
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"json" | "sql" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rawText, setRawText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsed results from Step 1
  const [detectedTables, setDetectedTables] = useState<Array<{
    originalName: string;
    rowCount: number;
    sampleData?: any;
    statements?: string[];
  }>>([]);

  // Mapping state: table originalName -> target database table id
  const [tableMapping, setTableMapping] = useState<Record<string, string>>({});
  // Table selection state: table originalName -> boolean
  const [selectedTables, setSelectedTables] = useState<Record<string, boolean>>({});
  // Overwrite strategy state: table originalName -> "overwrite" | "append"
  const [overwriteStrategy, setOverwriteStrategy] = useState<Record<string, "overwrite" | "append">>({});

  // Validation results
  const [validationReports, setValidationReports] = useState<Array<{
    type: "success" | "warning" | "error";
    message: string;
    description?: string;
  }>>([]);

  // Execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentExecutingTable, setCurrentExecutingTable] = useState<string>("");
  const [executionLogs, setExecutionLogs] = useState<Array<{
    table: string;
    status: "pending" | "running" | "success" | "failed";
    message: string;
  }>>([]);
  const [executionSuccess, setExecutionSuccess] = useState(false);
  const [executionError, setExecutionError] = useState("");

  // Clean reset
  const handleReset = () => {
    setStep(1);
    setFile(null);
    setFileType(null);
    setRawText("");
    setDetectedTables([]);
    setTableMapping({});
    setSelectedTables({});
    setOverwriteStrategy({});
    setValidationReports([]);
    setIsExecuting(false);
    setCurrentExecutingTable("");
    setExecutionLogs([]);
    setExecutionSuccess(false);
    setExecutionError("");
  };

  // Drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processSelectedFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processSelectedFile(selectedFile);
    }
  };

  // Detect and read file
  const processSelectedFile = (selectedFile: File) => {
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "json" && ext !== "sql") {
      alert("Por favor, selecione apenas arquivos .JSON ou .SQL.");
      return;
    }

    setFile(selectedFile);
    setFileType(ext as "json" | "sql");

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawText(text);
      analyzeFileContent(ext as "json" | "sql", text, selectedFile.name);
    };
    reader.readAsText(selectedFile);
  };

  // Analyzer
  const analyzeFileContent = (type: "json" | "sql", content: string, name: string) => {
    const detected: Array<{ originalName: string; rowCount: number; sampleData?: any; statements?: string[] }> = [];
    const mappings: Record<string, string> = {};
    const selection: Record<string, boolean> = {};
    const strategies: Record<string, "overwrite" | "append"> = {};

    if (type === "json") {
      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          // Object with key arrays
          Object.keys(parsed).forEach((key) => {
            if (Array.isArray(parsed[key])) {
              const rows = parsed[key];
              detected.push({
                originalName: key,
                rowCount: rows.length,
                sampleData: rows.slice(0, 2)
              });
            }
          });
        } else if (Array.isArray(parsed)) {
          // Single array root
          detected.push({
            originalName: name.replace(".json", ""),
            rowCount: parsed.length,
            sampleData: parsed.slice(0, 2)
          });
        }
      } catch (err) {
        alert("Falha ao analisar JSON. Certifique-se de que o arquivo está no formato correto.");
        handleReset();
        return;
      }
    } else {
      // SQL Parser
      const statements = content
        .split(/;(?=(?:[^'"`]*['"`][^'"`]*['"`])*[^'"`]*$)/g)
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0);

      const groupedSql: Record<string, string[]> = {};

      statements.forEach((stmt) => {
        // Filter out comments to check content
        const cleanStmt = stmt
          .split("\n")
          .filter(line => !line.trim().startsWith("--") && !line.trim().startsWith("/*") && !line.trim().startsWith("#"))
          .join("\n")
          .trim();

        if (cleanStmt.length === 0) return;

        // Match INSERT INTO
        const insertRegex = /INSERT\s+INTO\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i;
        const match = cleanStmt.match(insertRegex);
        if (match) {
          const tableName = match[1];
          if (!groupedSql[tableName]) {
            groupedSql[tableName] = [];
          }
          groupedSql[tableName].push(cleanStmt);
        } else {
          // Put schema or other SQL under a general group
          const schemaRegex = /(CREATE|ALTER|DROP)\s+TABLE\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i;
          const schemaMatch = cleanStmt.match(schemaRegex);
          const groupName = schemaMatch ? `${schemaMatch[2]} (Estrutura)` : "Comandos Globais";
          
          if (!groupedSql[groupName]) {
            groupedSql[groupName] = [];
          }
          groupedSql[groupName].push(cleanStmt);
        }
      });

      Object.keys(groupedSql).forEach((tableName) => {
        detected.push({
          originalName: tableName,
          rowCount: groupedSql[tableName].length,
          statements: groupedSql[tableName]
        });
      });
    }

    if (detected.length === 0) {
      alert("Nenhuma tabela ou dado compatível foi identificado no arquivo.");
      handleReset();
      return;
    }

    // Pre-configure mappings and selection
    detected.forEach((item) => {
      // Find a matching target table ID
      const targetMatch = SYSTEM_TABLES.find(
        (t) => t.id.toLowerCase() === item.originalName.toLowerCase().replace(/_?\s?\(estrutura\)/i, "")
      );

      const targetId = targetMatch ? targetMatch.id : "";
      mappings[item.originalName] = targetId;
      // Select it if it mapped to a system table and has rows
      selection[item.originalName] = targetId !== "" && item.rowCount > 0;
      // Default strategy is "overwrite" for settings and sequences, "append" for main logs
      const isLog = ["clients", "equipments", "service_orders", "budget_items", "payment_guides", "payments", "financial_transactions"].includes(targetId);
      strategies[item.originalName] = isLog ? "append" : "overwrite";
    });

    setDetectedTables(detected);
    setTableMapping(mappings);
    setSelectedTables(selection);
    setOverwriteStrategy(strategies);
    setStep(2);
  };

  // Run validation checks
  const runValidation = () => {
    const reports: typeof validationReports = [];
    let hasTargetSelected = false;

    Object.keys(selectedTables).forEach((origName) => {
      if (!selectedTables[origName]) return;
      hasTargetSelected = true;

      const targetId = tableMapping[origName];
      const tableInfo = detectedTables.find((t) => t.originalName === origName);
      if (!tableInfo) return;

      if (!targetId) {
        reports.push({
          type: "error",
          message: `Tabela original "${origName}" selecionada mas sem mapeamento de destino.`,
          description: "Defina uma tabela de destino válida ou desmarque esta tabela para prosseguir."
        });
        return;
      }

      const isLog = ["clients", "equipments", "service_orders", "budget_items", "payment_guides", "payments", "financial_transactions"].includes(targetId);
      const strategy = overwriteStrategy[origName];

      if (strategy === "overwrite") {
        reports.push({
          type: "warning",
          message: `Substituição total ativa para: ${targetId}`,
          description: `Atenção: todos os dados atuais de "${targetId}" serão apagados antes da inserção dos ${tableInfo.rowCount} novos registros.`
        });
      } else {
        reports.push({
          type: "success",
          message: `Mesclagem ativa para: ${targetId}`,
          description: `Os ${tableInfo.rowCount} novos registros serão adicionados mantendo os dados que já existem na tabela.`
        });
      }
    });

    if (!hasTargetSelected) {
      reports.push({
        type: "error",
        message: "Nenhuma tabela foi selecionada para importação.",
        description: "Marque as caixas de seleção correspondentes às tabelas que deseja importar no passo anterior."
      });
    }

    // Structural dependency warnings
    const targetIds = Object.keys(selectedTables)
      .filter((k) => selectedTables[k])
      .map((k) => tableMapping[k]);

    if (targetIds.includes("equipments") && !targetIds.includes("clients")) {
      reports.push({
        type: "warning",
        message: "Referência de Clientes Pendente",
        description: "Você está importando 'equipments' sem importar 'clients'. Se os IDs de clientes correspondentes não existirem na base, ocorrerá erro de chave estrangeira."
      });
    }

    if (targetIds.includes("service_orders") && (!targetIds.includes("clients") || !targetIds.includes("equipments"))) {
      reports.push({
        type: "warning",
        message: "Referência de Equipamentos ou Clientes Pendente",
        description: "Ordens de Serviço exigem relacionamentos com 'clients' e 'equipments'. É recomendável importar estas tabelas em conjunto."
      });
    }

    if (targetIds.includes("budget_items") && !targetIds.includes("service_orders")) {
      reports.push({
        type: "warning",
        message: "Itens de Orçamento Isolados",
        description: "Itens de orçamento devem obrigatoriamente estar vinculados a uma Ordem de Serviço."
      });
    }

    if (reports.length === 0) {
      reports.push({
        type: "success",
        message: "Validações estruturais básicas concluídas com sucesso!",
        description: "Não foram encontrados conflitos diretos de modelagem ou dependências pendentes no mapeamento selecionado."
      });
    }

    setValidationReports(reports);
    setStep(3);
  };

  // Execute import process
  const executeImport = async () => {
    setIsExecuting(true);
    setExecutionError("");
    setExecutionSuccess(false);
    setStep(4);

    const tablesToImport = Object.keys(selectedTables).filter((k) => selectedTables[k]);
    const initialLogs = tablesToImport.map((table) => ({
      table,
      status: "pending" as const,
      message: "Aguardando na fila de tarefas..."
    }));
    setExecutionLogs(initialLogs);

    try {
      // Loop over tables sequentially to maintain integrity and show step progress
      for (let i = 0; i < tablesToImport.length; i++) {
        const table = tablesToImport[i];
        const targetId = tableMapping[table];
        const strategy = overwriteStrategy[table];
        const item = detectedTables.find((t) => t.originalName === table);
        if (!item) continue;

        setCurrentExecutingTable(table);
        setExecutionLogs((prev) =>
          prev.map((log) => (log.table === table ? { ...log, status: "running", message: "Processando dados..." } : log))
        );

        let finalSql = "";

        // Build SQL statements
        if (fileType === "json") {
          // JSON Import
          const parsed = JSON.parse(rawText);
          const dataArray = Array.isArray(parsed) ? parsed : parsed[table];
          finalSql = jsonToSql(targetId, dataArray, strategy === "overwrite");
        } else {
          // SQL Import
          const shouldOverwrite = strategy === "overwrite";
          if (shouldOverwrite) {
            finalSql += `DELETE FROM \`${targetId}\`;\n`;
          }
          if (item.statements) {
            // Map the statements to the target table name if they differ
            const mappedStatements = item.statements.map((stmt) => {
              if (table !== targetId) {
                // simple replacement of target table name in SQL statement
                // replaces INSERT INTO table with INSERT INTO targetId
                const regex = new RegExp(`INSERT\\s+INTO\\s+[\`"']?${table}[\`"']?`, "i");
                return stmt.replace(regex, `INSERT INTO \`${targetId}\``);
              }
              return stmt;
            });
            finalSql += mappedStatements.join(";\n") + ";";
          }
        }

        if (finalSql.trim().length === 0) {
          setExecutionLogs((prev) =>
            prev.map((log) => (log.table === table ? { ...log, status: "success", message: "Nenhum comando necessário." } : log))
          );
          continue;
        }

        // Send query to database endpoint
        const res = await fetch("/api/database/import-sql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ sql: finalSql })
        });

        const resData = await res.json();
        if (res.ok && resData.success) {
          const errMsg = resData.errors && resData.errors.length > 0 
            ? ` Concluído com ${resData.errors.length} erros secundários.` 
            : "";
          setExecutionLogs((prev) =>
            prev.map((log) => (log.table === table ? { ...log, status: "success", message: `Importação realizada com sucesso!${errMsg}` } : log))
          );
        } else {
          throw new Error(resData.error || `Falha ao importar tabela ${targetId}.`);
        }
      }

      setExecutionSuccess(true);
      if (onDatabaseUpdated) onDatabaseUpdated();
      if (loadSettingsData) await loadSettingsData();

    } catch (err: any) {
      console.error(err);
      setExecutionError(err.message || "Erro desconhecido durante a importação.");
      setExecutionLogs((prev) =>
        prev.map((log) => (log.status === "running" || log.status === "pending" ? { ...log, status: "failed", message: "Abortado devido a falha geral." } : log))
      );
    } finally {
      setIsExecuting(false);
    }
  };

  // Convert JSON arrays to SQL queries dynamically
  const jsonToSql = (tableName: string, rows: any[], overwrite: boolean): string => {
    if (!rows || rows.length === 0) return "";
    
    let sql = "";
    if (overwrite) {
      sql += `DELETE FROM \`${tableName}\`;\n`;
    }
    
    rows.forEach((row) => {
      const keys = Object.keys(row).filter(k => k.toLowerCase() !== "total_value");
      if (keys.length === 0) return;
      
      const columns = keys.map(k => `\`${k}\``).join(", ");
      const values = keys.map(k => {
        const val = row[k];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "boolean") return val ? "1" : "0";
        if (typeof val === "number") return String(val);
        if (typeof val === "string") {
          const escaped = val.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
          return `'${escaped}'`;
        }
        if (val instanceof Date || (typeof val === "string" && !isNaN(Date.parse(val)) && val.includes("-"))) {
          try {
            const dateStr = new Date(val).toISOString().slice(0, 19).replace('T', ' ');
            return `'${dateStr}'`;
          } catch (e) {
            return `'${String(val).replace(/'/g, "\\'")}'`;
          }
        }
        return `'${JSON.stringify(val).replace(/'/g, "\\'")}'`;
      }).join(", ");
      
      sql += `INSERT INTO \`${tableName}\` (${columns}) VALUES (${values});\n`;
    });
    
    return sql;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md p-5 space-y-6 shadow-sm">
      <div className="border-b border-gray-100 pb-3 flex flex-col sm:flex-row justify-between sm:items-center">
        <div>
          <h4 className="font-bold text-gray-800 text-sm flex items-center">
            <Database className="h-4.5 w-4.5 mr-2 text-indigo-600" />
            Assistente de Importação & Carga de Dados Inteligente
          </h4>
          <p className="text-gray-400 text-[10px] mt-0.5 leading-relaxed">
            Importe dados legados ou backups via arquivos .SQL ou .JSON com mapeamento dinâmico de tabelas, estratégias customizadas de sobreposição e verificação automática de consistência.
          </p>
        </div>
        {step > 1 && (
          <button
            onClick={handleReset}
            className="text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded px-2 py-1 mt-2 sm:mt-0 cursor-pointer self-start transition"
          >
            Reiniciar Assistente
          </button>
        )}
      </div>

      {/* STEP INDICATORS */}
      <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-gray-400 bg-gray-50 border border-gray-150 rounded px-4 py-2">
        <div className={`flex items-center space-x-1.5 ${step === 1 ? "text-indigo-600" : step > 1 ? "text-green-600" : ""}`}>
          <span className={`h-4.5 w-4.5 rounded-full flex items-center justify-center text-[8.5px] font-bold border ${step === 1 ? "border-indigo-600 bg-indigo-50" : step > 1 ? "border-green-600 bg-green-50" : "border-gray-300"}`}>
            {step > 1 ? <Check className="h-2.5 w-2.5" /> : "1"}
          </span>
          <span>Upload</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />

        <div className={`flex items-center space-x-1.5 ${step === 2 ? "text-indigo-600" : step > 2 ? "text-green-600" : ""}`}>
          <span className={`h-4.5 w-4.5 rounded-full flex items-center justify-center text-[8.5px] font-bold border ${step === 2 ? "border-indigo-600 bg-indigo-50" : step > 2 ? "border-green-600 bg-green-50" : "border-gray-300"}`}>
            {step > 2 ? <Check className="h-2.5 w-2.5" /> : "2"}
          </span>
          <span>Mapeamento</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />

        <div className={`flex items-center space-x-1.5 ${step === 3 ? "text-indigo-600" : step > 3 ? "text-green-600" : ""}`}>
          <span className={`h-4.5 w-4.5 rounded-full flex items-center justify-center text-[8.5px] font-bold border ${step === 3 ? "border-indigo-600 bg-indigo-50" : step > 3 ? "border-green-600 bg-green-50" : "border-gray-300"}`}>
            {step > 3 ? <Check className="h-2.5 w-2.5" /> : "3"}
          </span>
          <span>Validação</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />

        <div className={`flex items-center space-x-1.5 ${step === 4 ? "text-indigo-600" : ""}`}>
          <span className={`h-4.5 w-4.5 rounded-full flex items-center justify-center text-[8.5px] font-bold border ${step === 4 ? "border-indigo-600 bg-indigo-50" : "border-gray-300"}`}>
            4
          </span>
          <span>Executar</span>
        </div>
      </div>

      {/* STEP 1: UPLOAD AREA */}
      {step === 1 && (
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center space-y-3 cursor-pointer transition ${
              isDragging
                ? "border-indigo-500 bg-indigo-50/40"
                : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50/50"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,.sql"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
              <Upload className="h-6 w-6" />
            </div>

            <div className="text-center">
              <p className="font-bold text-gray-700 text-xs">Arraste seu arquivo de banco de dados ou clique para buscar</p>
              <p className="text-gray-400 text-[10px] mt-0.5">Suporta formatos backup SQL (dump padrão) ou dados estruturados JSON.</p>
            </div>

            <div className="flex items-center space-x-4 pt-1 text-[10px] font-bold text-gray-500">
              <span className="flex items-center space-x-1"><FileCode className="h-3.5 w-3.5 text-blue-500" /> <span>Dump .SQL</span></span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center space-x-1"><FileJson className="h-3.5 w-3.5 text-amber-500" /> <span>Backup .JSON</span></span>
            </div>
          </div>

          <div className="bg-gray-50 rounded border border-gray-150 p-4.5 text-[10.5px] text-gray-500 space-y-2">
            <p className="font-bold text-gray-700 flex items-center">
              <Info className="h-4 w-4 mr-1 text-indigo-600" />
              Informações importantes sobre a carga:
            </p>
            <ul className="list-disc pl-4 space-y-1 leading-relaxed">
              <li>O assistente detecta automaticamente os dados contidos e sugere o melhor mapeamento de tabelas.</li>
              <li>A integridade de chaves estrangeiras é protegida desativando verificações temporariamente durante a inserção, mas inconsistências permanentes no arquivo podem falhar a validação.</li>
              <li>Arquivos JSON devem preferencialmente possuir uma estrutura de chave correspondente às tabelas ou ser um array direto.</li>
            </ul>
          </div>
        </div>
      )}

      {/* STEP 2: TABLE MAPPING */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <div className="bg-blue-50/50 border border-blue-150 rounded p-3 text-[11px] text-blue-800 flex items-start space-x-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Arquivo detectado: {file?.name} ({Math.round((file?.size || 0) / 1024)} KB)</p>
              <p className="text-[10px] mt-0.5">Abaixo está a lista de tabelas e volumes encontrados no arquivo. Configure o mapeamento de destino e a estratégia de inserção para cada tabela ativa.</p>
            </div>
          </div>

          <div className="border border-gray-200 rounded-md overflow-hidden bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-150 text-gray-500 text-[10px] font-bold uppercase">
                  <th className="p-3 w-10 text-center">Ativo</th>
                  <th className="p-3">Tabela no Arquivo</th>
                  <th className="p-3 text-center">Registros</th>
                  <th className="p-3">Tabela de Destino</th>
                  <th className="p-3">Estratégia de Carga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {detectedTables.map((item) => {
                  const isChecked = selectedTables[item.originalName] || false;
                  const mappedValue = tableMapping[item.originalName] || "";
                  const strategy = overwriteStrategy[item.originalName] || "append";

                  return (
                    <tr key={item.originalName} className={`hover:bg-gray-50/30 transition ${!isChecked ? "opacity-60 bg-gray-50/10" : ""}`}>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            setSelectedTables({ ...selectedTables, [item.originalName]: e.target.checked });
                          }}
                          className="h-3.5 w-3.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-gray-800 flex items-center">
                          {fileType === "json" ? (
                            <FileJson className="h-3.5 w-3.5 mr-1.5 text-amber-500 shrink-0" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 mr-1.5 text-blue-500 shrink-0" />
                          )}
                          <span>{item.originalName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-indigo-600">
                        {item.rowCount}
                      </td>
                      <td className="p-3">
                        <select
                          value={mappedValue}
                          disabled={!isChecked}
                          onChange={(e) => {
                            setTableMapping({ ...tableMapping, [item.originalName]: e.target.value });
                          }}
                          className="px-2 py-1.5 bg-white border border-gray-300 rounded text-[11px] font-semibold text-gray-700 focus:outline-none focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-400 w-full"
                        >
                          <option value="">-- Ignorar ou Não Mapear --</option>
                          {SYSTEM_TABLES.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            disabled={!isChecked}
                            onClick={() => setOverwriteStrategy({ ...overwriteStrategy, [item.originalName]: "overwrite" })}
                            className={`px-2 py-1 rounded text-[9px] font-bold border transition cursor-pointer ${
                              strategy === "overwrite"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                            }`}
                            title="Apaga os dados atuais antes de inserir novos"
                          >
                            Sobrescrever
                          </button>
                          <button
                            type="button"
                            disabled={!isChecked}
                            onClick={() => setOverwriteStrategy({ ...overwriteStrategy, [item.originalName]: "append" })}
                            className={`px-2 py-1 rounded text-[9px] font-bold border transition cursor-pointer ${
                              strategy === "append"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                            }`}
                            title="Preserva dados e insere novos"
                          >
                            Mesclar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs font-bold transition cursor-pointer"
            >
              Voltar
            </button>
            <button
              onClick={runValidation}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
            >
              <span>Avançar para Validação</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: VALIDATION & CONSISTENCY */}
      {step === 3 && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <h5 className="font-bold text-gray-800 text-xs flex items-center">
              <CheckCircle className="h-4.5 w-4.5 mr-1.5 text-indigo-600" />
              Relatório de Validação de Dados & Consistência Estrutural
            </h5>
            <p className="text-gray-400 text-[10px] mt-0.5">
              Análise preliminar realizada pelo assistente com base nas tabelas ativas e mapeamentos configurados. Revise os pontos antes de processar.
            </p>
          </div>

          <div className="space-y-2.5">
            {validationReports.map((report, idx) => (
              <div
                key={idx}
                className={`p-3 border rounded-lg flex items-start space-x-3 text-xs ${
                  report.type === "success"
                    ? "bg-green-50/50 border-green-200 text-green-900"
                    : report.type === "warning"
                    ? "bg-amber-50/50 border-amber-200 text-amber-900"
                    : "bg-red-50/50 border-red-200 text-red-900"
                }`}
              >
                {report.type === "success" ? (
                  <CheckCircle className="h-4.5 w-4.5 text-green-600 shrink-0 mt-0.5" />
                ) : report.type === "warning" ? (
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4.5 w-4.5 text-red-600 shrink-0 mt-0.5" />
                )}

                <div>
                  <p className="font-bold text-xs">{report.message}</p>
                  {report.description && <p className="text-[10px] opacity-80 mt-0.5 leading-relaxed">{report.description}</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={() => setStep(2)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs font-bold transition cursor-pointer"
            >
              Ajustar Mapeamento
            </button>

            <button
              onClick={executeImport}
              disabled={validationReports.some((r) => r.type === "error")}
              className={`px-4 py-1.5 text-white rounded text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                validationReports.some((r) => r.type === "error")
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              <span>Confirmar e Iniciar Importação</span>
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: EXECUTION & PROGRESS LOGS */}
      {step === 4 && (
        <div className="space-y-4 animate-fade-in">
          <div className="border border-gray-150 rounded-lg p-5 bg-gray-50/40 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="font-bold text-gray-800 text-xs flex items-center">
                  {isExecuting ? (
                    <Loader className="h-4.5 w-4.5 mr-1.5 text-indigo-600 animate-spin" />
                  ) : executionSuccess ? (
                    <CheckCircle className="h-4.5 w-4.5 mr-1.5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4.5 w-4.5 mr-1.5 text-red-600" />
                  )}
                  <span>Status do Processamento em Lote</span>
                </h5>
                <p className="text-gray-400 text-[10px] mt-0.5">
                  {isExecuting 
                    ? `Importando lote de dados ativos para a tabela "${currentExecutingTable}"...` 
                    : executionSuccess 
                    ? "Carga de banco concluída com sucesso absoluto!" 
                    : "Falha na execução de queries de importação."
                  }
                </p>
              </div>

              {!isExecuting && (
                <button
                  onClick={handleReset}
                  className="px-3 py-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold rounded text-[10px] transition cursor-pointer"
                >
                  Fechar Assistente
                </button>
              )}
            </div>

            {/* PROGRESS BAR */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full transition-all duration-350 ${
                  executionSuccess ? "bg-green-500" : executionError ? "bg-red-500" : "bg-indigo-600 animate-pulse"
                }`}
                style={{
                  width: `${
                    (executionLogs.filter((l) => l.status === "success" || l.status === "failed").length / 
                    Math.max(executionLogs.length, 1)) * 100
                  }%`
                }}
              />
            </div>

            {/* TASK STEP LOGS */}
            <div className="border border-gray-200 rounded-md overflow-hidden divide-y divide-gray-100 bg-white">
              {executionLogs.map((log) => (
                <div key={log.table} className="p-3 flex items-center justify-between text-xs hover:bg-gray-50/10 transition">
                  <div className="flex items-center space-x-2.5">
                    {log.status === "pending" && <span className="h-2 w-2 rounded-full bg-gray-300" />}
                    {log.status === "running" && <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />}
                    {log.status === "success" && <Check className="h-3.5 w-3.5 text-green-600" />}
                    {log.status === "failed" && <AlertCircle className="h-3.5 w-3.5 text-red-600" />}
                    
                    <span className="font-bold text-gray-700">{log.table}</span>
                    <span className="text-[10px] text-gray-400">({tableMapping[log.table]})</span>
                  </div>

                  <span className={`text-[10px] font-bold ${
                    log.status === "success" 
                      ? "text-green-600" 
                      : log.status === "failed" 
                      ? "text-red-600" 
                      : log.status === "running" 
                      ? "text-indigo-600" 
                      : "text-gray-400"
                  }`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {executionError && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 text-xs space-y-1.5 animate-fade-in">
              <p className="font-bold flex items-center">
                <AlertCircle className="h-4 w-4 mr-1.5 text-red-600 shrink-0" />
                Erro crítico na importação:
              </p>
              <p className="text-[11px] leading-relaxed font-mono bg-white/65 p-2 rounded border border-red-100 whitespace-pre-wrap max-h-32 overflow-y-auto">
                {executionError}
              </p>
              <p className="text-[10px] text-red-600 mt-1">Alguns comandos foram desfeitos para evitar desordem. Verifique a sintaxe ou tente mesclar ao invés de sobrescrever.</p>
            </div>
          )}

          {executionSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-4 text-xs space-y-1 animate-fade-in">
              <p className="font-bold flex items-center">
                <CheckCircle className="h-4 w-4 mr-1.5 text-green-600 shrink-0" />
                Sucesso! Banco de Dados Atualizado
              </p>
              <p className="text-[10.5px] leading-relaxed">
                Todas as tabelas selecionadas foram importadas com sucesso absoluto! A estrutura de dados interna do PK SIG foi limpa ou integrada de acordo com as preferências escolhidas. O cache local do PWA foi sinalizado e os novos registros já estão disponíveis para uso imediato em todas as abas.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
