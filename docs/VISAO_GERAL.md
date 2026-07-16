# Visão Geral do Sistema PKSIG

## 1. Objetivo do PKSIG

O **PKSIG (Sistema de Gerenciamento de Ordens de Serviço e TI)** é uma plataforma web full-stack, leve e de alto desempenho, desenvolvida especificamente para assistências técnicas de eletrônicos, computadores, celulares e provedores de suporte de TI.

O principal objetivo do PKSIG é centralizar e otimizar toda a rotina de atendimento de balcão, diagnóstico técnico, elaboração de orçamentos, faturamento de ordens de serviço, controle de garantias e monitoramento de movimentações financeiras diárias, mantendo-se como uma aplicação monolítica de baixíssimo custo de infraestrutura, fácil instalação e suporte operacional contínuo (incluindo funcionamento sem conectividade de rede).

---

## 2. Tipos de Usuários

O sistema adota uma estrutura de controle simplificada focada em papéis de gerenciamento de assistência técnica:

1.  **Administrador do Sistema**:
    *   Controle total das configurações de identidade corporativa (Logotipo, Razão Social, CNPJ, dados de contato).
    *   Gestão de usuários, credenciais e redefinição de senhas.
    *   Parametrização das regras de negócios globais (porcentagem de impostos padrão, dias de atraso limite de alertas, regras e prazos de garantia).
    *   Parametrização das tabelas de apoio (Adicionar ou inativar categorias de equipamentos, acessórios de recepção e métodos de faturamento).
    *   Acesso a auditorias e relatórios financeiros consolidados de receitas, saídas e rentabilidade.
2.  **Operador / Técnico da Oficina**:
    *   Visualização e gestão de ordens de serviço em andamento.
    *   Lançamento de diagnósticos, checklist de recepção de balcão e status do equipamento.
    *   Inclusão de peças necessárias, insumos de mão de obra e serviços prestados no orçamento de cada OS.
    *   Registro de alteração de status operacional (Aguardando Peça, Em Manutenção, Pronta).
    *   Impressão de vias de atendimento físicas para o cliente (A4).

---

## 3. Módulos e Escopo do Sistema

O PKSIG é estruturado nos seguintes macro-módulos funcionais:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                                PKSIG                                    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      ▼                              ▼                              ▼
┌───────────┐                  ┌───────────┐                  ┌───────────┐
│ CADASTROS │                  │ OPERAÇÕES │                  │FINANCEIRO │
├───────────┤                  ├───────────┤                  ├───────────┤
│ Clientes  │                  │ Entrada   │                  │ Guias OS  │
│ PF / PJ   │                  │ Checklist │                  │ Parcelas  │
│ Equipam.  │                  │ Orçamento │                  │ Transações│
│ Categorias│                  │ Garantias │                  │ Caixa     │
└───────────┘                  └───────────┘                  └───────────┘
```

### A. Módulo de Cadastros Base
*   **Clientes (PF/PJ)**: Central de histórico onde cada cliente possui suas informações pessoais (Nome, CPF/CNPJ, Contatos, Endereço completo) e histórico de ordens de serviço e termos de garantia emitidos.
*   **Equipamentos**: Rastreamento individual do hardware por Marca, Modelo, Número de Série e Tag de Patrimônio, prevenindo trocas acidentais de peças e mantendo o histórico de reparos do ativo.
*   **Tabelas de Apoio**: Cadastro e controle de categorias de hardware (Notebooks, Smartphones, Impressoras) e acessórios padrão que costumam acompanhar o equipamento (Carregadores, Cabos, Baterias).

### B. Módulo de Atendimento e Oficina (OS)
*   **Abertura e Checklist**: Registro de entrada descrevendo o problema relatado, estado físico exterior do equipamento (arranhões, trincas) e os acessórios deixados.
*   **Gestão de Status**: Linha do tempo visual do processo técnico (Recebida -> Em Análise -> Aguardando Aprovação -> Aguardando Peça -> Em Manutenção -> Pronta -> Entregue -> Cancelada).
*   **Laudo Técnico e Orçamento**: Área específica para inclusão de horas trabalhadas, serviços e peças utilizadas no reparo com controle de descontos e taxas de serviço.

### C. Módulo Financeiro e Fluxo de Caixa
*   **Guias de Faturamento**: Documentos financeiros gerados de forma automática a partir dos orçamentos aprovados de OS.
*   **Parcelamentos**: Divisão automática de guias em parcelas com prazos de vencimento ajustáveis de acordo com a regra de faturamento escolhida.
*   **Fluxo de Caixa**: Registro independente de entradas e despesas diárias de manutenção da oficina física (Compra de peças em atacado, aluguel, energia, salários).

### D. Módulo de Garantia e Documentação
*   **Regras e Termos**: Automação da geração de termos de garantia técnica baseados nos dias úteis especificados de acordo com a categoria de serviço.
*   **Impressão Otimizada**: Geração de PDFs e páginas prontas para impressão física em formato A4 das ordens de serviço e faturas financeiras.

### E. Módulo PWA e Resiliência Síncrona
*   **Funcionamento Offline**: Cache integral de interfaces e consultas locais.
*   **Fila de Sincronização Síncrona**: Enfileiramento de cadastros e modificações efetuados pelo técnico em visitas ou momentos de instabilidade de internet, com sincronizador de segundo plano que traduz chaves temporárias em chaves primárias do banco físico.
