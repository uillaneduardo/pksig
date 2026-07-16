# Decisões Pendentes — Arquitetura PKSIG

Este documento registra dúvidas técnicas ou de usabilidade identificadas durante a auditoria de código do sistema PKSIG. Para cada ponto, apresentamos as alternativas possíveis, os prós e contras e a recomendação técnica para aprovação do cliente.

---

## Decisão 1: Abordagem para Versionamento de Banco de Dados e Migrations

O sistema atual realiza correções incrementais em tempo real na inicialização (Self-Healing) adicionando colunas ou tabelas individuais por meio de funções `ensureColumn` ou `ensureTable` escritas no Express.

*   **Opção A: Manter o Motor de Inicialização com Correções Diretas (Atual)**
    *   *Prós*: Extremamente simples, funciona no SQLite e MySQL de forma síncrona sem precisar de CLI extra ou dependências adicionais de migração pesadas.
    *   *Contras*: Se torna difícil de rastrear em equipes maiores e pode poluir o código de inicialização do servidor com dezenas de checagens manuais de colunas.
*   **Opção B: Adotar uma Tabela de Versionamento de Migrations (`schema_migrations`) (RECOMENDADA)**
    *   *Prós*: Padrão profissional de mercado. Criamos uma pasta `/database/migrations/` contendo arquivos SQL ordenados por timestamp (Ex: `1705643928_add_pwa_columns.sql`). O sistema lê essa pasta na inicialização, executa os scripts pendentes de forma atômica dentro de uma transação e registra o carimbo na tabela `schema_migrations`.
    *   *Contras*: Exige que o tradutor sintático SQL (`translateMySqlToSqlite`) continue funcionando perfeitamente sobre as migrations para que o SQLite também as compreenda, o que já é suportado de forma engenhosa no sistema.
*   **Decisão Recomendada**: **Opção B**. Ela unifica as duas abordagens, trazendo o profissionalismo de migrations versionadas e mantendo a simplicidade de execução automática sem obrigar o cliente final a rodar CLIs complexas no terminal do Ubuntu 24.04.

---

## Decisão 2: Centralização de Validação de Dados de Entrada no Backend

Atualmente, alguns formulários validam formatos de dados (como datas, CPF/CNPJ e limites monetários) de forma exclusiva no cliente React ou de maneira diluída no backend.

*   **Opção A: Validação Duplicada e Autônoma (Atual)**
    *   *Prós*: Implementação rápida e isolada em cada rota.
    *   *Contras*: Risco de dados corrompidos se um payload malformado for enviado diretamente para o endpoint de API ignorando o frontend.
*   **Opção B: Middleware de Validação Centralizado com Zod (RECOMENDADA)**
    *   *Prós*: Segurança absoluta. Criamos esquemas declarativos Zod no arquivo `/src/types.ts` ou pasta de esquemas do backend, e aplicamos um middleware Express genérico `validateBody(schema)` que retorna erro `422 (Unprocessable Entity)` com os detalhes exatos e mensagens em português se o payload violar qualquer regra.
    *   *Contras*: Pequeno tempo adicional de setup inicial para mapear todos os payloads.
*   **Decisão Recomendada**: **Opção B**. Reduz drasticamente a quantidade de código repetitivo de validação manual nas rotas Express e blinda o banco de dados contra inserções inconsistentes, garantindo a robustez desejada na reconstrução.

---

## Decisão 3: Gestão de Conflitos na Sincronização Offline (PWA)

Atualmente, se um item falha por conflito de versão, ele é inserido na tabela local `syncConflicts`. No entanto, a interface de decisão manual de conflitos precisa ser unificada.

*   **Opção A: Modal de Resolução de Conflitos sob Demanda**
    *   *Prós*: Alerta o usuário imediatamente quando a rede é reestabelecida e um conflito é detectado.
    *   *Contras*: Pode interromper o fluxo de trabalho do operador de forma inconveniente se ele estiver preenchendo outra OS.
*   **Opção B: Painel de Diagnóstico na Tela de Configurações (RECOMENDADA)**
    *   *Prós*: Mantém uma notificação silenciosa discreta no menu (Ex: "⚠️ 1 conflito pendente") e permite ao usuário abrir uma interface dedicada em configurações a qualquer momento para comparar as versões "Local" e "Servidor" lado a lado e escolher qual reter.
    *   *Contras*: Exige que o usuário se lembre de ir até as configurações para resolver o conflito.
*   **Decisão Recomendada**: **Opção B**. Proporciona uma experiência do usuário muito mais fluida e segura, sem interrupções abruptas na oficina técnica.
