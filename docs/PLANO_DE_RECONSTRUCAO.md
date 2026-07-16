# Plano de Reconstrução do PKSIG

Este documento apresenta o planejamento detalhado das fases de desenvolvimento para a refatoração e reconstrução progressiva do sistema **PKSIG**. O projeto foi dividido em ciclos de tamanho gerenciável, focados na simplicidade, correção e manutenção da integridade dos dados existentes.

---

## 📅 Visão Geral do Cronograma

```text
┌────────────────────────────────────────────────────────┐
│  Fase 1: Base da Arquitetura, Ambientes & Migrations  │◄── Estamos aqui
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  Fase 2: Autenticação & Sessão Segura (JWT & Brute)    │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  Fase 3: Layout, Navegação Unificada & Configurações   │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  Fase 4: Módulos de Clientes & Equipamentos (Ativos)   │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  Fase 5: Ordens de Serviço (Checklist, Status & Logs)  │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  Fase 6: Financeiro (Orçamentos, Parcelas & Caixa)     │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  Fase 7: Garantias, Emissões & Impressão A4 Otimizada  │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  Fase 8: Offline-First, PWA & Resolução de Conflitos   │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│  Fase 9: Documentação Técnica de Produção & Ajustes    │
└────────────────────────────────────────────────────────┘
```

---

## 🛠️ Detalhamento das Fases

### Fase 1: Base da Arquitetura, Ambientes e Migrations
*   **Objetivo**: Estruturar os alicerces do projeto, organizar as variáveis de ambiente, implementar o novo sistema de migração versionada automática (`schema_migrations`), garantindo a compatibilidade de execução do SQLite síncrono e MySQL através do tradutor DDL.
*   **Arquivos que serão criados ou alterados**:
    *   Criar `/database/migrations/` e as primeiras migrations base de instalação.
    *   Alterar `/src/lib/database.ts` para suportar o controle e checagem da tabela `schema_migrations`.
    *   Atualizar `.env.example` com validações robustas na inicialização de `server.ts`.
    *   Atualizar os scripts no `package.json` para suportar comandos de banco previsíveis.
*   **Tabelas afetadas**: Criação das tabelas `schema_migrations` e tabelas mestre do sistema (`app_meta`, `system_settings`, `sequences`).
*   **Migrations necessárias**: Sim, a migration inicial `001_initial_schema.sql` (que encapsula o script `install.sql`).
*   **Funcionalidades entregues**: Inicialização segura e robusta do backend Express com validação estrita de portas, validação das variáveis do `.env`, e migração transparente do banco de dados na inicialização do servidor.
*   **Testes necessários**: Testar se o servidor inicia corretamente sem `.env` (deve dar erro explicativo) e se cria o banco SQLite `pksig.db` perfeitamente no primeiro boot.
*   **Riscos**: Nenhum. É a base isolada do sistema.
*   **Comandos de execução**:
    ```bash
    npm run lint
    npm run build
    npm run dev
    ```

---

### Fase 2: Autenticação e Sessão Segura
*   **Objetivo**: Implementar o fluxo completo de login para administradores com tokens JWT contidos em cookies HTTPOnly e proteção anti-força bruta.
*   **Arquivos que serão criados ou alterados**:
    *   `/server.ts` (rotas de auth e middleware `authenticateToken`).
    *   `/src/lib/session.ts` (gerenciamento de tokens).
    *   `/src/components/Login.tsx` (interface refinada de autenticação).
*   **Tabelas afetadas**: `admins`, `admin_sessions`, `login_attempts`.
*   **Migrations necessárias**: Sim, migration `002_authentication_schema.sql`.
*   **Funcionalidades entregues**: Tela de login segura, cookies seguros HTTPOnly contra ataques XSS, expiração automática de sessão por ociosidade e bloqueio de IPs após erros recorrentes.
*   **Testes necessários**: Tentar logar com dados inválidos 5 vezes consecutivas para validar o bloqueio. Verificar se o cookie JWT é anexado de forma HTTPOnly nas respostas.
*   **Riscos**: Desconexão temporária se as chaves JWT não estiverem configuradas no `.env`.

