import { useState } from "react";
import { DatabaseConfig, SystemStatus } from "../types";
import { Database, Shield, Settings, Server, Check, AlertCircle, Loader } from "lucide-react";

interface SetupWizardProps {
  onCompleted: () => void;
}

export default function SetupWizard({ onCompleted }: SetupWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Connection fields
  const [mode, setMode] = useState<"local" | "remoto">("remoto");
  const [dbType, setDbType] = useState<"sqlite" | "mysql" | "mariadb" | "postgresql" | "sqlserver">("mysql");
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState("3306");
  const [database, setDatabase] = useState("pksig");
  const [user, setUser] = useState("root");
  const [password, setPassword] = useState("");
  const [ssl, setSsl] = useState(false);
  const [certificate, setCertificate] = useState("");

  const [connectionTested, setConnectionTested] = useState(false);
  const [dbMissing, setDbMissing] = useState(false);

  // Compatibility fields
  const [hasCompatibleDb, setHasCompatibleDb] = useState(false);
  const [existingAdmins, setExistingAdmins] = useState<string[]>([]);
  const [useExistingDb, setUseExistingDb] = useState(false);
  const [checkingCompatibility, setCheckingCompatibility] = useState(false);

  // Admin fields
  const [adminName, setAdminName] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminPassConfirm, setAdminPassConfirm] = useState("");

  // Company fields
  const [companyName, setCompanyName] = useState("");
  const [companyTrade, setCompanyTrade] = useState("");
  const [companyTaxId, setCompanyTaxId] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyWhatsapp, setCompanyWhatsapp] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyNotes, setCompanyNotes] = useState("");

  const handleTestConnection = async () => {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setDbMissing(false);
    setHasCompatibleDb(false);
    setExistingAdmins([]);

    try {
      const res = await fetch("/api/setup/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, type: dbType, host, port, database, user, password, ssl, certificate })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message);
        setConnectionTested(true);

        // Immediately check compatibility
        setCheckingCompatibility(true);
        try {
          const compRes = await fetch("/api/setup/verify-compatibility", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode, type: dbType, host, port, database, user, password, ssl, certificate })
          });
          const compData = await compRes.json();
          if (compData.success) {
            if (compData.hasCompatibleTables) {
              setHasCompatibleDb(true);
              setExistingAdmins(compData.existingAdmins || []);
              setUseExistingDb(true); // default to preserving data
              setSuccessMsg(data.message + " " + compData.message);
            } else {
              setUseExistingDb(false);
            }
          }
        } catch (compErr) {
          console.error("Erro ao verificar compatibilidade do banco:", compErr);
        } finally {
          setCheckingCompatibility(false);
        }
      } else {
        setErrorMsg(data.message);
        setConnectionTested(false);
        if (data.message.includes("não existe")) {
          setDbMissing(true);
        }
      }
    } catch (err) {
      setErrorMsg("Erro ao tentar se comunicar com o servidor");
      setConnectionTested(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDatabase = async () => {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/setup/create-database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, type: dbType, host, port, database, user, password, ssl, certificate })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message + " Agora você pode testar a conexão novamente.");
        setDbMissing(false);
        setConnectionTested(true);
      } else {
        setErrorMsg(data.message);
      }
    } catch (err) {
      setErrorMsg("Erro de comunicação ao criar o banco");
    } finally {
      setLoading(false);
    }
  };

  const handlePrepareDatabaseAndInstall = async () => {
    setLoading(true);
    setErrorMsg("");
    
    try {
      const payload = {
        connection: { mode, type: dbType, host, port, database, user, password, ssl },
        admin: { name: adminName, username: adminUser, password: adminPass },
        company: {
          name: companyName,
          tradeName: companyTrade,
          taxId: companyTaxId,
          phone: companyPhone,
          whatsapp: companyWhatsapp,
          email: companyEmail,
          address: companyAddress,
          notes: companyNotes
        },
        useExistingDb
      };

      const res = await fetch("/api/setup/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStep(7);
      } else {
        setErrorMsg(data.error || "Erro na instalação das tabelas.");
      }
    } catch (err) {
      setErrorMsg("Falha crítica de comunicação.");
    } finally {
      setLoading(false);
    }
  };

  const validateAdminStep = () => {
    if (!adminName || !adminUser || !adminPass) {
      setErrorMsg("Por favor, preencha todos os campos obrigatórios");
      return false;
    }
    if (adminPass.length < 8) {
      setErrorMsg("A senha deve conter no mínimo 8 caracteres");
      return false;
    }
    if (adminPass !== adminPassConfirm) {
      setErrorMsg("As senhas não conferem");
      return false;
    }
    setErrorMsg("");
    return true;
  };

  const nextStep = () => {
    setErrorMsg("");
    setSuccessMsg("");
    
    if (step === 2) {
      if (!validateAdminStep()) return;
    }
    if (step === 4 && !connectionTested) {
      setErrorMsg("Você precisa testar e validar a conexão com o banco de dados antes de avançar.");
      return;
    }

    setStep(step + 1);
  };

  const prevStep = () => {
    setErrorMsg("");
    setSuccessMsg("");
    setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-xl w-full mx-auto bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
        
        {/* Header bar */}
        <div className="bg-[#0e131f] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Settings className="h-6 w-6 text-white" />
            <div>
              <h1 className="text-white text-lg font-bold tracking-tight">PK SIG</h1>
              <p className="text-gray-400 text-xs">Assistente de Configuração Inicial</p>
            </div>
          </div>
          <span className="text-gray-400 text-sm font-mono">Etapa {step} de 7</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 h-1">
          <div 
            className="bg-indigo-600 h-1 transition-all duration-300" 
            style={{ width: `${(step / 7) * 100}%` }}
          />
        </div>

        {/* Main Content */}
        <div className="p-8">
          
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-start space-x-3 text-red-700 text-sm">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md flex items-start space-x-3 text-green-700 text-sm">
              <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: WELCOME */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Seja bem-vindo ao PK SIG</h2>
                <p className="text-gray-500 text-sm">
                  O sistema pessoal para gestão simplificada de sua assistência técnica. 
                  Em poucos minutos configuraremos sua conta administrativa e banco de dados.
                </p>
              </div>
              <div className="bg-gray-50 p-4 border border-gray-200 rounded-md text-xs text-gray-600 leading-relaxed space-y-2">
                <p className="font-semibold text-gray-800">O que faremos nas próximas etapas:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Cadastro do administrador do sistema</li>
                  <li>Seleção de armazenamento MySQL (Local ou Remoto)</li>
                  <li>Configuração e teste de conexão do banco de dados</li>
                  <li>Preparação automática e instalação das tabelas</li>
                  <li>Dados cadastrais da sua assistência técnica (opcional)</li>
                </ul>
              </div>
              <button
                onClick={nextStep}
                className="w-full py-2.5 bg-[#0e131f] hover:bg-[#1a2336] text-white rounded-md text-sm font-semibold transition"
              >
                Começar Configuração
              </button>
            </div>
          )}

          {/* STEP 2: ADMINISTRADOR */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="border-b border-gray-100 pb-3 mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-gray-600" />
                  <span>1. Cadastro do Administrador</span>
                </h2>
                <p className="text-gray-500 text-xs mt-1">Insira as credenciais do único administrador que operará o sistema.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Ex: Uillan Eduardo Lira da Silva"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nome de Usuário (Login) *</label>
                  <input
                    type="text"
                    value={adminUser}
                    onChange={(e) => setAdminUser(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Ex: uillan.silva"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Senha *</label>
                    <input
                      type="password"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Mínimo 8 dígitos"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Confirmar Senha *</label>
                    <input
                      type="password"
                      value={adminPassConfirm}
                      onChange={(e) => setAdminPassConfirm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Repita a senha"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={prevStep}
                  className="w-1/3 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50 transition"
                >
                  Voltar
                </button>
                <button
                  onClick={nextStep}
                  className="w-2/3 py-2 bg-[#0e131f] hover:bg-[#1a2336] text-white rounded-md text-sm font-semibold transition"
                >
                  Avançar
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: ARMAZENAMENTO MODE */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="border-b border-gray-100 pb-3">
                <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                  <Server className="h-5 w-5 text-gray-600" />
                  <span>2. Tipo de Banco de Dados</span>
                </h2>
                <p className="text-gray-500 text-xs mt-1">Selecione o motor de banco de dados que deseja utilizar:</p>
              </div>

              <div className="space-y-3">
                <div 
                  className="p-4 border rounded-md cursor-pointer transition border-indigo-600 bg-indigo-50/40"
                >
                  <div className="flex items-center space-x-3">
                    <input 
                      type="radio" 
                      name="db_type_select" 
                      checked={true} 
                      onChange={() => {}} 
                      className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-900">MySQL / MariaDB</p>
                      <p className="text-xs text-gray-500 mt-0.5">Banco de dados relacional robusto com motor InnoDB, ideal para alto desempenho, segurança de dados e uso em produção.</p>
                    </div>
                  </div>
                </div>

                <div 
                  className="p-4 border border-gray-200 opacity-60 rounded-md cursor-not-allowed bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    <input 
                      type="radio" 
                      name="db_type_select" 
                      checked={false} 
                      disabled={true}
                      className="text-gray-400 h-4 w-4"
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-400">PostgreSQL (Em breve)</p>
                      <p className="text-xs text-gray-400 mt-0.5">Suporte planejado para futuras atualizações da plataforma.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={prevStep}
                  className="w-1/3 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50 transition"
                >
                  Voltar
                </button>
                <button
                  onClick={nextStep}
                  className="w-2/3 py-2 bg-[#0e131f] hover:bg-[#1a2336] text-white rounded-md text-sm font-semibold transition"
                >
                  Avançar
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: CONNECTION PARAMS */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="border-b border-gray-100 pb-3 mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                  <Database className="h-5 w-5 text-gray-600" />
                  <span>3. Inicialização do Banco de Dados (MySQL / MariaDB)</span>
                </h2>
                <p className="text-gray-500 text-xs mt-1">
                  Configure os dados de acesso ao seu servidor MySQL.
                </p>
              </div>

              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de Banco de Dados Remoto *</label>
                  <select
                    value={dbType}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      setDbType(newType);
                      setConnectionTested(false);
                    }}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="mysql">MySQL</option>
                    <option value="mariadb">MariaDB</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Host / Servidor *</label>
                    <input
                      type="text"
                      value={host}
                      onChange={(e) => { setHost(e.target.value); setConnectionTested(false); }}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Ex: localhost ou 127.0.0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Porta *</label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => { setPort(e.target.value); setConnectionTested(false); }}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nome do Banco (Database) *</label>
                    <input
                      type="text"
                      value={database}
                      onChange={(e) => { setDatabase(e.target.value); setConnectionTested(false); }}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Usuário *</label>
                    <input
                      type="text"
                      value={user}
                      onChange={(e) => { setUser(e.target.value); setConnectionTested(false); }}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setConnectionTested(false); }}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Deixe em branco se não houver"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center space-x-2 text-xs font-semibold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ssl}
                      onChange={(e) => { setSsl(e.target.checked); setConnectionTested(false); }}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>Usar Conexão Segura (SSL)</span>
                  </label>

                  {ssl && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Certificado CA (Opcional)</label>
                      <textarea
                        value={certificate}
                        onChange={(e) => { setCertificate(e.target.value); setConnectionTested(false); }}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 h-20"
                        placeholder="Cole o conteúdo do certificado PEM se exigido pela hospedagem"
                      />
                    </div>
                  )}
                </div>
              </>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={loading}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold transition flex items-center justify-center space-x-2"
                >
                  {loading && <Loader className="animate-spin h-4 w-4" />}
                  <span>Testar Conexão</span>
                </button>

                {dbMissing && (
                  <button
                    type="button"
                    onClick={handleCreateDatabase}
                    disabled={loading}
                    className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-bold transition flex items-center justify-center space-x-2"
                  >
                    <span>Criar Banco Automático</span>
                  </button>
                )}
              </div>

              {connectionTested && hasCompatibleDb && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-md text-xs space-y-3 mt-4 text-amber-900">
                  <div className="flex items-center space-x-2 font-bold text-amber-800">
                    <AlertCircle className="h-4 w-4" />
                    <span>Base de Dados Existente com Dados Compatíveis Detectada!</span>
                  </div>
                  <p>
                    O banco de dados selecionado já possui as tabelas principais estruturadas e dados compatíveis do PK SIG.
                  </p>
                  {existingAdmins.length > 0 && (
                    <div className="bg-amber-100/50 p-2 rounded border border-amber-200">
                      <p className="font-semibold mb-1 text-amber-950">Contas administradoras existentes encontradas:</p>
                      <ul className="list-disc list-inside space-y-0.5 font-mono text-[11px] text-amber-900">
                        {existingAdmins.map((admin, idx) => (
                          <li key={idx}>{admin}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="space-y-2 pt-1 border-t border-amber-200/50">
                    <p className="font-semibold text-amber-950">Como deseja prosseguir com a instalação?</p>
                    <div className="flex flex-col space-y-2">
                      <label className="flex items-start space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="use_existing_db"
                          checked={useExistingDb}
                          onChange={() => setUseExistingDb(true)}
                          className="mt-0.5 text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                        />
                        <div>
                          <span className="font-bold text-amber-950">Preservar e utilizar base de dados existente (Recomendado)</span>
                          <p className="text-[11px] text-amber-800 mt-0.5">Mantém todos os seus dados atuais (clientes, ordens de serviço, etc.) intactos. Cria o novo administrador apenas se a conta ainda não existir.</p>
                        </div>
                      </label>
                      <label className="flex items-start space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="use_existing_db"
                          checked={!useExistingDb}
                          onChange={() => setUseExistingDb(false)}
                          className="mt-0.5 text-red-600 focus:ring-red-500 h-3.5 w-3.5"
                        />
                        <div>
                          <span className="font-bold text-red-700">Formatar banco e reinstalar do zero (Apaga todos os dados!)</span>
                          <p className="text-[11px] text-red-600 mt-0.5">⚠️ ATENÇÃO: Todas as tabelas existentes serão excluídas e criadas novamente. Todos os dados atuais da base serão PERDIDOS permanentemente.</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  onClick={prevStep}
                  className="w-1/3 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50 transition"
                >
                  Voltar
                </button>
                <button
                  onClick={nextStep}
                  disabled={!connectionTested}
                  className={`w-2/3 py-2 rounded-md text-sm font-semibold transition ${connectionTested ? "bg-[#0e131f] hover:bg-[#1a2336] text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
                >
                  Avançar
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: PREPARATION */}
          {step === 5 && (
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <Database className="h-6 w-6 text-green-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">
                  {useExistingDb ? "4. Conectando à Base de Dados Existente" : "4. Estruturando o Banco de Dados"}
                </h2>
                <p className="text-sm text-gray-500">
                  {useExistingDb 
                    ? "O PK SIG irá conectar-se à base de dados existente, preservar todos os dados e cadastrar o novo administrador se o usuário não existir."
                    : "O PK SIG agora criará as tabelas do sistema, carregará categorias padrão, status das ordens de serviço, acessórios e registrará o usuário administrador."}
                </p>
              </div>

              <div className="bg-gray-50 p-4 border border-gray-200 rounded-md text-left text-xs font-mono text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>{useExistingDb ? "Preservar tabelas existentes:" : "Criar Tabelas de Cadastro:"}</span> 
                  <span className={useExistingDb ? "text-indigo-600 font-bold" : "text-green-600 font-bold"}>
                    {useExistingDb ? "Ativo" : "Pendente"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Registrar/Verificar Administrador:</span> 
                  <span className="text-green-600 font-bold">Pendente</span>
                </div>
                <div className="flex justify-between">
                  <span>{useExistingDb ? "Preservar dados existentes:" : "Criar Categorias e Status:"}</span> 
                  <span className={useExistingDb ? "text-indigo-600 font-bold" : "text-green-600 font-bold"}>
                    {useExistingDb ? "Ativo" : "Pendente"}
                  </span>
                </div>
                <div className="flex justify-between"><span>Gravar arquivo de configuração:</span> <span className="text-green-600 font-bold">Pendente</span></div>
              </div>

              <button
                onClick={handlePrepareDatabaseAndInstall}
                disabled={loading}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-semibold transition flex items-center justify-center space-x-2"
              >
                {loading && <Loader className="animate-spin h-5 w-5" />}
                <span>Executar Instalação e Preparar</span>
              </button>
            </div>
          )}

          {/* STEP 6: DADOS DA ASSISTÊNCIA */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="border-b border-gray-100 pb-3 mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <span>5. Dados Cadastrais da Assistência</span>
                </h2>
                <p className="text-gray-500 text-xs mt-1">Preencha os dados da sua empresa. Estes dados aparecerão no topo das ordens de serviço e garantias (Você pode pular e preencher depois).</p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nome da Assistência *</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none"
                      placeholder="Ex: PK SIG Assistência"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nome Fantasia</label>
                    <input
                      type="text"
                      value={companyTrade}
                      onChange={(e) => setCompanyTrade(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">CPF ou CNPJ</label>
                    <input
                      type="text"
                      value={companyTaxId}
                      onChange={(e) => setCompanyTaxId(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Telefone</label>
                    <input
                      type="text"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">WhatsApp</label>
                    <input
                      type="text"
                      value={companyWhatsapp}
                      onChange={(e) => setCompanyWhatsapp(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">E-mail Comercial</label>
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Endereço Completo</label>
                  <input
                    type="text"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none"
                    placeholder="Rua, número, bairro, cidade - Estado"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={nextStep}
                  className="w-1/3 py-2 border border-gray-300 text-gray-500 rounded-md text-sm hover:bg-gray-50 transition"
                >
                  Pular esta Etapa
                </button>
                <button
                  onClick={handlePrepareDatabaseAndInstall}
                  disabled={loading}
                  className="w-2/3 py-2 bg-[#0e131f] hover:bg-[#1a2336] text-white rounded-md text-sm font-semibold transition flex items-center justify-center space-x-2"
                >
                  {loading && <Loader className="animate-spin h-4 w-4" />}
                  <span>Salvar e Continuar</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 7: CONCLUSION */}
          {step === 7 && (
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-gray-900">Tudo Pronto!</h2>
                <p className="text-sm text-gray-500">
                  O PK SIG foi inicializado com sucesso. As configurações foram persistidas, a conexão com o banco de dados foi assegurada, e sua conta administrativa foi criada.
                </p>
              </div>

              <div className="bg-green-50 p-4 border border-green-200 rounded-md text-left text-xs text-green-800 space-y-1.5">
                <p className="font-bold flex items-center"><Check className="h-4 w-4 mr-1.5" /> Banco conectado ({mode === "local" ? "MySQL Local" : "MySQL Remoto"})</p>
                <p className="font-bold flex items-center"><Check className="h-4 w-4 mr-1.5" /> Estrutura do banco preparada (Versão 1.0.0)</p>
                <p className="font-bold flex items-center"><Check className="h-4 w-4 mr-1.5" /> Administrador cadastrado: <span className="font-mono ml-1">{adminUser}</span></p>
                <p className="font-bold flex items-center"><Check className="h-4 w-4 mr-1.5" /> Arquivo <span className="font-mono ml-1 bg-green-100 px-1 rounded">database.json</span> gravado com segurança</p>
              </div>

              <button
                onClick={onCompleted}
                className="w-full py-2.5 bg-[#0e131f] hover:bg-[#1a2336] text-white rounded-md text-sm font-semibold transition"
              >
                Ir para o Login
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
