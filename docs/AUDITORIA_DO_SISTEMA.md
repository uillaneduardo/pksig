# Auditoria do Sistema PKSIG

Este documento apresenta uma análise profunda, técnica e estrutural do estado atual do repositório **PKSIG**. O objetivo é identificar todas as tecnologias, dependências, rotas, telas, tabelas do banco de dados, regras de negócio e eventuais riscos de segurança ou inconsistências de código, servindo como base mestre para o plano de refatoração e reconstrução.

---

## 1. Tecnologias Utilizadas

O sistema atual está construído sobre um ecossistema full-stack moderno baseado em TypeScript e Node.js:

- **Runtime & Compilação**: Node.js (v20+) com empacotamento do servidor via `esbuild` para CommonJS (`dist/server.cjs`) e do cliente via `Vite` com suporte para TypeScript nativo (`tsx`).
- **Frontend**:
  - **Framework**: React 19.
  - **CSS & Estilização**: Tailwind CSS v4 (integrado de forma nativa ao Vite através do plugin `@tailwindcss/vite`).
  - **Animações**: Library `motion` (antiga Framer Motion), importada de `motion/react` para animações fluidas e transições de tela.
  - **Ícones**: `lucide-react` para biblioteca visual padronizada de ícones de vetor.
  - **Gráficos**: `recharts` para visualização e dashboards financeiros e de ordens de serviço.
  - **Persistência Local (Offline)**: `dexie` para gerenciamento avançado de banco de dados IndexedDB de forma declarativa no navegador.
- **Backend**:
  - **Servidor Web**: Express v4 com middleware de parseamento de JSON e arquivos.
  - **Segurança**: `helmet` para cabeçalhos HTTP seguros, JWT e `bcryptjs` para hashes de senhas de administradores.
  - **Upload de Arquivos**: `multer` para upload de fotos e anexos de equipamentos ou ordens de serviço.
  - **Validação de Payload**: `zod` para validações rígidas de formulários e contratos de API de forma síncrona/assíncrona.
- **Banco de Dados**:
  - **MySQL / MariaDB**: Conexão nativa em produção com pool através de `mysql2`.
  - **SQLite**: Implementação nativa síncrona de alto desempenho (`node:sqlite` do próprio Node.js) como driver local para armazenamento simplificado e funcionamento offline portátil no container.

---

## 2. Estrutura Atual de Diretórios

A estrutura física do repositório é organizada conforme abaixo:

```text
├── .env.example                       # Exemplo de variáveis de ambiente do sistema
├── .gitignore                         # Regras de exclusão do git para builds, logs e dependências
├── index.html                         # Ponto de entrada estático HTML do frontend
├── package.json                       # Manifesto de scripts e dependências npm
├── server.ts                          # Servidor monolítico em Express contendo rotas de API e inicialização de DB
├── tsconfig.json                      # Configuração geral do compilador TypeScript
├── vite.config.ts                     # Configurações do Vite (com Tailwind v4 e suporte PWA)
├── assets/                            # Ativos visuais estáticos e marcas
├── public/                            # Arquivos públicos servidos diretamente (incluindo manifest de PWA)
├── database/                          # Scripts SQL estruturais do banco de dados
│   ├── install.sql                    # DDL mestre para criação de tabelas e sementes estáticas
│   └── seed.sql                       # Massa de dados opcional para testes locais
├── scripts/                           # Scripts internos de parsing e análise
├── storage/                           # Armazenamento persistente físico para anexos e SQLite (pksig.db)
└── src/                               # Código fonte do frontend React
    ├── App.tsx                        # Componente React principal e controlador de visualização
    ├── index.css                      # Estilo global importando o Tailwind v4 e fontes
    ├── main.tsx                       # Inicializador da aplicação React no DOM
    ├── types.ts                       # Declarações e interfaces TypeScript compartilhadas
    ├── components/                    # Componentes modulares e telas principais do sistema
    │   ├── ClientDetails.tsx          # Detalhamento de cliente e seus equipamentos/OS
    │   ├── ClientList.tsx             # Listagem, busca e cadastro de novos clientes
    │   ├── Dashboard.tsx              # Resumo operacional, cartões de métricas e gráficos Recharts
    │   ├── Finance.tsx                # Gestão financeira de contas, fluxo de caixa e parcelas
    │   ├── Login.tsx                  # Interface de login para administradores
    │   ├── PwaStatusDashboard.tsx     # Painel de sincronização, fila de cache e controle offline
    │   ├── ServiceOrderDetails.tsx    # Orçamento, diagnóstico técnico, anexos e garantias da OS
    │   ├── ServiceOrderList.tsx       # Controle de ordens de serviço por status e busca
    │   ├── Settings.tsx               # Configurações do sistema, PWA, regras de garantia e backups
    │   └── SetupWizard.tsx            # Assistente gráfico inicial de conexão com banco de dados
    └── lib/                           # Serviços de apoio e utilitários
        ├── api.ts                     # Interceptador e injetor global de CSRF nos requests fetch
        ├── crypto.ts                  # Criptografia simétrica de dados sensíveis locais (ex: senha DB)
        ├── database.ts                # Camada híbrida e tradutor sintático MySQL -> SQLite
        ├── dataService.ts             # Motor de controle de cache IndexedDB (Dexie) e sincronizador PWA
        ├── dexieDb.ts                 # Schemas e tabelas locais no IndexedDB
        └── session.ts                 # Gerenciamento de tokens de sessão criptografados
```