---

### Fase 3: Layout, Navegação Unificada e Configurações Gerais
*   **Objetivo**: Estruturar a moldura da aplicação React (sidebar para desktop, bottom bar para celular) e as telas de configurações globais e do setup de inicialização (SetupWizard).
*   **Arquivos que serão criados ou alterados**:
    *   `/src/App.tsx` (controlador de rotas e layout responsivo).
    *   `/src/components/Settings.tsx` (painel de configurações corporativas e parâmetros de garantia).
    *   `/src/components/SetupWizard.tsx` (instalador gráfico do banco de dados).
*   **Tabelas afetadas**: `system_settings`.
*   **Migrations necessárias**: Não.
*   **Funcionalidades entregues**: Interface fluida com animações Motion, responsividade nativa para dispositivos móveis, e controle visual de personalização de dados da assistência técnica.
*   **Testes necessários**: Redimensionar a tela para o modo mobile e testar a barra inferior de navegação por toque.
*   **Riscos**: Quebras visuais menores de layout caso o CSS global não esteja com resets corretos.

---

### Fase 4: Cadastro de Clientes e Equipamentos
*   **Objetivo**: Implementar as telas de cadastro e gestão de clientes (Pessoa Física e Pessoa Jurídica) e seus respectivos ativos.
*   **Arquivos que serão criados ou alterados**:
    *   `/src/components/ClientList.tsx` e `/src/components/ClientDetails.tsx`.
    *   Endpoints de API para `/api/clients` e `/api/equipments`.
*   **Tabelas afetadas**: `clients`, `equipments`, `equipment_categories`.
*   **Migrations necessárias**: Sim, `003_clients_and_equipments.sql`.
*   **Funcionalidades entregues**: Cadastro robusto, validação de CPF/CNPJ com mensagens claras, pesquisa rápida em tempo real, e visualização detalhada do histórico de ativos do cliente.
*   **Testes necessários**: Tentar cadastrar um cliente com CPF inválido ou duplicado (deve retornar erro de validação).
*   **Riscos**: Inconsistências de busca caso os índices do banco não estejam performáticos.

---

### Fase 5: Ordens de Serviço (Checklist e Esteira de Status)
*   **Objetivo**: Construir a engrenagem principal do sistema: abertura de OS, checklist estético e acessórios de balcão, esteira operacional de status e gravação de histórico técnico.
*   **Arquivos que serão criados ou alterados**:
    *   `/src/components/ServiceOrderList.tsx` e `/src/components/ServiceOrderDetails.tsx`.
    *   Rotas `/api/service-orders` e `/api/service-orders/:id/history`.
*   **Tabelas afetadas**: `service_orders`, `service_order_statuses`, `service_order_history`.
*   **Migrations necessárias**: Sim, `004_service_orders_schema.sql`.
*   **Funcionalidades entregues**: Abertura de OS rápida vinculando cliente/equipamento, checklist interativo, alteração controlada de status operacionais e histórico imutável de eventos por OS.
*   **Testes necessários**: Avançar uma OS por todos os status e certificar-se de que os registros de histórico foram criados com o nome do técnico logado.
*   **Riscos**: Complexidade de concorrência se dois técnicos tentarem editar a mesma OS ao mesmo tempo (tratado via carimbo de data/hora).

---

### Fase 6: Financeiro Integrado e Fluxo de Caixa
*   **Objetivo**: Implementar o motor de orçamentos de OS, faturamento em guias financeiras, geração de carnê de parcelas e controle de fluxo de caixa independente.
*   **Arquivos que serão criados ou alterados**:
    *   `/src/components/Finance.tsx` (fluxo de caixa, receitas e despesas).
    *   Rotas `/api/budget-items`, `/api/payment-guides` e `/api/payments`.