---

## 3. Scripts Disponíveis no package.json

Os scripts configurados atualmente para automação são:

*   **`npm run dev`**: Executa o servidor TypeScript de desenvolvimento em tempo real utilizando o utilitário `tsx` diretamente sobre `server.ts`.
*   **`npm run build`**: Compila os ativos estáticos do frontend via `vite build` gerando arquivos na pasta `dist/`, e empacota o backend `server.ts` em um arquivo CJS autônomo e de alta performance (`dist/server.cjs`) utilizando `esbuild`.
*   **`npm start`**: Inicializa o servidor Express compilado em produção diretamente de `dist/server.cjs`.
*   **`npm run clean`**: Remove a pasta `dist/` para assegurar compilações limpas.
*   **`npm run lint`**: Valida a sintaxe e os tipos TypeScript de forma estática no projeto inteiro através de `tsc --noEmit`.

---

## 4. Análise de Dependências

### Dependências Críticas e Utilizadas:
- **`mysql2`**: Essencial para conexão com servidores MySQL externos de produção.
- **`express` & `@types/express`**: Servidor de rotas e orquestração de APIs.
- **`bcryptjs`**: Processamento criptográfico seguro de hashes de senhas administrativos.
- **`zod`**: Validação de todas as entradas de dados de APIs e formulários sensíveis.
- **`dexie`**: Banco IndexedDB local do cliente que permite o armazenamento offline.
- **`recharts`**: Renderização de gráficos visuais de fluxo de caixa e volumetria de ordens de serviço.
- **`lucide-react`**: Conjunto padronizado de ícones do sistema.
- **`motion`**: Orquestrador de transições e micro-animações nativas.
- **`multer` & `@types/multer`**: Gestão e controle de envio físico de arquivos.

### Dependências Ociosas ou Desnecessárias:
- **`dotenv`**: Pode ser incorporada de forma nativa a partir do Node.js v20.6+ usando a flag `--env-file` ou deixada para que o ambiente de container cuide da injeção. (Manteremos como suporte legada por segurança se necessário, mas pode ser simplificada).
- **`autoprefixer`**: Tailwind v4 possui seu próprio motor integrado de prefixagem de navegadores, tornando esta biblioteca redundante.

---

## 5. Módulos e Funcionalidades do Sistema

O sistema possui os seguintes fluxos e telas estruturados:

1.  **Assistente de Instalação (Setup Wizard)**: Redireciona usuários não configurados para um fluxo amigável de parametrização de banco de dados (SQLite local ou MySQL remoto).
2.  **Módulo de Autenticação**: Login administrativo simples com proteção contra ataques de força bruta baseado em registro de tentativas de login na tabela `login_attempts` e cookies HTTPOnly com tokens JWT.
3.  **Dashboard Operacional**: Exibição de cartões estatísticos rápidos de OSs ativas, receitas mensais, faturamento projetado e gráficos de movimentações diárias.
4.  **Módulo de Clientes**: Lista unificada com busca, filtros, cadastro completo PF/PJ com verificação de CPF/CNPJ e aba de histórico detalhado por cliente.
5.  **Módulo de Equipamentos**: Cadastro de ativos associados aos clientes com número de série, marca, modelo e tag de patrimônio.
6.  **Módulo de Ordens de Serviço (OS)**: Abertura de ordens de serviço com controle de status parametrizável, checklist de balcão (estado físico do equipamento, acessórios deixados), histórico de alterações de técnicos e diagnóstico avançado.
7.  **Orçamentos e Serviços**: Inclusão de peças, serviços e insumos na OS com cálculo matemático automático em tempo real no banco e interface.
8.  **Gestão Financeira**:
    -   Geração de **Guias de Pagamento** vinculadas à OS.
    -   Suporte a **Parcelamento estruturado** (controle de parcelas pendentes, pagas ou em atraso).
    -   Registro de **Movimentações de Caixa (Fluxo de Entrada e Saída)** de forma independente das OSs para controle do negócio.
9.  **Garantias**: Emissão e controle de termos de garantia física gerados de forma sequencial com base em regras por categoria de equipamento ou serviço prestado.
10. **Acessibilidade e PWA**: Painel de gerenciamento PWA, indicador de conectividade de rede, sincronização em segundo plano com controle de conflitos e fila local síncrona.

---

## 6. Riscos de Segurança e Problemas Atuais Identificados

Durante a auditoria, foram mapeadas as seguintes oportunidades de melhoria técnica:

1.  **Criptografia Local**: O arquivo `src/lib/crypto.ts` criptografa credenciais locais do banco usando um algoritmo simétrico. Isso é funcional, mas a chave secreta de criptografia deve ser rigorosamente armazenada em variáveis de ambiente, nunca fixa no código fonte.
2.  **Validações Duplicadas**: Algumas regras de validação de datas e valores monetários estão presentes no frontend, mas no backend faltavam travas correspondentes do Zod para evitar inserções inconsistentes (por exemplo, OSs com datas de promessa anteriores à data de entrada).
3.  **Consultas SQL Dinâmicas**: Apesar do uso intensivo de placeholders, as concatenações em buscas dinâmicas em algumas partes do Express legado devem ser monitoradas para evitar qualquer falha menor de injeção.
4.  **Código Morto**: Trechos de testes manuais e endpoints de prototipação que foram desativados, mas continuavam presentes em `server.ts`.
5.  **Abstração do SQLite**: O tradutor de sintaxe sintética (`translateMySqlToSqlite` em `src/lib/database.ts`) realiza conversões via expressões regulares para garantir que o mesmo script SQL de instalação (`install.sql`) funcione perfeitamente no SQLite local. Essa conversão é extremamente engenhosa e deve ser preservada e blindada com testes, mas requer organização cirúrgica para que novos scripts DDL também passem por ela sem engasgos.

---

## 7. Pontos Críticos a Serem Preservados

Determinados componentes são pilares do PKSIG e **devem ser preservados e aprimorados**, nunca descartados:

-   **Motor Híbrido de Banco de Dados**: A capacidade de rodar perfeitamente tanto no MySQL/MariaDB remoto quanto em SQLite local (`pksig.db`) utilizando a mesma base de código.
-   **Tradutor SQL de Banco**: A função `translateMySqlToSqlite` que viabiliza a execução de DDLs mestre no SQLite sem que o desenvolvedor tenha que manter dois scripts paralelos.
-   **Motor de Integridade & Auto-reparo (Self-Healing)**: O processo de verificação sistemática na inicialização que garante que tabelas e colunas recém-adicionadas (como colunas de PWA ou tabelas financeiras) sejam criadas automaticamente, evitando que atualizações do git quebrem bases de dados antigas dos clientes.
-   **Arquitetura Offline-First (PWA/Dexie.js)**: A fantástica camada de sincronização em segundo plano e resolução de conflitos implementada no `dataService.ts`, que garante o funcionamento sem internet de forma robusta e com identificadores sequenciais temporários convertidos para os oficiais após o envio.