*   **Tabelas afetadas**: `budget_items`, `payment_guides`, `payment_installments`, `payments`, `financial_categories`.
*   **Migrations necessárias**: Sim, `005_financial_schema.sql`.
*   **Funcionalidades entregues**: Linhas de peças e serviços na OS com cálculo de total líquido automático, divisão de parcelas com resíduo decimal amortizado, controle de vencimentos e conciliação bancária simples.
*   **Testes necessários**: Testar o parcelamento de R$ 100,00 em 3 parcelas e validar se a soma exata é R$ 100,00 e o resíduo foi atribuído à primeira parcela.
*   **Riscos**: Cálculos de arredondamento de floats JavaScript (resolvidos utilizando armazenamento em decimais e truncando a duas casas decimais).

---

### Fase 7: Garantias Contratuais e Impressão A4 Otimizada
*   **Objetivo**: Automatizar a emissão de certificados de garantia na entrega das ordens de serviço e desenvolver as interfaces limpas para impressão física em folhas A4.
*   **Arquivos que serão criados ou alterados**:
    *   Estilos em `/src/index.css` (regras específicas de `@media print`).
    *   Rotas `/api/warranties`.
*   **Tabelas afetadas**: `warranties`, `warranty_rules`.
*   **Migrations necessárias**: Sim, `006_warranties_schema.sql`.
*   **Funcionalidades entregues**: Emissão automatizada de termos de garantia ao mudar OS para "Entregue", cálculo de expiração com base em regras configuráveis, e botões de impressão direta para via de recebimento, faturas e garantias.
*   **Testes necessários**: Imprimir uma OS e visualizar o layout final no preview de impressão do navegador (garantindo que menus e botões foram devidamente ocultados).
*   **Riscos**: Incompatibilidades pontuais de renderização do print em navegadores legados (mitigadas com Tailwind standard e seletores genéricos).

---

### Fase 8: Offline-First e Sincronização PWA
*   **Objetivo**: Consolidar a arquitetura offline utilizando IndexedDB (Dexie) e sincronização resiliente em segundo plano, incluindo o controle visual refinado de resolução de conflitos de dados.
*   **Arquivos que serão criados ou alterados**:
    *   `/src/lib/dataService.ts` e `/src/lib/dexieDb.ts` (revisão e refatoração do motor de sincronização).
    *   `/src/components/PwaStatusDashboard.tsx` (painel de controle offline).
*   **Tabelas afetadas**: Nenhuma diretamente no banco de dados físico, apenas no IndexedDB local do navegador.
*   **Migrations necessárias**: Não.
*   **Funcionalidades entregues**: Funcionamento autônomo sem internet para cadastros, fila síncrona com conversão dinâmica de IDs temporários para IDs definitivos do banco de dados, e painel de controle de conflitos de sincronização.
*   **Testes necessários**: Simular o estado "Offline" pelo DevTools do navegador, cadastrar um cliente e um equipamento, retornar ao modo "Online" e certificar-se de que o sincronizador atualizou os dados físicos com os IDs gerados pelo Express.
*   **Riscos**: Conflitos de chaves estrangeiras se o fluxo cronológico não for seguido rigorosamente.

---

### Fase 9: Documentação Técnica Final, Changelog e Instruções de Deploy
*   **Objetivo**: Gerar todos os guias operacionais finais, consolidar o Changelog e fornecer scripts de backup e restauração automatizados para o Ubuntu 24.04.
*   **Arquivos que serão criados ou alterados**:
    *   `/docs/INSTALACAO.md`, `/docs/DESENVOLVIMENTO.md`, `/docs/ATUALIZACAO.md`, `/docs/BANCO_DE_DADOS.md`, `/docs/DEPLOY.md`, `/docs/SOLUCAO_DE_PROBLEMAS.md` e `/CHANGELOG.md`.
*   **Tabelas afetadas**: Nenhuma.
*   **Migrations necessárias**: Não.
*   **Funcionalidades entregues**: Kit completo de documentação e manuais de administração do sistema.
*   **Testes necessários**: Revisão ortográfica e de sintaxe de todos os arquivos markdown criados.
*   **Riscos**: Desatualização de comandos menores caso o ambiente mude.
